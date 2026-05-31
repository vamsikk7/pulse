import { Router } from "express";
import mongoose from "mongoose";
import { ping as clamavPing, CLAMAV_ENABLED } from "../services/clamav.js";
import { CriteriaFreshnessModel } from "../models/index.js";

export const healthRouter = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Readiness check
 *     description: Returns service status, MongoDB and ClamAV connectivity, and criteria freshness.
 *     responses:
 *       200:
 *         description: Service health status
 */
healthRouter.get("/", async (_req, res) => {
  let clamav: string;
  if (!CLAMAV_ENABLED) {
    clamav = "disabled";
  } else {
    try {
      clamav = (await clamavPing()).slice(0, 20);
    } catch (err) {
      clamav = `unreachable: ${err instanceof Error ? err.message : "error"}`;
    }
  }

  const freshness = await CriteriaFreshnessModel.findOne({
    key: "criteria",
  }).lean();

  res.json({
    ok: true,
    service: "api",
    uptime: process.uptime(),
    mongo: mongoose.connection.readyState === 1 ? "up" : "down",
    clamav,
    criteria: freshness
      ? {
          lastSyncedAt: freshness.lastSyncedAt,
          lastSuccessfulSyncAt: freshness.lastSuccessfulSyncAt,
          lastChangedAt: freshness.lastChangedAt,
          consecutiveFailures: freshness.consecutiveFailures,
          lastError: freshness.lastError || undefined,
        }
      : null,
    time: new Date().toISOString(),
  });
});
