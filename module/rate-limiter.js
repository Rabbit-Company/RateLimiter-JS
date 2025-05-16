// src/index.ts
var defaultConfig = {
  windowMs: 60 * 1000,
  max: 60
};

class RateLimiter {
  store = new Map;
  config;
  constructor(config) {
    this.config = { ...defaultConfig, ...config };
    const cleanupInterval = config?.cleanupIntervalMs ?? 30000;
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (entry.resetTime < now) {
          this.store.delete(key);
        }
      }
    }, cleanupInterval).unref();
  }
  check(endpoint, identifier) {
    const now = Date.now();
    const key = `${endpoint}:${identifier}`;
    let entry = this.store.get(key);
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 1,
        resetTime: now + this.config.windowMs
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
      reset: entry.resetTime
    };
  }
}
export {
  RateLimiter
};
