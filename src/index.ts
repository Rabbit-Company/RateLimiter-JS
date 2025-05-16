import type { Entry, ExtendedRateLimitConfig, RateLimitConfig, RateLimitResult, StoreKey } from "./types";

/**
 * Default configuration: 60 requests per 60 seconds.
 */
const defaultConfig: RateLimitConfig = {
	windowMs: 60 * 1000,
	max: 60,
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
	 * The key is a string composed of endpoint + identifier.
	 */
	store: Map<StoreKey, Entry> = new Map();

	/**
	 * The active configuration for this rate limiter instance.
	 */
	config: RateLimitConfig;

	/**
	 * Creates a new rate limiter instance.
	 *
	 * @param config Optional custom configuration (max requests, window duration, cleanup interval)
	 */
	constructor(config?: Partial<ExtendedRateLimitConfig>) {
		this.config = { ...defaultConfig, ...config };

		const cleanupInterval = config?.cleanupIntervalMs ?? 30_000;

		setInterval(() => {
			const now = Date.now();
			for (const [key, entry] of this.store.entries()) {
				if (entry.resetTime < now) {
					this.store.delete(key);
				}
			}
		}, cleanupInterval).unref();
	}

	/**
	 * Check if a given `identifier` is rate-limited for a specific `endpoint`.
	 *
	 * @param endpoint The API endpoint being accessed (e.g., "/api/login").
	 * @param identifier A unique string representing the caller (e.g., IP or user ID).
	 * @returns Object containing whether the identifier is rate limited, how many requests remain, and when the window resets.
	 */
	check(endpoint: string, identifier: string): RateLimitResult {
		const now = Date.now();
		const key = `${endpoint}:${identifier}`;
		let entry = this.store.get(key);

		if (!entry || entry.resetTime < now) {
			entry = {
				count: 1,
				resetTime: now + this.config.windowMs,
			};
		} else {
			entry.count += 1;
		}

		this.store.set(key, entry);

		const limited = entry.count > this.config.max;
		const remaining = Math.max(this.config.max - entry.count, 0);

		return {
			limited,
			remaining,
			reset: entry.resetTime,
		};
	}
}

export type { RateLimitConfig, ExtendedRateLimitConfig, RateLimitResult };
