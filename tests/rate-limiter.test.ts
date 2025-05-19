import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { RateLimiter, Algorithm } from "../src/index";

describe("RateLimiter", () => {
	describe("get", () => {
		let limiter: RateLimiter;

		beforeEach(() => {
			limiter = new RateLimiter({
				algorithm: Algorithm.SLIDING_WINDOW,
				window: 1000,
				max: 5,
				precision: 100,
			});
		});

		test("should return fresh state for new endpoints", () => {
			const result = limiter.get("/new", "user1");
			expect(result).toMatchObject({
				limited: false,
				current: 0,
				remaining: 5,
			});
		});

		test("should reflect current usage without incrementing", () => {
			limiter.check("/api", "user1");
			limiter.check("/api", "user1");

			const status = limiter.get("/api", "user1");
			expect(status).toMatchObject({
				current: 2,
				remaining: 3,
			});

			// Verify another get doesn't change count
			expect(limiter.get("/api", "user1").current).toBe(2);
		});

		test("should calculate sliding window expiration correctly", () => {
			// First request at time 0
			const firstCheck = limiter.check("/api", "user2");
			expect(firstCheck.remaining).toBe(4);
			expect(firstCheck.current).toBe(1);

			// Wait 600ms (within the 1000ms window)
			Bun.sleepSync(600);

			// Should still see the first request counting against the limit
			const status = limiter.get("/api", "user2");
			expect(status.remaining).toBe(4);
			expect(status.current).toBe(1);

			// Wait another 500ms (total 1100ms - past window expiration)
			Bun.sleepSync(500);

			// Window should have expired, count reset
			const expiredStatus = limiter.get("/api", "user2");
			expect(expiredStatus.remaining).toBe(5);
			expect(expiredStatus.current).toBe(0);
		});
	});

	describe("getEntry", () => {
		test("should return null for non-existent entries", () => {
			const limiter = new RateLimiter();
			expect(limiter.getEntry("/nonexistent", "user1")).toBeNull();
		});

		test("should return current rate limit state", () => {
			const limiter = new RateLimiter({
				algorithm: Algorithm.SLIDING_WINDOW,
				window: 1000,
				max: 5,
			});

			limiter.check("/api", "user1");
			const entry = limiter.getEntry("/api", "user1");

			expect(entry).toMatchObject({
				count: 1,
				resetTime: expect.any(Number),
			});

			if (entry?.buckets) {
				expect(entry.buckets.size).toBe(1);
			}
		});

		test("should return a clone that cannot modify internal state", () => {
			const limiter = new RateLimiter();
			limiter.check("/api", "user1");

			const entry = limiter.getEntry("/api", "user1");
			if (entry) {
				entry.count = 999; // Try to modify

				// Verify internal state wasn't changed
				const freshEntry = limiter.getEntry("/api", "user1");
				expect(freshEntry?.count).toBe(1);
			}
		});
	});

	describe("Fixed Window Algorithm", () => {
		let limiter: RateLimiter;

		beforeEach(() => {
			limiter = new RateLimiter({
				algorithm: Algorithm.FIXED_WINDOW,
				window: 1000,
				max: 2,
				cleanupInterval: 100,
			});
		});

		afterEach(() => {
			limiter.clear();
		});

		test("should count all requests but limit after max", () => {
			// First request (allowed)
			const result1 = limiter.check("/api", "user1");
			expect(result1).toEqual({
				limited: false,
				current: 1,
				remaining: 1,
				limit: 2,
				reset: expect.any(Number),
				window: 1000,
			});

			// Second request (allowed)
			const result2 = limiter.check("/api", "user1");
			expect(result2).toMatchObject({
				limited: false,
				current: 2,
				remaining: 0,
			});

			// Third request (blocked but counted)
			const result3 = limiter.check("/api", "user1");
			expect(result3).toMatchObject({
				limited: true,
				current: 3,
				remaining: 0,
			});
		});

		test("should reset count after window expires", () => {
			// Exhaust the limit
			limiter.check("/api", "user2");
			limiter.check("/api", "user2");

			// Verify limited
			expect(limiter.check("/api", "user2").limited).toBeTrue();

			// Wait for window to expire
			Bun.sleepSync(1100);

			// Should allow new requests
			const result = limiter.check("/api", "user2");
			expect(result).toMatchObject({
				limited: false,
				current: 1,
				remaining: 1,
			});
		});

		test("should handle rapid consecutive requests", () => {
			for (let i = 1; i <= 5; i++) {
				const result = limiter.check("/api", "user3");
				expect(result.current).toBe(i);
				expect(result.limited).toBe(i > 2);
			}
		});
	});

	describe("Sliding Window Algorithm", () => {
		let limiter: RateLimiter;

		beforeEach(() => {
			limiter = new RateLimiter({
				algorithm: Algorithm.SLIDING_WINDOW,
				window: 1000, // 1 second window
				max: 5, // 5 requests max
				precision: 100, // 100ms precision
			});
		});

		test("should accurately count requests within precision windows", () => {
			// First request in new bucket
			const result1 = limiter.check("/api", "user1");
			expect(result1).toMatchObject({
				limited: false,
				current: 1,
				remaining: 4,
			});

			// Second request in same 100ms window
			const result2 = limiter.check("/api", "user1");
			expect(result2).toMatchObject({
				limited: false,
				current: 2,
				remaining: 3,
			});
		});

		test("should properly limit when max requests reached", () => {
			// Make 5 requests quickly (should all count)
			for (let i = 0; i < 5; i++) {
				limiter.check("/api", "user2");
			}

			// Sixth request should be limited
			const result = limiter.check("/api", "user2");
			expect(result).toMatchObject({
				limited: true,
				current: 6,
				remaining: 0,
			});
		});

		test("should expire old buckets and allow new requests", () => {
			limiter.check("/api", "user3");
			limiter.check("/api", "user3");

			Bun.sleepSync(1000);

			// Make 4 more requests (2+4=6 would exceed limit if not for expiration)
			for (let i = 0; i < 4; i++) {
				limiter.check("/api", "user3");
			}

			const result = limiter.check("/api", "user3");
			expect(result).toMatchObject({
				limited: false,
				current: 5, // Only the recent 4 + 1 from current bucket
				remaining: 0,
			});
		});

		test("should handle rapid bursts within precision windows", () => {
			// Make 100 requests within the same 100ms precision window
			for (let i = 0; i < 100; i++) {
				limiter.check("/api", "user4");
			}

			const result = limiter.check("/api", "user4");
			expect(result).toMatchObject({
				limited: true,
				current: 101, // All counted individually
				remaining: 0,
			});

			// Wait for window to expire
			Bun.sleepSync(1100);

			const newResult = limiter.check("/api", "user4");
			expect(newResult).toMatchObject({
				limited: false,
				current: 1,
				remaining: 4,
			});
		});
	});

	describe("Token Bucket Algorithm", () => {
		let limiter: RateLimiter;

		beforeEach(() => {
			limiter = new RateLimiter({
				algorithm: Algorithm.TOKEN_BUCKET,
				max: 2,
				refillRate: 1,
				refillInterval: 500,
				window: 1000,
			});
		});

		test("should count all requests including when empty", () => {
			// First two requests (allowed)
			limiter.check("/api", "user1");
			limiter.check("/api", "user1");

			// Next three requests (blocked but counted)
			for (let i = 3; i <= 5; i++) {
				const result = limiter.check("/api", "user1");
				expect(result).toMatchObject({
					limited: true,
					current: i,
					remaining: 0,
				});
			}
		});

		test("should properly refill tokens", () => {
			// Exhaust tokens
			limiter.check("/api", "user2");
			limiter.check("/api", "user2");

			// Verify limited
			expect(limiter.check("/api", "user2").limited).toBeTrue();

			// Wait for refill (600ms > 500ms interval)
			Bun.sleepSync(600);

			// Should have 1 token available
			const result = limiter.check("/api", "user2");

			expect(result).toMatchObject({
				limited: false,
				remaining: 0,
			});
		});
	});

	describe("Common Behavior", () => {
		test("should isolate limits by endpoint and identifier", () => {
			const limiter = new RateLimiter({ max: 2, window: 1000 });

			// Different endpoints
			const results = [limiter.check("/api/one", "user"), limiter.check("/api/two", "user"), limiter.check("/api", "userA"), limiter.check("/api", "userB")];

			results.forEach((result) => {
				expect(result.limited).toBeFalse();
				expect(result.current).toBe(1);
			});
		});

		test("should handle cleanup of expired entries", async () => {
			const limiter = new RateLimiter({
				max: 2,
				window: 100,
				cleanupInterval: 50,
			});

			// Add active entry
			limiter.check("/api", "user1");
			expect(limiter.getSize()).toBe(1);

			// Wait for expiration and cleanup
			await Bun.sleep(150);
			expect(limiter.getSize()).toBe(0);
		});

		test("should work with disabled cleanup", () => {
			const limiter = new RateLimiter({
				max: 2,
				window: 100,
				enableCleanup: false,
			});

			limiter.check("/api", "user1");
			Bun.sleepSync(150);

			// Entry still exists but should be expired
			expect(limiter.getSize()).toBe(1);

			// New request should create fresh entry
			const result = limiter.check("/api", "user1");
			expect(result.limited).toBeFalse();
		});
	});
});
