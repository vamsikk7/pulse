import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://redis:6379";

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const QUEUES = {
  petitionAnalysis: "petition-analysis",
  uscisScrape: "uscis-scrape",
  processingTimesCron: "processing-times-cron",
  criteriaRefreshCron: "criteria-refresh-cron",
} as const;

export const petitionAnalysisQueue = new Queue(QUEUES.petitionAnalysis, {
  connection: redisConnection,
});

export const uscisScrapeQueue = new Queue(QUEUES.uscisScrape, {
  connection: redisConnection,
});

export const processingTimesQueue = new Queue(QUEUES.processingTimesCron, {
  connection: redisConnection,
});

export const criteriaRefreshQueue = new Queue(QUEUES.criteriaRefreshCron, {
  connection: redisConnection,
});

/**
 * Repeatable job — nightly processing-times refresh.
 */
export async function scheduleCrons(): Promise<void> {
  await processingTimesQueue.add(
    "refresh",
    {},
    {
      repeat: { pattern: "0 3 * * *" }, // 03:00 UTC daily
      removeOnComplete: 10,
      removeOnFail: 10,
    },
  );
  // Also fire once on startup so we have data immediately.
  await processingTimesQueue.add(
    "refresh-bootstrap",
    { reason: "bootstrap" },
    { removeOnComplete: true, removeOnFail: true },
  );

  // Daily eCFR criteria-freshness check at 04:00 UTC (offset from
  // processing-times cron at 03:00 UTC so they don't collide).
  await criteriaRefreshQueue.add(
    "refresh",
    {},
    {
      repeat: { pattern: "0 4 * * *" },
      removeOnComplete: 10,
      removeOnFail: 10,
    },
  );
  await criteriaRefreshQueue.add(
    "refresh-bootstrap",
    { reason: "bootstrap" },
    { removeOnComplete: true, removeOnFail: true },
  );
}
