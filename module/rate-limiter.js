// src/types.ts
var Algorithm;
((Algorithm2) => {
  Algorithm2["FIXED_WINDOW"] = "FIXED_WINDOW";
  Algorithm2["SLIDING_WINDOW"] = "SLIDING_WINDOW";
  Algorithm2["TOKEN_BUCKET"] = "TOKEN_BUCKET";
})(Algorithm ||= {});

// src/index.ts
var DEFAULT_CONFIG = {
  algorithm: "FIXED_WINDOW" /* FIXED_WINDOW */,
  window: 60000,
  max: 60,
  refillRate: 1,
  refillInterval: 1000,
  precision: 100,
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
      this.setupCleanupInterval(this.config.cleanupInterval);
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
    switch (this.config.algorithm) {
      case "FIXED_WINDOW" /* FIXED_WINDOW */:
        return this.checkFixedWindow(key, now);
      case "SLIDING_WINDOW" /* SLIDING_WINDOW */:
        return this.checkSlidingWindow(key, now);
      case "TOKEN_BUCKET" /* TOKEN_BUCKET */:
        return this.checkTokenBucket(key, now);
      default:
        throw new Error(`Unknown algorithm: ${this.config.algorithm}`);
    }
  }
  checkFixedWindow(key, now) {
    const entry = this.getOrCreateEntry(key, now);
    if (entry.resetTime <= now) {
      entry.count = 0;
      entry.resetTime = now + this.config.window;
    }
    entry.count += 1;
    this.store.set(key, entry);
    return this.createRateLimitResult(entry);
  }
  checkSlidingWindow(key, now) {
    let entry = this.store.get(key) || {
      count: 0,
      buckets: new Map,
      resetTime: now + this.config.window
    };
    const precision = this.config.precision;
    const roundedNow = Math.floor(now / precision) * precision;
    const windowStart = roundedNow - this.config.window;
    let totalCount = 0;
    entry.buckets.forEach((count, timestamp) => {
      if (timestamp > windowStart) {
        totalCount += count;
      } else {
        entry.buckets.delete(timestamp);
      }
    });
    const currentCount = (entry.buckets.get(roundedNow) || 0) + 1;
    entry.buckets.set(roundedNow, currentCount);
    totalCount += 1;
    entry.count = totalCount;
    if (entry.buckets.size > 0) {
      const oldestTimestamp = Math.min(...entry.buckets.keys());
      entry.resetTime = oldestTimestamp + this.config.window;
    } else {
      entry.resetTime = roundedNow + this.config.window;
    }
    this.store.set(key, entry);
    return this.createRateLimitResult(entry);
  }
  checkTokenBucket(key, now) {
    let entry = this.store.get(key) || {
      tokens: this.config.max,
      lastRefill: now,
      resetTime: now + this.config.window
    };
    const timePassed = now - entry.lastRefill;
    const tokensToAdd = Math.floor(timePassed / this.config.refillInterval) * this.config.refillRate;
    if (tokensToAdd > 0) {
      entry.tokens = Math.min(Math.max(entry.tokens + tokensToAdd, tokensToAdd), this.config.max);
      entry.lastRefill = now;
    }
    entry.tokens -= 1;
    this.store.set(key, entry);
    return {
      ...this.createRateLimitResult(entry),
      remaining: Math.max(Math.floor(entry.tokens), 0)
    };
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
    let limited;
    let remaining;
    let current;
    switch (this.config.algorithm) {
      case "TOKEN_BUCKET" /* TOKEN_BUCKET */:
        limited = entry.tokens < 0;
        remaining = Math.max(Math.floor(entry.tokens), 0);
        current = this.config.max - entry.tokens;
        break;
      case "SLIDING_WINDOW" /* SLIDING_WINDOW */:
        const now = Date.now();
        limited = entry.count > this.config.max;
        remaining = Math.max(this.config.max - entry.count, 0);
        current = entry.count;
        break;
      case "FIXED_WINDOW" /* FIXED_WINDOW */:
      default:
        limited = entry.count > this.config.max;
        remaining = Math.max(this.config.max - entry.count, 0);
        current = entry.count;
        break;
    }
    return {
      limited,
      remaining,
      reset: entry.resetTime,
      current,
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
  getEntry(endpoint, identifier) {
    const key = this.generateKey(endpoint, identifier);
    const entry = this.store.get(key);
    return entry ? { ...entry } : null;
  }
  get(endpoint, identifier) {
    const key = this.generateKey(endpoint, identifier);
    const entry = this.store.get(key);
    const now = Date.now();
    const currentEntry = entry || this.createNewEntry(now);
    if (this.config.algorithm === "SLIDING_WINDOW" /* SLIDING_WINDOW */ && entry?.buckets) {
      const precision = this.config.precision;
      const roundedNow = Math.floor(now / precision) * precision;
      const windowStart = roundedNow - this.config.window;
      let totalCount = 0;
      entry.buckets.forEach((count, timestamp) => {
        if (timestamp > windowStart) {
          totalCount += count;
        } else {
          entry.buckets.delete(timestamp);
        }
      });
      entry.count = totalCount;
      if (entry.buckets.size > 0) {
        entry.resetTime = Math.min(...entry.buckets.keys()) + this.config.window;
      }
    }
    return this.createRateLimitResult(currentEntry);
  }
}
export {
  RateLimiter,
  Algorithm
};
