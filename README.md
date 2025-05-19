# @rabbit-company/rate-limiter 🐇⏱️

[![NPM Version](https://img.shields.io/npm/v/@rabbit-company/rate-limiter)](https://www.npmjs.com/package/@rabbit-company/rate-limiter)
[![JSR Version](https://jsr.io/badges/@rabbit-company/rate-limiter)](https://jsr.io/@rabbit-company/rate-limiter)
[![License](https://img.shields.io/npm/l/@rabbit-company/rate-limiter)](LICENSE)

A powerful in-memory rate limiter for Node.js and browser environments with multiple algorithm support and TypeScript integration.

## Features ✨

- 🚦 Three rate limiting algorithms:
  - Fixed Window (simple counter)
  - Sliding Window (precise tracking)
  - Token Bucket (burst handling)
- ⚙️ Highly configurable with sensible defaults
- 📊 Detailed rate limit information including:
  - Current request count
  - Remaining requests
  - Reset timestamp
  - Window duration
- 🧹 Automatic cleanup of expired entries
- 🪶 Lightweight and dependency-free
- 🛠️ Full TypeScript definitions included

## Installation 📦

```bash
# npm
npm install @rabbit-company/rate-limiter

# yarn
yarn add @rabbit-company/rate-limiter

# pnpm
pnpm add @rabbit-company/rate-limiter
```

## Basic Usage 🚀

```js
import { RateLimiter } from "@rabbit-company/rate-limiter";

// Create rate limiter
const limiter = new RateLimiter({
	window: 15 * 60 * 1000, // 15 minutes (default: 1 minute)
	max: 100, // Limit each identifier to 100 requests per window (default: 60)
	cleanupInterval: 60 * 1000, // Cleanup every minute (default: 30 seconds)
	enableCleanup: true, // Enable automatic cleanup (default: true)
});

// Check a request
const result = limiter.check("/api/login", "192.168.1.1");

if (result.limited) {
	console.log("Rate limit exceeded! Try again at:", new Date(result.reset));
} else {
	console.log(`${result.remaining} requests remaining this window`);
}
```

## Advanced Usage 🔥

### Sliding Window Example

```js
const slidingLimiter = new RateLimiter({
	algorithm: Algorithm.SLIDING_WINDOW,
	max: 50, // 50 requests
	window: 30 * 1000, // per 30 seconds
	precision: 50, // 50ms tracking precision
});

const status = slidingLimiter.check("/api/data", "user123");
if (!status.limited) {
	// Safe to make request
} else {
	// Wait until status.reset
}
```

### Token Bucket Example

```js
const tokenLimiter = new RateLimiter({
	algorithm: Algorithm.TOKEN_BUCKET,
	max: 10, // Bucket capacity
	refillRate: 2, // Tokens added per interval
	refillInterval: 1000, // Refill interval in ms
});

const status = tokenLimiter.check("/api/data", "user123");
if (!status.limited) {
	// Safe to make request
} else {
	// Wait until status.reset
}
```

### Web Server Integration

```js
import { Hono } from "hono";
import { getConnInfo } from "hono/bun";
import { RateLimiter } from "@rabbit-company/rate-limiter";
import type { Context } from "hono";

const app = new Hono();

const limiter = new RateLimiter({
	window: 15 * 60 * 1000, // 15 minutes (default: 1 minute)
	max: 100, // Limit each identifier to 100 requests per window (default: 60)
	cleanupInterval: 60 * 1000, // Cleanup every minute (default: 30 seconds)
	enableCleanup: true, // Enable automatic cleanup (default: true)
});

app.use("*", async (c: Context, next) => {
	const ip = getConnInfo(c).remote.address || "";
	const endpoint = c.req.path;

	const result = limiter.check(endpoint, ip);

	// Set headers
	c.header("X-RateLimit-Limit", result.limit.toString());
	c.header("X-RateLimit-Remaining", result.remaining.toString());
	c.header("X-RateLimit-Reset", Math.ceil(result.reset / 1000).toString());

	if (result.limited) {
		c.header("Retry-After", Math.ceil((result.reset - Date.now()) / 1000).toString());
		return c.json(
			{
				error: "Too many requests",
				retryAfter: `${Math.ceil((result.reset - Date.now()) / 1000)} seconds`,
			},
			429
		);
	}

	await next();
});

app.get("/api/data", (c) => {
	return c.json({ data: "Your precious data" });
});

export default app;
```

## Manual Management 👷

```js
const limiter = new RateLimiter({ enableCleanup: false });

// Manually clear all rate limit entries
limiter.clear();

// Get current number of tracked rate limit entries
const activeLimits = limiter.getSize();
```

## Algorithm Comparison 🤔

1. Fixed Window (default):

   - Simple counter per time window
   - Resets completely at window end
   - Allows bursts at window boundaries

2. Sliding Window:

   - Tracks exact request timestamps
   - More precise but uses more memory
   - Smooths bursts over the window

3. Token Bucket:
   - Allows bursts up to capacity
   - Steady refill rate between bursts
   - Good for smoothing traffic

## API Reference 📖

`RateLimiter(config?: Partial<RateLimitConfig>)`

Creates a new rate limiter instance. Configuration options:

```js
interface RateLimitConfig {
	algorithm?: Algorithm; // FIXED_WINDOW | SLIDING_WINDOW | TOKEN_BUCKET
	window?: number; // Window duration in ms (default: 60000)
	max?: number; // Max requests per window (default: 60)
	cleanupInterval?: number; // Cleanup interval in ms (default: 30000)
	enableCleanup?: boolean; // Enable automatic cleanup (default: true)

	// Token Bucket specific:
	refillRate?: number; // Tokens to add per interval (default: 1)
	refillInterval?: number; // Refill interval in ms (default: 1000)

	// Sliding Window specific:
	precision?: number; // Tracking precision in ms (default: 100)
}
```

### Instance Methods

- `check(endpoint: string, identifier: string): RateLimitResult`
  Checks and records a request against the rate limit.

- `get(endpoint: string, identifier: string): RateLimitResult`
  Gets current rate limit status without counting as a request.

- `getEntry(endpoint: string, identifier: string): Entry | null`
  Returns the current rate limit entry for inspection.

- `getSize(): number`
  Returns number of active rate limit entries being tracked.

- `clear(): void`
  Clears all rate limit entries and stops automatic cleanup.

### RateLimitResult

```js
interface RateLimitResult {
	limited: boolean; // Whether the request should be limited
	remaining: number; // Remaining requests in current window
	reset: number; // Timestamp when window resets (ms since epoch)
	current: number; // Current request count in window
	limit: number; // Max allowed requests
	window: number; // Window duration in milliseconds
}
```

## Limitations ⚠️

- 🏷️ In-memory storage only (not suitable for distributed systems)
- 🔄 State lost on process restart
- 🔗 For multi-server setups, consider a persistent store (Redis, etc.)

## License 📄

This project is licensed under the MIT License - see the [LICENSE](https://github.com/Rabbit-Company/RateLimiter-JS/blob/main/LICENSE) file for details. 🐇💕
