import { Router } from "express";
import asyncHandler from "express-async-handler";
import { fileTypeFromBuffer } from "file-type";
import { CreatePetitionSchema } from "@pulse/shared";
import { CaseModel, PetitionModel, RfeAnalysisModel } from "../models/index.js";
import { getUserId } from "../middleware/clerk.js";
import { petitionAnalysisQueue } from "../services/queue.js";
import { minio, BUCKET } from "../services/minio.js";
import { scanBuffer, CLAMAV_ENABLED } from "../services/clamav.js";
import { checkAndRecordUpload, refundUpload } from "../services/uploadLimit.js";

export const petitionsRouter = Router();

const MAX_BYTES = 25 * 1024 * 1024;
const MIN_BYTES = 1024;
const MAGIC_PREVIEW_BYTES = 4100;

async function readObject(fileKey: string): Promise<Buffer> {
  const stream = await minio.getObject(BUCKET, fileKey);
  const chunks: Buffer[] = [];
  return await new Promise((resolve, reject) => {
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

interface FileInput {
  fileKey: string;
  filename: string;
  role?: "brief" | "exhibit";
}

interface ValidatedFile {
  role: "brief" | "exhibit";
  filename: string;
  fileKey: string;
  fileSize: number;
  contentType: string;
}

/**
 * Validate one file (existence, size, magic-byte content-type, virus scan).
 * Returns the verified shape OR an error string + status code.
 */
async function validateOneFile(
  f: FileInput,
): Promise<
  | { ok: true; file: Omit<ValidatedFile, "role"> }
  | { ok: false; status: number; error: string; deleteFromMinio?: boolean }
> {
  let stat;
  try {
    stat = await minio.statObject(BUCKET, f.fileKey);
  } catch {
    return {
      ok: false,
      status: 400,
      error: `${f.filename}: upload couldn't be verified — try uploading again`,
    };
  }
  if (stat.size > MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `${f.filename}: too large (${(stat.size / 1024 / 1024).toFixed(1)} MB; max is 25 MB)`,
    };
  }
  if (stat.size < MIN_BYTES) {
    return {
      ok: false,
      status: 400,
      error: `${f.filename}: appears empty (${stat.size} bytes)`,
    };
  }

  let head: Buffer;
  try {
    head = await readObject(f.fileKey);
  } catch {
    return { ok: false, status: 500, error: `${f.filename}: couldn't read from storage` };
  }
  const detected = await fileTypeFromBuffer(head.subarray(0, MAGIC_PREVIEW_BYTES));
  if (!detected || detected.mime !== "application/pdf") {
    return {
      ok: false,
      status: 415,
      error: `${f.filename}: not a PDF (detected ${detected?.mime ?? "unknown"})`,
      deleteFromMinio: true,
    };
  }

  if (CLAMAV_ENABLED) {
    try {
      const scan = await scanBuffer(head);
      if (!scan.clean) {
        return {
          ok: false,
          status: 400,
          error: `${f.filename}: rejected by virus scanner${scan.signature ? ` (${scan.signature})` : ""}`,
          deleteFromMinio: true,
        };
      }
    } catch (err) {
      console.error("[petitions] ClamAV scan failed:", err);
      return {
        ok: false,
        status: 503,
        error: "virus scanner unavailable right now — try again in a moment",
      };
    }
  }

  return {
    ok: true,
    file: {
      filename: f.filename,
      fileKey: f.fileKey,
      fileSize: stat.size,
      contentType: detected.mime,
    },
  };
}

/**
 * @openapi
 * /petitions:
 *   post:
 *     tags: [Petitions]
 *     summary: Upload a petition for analysis
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [caseId]
 *             properties:
 *               caseId:
 *                 type: string
 *               fileKey:
 *                 type: string
 *               filename:
 *                 type: string
 *               files:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     fileKey:
 *                       type: string
 *                     filename:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum: [brief, exhibit]
 *     responses:
 *       201:
 *         description: Created petition with analysis job enqueued
 *       413:
 *         description: File too large
 *       415:
 *         description: Not a PDF
 *       429:
 *         description: Upload rate limit exceeded
 */
petitionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const body = CreatePetitionSchema.parse(req.body);

    const owns = await CaseModel.exists({ _id: body.caseId, userId });
    if (!owns) {
      res.status(404).json({ error: "case not found" });
      return;
    }

    // Normalize: turn the legacy single-file shape into the multi-file shape.
    const filesInput: FileInput[] = body.files?.length
      ? body.files
      : [{ fileKey: body.fileKey!, filename: body.filename! }];

    // Designate the first file as the brief unless explicitly tagged
    let briefIdx = filesInput.findIndex((f) => f.role === "brief");
    if (briefIdx === -1) briefIdx = 0;

    // ─── Rate limit (one charge per petition, not per file) ─────
    const limit = await checkAndRecordUpload(userId);
    if (!limit.allowed) {
      res.status(429).json({
        error:
          limit.windowLabel === "hour"
            ? `Too many uploads this hour. Wait ${Math.ceil(limit.retryAfterSec / 60)} min and try again.`
            : `Daily upload limit reached. Try again in ${Math.ceil(limit.retryAfterSec / 3600)} h.`,
        retryAfterSec: limit.retryAfterSec,
      });
      res.setHeader("Retry-After", String(limit.retryAfterSec));
      return;
    }

    // ─── Validate every file ────────────────────────────────────
    const validated: ValidatedFile[] = [];
    for (let i = 0; i < filesInput.length; i++) {
      const f = filesInput[i]!;
      const result = await validateOneFile(f);
      if (!result.ok) {
        await refundUpload(userId);
        // Best-effort cleanup of any files we've already verified plus the rogue one
        if (result.deleteFromMinio) {
          await minio.removeObject(BUCKET, f.fileKey).catch(() => {});
        }
        for (const v of validated) {
          await minio.removeObject(BUCKET, v.fileKey).catch(() => {});
        }
        res.status(result.status).json({ error: result.error });
        return;
      }
      validated.push({
        role: i === briefIdx ? "brief" : "exhibit",
        ...result.file,
      });
    }

    // Move the brief to index 0 for predictable ordering
    if (briefIdx !== 0) {
      const [brief] = validated.splice(briefIdx, 1);
      if (brief) validated.unshift(brief);
    }

    const primary = validated[0]!;

    const petition = await PetitionModel.create({
      caseId: body.caseId,
      userId,
      // Primary fields (the brief)
      filename: primary.filename,
      fileKey: primary.fileKey,
      fileSize: primary.fileSize,
      contentType: primary.contentType,
      // Full file list (brief + exhibits)
      files: validated,
    });

    const analysis = await RfeAnalysisModel.create({
      petitionId: petition._id,
      caseId: body.caseId,
      userId,
      status: "queued",
      progressLabel:
        validated.length === 1
          ? "Queued for analysis"
          : `Queued for analysis (${validated.length} files)`,
    });

    await petitionAnalysisQueue.add(
      "analyze",
      {
        petitionId: petition._id.toString(),
        analysisId: analysis._id.toString(),
      },
      {
        attempts: 1,
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    );

    res.status(201).json({
      ...petition.toObject(),
      analysisId: analysis._id.toString(),
      uploadsRemainingThisWindow: limit.remaining,
    });
  }),
);

/**
 * @openapi
 * /petitions/{id}:
 *   get:
 *     tags: [Petitions]
 *     summary: Get petition details with latest analysis
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Petition with latest analysis
 *       404:
 *         description: Petition not found
 */
petitionsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const p = await PetitionModel.findOne({
      _id: req.params.id,
      userId,
      deletedAt: null,
    }).lean();
    if (!p) {
      res.status(404).json({ error: "petition not found" });
      return;
    }
    const analysis = await RfeAnalysisModel.findOne({ petitionId: p._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ ...p, latestAnalysis: analysis });
  }),
);

/**
 * @openapi
 * /petitions/{id}:
 *   delete:
 *     tags: [Petitions]
 *     summary: Soft-delete a petition and cancel in-flight analyses
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted with cancelled analysis count
 *       404:
 *         description: Petition not found
 */
petitionsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const petition = await PetitionModel.findOne({
      _id: req.params.id,
      userId,
      deletedAt: null,
    });
    if (!petition) {
      res.status(404).json({ error: "petition not found" });
      return;
    }

    petition.deletedAt = new Date();
    await petition.save();

    const analyses = await RfeAnalysisModel.find({
      petitionId: petition._id,
      status: { $in: ["queued", "running"] },
    });

    let removedJobs = 0;
    for (const a of analyses) {
      a.status = "cancelled";
      a.progressLabel = "Cancelled — petition was withdrawn";
      await a.save();
      try {
        const jobs = await petitionAnalysisQueue.getJobs([
          "waiting",
          "delayed",
          "paused",
        ]);
        for (const j of jobs) {
          if (j.data?.analysisId === a._id.toString()) {
            await j.remove();
            removedJobs += 1;
          }
        }
      } catch (err) {
        console.warn("[petitions] could not remove queued job:", err);
      }
    }

    res.json({
      ok: true,
      cancelledAnalyses: analyses.length,
      removedQueuedJobs: removedJobs,
    });
  }),
);
