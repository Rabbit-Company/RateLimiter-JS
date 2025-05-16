import { describe, expect, test, beforeEach } from "bun:test";
import { RateLimiter } from "../src/index";

describe("RateLimiter", () => {
	let limiter: RateLimiter;

	beforeEach(() => {
		limiter = new RateLimiter({
			windowMs: 1000, // 1 second window for testing
			max: 2, // allow 2 requests per window
			cleanupIntervalMs: 100, // short cleanup for testing
		});
	});

	test("should allow requests under the limit", () => {
		const result1 = limiter.check("/api/test", "user1");
		const result2 = limiter.check("/api/test", "user1");

		expect(result1.limited).toBe(false);
		expect(result1.remaining).toBe(1);
		expect(result2.limited).toBe(false);
		expect(result2.remaining).toBe(0);
	});

	test("should block requests over the limit", () => {
		limiter.check("/api/test", "user2");
		limiter.check("/api/test", "user2");
		const result3 = limiter.check("/api/test", "user2");

		expect(result3.limited).toBe(true);
		expect(result3.remaining).toBe(0);
	});

	test("should reset count after window expires", async () => {
		limiter.check("/api/test", "user3");
		limiter.check("/api/test", "user3");

		// Wait for window to expire
		await new Promise((res) => setTimeout(res, 1100));

		const result = limiter.check("/api/test", "user3");
		expect(result.limited).toBe(false);
		expect(result.remaining).toBe(1);
	});

	test("should isolate rate limits per identifier", () => {
		const result1 = limiter.check("/api/test", "userA");
		const result2 = limiter.check("/api/test", "userB");

		expect(result1.limited).toBe(false);
		expect(result2.limited).toBe(false);
		expect(result1.remaining).toBe(1);
		expect(result2.remaining).toBe(1);
	});

	test("should isolate rate limits per endpoint", () => {
		const result1 = limiter.check("/api/one", "sameUser");
		const result2 = limiter.check("/api/two", "sameUser");

		expect(result1.limited).toBe(false);
		expect(result2.limited).toBe(false);
		expect(result1.remaining).toBe(1);
		expect(result2.remaining).toBe(1);
	});

	test("should purge expired entries after cleanup interval", async () => {
		limiter.check("/api/clean", "userX");
		expect(limiter.store.size).toBe(1);

		await new Promise((res) => setTimeout(res, 1100)); // wait for window to expire

		await new Promise((res) => setTimeout(res, 150)); // wait for cleanup to run
		expect(limiter.store.size).toBe(0);
	});
});
