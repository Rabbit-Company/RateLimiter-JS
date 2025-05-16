import { Hono } from "hono";
import { getConnInfo } from "hono/bun";
import { RateLimiter } from "../src/index";
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
