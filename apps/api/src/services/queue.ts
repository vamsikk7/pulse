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

export const allQueues = [
  petitionAnalysisQueue,
  uscisScrapeQueue,
  processingTimesQueue,
  criteriaRefreshQueue,
];
