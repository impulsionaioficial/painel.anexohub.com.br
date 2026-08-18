import 'server-only';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
}

export function checkRateLimit(
  request: Request,
  namespace: string,
  limit: number,
  windowMs: number
): { error: string; status: number } | null {
  const now = Date.now();
  const key = `${namespace}:${clientIdentifier(request)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    current.count += 1;
    if (current.count > limit) return { error: 'Muitas requisições. Tente novamente mais tarde.', status: 429 };
  }

  if (buckets.size > 10_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }
  return null;
}
