import "dotenv/config";
import { Worker } from "bullmq";
import { connect } from "./db.js";
import { redisConnection, QUEUES, scheduleCrons } from "./queues.js";
import { analyzePetition, markAnalysisFailed } from "./jobs/analyzePetition.js";
import { scrapeReceipt } from "./jobs/scrapeReceipt.js";
import { refreshProcessingTimes } from "./uscis/processingTimes.js";
import { refreshCriteria } from "./jobs/refreshCriteria.js";
import { ensureWarm } from "./ollama/client.js";

async function main() {
  await connect();

  // Pre-warm Ollama in the background — don't block startup
  void ensureWarm();

  // ---- Petition analysis worker ----
  const analysisWorker = new Worker(
    QUEUES.petitionAnalysis,
    async (job) => {
      try {
        await analyzePetition(job);
      } catch (err) {
        const { analysisId } = job.data as { analysisId: string };
        const attemptsLeft =
          (job.opts.attempts ?? 1) - (job.attemptsMade + 1);
        if (attemptsLeft <= 0) {
          await markAnalysisFailed(analysisId, err);
        }
        throw err;
      }
    },
    {
      connection: redisConnection,
      concurrency: 1, // single-threaded — Ollama serves one request at a time
    },
  );
  analysisWorker.on("ready", () => console.log("[worker] petition-analysis ready"));
  analysisWorker.on("failed", (job, err) =>
    console.error(`[worker] petition-analysis FAILED job=${job?.id}:`, err.message),
  );

  // ---- USCIS scrape worker ----
  const scrapeWorker = new Worker(QUEUES.uscisScrape, scrapeReceipt, {
    connection: redisConnection,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: Number(process.env.USCIS_RATE_LIMIT_MS ?? 10_000),
    },
  });
  scrapeWorker.on("ready", () => console.log("[worker] uscis-scrape ready"));
  scrapeWorker.on("failed", (job, err) =>
    console.error(`[worker] uscis-scrape FAILED job=${job?.id}:`, err.message),
  );

  // ---- Processing-times cron worker ----
  const cronWorker = new Worker(
    QUEUES.processingTimesCron,
    async () => {
      await refreshProcessingTimes();
    },
    { connection: redisConnection, concurrency: 1 },
  );
  cronWorker.on("ready", () => console.log("[worker] processing-times ready"));
  cronWorker.on("failed", (job, err) =>
    console.error(`[worker] processing-times FAILED job=${job?.id}:`, err.message),
  );

  // ---- USCIS criteria freshness cron worker (daily eCFR check) ----
  const criteriaWorker = new Worker(
    QUEUES.criteriaRefreshCron,
    async () => {
      await refreshCriteria();
    },
    { connection: redisConnection, concurrency: 1 },
  );
  criteriaWorker.on("ready", () => console.log("[worker] criteria-refresh ready"));
  criteriaWorker.on("failed", (job, err) =>
    console.error(
      `[worker] criteria-refresh FAILED job=${job?.id}:`,
      err.message,
    ),
  );

  await scheduleCrons();
  console.log("[worker] all workers running");

  // Keep process alive
  process.on("SIGTERM", async () => {
    console.log("[worker] shutting down");
    await Promise.all([
      analysisWorker.close(),
      scrapeWorker.close(),
      cronWorker.close(),
      criteriaWorker.close(),
    ]);
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
