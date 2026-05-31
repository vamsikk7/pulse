import { Router } from "express";
import asyncHandler from "express-async-handler";
import { CreateReceiptSchema } from "@pulse/shared";
import {
  CaseModel,
  ReceiptModel,
  StatusEventModel,
  PredictionModel,
} from "../models/index.js";
import { getUserId } from "../middleware/clerk.js";
import { uscisScrapeQueue } from "../services/queue.js";

export const receiptsRouter = Router();

/**
 * @openapi
 * /receipts:
 *   post:
 *     tags: [Receipts]
 *     summary: Track a new USCIS receipt
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [caseId, receiptNumber]
 *             properties:
 *               caseId:
 *                 type: string
 *               receiptNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created receipt (scrape job enqueued)
 *       409:
 *         description: Receipt already tracked
 */
receiptsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const body = CreateReceiptSchema.parse(req.body);

    const owns = await CaseModel.exists({ _id: body.caseId, userId });
    if (!owns) {
      res.status(404).json({ error: "case not found" });
      return;
    }

    // Block creating a duplicate of a still-active receipt;
    // a previously-soft-deleted one with the same number is fine to re-add.
    const existing = await ReceiptModel.findOne({
      caseId: body.caseId,
      receiptNumber: body.receiptNumber,
      userId,
      deletedAt: null,
    });
    if (existing) {
      res
        .status(409)
        .json({ error: "receipt already added", receipt: existing.toObject() });
      return;
    }

    const created = await ReceiptModel.create({ ...body, userId });

    await uscisScrapeQueue.add(
      "scrape",
      { receiptId: created._id.toString() },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    res.status(201).json(created.toObject());
  }),
);

/**
 * @openapi
 * /receipts/{id}:
 *   get:
 *     tags: [Receipts]
 *     summary: Get receipt details with status events and prediction
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Receipt with events and prediction
 *       404:
 *         description: Receipt not found
 */
receiptsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const r = await ReceiptModel.findOne({
      _id: req.params.id,
      userId,
      deletedAt: null,
    }).lean();
    if (!r) {
      res.status(404).json({ error: "receipt not found" });
      return;
    }
    const [events, prediction] = await Promise.all([
      StatusEventModel.find({ receiptId: r._id }).sort({ scrapedAt: -1 }).lean(),
      PredictionModel.findOne({ receiptId: r._id })
        .sort({ computedAt: -1 })
        .lean(),
    ]);
    res.json({ ...r, events, prediction });
  }),
);

/**
 * @openapi
 * /receipts/{id}/refresh:
 *   post:
 *     tags: [Receipts]
 *     summary: Force a fresh scrape of the receipt status
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Scrape job enqueued
 */
receiptsRouter.post(
  "/:id/refresh",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const r = await ReceiptModel.findOne({
      _id: req.params.id,
      userId,
      deletedAt: null,
    });
    if (!r) {
      res.status(404).json({ error: "receipt not found" });
      return;
    }
    await uscisScrapeQueue.add(
      "scrape",
      { receiptId: r._id.toString(), force: true },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    );
    res.json({ enqueued: true });
  }),
);

/**
 * Soft-remove a tracked receipt. Future scrape jobs check deletedAt and skip.
 * Status events and predictions are preserved for audit, but no longer shown.
 *
 * @openapi
 * /receipts/{id}:
 *   delete:
 *     tags: [Receipts]
 *     summary: Soft-delete a tracked receipt
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Receipt not found
 */
receiptsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const r = await ReceiptModel.findOne({
      _id: req.params.id,
      userId,
      deletedAt: null,
    });
    if (!r) {
      res.status(404).json({ error: "receipt not found" });
      return;
    }
    r.deletedAt = new Date();
    await r.save();

    let removedJobs = 0;
    try {
      const jobs = await uscisScrapeQueue.getJobs([
        "waiting",
        "delayed",
        "paused",
      ]);
      for (const j of jobs) {
        if (j.data?.receiptId === r._id.toString()) {
          await j.remove();
          removedJobs += 1;
        }
      }
    } catch (err) {
      console.warn("[receipts] could not remove queued job:", err);
    }

    res.json({ ok: true, removedQueuedJobs: removedJobs });
  }),
);
