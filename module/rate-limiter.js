// src/index.ts
var DEFAULT_CONFIG = {
  window: 60000,
  max: 60,
  enableCleanup: true,
  cleanupInterval: 30000
};

class RateLimiter {
  store = new Map;
  config;
  cleanupInterval;
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (this.config.enableCleanup) {
      this.setupCleanupInterval(this.config.cleanupInterval || 30000);
    }
  }
  setupCleanupInterval(intervalMs) {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, intervalMs).unref?.();
  }
  cleanupExpiredEntries() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }
  createNewEntry(now) {
    return {
      count: 0,
      resetTime: now + this.config.window
    };
  }
  check(endpoint, identifier) {
    const now = Date.now();
    const key = this.generateKey(endpoint, identifier);
    const entry = this.getOrCreateEntry(key, now);
    entry.count += 1;
    this.store.set(key, entry);
    return this.createRateLimitResult(entry);
  }
  generateKey(endpoint, identifier) {
    return `${endpoint}:${identifier}`;
  }
  getOrCreateEntry(key, now) {
    const existingEntry = this.store.get(key);
    if (!existingEntry || existingEntry.resetTime <= now) {
      return this.createNewEntry(now);
    }
    return { ...existingEntry };
  }
  createRateLimitResult(entry) {
    const limited = entry.count > this.config.max;
    const remaining = Math.max(this.config.max - entry.count, 0);
    return {
      limited,
      remaining,
      reset: entry.resetTime,
      current: entry.count,
      limit: this.config.max,
      window: this.config.window
    };
  }
  clear() {
    this.store.clear();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
  getSize() {
    return this.store.size;
  }
}
export {
  RateLimiter
};
