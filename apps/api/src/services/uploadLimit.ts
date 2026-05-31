import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://redis:6379";
const conn = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const HOURLY_LIMIT = Number(process.env.UPLOAD_HOURLY_LIMIT ?? 30);
const DAILY_LIMIT = Number(process.env.UPLOAD_DAILY_LIMIT ?? 100);

export interface LimitResult {
  allowed: boolean;
  /** Remaining quota in the strictest window */
  remaining: number;
  /** Seconds until the strictest window resets */
  retryAfterSec: number;
  windowLabel: "hour" | "day";
}

/**
 * Sliding hour + day quota per user. Counters live in Redis and self-expire.
 */
export async function checkAndRecordUpload(userId: string): Promise<LimitResult> {
  const hourKey = `upload:${userId}:h`;
  const dayKey = `upload:${userId}:d`;

  const pipeline = conn.multi();
  pipeline.incr(hourKey);
  pipeline.expire(hourKey, 60 * 60);
  pipeline.incr(dayKey);
  pipeline.expire(dayKey, 24 * 60 * 60);
  const results = (await pipeline.exec()) ?? [];

  const hourCount = Number(results[0]?.[1] ?? 0);
  const dayCount = Number(results[2]?.[1] ?? 0);

  if (hourCount > HOURLY_LIMIT) {
    const ttl = await conn.ttl(hourKey);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: ttl > 0 ? ttl : 60 * 60,
      windowLabel: "hour",
    };
  }
  if (dayCount > DAILY_LIMIT) {
    const ttl = await conn.ttl(dayKey);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: ttl > 0 ? ttl : 24 * 60 * 60,
      windowLabel: "day",
    };
  }

  return {
    allowed: true,
    remaining: Math.min(
      HOURLY_LIMIT - hourCount,
      DAILY_LIMIT - dayCount,
    ),
    retryAfterSec: 0,
    windowLabel: hourCount > dayCount ? "hour" : "day",
  };
}

/**
 * Roll back the counter when we rejected the upload for a different reason
 * (so the user doesn't get penalized for a server-side rejection).
 */
export async function refundUpload(userId: string): Promise<void> {
  const hourKey = `upload:${userId}:h`;
  const dayKey = `upload:${userId}:d`;
  await conn.multi().decr(hourKey).decr(dayKey).exec();
}
