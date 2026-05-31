import { Router } from "express";
import asyncHandler from "express-async-handler";
import {
  RfeAnalysisModel,
  PetitionModel,
  CaseModel,
} from "../models/index.js";
import { getUserId } from "../middleware/clerk.js";
import { streamReportPdf } from "../services/reportPdf.js";

export const analysesRouter = Router();

/**
 * @openapi
 * /analyses/{id}/report.pdf:
 *   get:
 *     tags: [Analyses]
 *     summary: Download analysis report as PDF
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF report
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Analysis not found or not complete
 */
analysesRouter.get(
  "/:id/report.pdf",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const a = await RfeAnalysisModel.findOne({ _id: req.params.id, userId }).lean();
    if (!a || a.status !== "done") {
      res
        .status(404)
        .json({ error: "Report not available — analysis must be complete first." });
      return;
    }
    const petition = await PetitionModel.findById(a.petitionId).lean();
    const kase = petition ? await CaseModel.findById(petition.caseId).lean() : null;

    streamReportPdf(res, {
      caseName: kase?.name ?? "Untitled applicant",
      visaType: kase?.visaType ?? "—",
      filename: petition?.filename ?? "petition.pdf",
      generatedAt: new Date(),
      riskScore: a.riskScore ?? 0,
      overallSummary: a.overallSummary ?? "",
      criteriaFindings: (a.criteriaFindings ?? []) as never,
      weaknesses: (a.weaknesses ?? []) as never,
      checks: (a.checks ?? []) as never,
      preflightSignals: (a.preflightSignals ?? []) as never,
    });
  }),
);

/**
 * @openapi
 * /analyses/{id}:
 *   get:
 *     tags: [Analyses]
 *     summary: Get analysis details
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: debug
 *         in: query
 *         schema:
 *           type: string
 *           enum: ["0", "1"]
 *         description: Include raw model output when set to 1
 *     responses:
 *       200:
 *         description: Analysis object
 *       404:
 *         description: Analysis not found
 */
analysesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const debug = req.query.debug === "1";
    const a = await RfeAnalysisModel.findOne({ _id: req.params.id, userId }).lean();
    if (!a) {
      res.status(404).json({ error: "analysis not found" });
      return;
    }
    if (!debug) {
      delete (a as Partial<typeof a>).rawModelOutput;
      delete (a as Partial<typeof a>).rawReasoning;
    }
    res.json(a);
  }),
);

/**
 * SSE stream — polls Mongo every 1s for changes; emits when status/progress changes.
 * Closes when status reaches done/failed.
 *
 * @openapi
 * /analyses/{id}/stream:
 *   get:
 *     tags: [Analyses]
 *     summary: SSE stream for live analysis progress
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Server-Sent Events stream
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
analysesRouter.get(
  "/:id/stream",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const debug = req.query.debug === "1";
    const analysisId = req.params.id;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    let lastSerialized = "";
    let isClosed = false;
    const ping = setInterval(() => {
      if (isClosed) return;
      res.write(`: ping\n\n`);
    }, 15_000);

    const cleanup = () => {
      if (isClosed) return;
      isClosed = true;
      clearInterval(ping);
      clearInterval(poll);
      res.end();
    };

    req.on("close", cleanup);

    const poll = setInterval(async () => {
      if (isClosed) return;
      try {
        const a = await RfeAnalysisModel.findOne({ _id: analysisId, userId }).lean();
        if (!a) {
          res.write(`event: error\ndata: ${JSON.stringify({ error: "not found" })}\n\n`);
          cleanup();
          return;
        }
        if (!debug) {
          delete (a as Partial<typeof a>).rawModelOutput;
          delete (a as Partial<typeof a>).rawReasoning;
        }
        const snapshot = JSON.stringify({
          status: a.status,
          progressLabel: a.progressLabel,
          progressPct: a.progressPct,
          riskScore: a.riskScore,
          overallSummary: a.overallSummary,
          criteriaFindings: a.criteriaFindings,
          weaknesses: a.weaknesses,
          preflightSignals: a.preflightSignals ?? [],
          checks: a.checks ?? [],
          errorMessage: a.errorMessage,
          ...(debug && {
            rawReasoning: a.rawReasoning,
            rawModelOutput: a.rawModelOutput,
          }),
        });
        if (snapshot !== lastSerialized) {
          lastSerialized = snapshot;
          res.write(`event: snapshot\ndata: ${snapshot}\n\n`);
        }
        if (a.status === "done" || a.status === "failed") {
          res.write(`event: end\ndata: ${JSON.stringify({ status: a.status })}\n\n`);
          cleanup();
        }
      } catch (err) {
        console.error("[sse] poll error", err);
      }
    }, 1000);
  }),
);
