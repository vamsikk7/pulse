import { Router } from "express";
import asyncHandler from "express-async-handler";
import { z } from "zod";
import { request as undiciRequest } from "undici";
import { UscisSettingsModel } from "../models/index.js";
import { getUserId } from "../middleware/clerk.js";

export const uscisSettingsRouter = Router();

const DEFAULTS = {
  baseUrl: "https://api-int.uscis.gov",
  enabled: true,
};

/**
 * @openapi
 * /settings/uscis:
 *   get:
 *     tags: [Settings]
 *     summary: Get USCIS sandbox API configuration
 *     responses:
 *       200:
 *         description: Current USCIS settings
 *   put:
 *     tags: [Settings]
 *     summary: Update USCIS sandbox API configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               baseUrl:
 *                 type: string
 *               clientId:
 *                 type: string
 *               clientSecret:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated settings
 */
const UpsertSchema = z.object({
  baseUrl: z.string().url(),
  clientId: z.string().max(500).optional(),
  clientSecret: z.string().max(500).optional(),
  enabled: z.boolean().default(true),
});

uscisSettingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const s = await UscisSettingsModel.findOne({ userId }).lean();
    res.json({
      baseUrl: s?.baseUrl ?? DEFAULTS.baseUrl,
      clientId: s?.clientId ?? "",
      clientSecretConfigured: Boolean(s?.clientSecret),
      enabled: s?.enabled ?? DEFAULTS.enabled,
    });
  }),
);

uscisSettingsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const body = UpsertSchema.parse(req.body);
    const existing = await UscisSettingsModel.findOne({ userId });

    // Empty clientSecret = keep existing. "__clear__" = wipe.
    let nextSecret = existing?.clientSecret ?? "";
    if (body.clientSecret === "__clear__") nextSecret = "";
    else if (body.clientSecret && body.clientSecret.length > 0)
      nextSecret = body.clientSecret;

    const updated = await UscisSettingsModel.findOneAndUpdate(
      { userId },
      {
        userId,
        baseUrl: body.baseUrl,
        clientId: body.clientId ?? existing?.clientId ?? "",
        clientSecret: nextSecret,
        enabled: body.enabled,
      },
      { upsert: true, new: true },
    );

    res.json({
      baseUrl: updated.baseUrl,
      clientId: updated.clientId,
      clientSecretConfigured: Boolean(updated.clientSecret),
      enabled: updated.enabled,
    });
  }),
);

/**
 * Test the supplied credentials by fetching an OAuth access token from the
 * sandbox base URL. Doesn't save and doesn't call the case-status endpoint
 * (which would need a valid staging receipt). If a 200 with `access_token`
 * comes back, the credentials are valid.
 *
 * @openapi
 * /settings/uscis/test:
 *   post:
 *     tags: [Settings]
 *     summary: Test USCIS sandbox credentials
 *     responses:
 *       200:
 *         description: Test result with latency
 */
const TestSchema = z.object({
  baseUrl: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().optional(),
});

uscisSettingsRouter.post(
  "/test",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const body = TestSchema.parse(req.body);

    let clientSecret = body.clientSecret;
    if (!clientSecret) {
      const existing = await UscisSettingsModel.findOne({ userId }).lean();
      clientSecret = existing?.clientSecret ?? "";
    }
    if (!clientSecret) {
      res.status(400).send("client secret not provided and none saved");
      return;
    }

    const base = body.baseUrl.replace(/\/$/, "");
    try {
      const t0 = Date.now();
      const resp = await undiciRequest(`${base}/oauth/accesstoken`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: body.clientId,
          client_secret: clientSecret,
        }).toString(),
        bodyTimeout: 15_000,
        headersTimeout: 15_000,
      });
      const latencyMs = Date.now() - t0;
      if (resp.statusCode >= 400) {
        const text = await resp.body.text();
        res
          .status(resp.statusCode)
          .send(`USCIS rejected the credentials (HTTP ${resp.statusCode}): ${text.slice(0, 200)}`);
        return;
      }
      const json = (await resp.body.json()) as {
        access_token?: string;
        expires_in?: number;
      };
      if (!json.access_token) {
        res.status(502).send("OAuth response missing access_token");
        return;
      }
      res.json({
        ok: true,
        latencyMs,
        expiresIn: json.expires_in ?? null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).send(msg.slice(0, 300));
    }
  }),
);
