import { Algorithm, type Entry, type RateLimitConfig, type RateLimitResult, type StoreKey } from "./types";

/**
 * Default rate limiter configuration:
 * - Fixed window algorithm
 * - 60 requests per 60 seconds window
 * - Token bucket refill rate of 1 token per second (when used)
 * - 100ms precision for sliding window
 * - Automatic cleanup every 30 seconds
 */
const DEFAULT_CONFIG: Readonly<RateLimitConfig> = {
	algorithm: Algorithm.FIXED_WINDOW,
	window: 60_000,
	max: 60,
	refillRate: 1,
	refillInterval: 1000,
	precision: 100,
	enableCleanup: true,
	cleanupInterval: 30_000,
};

/**
 * A configurable in-memory rate limiter supporting multiple algorithms.
 *
 * @example
 * // Fixed window: 100 requests per minute
 * const limiter = new RateLimiter({ max: 100, window: 60_000 });
 *
 * @example
 * // Sliding window: 50 requests per 30 seconds
 * const limiter = new RateLimiter({
 *   algorithm: Algorithm.SLIDING_WINDOW,
 *   max: 50,
 *   window: 30_000
 * });
 *
 * @example
 * // Token bucket: Burst of 10, sustained 2 requests per second
 * const limiter = new RateLimiter({
 *   algorithm: Algorithm.TOKEN_BUCKET,
 *   max: 10,
 *   refillRate: 2,
 *   refillInterval: 1000
 * });
 */
export class RateLimiter {
	/**
	 * Internal store for tracking rate limit entries.
	 * @private
	 */
	private readonly store: Map<StoreKey, Entry> = new Map();

	/**
	 * The active configuration for this rate limiter instance.
	 * Merges user-provided config with defaults.
	 * @private
	 */
	private readonly config: Readonly<RateLimitConfig>;

	/**
	 * Timer for periodic cleanup of expired entries.
	 * @private
	 */
	private cleanupInterval?: NodeJS.Timeout;

	/**
	 * Creates a new rate limiter instance with optional configuration.
	 * @param config - Custom configuration overrides
	 *
	 * @example
	 * // Basic fixed window
	 * new RateLimiter({ max: 100, window: 60_000 });
	 *
	 * @example
	 * // Token bucket with custom refill
	 * new RateLimiter({
	 *   algorithm: Algorithm.TOKEN_BUCKET,
	 *   max: 20,
	 *   refillRate: 5,
	 *   refillInterval: 2000
	 * });
	 */
	constructor(config: Partial<RateLimitConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };

		if (this.config.enableCleanup) {
			this.setupCleanupInterval(this.config.cleanupInterval!);
		}
	}

	/**
	 * Initializes the periodic cleanup of expired entries.
	 * @param intervalMs - How often to run cleanup in milliseconds
	 * @private
	 */
	private setupCleanupInterval(intervalMs: number): void {
		this.cleanupInterval = setInterval(() => {
			this.cleanupExpiredEntries();
		}, intervalMs).unref?.();
	}

	/**
	 * Removes expired entries from the store based on their resetTime.
	 * @private
	 */
	private cleanupExpiredEntries(): void {
		const now = Date.now();
		for (const [key, entry] of this.store.entries()) {
			if (entry.resetTime <= now) {
				this.store.delete(key);
			}
		}
	}

	/**
	 * Creates a new rate limit entry with default values.
	 * @param now - Current timestamp in milliseconds
	 * @returns New entry initialized for the current window
	 * @private
	 */
	private createNewEntry(now: number): Entry {
		return {
			count: 0,
			resetTime: now + this.config.window!,
		};
	}

	/**
	 * Checks if a request should be rate limited for the given endpoint and identifier.
	 *
	 * @param endpoint - The API endpoint being accessed (e.g., "/api/login")
	 * @param identifier - Unique caller identifier (e.g., IP address or user ID)
	 * @returns Rate limit status including remaining requests and reset time
	 *
	 * @example
	 * const result = limiter.check("/api/login", "192.168.1.1");
	 * if (result.limited) {
	 *   throw new Error(`Rate limited. Try again in ${Math.ceil((result.reset - Date.now())/1000)}s`);
	 * }
	 */
	public check(endpoint: string, identifier: string): RateLimitResult {
		const now = Date.now();
		const key = this.generateKey(endpoint, identifier);

		switch (this.config.algorithm) {
			case Algorithm.FIXED_WINDOW:
				return this.checkFixedWindow(key, now);
			case Algorithm.SLIDING_WINDOW:
				return this.checkSlidingWindow(key, now);
			case Algorithm.TOKEN_BUCKET:
				return this.checkTokenBucket(key, now);
			default:
				throw new Error(`Unknown algorithm: ${this.config.algorithm}`);
		}
	}

	/**
	 * Fixed window rate limit algorithm implementation.
	 * Simple counter that resets after each window.
	 * @private
	 */
	private checkFixedWindow(key: StoreKey, now: number): RateLimitResult {
		const entry = this.getOrCreateEntry(key, now);

		if (entry.resetTime <= now) {
			entry.count = 0;
			entry.resetTime = now + this.config.window!;
		}

		entry.count! += 1;

		this.store.set(key, entry);
		return this.createRateLimitResult(entry);
	}

	/**
	 * Sliding window rate limit algorithm implementation.
	 * Tracks exact request timestamps for more precise limiting.
	 * @private
	 */
	private checkSlidingWindow(key: StoreKey, now: number): RateLimitResult {
		let entry = this.store.get(key) || {
			count: 0,
			buckets: new Map<number, number>(),
			resetTime: now + this.config.window!,
		};

		const precision = this.config.precision!;
		const roundedNow = Math.floor(now / precision) * precision;

		// Remove timestamps outside the current window
		const windowStart = roundedNow - this.config.window!;
		let totalCount = 0;

		entry.buckets!.forEach((count, timestamp) => {
			if (timestamp > windowStart) {
				totalCount += count;
			} else {
				entry.buckets!.delete(timestamp);
			}
		});

		const currentCount = (entry.buckets!.get(roundedNow) || 0) + 1;
		entry.buckets!.set(roundedNow, currentCount);
		totalCount += 1;

		entry.count = totalCount;

		if (entry.buckets!.size > 0) {
			const oldestTimestamp = Math.min(...entry.buckets!.keys());
			entry.resetTime = oldestTimestamp + this.config.window!;
		} else {
			entry.resetTime = roundedNow + this.config.window!;
		}

		this.store.set(key, entry);
		return this.createRateLimitResult(entry);
	}

	/**
	 * Token bucket rate limit algorithm implementation.
	 * Allows bursts up to max capacity with steady refill rate.
	 * @private
	 */
	private checkTokenBucket(key: StoreKey, now: number): RateLimitResult {
		let entry = this.store.get(key) || {
			tokens: this.config.max!,
			lastRefill: now,
			resetTime: now + this.config.window!,
		};

		// Calculate how many tokens to add since last refill
		const timePassed = now - entry.lastRefill!;
		const tokensToAdd = Math.floor(timePassed / this.config.refillInterval!) * this.config.refillRate!;

		if (tokensToAdd > 0) {
			entry.tokens = Math.min(Math.max(entry.tokens! + tokensToAdd, tokensToAdd), this.config.max!);
			entry.lastRefill = now;
		}

		entry.tokens! -= 1;

		this.store.set(key, entry);
		return {
			...this.createRateLimitResult(entry),
			remaining: Math.max(Math.floor(entry.tokens!), 0),
		};
	}

	/**
	 * Generates a consistent store key from endpoint and identifier.
	 * @private
	 */
	private generateKey(endpoint: string, identifier: string): StoreKey {
		return `${endpoint}:${identifier}`;
	}

	/**
	 * Retrieves an existing entry or creates a new one if expired/missing.
	 * @private
	 */
	private getOrCreateEntry(key: StoreKey, now: number): Entry {
		const existingEntry = this.store.get(key);
		if (!existingEntry || existingEntry.resetTime <= now) {
			return this.createNewEntry(now);
		}
		return { ...existingEntry };
	}

	/**
	 * Formats the rate limit result based on the current entry state.
	 * @private
	 */
	private createRateLimitResult(entry: Entry): RateLimitResult {
		let limited: boolean;
		let remaining: number;
		let current: number;

		switch (this.config.algorithm) {
			case Algorithm.TOKEN_BUCKET:
				limited = entry.tokens! < 0;
				remaining = Math.max(Math.floor(entry.tokens!), 0);
				current = this.config.max! - entry.tokens!;
				break;

			case Algorithm.SLIDING_WINDOW:
				const now = Date.now();
				limited = entry.count! > this.config.max!;
				remaining = Math.max(this.config.max! - entry.count!, 0);
				current = entry.count!;
				break;

			case Algorithm.FIXED_WINDOW:
			default:
				limited = entry.count! > this.config.max!;
				remaining = Math.max(this.config.max! - entry.count!, 0);
				current = entry.count!;
				break;
		}

		return {
			limited,
			remaining,
			reset: entry.resetTime,
			current,
			limit: this.config.max!,
			window: this.config.window!,
		};
	}

	/**
	 * Clears all rate limit entries and stops automatic cleanup.
	 * Useful for testing or when shutting down the application.
	 */
	public clear(): void {
		this.store.clear();
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = undefined;
		}
	}

	/**
	 * Gets the current number of tracked rate limit entries.
	 * @returns Count of active entries being monitored
	 */
	public getSize(): number {
		return this.store.size;
	}

	/**
	 * Gets the current rate limit entry for a specific endpoint and identifier.
	 * Useful for debugging and monitoring rate limit states.
	 *
	 * @param endpoint - The API endpoint being accessed
	 * @param identifier - Unique caller identifier
	 * @returns The current rate limit entry or null if not found
	 *
	 * @example
	 * const entry = limiter.getEntry("/api/login", "192.168.1.1");
	 * console.log(entry);
	 */
	public getEntry(endpoint: string, identifier: string): Entry | null {
		const key = this.generateKey(endpoint, identifier);
		const entry = this.store.get(key);

		// Return a clone to prevent external modification
		return entry ? { ...entry } : null;
	}

	/**
	 * Gets the current rate limit status for a specific endpoint and identifier
	 * without counting it as a new request. Useful for checking rate limit status
	 * before making actual requests.
	 *
	 * @param endpoint - The API endpoint being accessed
	 * @param identifier - Unique caller identifier
	 * @returns Rate limit status including remaining requests and reset time
	 *
	 * @example
	 * const status = limiter.get("/api/login", "192.168.1.1");
	 * if (status.remaining > 0) {
	 *   // Safe to make request
	 * } else {
	 *   // Wait until status.reset
	 * }
	 */
	public get(endpoint: string, identifier: string): RateLimitResult {
		const key = this.generateKey(endpoint, identifier);
		const entry = this.store.get(key);

		const now = Date.now();
		const currentEntry = entry || this.createNewEntry(now);

		// For sliding window, we need to clean up old buckets first
		if (this.config.algorithm === Algorithm.SLIDING_WINDOW && entry?.buckets) {
			const precision = this.config.precision!;
			const roundedNow = Math.floor(now / precision) * precision;
			const windowStart = roundedNow - this.config.window!;

			// Clean up expired buckets and recalculate count
			let totalCount = 0;
			entry.buckets.forEach((count, timestamp) => {
				if (timestamp > windowStart) {
					totalCount += count;
				} else {
					entry.buckets!.delete(timestamp);
				}
			});
			entry.count = totalCount;

			// Update reset time if needed
			if (entry.buckets.size > 0) {
				entry.resetTime = Math.min(...entry.buckets.keys()) + this.config.window!;
			}
		}

		return this.createRateLimitResult(currentEntry);
	}
}

export { Algorithm };
export type { RateLimitConfig, RateLimitResult, Entry };
