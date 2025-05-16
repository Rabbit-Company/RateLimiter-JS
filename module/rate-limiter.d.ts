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
 * A simple in-memory rate limiter.
 *
 * Allows tracking request counts per endpoint and identifier (e.g. IP, username),
 * and determines whether the rate limit has been exceeded.
 */
export declare class RateLimiter {
	/**
	 * Internal store for tracking request entries.
	 */
	private readonly store;
	/**
	 * The active configuration for this rate limiter instance.
	 */
	private readonly config;
	/**
	 * Timer for periodic cleanup of expired entries.
	 */
	private cleanupInterval?;
	/**
	 * Creates a new rate limiter instance.
	 *
	 * @param config Optional custom configuration (max requests, window duration, cleanup interval)
	 */
	constructor(config?: Partial<RateLimitConfig>);
	/**
	 * Sets up the periodic cleanup of expired entries.
	 * @param intervalMs Cleanup interval in milliseconds
	 */
	private setupCleanupInterval;
	/**
	 * Cleans up expired entries from the store.
	 */
	private cleanupExpiredEntries;
	/**
	 * Creates a new rate limit entry.
	 * @param now Current timestamp in milliseconds
	 * @returns A new rate limit entry
	 */
	private createNewEntry;
	/**
	 * Check if a given `identifier` is rate-limited for a specific `endpoint`.
	 *
	 * @param endpoint The API endpoint being accessed (e.g., "/api/login").
	 * @param identifier A unique string representing the caller (e.g., IP or user ID).
	 * @returns Object containing rate limit information
	 */
	check(endpoint: string, identifier: string): RateLimitResult;
	/**
	 * Generates a store key from endpoint and identifier.
	 * @param endpoint The API endpoint
	 * @param identifier The caller identifier
	 * @returns The generated store key
	 */
	private generateKey;
	/**
	 * Gets an existing entry or creates a new one if it doesn't exist or is expired.
	 * @param key The store key
	 * @param now Current timestamp in milliseconds
	 * @returns The entry
	 */
	private getOrCreateEntry;
	/**
	 * Creates a rate limit result object.
	 * @param entry The current entry
	 * @returns The rate limit result
	 */
	private createRateLimitResult;
	/**
	 * Clears the rate limiter store and stops the cleanup interval.
	 */
	clear(): void;
	/**
	 * Gets the current size of the store (number of tracked keys).
	 * @returns The number of entries in the store
	 */
	getSize(): number;
}

export {};
