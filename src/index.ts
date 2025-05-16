import type { Entry, RateLimitConfig, RateLimitResult, StoreKey } from "./types";

/**
 * Default configuration: 60 requests per 60 seconds.
 */
const DEFAULT_CONFIG: Readonly<RateLimitConfig> = {
	window: 60_000,
	max: 60,
	enableCleanup: true,
	cleanupInterval: 30_000,
};

/**
 * A simple in-memory rate limiter.
 *
 * Allows tracking request counts per endpoint and identifier (e.g. IP, username),
 * and determines whether the rate limit has been exceeded.
 */
export class RateLimiter {
	/**
	 * Internal store for tracking request entries.
	 */
	private readonly store: Map<StoreKey, Entry> = new Map();

	/**
	 * The active configuration for this rate limiter instance.
	 */
	private readonly config: Readonly<RateLimitConfig>;

	/**
	 * Timer for periodic cleanup of expired entries.
	 */
	private cleanupInterval?: NodeJS.Timeout;

	/**
	 * Creates a new rate limiter instance.
	 *
	 * @param config Optional custom configuration (max requests, window duration, cleanup interval)
	 */
	constructor(config: Partial<RateLimitConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };

		if (this.config.enableCleanup) {
			this.setupCleanupInterval(this.config.cleanupInterval || 30_000);
		}
	}

	/**
	 * Sets up the periodic cleanup of expired entries.
	 * @param intervalMs Cleanup interval in milliseconds
	 */
	private setupCleanupInterval(intervalMs: number): void {
		this.cleanupInterval = setInterval(() => {
			this.cleanupExpiredEntries();
		}, intervalMs).unref?.();
	}

	/**
	 * Cleans up expired entries from the store.
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
	 * Creates a new rate limit entry.
	 * @param now Current timestamp in milliseconds
	 * @returns A new rate limit entry
	 */
	private createNewEntry(now: number): Entry {
		return {
			count: 0,
			resetTime: now + this.config.window,
		};
	}

	/**
	 * Check if a given `identifier` is rate-limited for a specific `endpoint`.
	 *
	 * @param endpoint The API endpoint being accessed (e.g., "/api/login").
	 * @param identifier A unique string representing the caller (e.g., IP or user ID).
	 * @returns Object containing rate limit information
	 */
	public check(endpoint: string, identifier: string): RateLimitResult {
		const now = Date.now();
		const key = this.generateKey(endpoint, identifier);
		const entry = this.getOrCreateEntry(key, now);

		entry.count += 1;
		this.store.set(key, entry);

		return this.createRateLimitResult(entry);
	}

	/**
	 * Generates a store key from endpoint and identifier.
	 * @param endpoint The API endpoint
	 * @param identifier The caller identifier
	 * @returns The generated store key
	 */
	private generateKey(endpoint: string, identifier: string): StoreKey {
		return `${endpoint}:${identifier}`;
	}

	/**
	 * Gets an existing entry or creates a new one if it doesn't exist or is expired.
	 * @param key The store key
	 * @param now Current timestamp in milliseconds
	 * @returns The entry
	 */
	private getOrCreateEntry(key: StoreKey, now: number): Entry {
		const existingEntry = this.store.get(key);
		if (!existingEntry || existingEntry.resetTime <= now) {
			return this.createNewEntry(now);
		}
		return { ...existingEntry };
	}

	/**
	 * Creates a rate limit result object.
	 * @param entry The current entry
	 * @returns The rate limit result
	 */
	private createRateLimitResult(entry: Entry): RateLimitResult {
		const limited = entry.count > this.config.max;
		const remaining = Math.max(this.config.max - entry.count, 0);

		return {
			limited,
			remaining,
			reset: entry.resetTime,
			current: entry.count,
			limit: this.config.max,
			window: this.config.window,
		};
	}

	/**
	 * Clears the rate limiter store and stops the cleanup interval.
	 */
	public clear(): void {
		this.store.clear();
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = undefined;
		}
	}

	/**
	 * Gets the current size of the store (number of tracked keys).
	 * @returns The number of entries in the store
	 */
	public getSize(): number {
		return this.store.size;
	}
}

export type { RateLimitConfig, RateLimitResult };
