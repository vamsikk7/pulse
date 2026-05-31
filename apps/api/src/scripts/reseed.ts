/**
 * One-shot reseed:
 *   1. Wipes all data belonging to DEMO_USER_ID across every collection
 *   2. Cleans up MinIO objects under that user's prefix
 *   3. Re-runs the seed (two demo applicants + 2 receipts + scrape jobs)
 *
 * Run via: `docker compose exec api npm run reseed`
 */
import "dotenv/config";
import mongoose from "mongoose";
import {
  CaseModel,
  PetitionModel,
  RfeAnalysisModel,
  ReceiptModel,
  StatusEventModel,
  PredictionModel,
} from "../models/index.js";
import { minio, BUCKET } from "../services/minio.js";

const DEMO_USER_ID = process.env.DEMO_USER_ID ?? "user_demo_seed";

interface WipeResult {
  cases: number;
  petitions: number;
  analyses: number;
  receipts: number;
  statusEvents: number;
  predictions: number;
  minioObjects: number;
}

async function wipeUser(userId: string): Promise<WipeResult> {
  // Find owning cases first so we can scope receipt-side cleanup correctly
  const cases = await CaseModel.find({ userId }).select("_id").lean();
  const caseIds = cases.map((c) => c._id);

  const receipts = await ReceiptModel.find({ userId }).select("_id").lean();
  const receiptIds = receipts.map((r) => r._id);

  const petitions = await PetitionModel.find({ userId }).select("_id").lean();
  const petitionIds = petitions.map((p) => p._id);

  const result: WipeResult = {
    cases: 0,
    petitions: 0,
    analyses: 0,
    receipts: 0,
    statusEvents: 0,
    predictions: 0,
    minioObjects: 0,
  };

  // Status events + predictions are scoped via receiptId
  if (receiptIds.length > 0) {
    const seRes = await StatusEventModel.deleteMany({
      receiptId: { $in: receiptIds },
    });
    result.statusEvents = seRes.deletedCount ?? 0;

    const predRes = await PredictionModel.deleteMany({
      receiptId: { $in: receiptIds },
    });
    result.predictions = predRes.deletedCount ?? 0;
  }

  if (petitionIds.length > 0) {
    const aRes = await RfeAnalysisModel.deleteMany({
      petitionId: { $in: petitionIds },
    });
    result.analyses = aRes.deletedCount ?? 0;
  }

  const recRes = await ReceiptModel.deleteMany({ userId });
  result.receipts = recRes.deletedCount ?? 0;
  const petRes = await PetitionModel.deleteMany({ userId });
  result.petitions = petRes.deletedCount ?? 0;
  const caseRes = await CaseModel.deleteMany({ userId });
  result.cases = caseRes.deletedCount ?? 0;

  // MinIO cleanup: every uploaded petition file lives at <userId>/<caseId>/<uuid>-<name>
  // so a recursive list under <userId>/ catches everything.
  try {
    const objects: string[] = await new Promise((resolve, reject) => {
      const out: string[] = [];
      const stream = minio.listObjectsV2(BUCKET, `${userId}/`, true);
      stream.on("data", (obj) => {
        if (obj.name) out.push(obj.name);
      });
      stream.on("end", () => resolve(out));
      stream.on("error", reject);
    });
    if (objects.length > 0) {
      await minio.removeObjects(BUCKET, objects);
      result.minioObjects = objects.length;
    }
  } catch (err) {
    console.warn(`[reseed] MinIO cleanup skipped: ${err instanceof Error ? err.message : err}`);
    void caseIds; // silence unused
  }

  return result;
}

async function runSeed(): Promise<void> {
  // Delegate to the existing seed script's logic by importing it.
  const seedModule = await import("./seed.js");
  void seedModule;
  // The seed script auto-runs on import because of its top-level main(),
  // but it also calls process.exit() — so when this reseed script runs it,
  // we never return here. That's fine.
}

async function main() {
  const url = process.env.MONGO_URL ?? "mongodb://localhost:27017/pulse";
  await mongoose.connect(url);
  console.log(`[reseed] connected to ${url}`);
  console.log(`[reseed] wiping data for userId=${DEMO_USER_ID}`);

  const wiped = await wipeUser(DEMO_USER_ID);
  console.log(
    `[reseed] wiped: ${wiped.cases} cases, ${wiped.petitions} petitions, ${wiped.analyses} analyses, ` +
      `${wiped.receipts} receipts, ${wiped.statusEvents} status events, ${wiped.predictions} predictions, ` +
      `${wiped.minioObjects} MinIO objects`,
  );

  // Disconnect so the seed script can connect fresh
  await mongoose.disconnect();
  console.log(`[reseed] running fresh seed…`);
  await runSeed();
}

main().catch((err) => {
  console.error("[reseed] failed:", err);
  process.exit(1);
});
