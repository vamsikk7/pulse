import type { Job } from "bullmq";
import { ReceiptModel, StatusEventModel, PredictionModel } from "../db.js";
import { scrapeUscisStatus } from "../uscis/scraper.js";
import {
  fetchCaseStatusViaApi,
  resolveUscisConfig,
} from "../uscis/apiClient.js";
import { getFixture } from "../uscis/mockAdapter.js";
import { computePrediction } from "../prediction.js";
import type { UscisStatusResult } from "@pulse/shared";

interface Payload {
  receiptId: string;
  force?: boolean;
}

const SCRAPE_ENABLED =
  (process.env.USCIS_SCRAPE_ENABLED ?? "true").toLowerCase() === "true";

export async function scrapeReceipt(job: Job<Payload>): Promise<void> {
  const { receiptId } = job.data;
  const r = await ReceiptModel.findById(receiptId);
  if (!r) throw new Error(`receipt ${receiptId} not found`);

  if (r.deletedAt) {
    console.log(`[scrape] skipped receipt=${receiptId} (withdrawn)`);
    return;
  }

  let result: UscisStatusResult | null = null;
  let usedFallback = false;

  // ─── Tier 1: official USCIS Developer Hub API (if creds configured) ──
  const uscisCfg = await resolveUscisConfig(r.userId);
  if (uscisCfg.enabled && uscisCfg.clientId && uscisCfg.clientSecret) {
    try {
      result = await fetchCaseStatusViaApi(r.receiptNumber, r.userId);
      if (result) {
        console.log(
          `[scrape] USCIS API OK ${r.receiptNumber} → ${result.statusTitle.slice(0, 50)} (creds: ${uscisCfg.source})`,
        );
      }
    } catch (err) {
      console.warn(
        `[scrape] USCIS API errored ${r.receiptNumber}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // ─── Tier 2: HTML scrape of the public case-status page ──────────
  if (!result && SCRAPE_ENABLED) {
    try {
      result = await scrapeUscisStatus(r.receiptNumber);
      console.log(
        `[scrape] live OK ${r.receiptNumber} → ${result.statusTitle.slice(0, 50)}`,
      );
    } catch (err) {
      console.warn(
        `[scrape] live failed ${r.receiptNumber} (${err instanceof Error ? err.message : err}); attempts left ${(job.opts.attempts ?? 1) - (job.attemptsMade + 1)}`,
      );
      const attemptsLeft = (job.opts.attempts ?? 1) - (job.attemptsMade + 1);
      if (attemptsLeft > 0) {
        // Let BullMQ retry the scrape tier
        throw err;
      }
      usedFallback = true;
    }
  } else if (!result) {
    usedFallback = true;
  }

  if (!result || usedFallback) {
    const fx = getFixture(r.receiptNumber);
    result = fx.current;
    // Seed history if this is the first sync for this receipt
    const existingCount = await StatusEventModel.countDocuments({ receiptId });
    if (existingCount === 0) {
      for (const h of fx.history) {
        await StatusEventModel.create({
          receiptId: r._id,
          caseId: r.caseId,
          statusCode: h.result.statusCode,
          statusTitle: h.result.statusTitle,
          statusDetail: h.result.statusDetail,
          source: "mock",
          scrapedAt: new Date(h.result.scrapedAt),
        });
      }
    }
    console.log(`[scrape] mock ${r.receiptNumber} → ${result.statusTitle}`);
  }

  // Only insert a new StatusEvent if the status has actually changed
  const last = await StatusEventModel.findOne({ receiptId }).sort({ scrapedAt: -1 });
  if (!last || last.statusCode !== result.statusCode) {
    await StatusEventModel.create({
      receiptId: r._id,
      caseId: r.caseId,
      statusCode: result.statusCode,
      statusTitle: result.statusTitle,
      statusDetail: result.statusDetail,
      source: result.source,
      scrapedAt: new Date(result.scrapedAt),
    });
  }

  // Backfill formType from the API response when USCIS told us. If the user
  // never picked one, this is the canonical source. If they did pick one and
  // it disagrees, USCIS is authoritative — overwrite.
  const set: Record<string, unknown> = {
    lastSyncedAt: new Date(),
    lastStatusCode: result.statusCode,
    lastStatusTitle: result.statusTitle,
    lastStatusDetail: result.statusDetail,
    lastSource: result.source,
  };
  if (result.formNumber && result.formNumber !== r.formType) {
    set.formType = result.formNumber;
    console.log(
      `[scrape] backfilled formType for ${r.receiptNumber}: ${r.formType || "(unset)"} → ${result.formNumber}`,
    );
  }
  await ReceiptModel.updateOne({ _id: r._id }, { $set: set });

  // Compute prediction
  const prediction = await computePrediction(r._id.toString());
  if (prediction) {
    await PredictionModel.create({ receiptId: r._id, ...prediction });
  }
}
