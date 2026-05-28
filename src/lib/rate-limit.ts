import "server-only";

type Bucket = {
  count: number;
  resetAt: number;
};

declare global {
  var contestVoteRateLimit: Map<string, Bucket> | undefined;
}

const buckets = globalThis.contestVoteRateLimit ?? new Map<string, Bucket>();
globalThis.contestVoteRateLimit = buckets;

export function isRateLimited(key: string, limit = 8, windowMs = 60_000) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
}
