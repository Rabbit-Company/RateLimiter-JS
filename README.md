# @rabbit-company/rate-limiter 🐇⏱️

[![NPM Version](https://img.shields.io/npm/v/@rabbit-company/rate-limiter)](https://www.npmjs.com/package/@rabbit-company/rate-limiter)
[![JSR Version](https://jsr.io/badges/@rabbit-company/rate-limiter)](https://jsr.io/@rabbit-company/rate-limiter)
[![License](https://img.shields.io/npm/l/@rabbit-company/rate-limiter)](LICENSE)

A simple yet powerful in-memory rate limiter for Node.js and browser environments with first-class TypeScript support.

## Features ✨

- 🚦 Track request counts per endpoint and identifier (IP, user ID, etc.)
- ⚙️ Configurable window duration and maximum request limits
- 📊 Returns detailed rate limit information including current usage
- 🧹 Automatic cleanup of expired entries
- 🪶 Lightweight and dependency-free
- 🛠️ Full TypeScript definitions included
- 📡 Optional rate limit headers for API responses

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

Here's how to integrate with a web server and add standard rate limit headers:

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

## Limitations ⚠️

- 🏷️ In-memory storage only (not suitable for distributed systems)
- 🔄 State lost on process restart
- 🔗 For multi-server setups, consider a persistent store (Redis, etc.)

## License 📄

This project is licensed under the MIT License - see the [LICENSE](https://github.com/Rabbit-Company/RateLimiter-JS/blob/main/LICENSE) file for details. 🐇💕
