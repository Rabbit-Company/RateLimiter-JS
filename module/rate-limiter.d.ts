/**
 * The result of a rate limit check.
 */
export interface RateLimitResult {
	/**
	 * Indicates whether the identifier has exceeded the rate limit.
	 */
	readonly limited: boolean;
	/**
	 * Number of remaining allowed requests within the current window.
	 */
	readonly remaining: number;
	/**
	 * Timestamp (in milliseconds since epoch) when the rate limit window resets.
	 */
	readonly reset: number;
	/**
	 * Current count of requests in the window.
	 */
	readonly current: number;
	/**
	 * Maximum allowed requests in the window.
	 */
	readonly limit: number;
	/**
	 * The rate limit window duration in milliseconds.
	 */
	readonly window: number;
}
/**
 * Configuration options for the rate limiter.
 */
export interface RateLimitConfig {
	/**
	 * The algorithm to use for rate limiting.
	 * @default Algorithm.FIXED_WINDOW
	 */
	algorithm?: Algorithm$1;
	/**
	 * Duration of the rate limit window in milliseconds.
	 * For token-bucket, this determines how long to wait when tokens are exhausted.
	 * @default 60000 (1 minute)
	 */
	window?: number;
	/**
	 * Maximum number of requests allowed per window (for fixed/sliding window)
	 * or maximum bucket capacity (for token bucket).
	 * @default 60
	 */
	max?: number;
	/**
	 * Interval in milliseconds to purge old/expired rate limit entries.
	 * Only applicable when enableCleanup is true.
	 * @default 30000 (30 seconds)
	 */
	cleanupInterval?: number;
	/**
	 * Whether to enable periodic cleanup of expired entries.
	 * Disable if you want to handle cleanup manually or through other means.
	 * @default true
	 */
	enableCleanup?: boolean;
	/**
	 * Token Bucket Specific:
	 * Number of tokens to add each refill interval.
	 * @default 1
	 */
	refillRate?: number;
	/**
	 * Token Bucket Specific:
	 * How often (in milliseconds) to add refillRate tokens.
	 * @default 1000 (1 second)
	 */
	refillInterval?: number;
	/**
	 * Sliding Window Specific:
	 * Storage precision - smaller values track more precise timestamps
	 * but use more memory. Represents milliseconds between stored timestamps.
	 * @default 100
	 */
	precision?: number;
}
/**
 * An internal structure representing a tracked request entry.
 * The specific fields used depend on the selected algorithm.
 */
export interface Entry {
	/**
	 * Number of requests made in the current window (used for fixed-window algorithm).
	 */
	count?: number;
	/**
	 * Map of request buckets for sliding-window algorithm.
	 * Keys are timestamps rounded to precision, values are request counts in that bucket.
	 */
	buckets?: Map<number, number>;
	/**
	 * Current number of available tokens (used for token-bucket algorithm).
	 */
	tokens?: number;
	/**
	 * Last time tokens were refilled (used for token-bucket algorithm).
	 * Milliseconds since epoch.
	 */
	lastRefill?: number;
	/**
	 * Timestamp (in milliseconds since epoch) when the current window resets.
	 * For sliding-window, this represents when the oldest request will expire.
	 */
	resetTime: number;
}
/**
 * Available rate limiting algorithms.
 */
declare enum Algorithm$1 {
	/**
	 * Simple counter within fixed time windows.
	 * Resets completely at the end of each window.
	 */
	FIXED_WINDOW = "FIXED_WINDOW",
	/**
	 * Tracks exact request timestamps within a rolling window.
	 * More precise but uses more memory.
	 */
	SLIDING_WINDOW = "SLIDING_WINDOW",
	/**
	 * Refills tokens at a steady rate, allowing bursts up to capacity.
	 * Smoothes traffic over time.
	 */
	TOKEN_BUCKET = "TOKEN_BUCKET"
}
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
export declare class RateLimiter {
	/**
	 * Internal store for tracking rate limit entries.
	 * @private
	 */
	private readonly store;
	/**
	 * The active configuration for this rate limiter instance.
	 * Merges user-provided config with defaults.
	 * @private
	 */
	private readonly config;
	/**
	 * Timer for periodic cleanup of expired entries.
	 * @private
	 */
	private cleanupInterval?;
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
	constructor(config?: Partial<RateLimitConfig>);
	/**
	 * Initializes the periodic cleanup of expired entries.
	 * @param intervalMs - How often to run cleanup in milliseconds
	 * @private
	 */
	private setupCleanupInterval;
	/**
	 * Removes expired entries from the store based on their resetTime.
	 * @private
	 */
	private cleanupExpiredEntries;
	/**
	 * Creates a new rate limit entry with default values.
	 * @param now - Current timestamp in milliseconds
	 * @returns New entry initialized for the current window
	 * @private
	 */
	private createNewEntry;
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
	check(endpoint: string, identifier: string): RateLimitResult;
	/**
	 * Fixed window rate limit algorithm implementation.
	 * Simple counter that resets after each window.
	 * @private
	 */
	private checkFixedWindow;
	/**
	 * Sliding window rate limit algorithm implementation.
	 * Tracks exact request timestamps for more precise limiting.
	 * @private
	 */
	private checkSlidingWindow;
	/**
	 * Token bucket rate limit algorithm implementation.
	 * Allows bursts up to max capacity with steady refill rate.
	 * @private
	 */
	private checkTokenBucket;
	/**
	 * Generates a consistent store key from endpoint and identifier.
	 * @private
	 */
	private generateKey;
	/**
	 * Retrieves an existing entry or creates a new one if expired/missing.
	 * @private
	 */
	private getOrCreateEntry;
	/**
	 * Formats the rate limit result based on the current entry state.
	 * @private
	 */
	private createRateLimitResult;
	/**
	 * Clears all rate limit entries and stops automatic cleanup.
	 * Useful for testing or when shutting down the application.
	 */
	clear(): void;
	/**
	 * Gets the current number of tracked rate limit entries.
	 * @returns Count of active entries being monitored
	 */
	getSize(): number;
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
	getEntry(endpoint: string, identifier: string): Entry | null;
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
	get(endpoint: string, identifier: string): RateLimitResult;
}

export {
	Algorithm$1 as Algorithm,
};

export {};
