import { HttpError } from './errors';

const hits = new Map<string, number[]>();

/** Small in-memory limiter (single-instance deployment). */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) throw new HttpError(429, 'Juda ko‘p urinish. Birozdan so‘ng qayta urining');
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
}
