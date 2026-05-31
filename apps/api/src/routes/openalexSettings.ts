import { Router } from "express";
import asyncHandler from "express-async-handler";
import { z } from "zod";
import { OpenAlexSettingsModel } from "../models/index.js";
import { getUserId } from "../middleware/clerk.js";

export const openalexSettingsRouter = Router();

const DEFAULTS = {
  mailto: "pulse-demo@example.com",
};

const UpsertSchema = z.object({
  mailto: z.string().email().max(200).optional(),
  apiKey: z.string().max(500).optional(),
});

/**
 * @openapi
 * /settings/openalex:
 *   get:
 *     tags: [Settings]
 *     summary: Get OpenAlex configuration
 *     responses:
 *       200:
 *         description: Current OpenAlex settings (API key is never returned)
 */
openalexSettingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const s = await OpenAlexSettingsModel.findOne({ userId }).lean();
    res.json({
      mailto: s?.mailto ?? DEFAULTS.mailto,
      apiKeyConfigured: Boolean(s?.apiKey),
    });
  }),
);

/**
 * @openapi
 * /settings/openalex:
 *   put:
 *     tags: [Settings]
 *     summary: Update OpenAlex configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mailto:
 *                 type: string
 *                 format: email
 *               apiKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated settings
 */
openalexSettingsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const body = UpsertSchema.parse(req.body);
    const existing = await OpenAlexSettingsModel.findOne({ userId });

    // Empty apiKey = keep existing. "__clear__" = wipe.
    let nextApiKey = existing?.apiKey ?? "";
    if (body.apiKey === "__clear__") nextApiKey = "";
    else if (body.apiKey && body.apiKey.length > 0) nextApiKey = body.apiKey;

    const updated = await OpenAlexSettingsModel.findOneAndUpdate(
      { userId },
      {
        userId,
        mailto: body.mailto ?? existing?.mailto ?? DEFAULTS.mailto,
        apiKey: nextApiKey,
      },
      { upsert: true, new: true },
    );

    res.json({
      mailto: updated.mailto,
      apiKeyConfigured: Boolean(updated.apiKey),
    });
  }),
);

/**
 * @openapi
 * /settings/openalex/test:
 *   post:
 *     tags: [Settings]
 *     summary: Test OpenAlex connectivity
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mailto:
 *                 type: string
 *               apiKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Test result with latency
 *       502:
 *         description: OpenAlex unreachable or returned error
 */
openalexSettingsRouter.post(
  "/test",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const body = z
      .object({
        mailto: z.string().optional(),
        apiKey: z.string().optional(),
      })
      .parse(req.body);

    let apiKey = body.apiKey;
    if (!apiKey) {
      const existing = await OpenAlexSettingsModel.findOne({ userId }).lean();
      apiKey = existing?.apiKey ?? "";
    }

    const mailto = body.mailto || DEFAULTS.mailto;
    const url = new URL("https://api.openalex.org/authors?search=test&per-page=1");
    url.searchParams.set("mailto", mailto);
    if (apiKey) url.searchParams.set("api_key", apiKey);

    try {
      const t0 = Date.now();
      const headers: Record<string, string> = { Accept: "application/json" };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const resp = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });
      const latencyMs = Date.now() - t0;
      if (!resp.ok) {
        const text = await resp.text();
        res
          .status(resp.status)
          .send(
            `OpenAlex returned HTTP ${resp.status}: ${text.slice(0, 200)}`,
          );
        return;
      }
      const json = (await resp.json()) as { meta?: { count?: number } };
      res.json({
        ok: true,
        latencyMs,
        totalAuthors: json.meta?.count ?? null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).send(msg.slice(0, 300));
    }
  }),
);
