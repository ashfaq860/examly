/**
 * rateLimit.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Minimal in-memory sliding-window limiter for public, unauthenticated
 * POST endpoints (contact form, signup) that had zero abuse protection.
 * Per-instance only — on a multi-instance/serverless deployment each
 * instance tracks its own counters, so this caps single-instance abuse
 * but isn't a substitute for an edge/WAF-level limiter (e.g. Upstash
 * Ratelimit) if the app scales to multiple regions/instances.
 */
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) || []).filter(t => now - t < windowMs);

  if (timestamps.length >= limit) {
    hits.set(key, timestamps);
    return true;
  }

  timestamps.push(now);
  hits.set(key, timestamps);

  // Opportunistic cleanup so the map doesn't grow unbounded
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every(t => now - t > windowMs)) hits.delete(k);
    }
  }

  return false;
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
