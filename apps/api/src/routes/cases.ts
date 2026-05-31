import { Router } from "express";
import asyncHandler from "express-async-handler";
import { CreateCaseSchema } from "@pulse/shared";
import { CaseModel, PetitionModel, ReceiptModel, RfeAnalysisModel, PredictionModel } from "../models/index.js";
import { getUserId } from "../middleware/clerk.js";

export const casesRouter = Router();

/**
 * @openapi
 * /cases:
 *   get:
 *     tags: [Cases]
 *     summary: List all cases for the current user
 *     responses:
 *       200:
 *         description: Array of enriched case objects
 */
casesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const cases = await CaseModel.find({ userId }).sort({ createdAt: -1 }).lean();

    const enriched = await Promise.all(
      cases.map(async (c) => {
        // Only count active (non-soft-deleted) petitions
        const activePetitions = await PetitionModel.find({
          caseId: c._id,
          userId,
          deletedAt: null,
        })
          .select("_id")
          .lean();
        const activePetitionIds = activePetitions.map((p) => p._id);

        const [
          receipts,
          latestDone,
          latestAny,
          inFlightAnalyses,
          failedAnalyses,
          doneAnalyses,
        ] = await Promise.all([
          ReceiptModel.find({ caseId: c._id, userId, deletedAt: null }).lean(),
          activePetitionIds.length
            ? RfeAnalysisModel.findOne({
                petitionId: { $in: activePetitionIds },
                status: "done",
              })
                .sort({ createdAt: -1 })
                .select("riskScore status updatedAt")
                .lean()
            : null,
          activePetitionIds.length
            ? RfeAnalysisModel.findOne({
                petitionId: { $in: activePetitionIds },
              })
                .sort({ createdAt: -1 })
                .select("status progressLabel progressPct updatedAt")
                .lean()
            : null,
          activePetitionIds.length
            ? RfeAnalysisModel.countDocuments({
                petitionId: { $in: activePetitionIds },
                status: { $in: ["queued", "running"] },
              })
            : 0,
          activePetitionIds.length
            ? RfeAnalysisModel.countDocuments({
                petitionId: { $in: activePetitionIds },
                status: "failed",
              })
            : 0,
          activePetitionIds.length
            ? RfeAnalysisModel.countDocuments({
                petitionId: { $in: activePetitionIds },
                status: "done",
              })
            : 0,
        ]);

        const petitionCount = activePetitions.length;

        const receiptIds = receipts.map((r) => r._id);

        // Per receipt, find the LATEST prediction and check whether it's
        // stuck. Older predictions that happened to be stuck don't count.
        let stuckReceiptCount = 0;
        if (receiptIds.length) {
          const grouped = await PredictionModel.aggregate<{
            _id: unknown;
            isStuck: boolean;
          }>([
            { $match: { receiptId: { $in: receiptIds } } },
            { $sort: { computedAt: -1, createdAt: -1 } },
            {
              $group: {
                _id: "$receiptId",
                isStuck: { $first: "$isStuck" },
              },
            },
          ]);
          stuckReceiptCount = grouped.filter((g) => g.isStuck === true).length;
        }

        const awaitingFirstSync = receipts.filter(
          (r) => !r.lastSyncedAt,
        ).length;

        return {
          ...c,
          petitionCount,
          receiptCount: receipts.length,
          latestRiskScore: latestDone?.riskScore ?? null,
          latestAnalysisStatus: latestAny?.status ?? null,
          latestAnalysisProgressLabel: latestAny?.progressLabel ?? null,
          latestAnalysisProgressPct: latestAny?.progressPct ?? null,
          latestAnalysisUpdatedAt:
            latestAny?.updatedAt instanceof Date
              ? latestAny.updatedAt.toISOString()
              : latestAny?.updatedAt ?? null,
          inFlightAnalysisCount: inFlightAnalyses,
          failedAnalysisCount: failedAnalyses,
          doneAnalysisCount: doneAnalyses,
          awaitingFirstSyncCount: awaitingFirstSync,
          stuckReceiptCount,
          hasStuckReceipt: stuckReceiptCount > 0,
        };
      }),
    );

    res.json(enriched);
  }),
);

/**
 * @openapi
 * /cases:
 *   post:
 *     tags: [Cases]
 *     summary: Create a new immigration case
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, visaType]
 *             properties:
 *               name:
 *                 type: string
 *               visaType:
 *                 type: string
 *                 enum: [EB-1A, O-1A]
 *     responses:
 *       201:
 *         description: Created case
 */
casesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const body = CreateCaseSchema.parse(req.body);
    const created = await CaseModel.create({ ...body, userId });
    res.status(201).json(created.toObject());
  }),
);

/**
 * @openapi
 * /cases/{id}:
 *   get:
 *     tags: [Cases]
 *     summary: Get case details with petitions and receipts
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Case with nested petitions and receipts
 *       404:
 *         description: Case not found
 */
casesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { id } = req.params;
    const c = await CaseModel.findOne({ _id: id, userId }).lean();
    if (!c) {
      res.status(404).json({ error: "case not found" });
      return;
    }

    const [petitions, receipts] = await Promise.all([
      PetitionModel.find({ caseId: id, userId, deletedAt: null })
        .sort({ createdAt: -1 })
        .lean(),
      ReceiptModel.find({ caseId: id, userId, deletedAt: null })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // For each petition, get the latest analysis
    const petitionWithAnalysis = await Promise.all(
      petitions.map(async (p) => {
        const a = await RfeAnalysisModel.findOne({ petitionId: p._id })
          .sort({ createdAt: -1 })
          .lean();
        return {
          ...p,
          latestAnalysisId: a?._id.toString(),
          latestAnalysisStatus: a?.status,
          riskScore: a?.riskScore,
        };
      }),
    );

    // For each receipt, get the latest prediction
    const receiptWithPrediction = await Promise.all(
      receipts.map(async (r) => {
        const p = await PredictionModel.findOne({ receiptId: r._id })
          .sort({ computedAt: -1 })
          .lean();
        return { ...r, prediction: p ?? null };
      }),
    );

    res.json({
      ...c,
      petitions: petitionWithAnalysis,
      receipts: receiptWithPrediction,
    });
  }),
);
