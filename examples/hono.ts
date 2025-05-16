import { Hono } from "hono";
import { getConnInfo } from "hono/bun";
import { RateLimiter } from "../src/index";
import type { Context } from "hono";

const app = new Hono();

const limiter = new RateLimiter({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each identifier to 100 requests per window
	cleanupIntervalMs: 30 * 1000, // Purge old rate limit entries every 30 seconds
});

app.use("*", async (c: Context, next) => {
	const ip = getConnInfo(c).remote.address || "";
	const endpoint = c.req.path;

	const result = limiter.check(endpoint, ip);

	// Set headers
	c.header("X-RateLimit-Limit", limiter.config.max.toString());
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
