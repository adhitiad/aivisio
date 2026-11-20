/**
 * Rate limiter in-memory (token bucket sederhana per key).
 * Cocok untuk single-instance deployment (output standalone).
 * Untuk multi-instance/serverless, ganti dengan store terpusat (Redis/KV).
 */

interface Bucket {
  tokens: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

/**
 * @param key identifier (mis. `contact:${ip}`)
 * @param limit jumlah permintaan yang diizinkan per window
 * @param windowMs panjang window dalam ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { tokens: limit - 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.tokens <= 0) return false;
  bucket.tokens -= 1;
  return true;
}

export function clientIp(req: Request): string {
  // Caddy overwrites X-Real-IP with the actual remote peer address.
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);

  // When running behind a trusted proxy that appends to X-Forwarded-For,
  // use the final address instead of a potentially client-controlled first item.
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const addresses = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    return (addresses.at(-1) ?? "unknown").slice(0, 64);
  }
  return "unknown";
}
