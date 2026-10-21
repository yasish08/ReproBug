const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;
const buckets = new Map();

export function authRateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > MAX_ATTEMPTS) {
    res.set("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
    return res.status(429).json({ error: "Too many sign-in attempts. Please try again later." });
  }

  // Keep the in-memory limiter bounded for long-running development servers.
  if (buckets.size > 5000) {
    for (const [address, value] of buckets) {
      if (now >= value.resetAt) buckets.delete(address);
    }
  }

  next();
}
