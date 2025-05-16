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
	 * Duration of the rate limit window in milliseconds.
	 * @default 60000 (1 minute)
	 */
	readonly window: number;
	/**
	 * Maximum number of requests allowed per window.
	 * @default 60
	 */
	readonly max: number;
	/**
	 * Interval in milliseconds to purge old rate limit entries.
	 * @default 30000 (30 seconds)
	 */
	readonly cleanupInterval?: number;
	/**
	 * Whether to enable the cleanup interval.
	 * @default true
	 */
	readonly enableCleanup?: boolean;
}

/**
 * A unique key used to identify a specific rate limit bucket.
 * Typically a combination of endpoint and identifier (e.g. IP or username).
 */
export type StoreKey = string;

/**
 * An internal structure representing a tracked request entry.
 */
export interface Entry {
	/**
	 * Number of requests made in the current window.
	 */
	count: number;
	/**
	 * Timestamp (in milliseconds since epoch) when the current window resets.
	 */
	resetTime: number;
}
