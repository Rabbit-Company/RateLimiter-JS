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
	algorithm?: Algorithm;
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
 * Type for keys used in the rate limit store.
 * Format: "endpoint:identifier"
 */
export type StoreKey = string;

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
export enum Algorithm {
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
	TOKEN_BUCKET = "TOKEN_BUCKET",
}
