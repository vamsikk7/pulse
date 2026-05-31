import "dotenv/config";
import mongoose from "mongoose";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  CaseModel,
  PetitionModel,
  ReceiptModel,
  RfeAnalysisModel,
} from "../models/index.js";
import { uscisScrapeQueue, petitionAnalysisQueue } from "../services/queue.js";
import { minio, BUCKET } from "../services/minio.js";

const DEMO_USER_ID = process.env.DEMO_USER_ID ?? "user_demo_seed";

// Paths inside the API container (the repo is bind-mounted at /repo)
const SAMPLE_PETITION = resolve("/repo/samples/synthetic-eb1a-petition.pdf");
const SAMPLE_EXHIBIT = resolve("/repo/samples/synthetic-eb1a-exhibit-1.pdf");

async function ensureBucket(): Promise<void> {
  const exists = await minio.bucketExists(BUCKET).catch(() => false);
  if (!exists) {
    await minio.makeBucket(BUCKET);
  }
}

async function uploadSample(
  caseId: string,
  filename: string,
  localPath: string,
): Promise<{ filename: string; fileKey: string; fileSize: number } | null> {
  if (!existsSync(localPath)) {
    console.warn(`[seed] sample PDF missing at ${localPath} — skipping`);
    return null;
  }
  const data = await readFile(localPath);
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const fileKey = `${DEMO_USER_ID}/${caseId}/${randomUUID()}-${safeName}`;
  await minio.putObject(BUCKET, fileKey, data, data.length, {
    "Content-Type": "application/pdf",
  });
  return { filename, fileKey, fileSize: data.length };
}

async function main() {
  const mongoUrl = process.env.MONGO_URL ?? "mongodb://localhost:27017/pulse";
  await mongoose.connect(mongoUrl);

  console.log(`[seed] connected to ${mongoUrl}`);
  console.log(`[seed] seeding for userId=${DEMO_USER_ID}`);

  await ensureBucket();

  // Wipe any prior demo state for these two cases. (The `reseed` script does
  // a deeper wipe across all collections + MinIO; this is a lighter pass.)
  const oldPetitions = await PetitionModel.find({ userId: DEMO_USER_ID })
    .select("_id")
    .lean();
  const oldPetitionIds = oldPetitions.map((p) => p._id);
  await RfeAnalysisModel.deleteMany({ petitionId: { $in: oldPetitionIds } });
  await PetitionModel.deleteMany({ userId: DEMO_USER_ID });
  await ReceiptModel.deleteMany({ userId: DEMO_USER_ID });
  await CaseModel.deleteMany({ userId: DEMO_USER_ID });

  // ─── Applicants ──────────────────────────────────────────────
  const patel = await CaseModel.create({
    userId: DEMO_USER_ID,
    name: "Dr. Patel — O-1A (ML researcher)",
    visaType: "O-1A",
    notes: "Pre-seeded demo case. 7 publications, 280 citations, IEEE judge.",
  });

  const lin = await CaseModel.create({
    userId: DEMO_USER_ID,
    name: "Ms. Lin — EB-1A (Bioinformatics)",
    visaType: "EB-1A",
    notes: "Pre-seeded demo case. Self-petition; missing salary comparator.",
  });

  // ─── Petition for Lin (real PDF, real analysis queued) ───────
  let petitionEnqueued = 0;
  const brief = await uploadSample(
    lin._id.toString(),
    "synthetic-eb1a-petition.pdf",
    SAMPLE_PETITION,
  );
  const exhibit = await uploadSample(
    lin._id.toString(),
    "synthetic-eb1a-exhibit-1.pdf",
    SAMPLE_EXHIBIT,
  );

  if (brief) {
    const files = [brief, ...(exhibit ? [exhibit] : [])].map((f, i) => ({
      role: (i === 0 ? "brief" : "exhibit") as "brief" | "exhibit",
      filename: f.filename,
      fileKey: f.fileKey,
      fileSize: f.fileSize,
      contentType: "application/pdf",
      pageCount: 0,
      textChars: 0,
      ocrUsed: false,
    }));

    const petition = await PetitionModel.create({
      caseId: lin._id,
      userId: DEMO_USER_ID,
      filename: brief.filename,
      fileKey: brief.fileKey,
      fileSize: brief.fileSize,
      contentType: "application/pdf",
      files,
    });

    const analysis = await RfeAnalysisModel.create({
      petitionId: petition._id,
      caseId: lin._id,
      userId: DEMO_USER_ID,
      status: "queued",
      progressLabel:
        files.length === 1
          ? "Queued for analysis"
          : `Queued for analysis (${files.length} files)`,
    });

    await petitionAnalysisQueue.add(
      "analyze",
      {
        petitionId: petition._id.toString(),
        analysisId: analysis._id.toString(),
      },
      { attempts: 1, removeOnComplete: 50, removeOnFail: 50 },
    );
    petitionEnqueued = 1;
    console.log(
      `[seed] queued petition analysis for Lin (petitionId=${petition._id}, files=${files.length})`,
    );
  } else {
    console.warn(
      "[seed] no sample petition PDF available — skipping Lin's petition seed",
    );
  }

  // ─── Receipts (USCIS scrape jobs queued) ─────────────────────
  const r1 = await ReceiptModel.create({
    caseId: patel._id,
    userId: DEMO_USER_ID,
    receiptNumber: "EAC2490012345",
    formType: "I-129",
  });
  const r2 = await ReceiptModel.create({
    caseId: patel._id,
    userId: DEMO_USER_ID,
    receiptNumber: "WAC2390098765",
    formType: "I-129",
  });

  for (const r of [r1, r2]) {
    await uscisScrapeQueue.add(
      "scrape",
      { receiptId: r._id.toString() },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    );
  }

  console.log(`[seed] created cases: ${patel._id}, ${lin._id}`);
  console.log(
    `[seed] enqueued ${petitionEnqueued} petition analysis + ${2} scrape jobs (live → mock fallback)`,
  );
  console.log(`[seed] done`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
