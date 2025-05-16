/**
 * The result of a rate limit check.
 */
export type RateLimitResult = {
	/**
	 * Indicates whether the identifier has exceeded the rate limit.
	 */
	limited: boolean;
	/**
	 * Number of remaining allowed requests within the current window.
	 */
	remaining: number;
	/**
	 * Timestamp (in milliseconds since epoch) when the rate limit window resets.
	 */
	reset: number;
};
/**
 * Configuration options for the rate limiter.
 */
export type RateLimitConfig = {
	/**
	 * Duration of the rate limit window in milliseconds.
	 * Example: 60_000 for 1 minute.
	 */
	windowMs: number;
	/**
	 * Maximum number of requests allowed per window.
	 */
	max: number;
};
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
/**
 * Optional extended config to include cleanup interval.
 */
export interface ExtendedRateLimitConfig extends RateLimitConfig {
	/**
	 * Interval in milliseconds to purge old rate limit entries.
	 * Defaults to 30_000ms (30 seconds)
	 */
	cleanupIntervalMs?: number;
}
/**
 * A simple in-memory rate limiter.
 *
 * Allows tracking request counts per endpoint and identifier (e.g. IP, username),
 * and determines whether the rate limit has been exceeded.
 */
export declare class RateLimiter {
	/**
	 * Internal store for tracking request entries.
	 * The key is a string composed of endpoint + identifier.
	 */
	store: Map<StoreKey, Entry>;
	/**
	 * The active configuration for this rate limiter instance.
	 */
	config: RateLimitConfig;
	/**
	 * Creates a new rate limiter instance.
	 *
	 * @param config Optional custom configuration (max requests, window duration, cleanup interval)
	 */
	constructor(config?: Partial<ExtendedRateLimitConfig>);
	/**
	 * Check if a given `identifier` is rate-limited for a specific `endpoint`.
	 *
	 * @param endpoint The API endpoint being accessed (e.g., "/api/login").
	 * @param identifier A unique string representing the caller (e.g., IP or user ID).
	 * @returns Object containing whether the identifier is rate limited, how many requests remain, and when the window resets.
	 */
	check(endpoint: string, identifier: string): RateLimitResult;
}

export {};
