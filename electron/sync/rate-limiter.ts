// Shared token-bucket rate limiter for platform API calls

interface Bucket { tokens: number; lastRefill: number; }

const buckets = new Map<string, Bucket>();

function getBucket(key: string, maxTokens: number, refillRatePerSec: number): Bucket {
  let b = buckets.get(key);
  if (!b) { b = { tokens: maxTokens, lastRefill: Date.now() }; buckets.set(key, b); }
  const now = Date.now();
  const seconds = Math.floor((now - b.lastRefill) / 1000);
  const refill = seconds * refillRatePerSec;
  if (refill > 0) {
    b.tokens = Math.min(maxTokens, b.tokens + refill);
    b.lastRefill = now; // only advance clock when tokens actually refilled
  }
  return b;
}

export function rateLimitedFetch(key: string, maxTokens: number, refillRate: number, url: string, init: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const tryFetch = async () => {
      const bucket = getBucket(key, maxTokens, refillRate);
      if (bucket.tokens > 0) {
        bucket.tokens--;
        try {
          const res = await fetch(url, init);
          if (res.status === 429) { bucket.tokens = 0; setTimeout(tryFetch, 2000); return; }
          resolve(res);
        } catch (e) { reject(e); }
      } else {
        setTimeout(tryFetch, 200);
      }
    };
    tryFetch();
  });
}
