import { Router } from "express";
import asyncHandler from "express-async-handler";
import { z } from "zod";
import OpenAI from "openai";
import { LlmSettingsModel } from "../models/index.js";
import { getUserId } from "../middleware/clerk.js";

export const settingsRouter = Router();

const DEFAULTS = {
  provider: "ollama-local" as const,
  baseUrl: "http://host.docker.internal:11434/v1",
  model: "deepseek-r1:8b",
  apiKey: "",
  temperature: 0.2,
  maxTokens: 4096,
};

const UpsertSchema = z.object({
  provider: z.enum(["ollama-local", "openai", "anthropic-compat", "custom"]),
  baseUrl: z.string().url(),
  model: z.string().min(1).max(120),
  apiKey: z.string().max(500).optional(),
  temperature: z.number().min(0).max(2).default(0.2),
  maxTokens: z.number().int().min(256).max(32_000).default(4096),
});

/**
 * @openapi
 * /settings/llm:
 *   get:
 *     tags: [Settings]
 *     summary: Get LLM configuration
 *     responses:
 *       200:
 *         description: Current LLM settings (API key is never returned)
 */
settingsRouter.get(
  "/llm",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const s = await LlmSettingsModel.findOne({ userId }).lean();
    const merged = { ...DEFAULTS, ...(s ?? {}) };
    res.json({
      provider: merged.provider,
      baseUrl: merged.baseUrl,
      model: merged.model,
      // Never leak the actual key — just say whether one is set
      apiKeyConfigured: Boolean(merged.apiKey),
      temperature: merged.temperature,
      maxTokens: merged.maxTokens,
    });
  }),
);

/**
 * Smoke-test the supplied LLM config without saving it. Calls the configured
 * chat endpoint with a tiny prompt and returns the response preview + latency.
 * If apiKey is omitted, falls back to the saved key.
 *
 * @openapi
 * /settings/llm/test:
 *   post:
 *     tags: [Settings]
 *     summary: Test LLM connection
 *     responses:
 *       200:
 *         description: Test result with latency and preview
 */
const TestSchema = z.object({
  provider: z.string(),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  apiKey: z.string().optional(),
});

/**
 * "Test connection" doesn't invoke inference — that would take minutes on
 * reasoning models like deepseek-r1:8b. Instead we hit GET /v1/models, which:
 *   - confirms the base URL is reachable
 *   - confirms the API key is accepted
 *   - confirms the requested model is in the provider's list
 * All without generating a single token.
 */
settingsRouter.post(
  "/llm/test",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const body = TestSchema.parse(req.body);

    let apiKey = body.apiKey;
    if (!apiKey) {
      const existing = await LlmSettingsModel.findOne({ userId }).lean();
      apiKey = existing?.apiKey ?? "";
    }
    if (!apiKey) apiKey = "x"; // local LLMs typically accept any string

    const modelsUrl = body.baseUrl.replace(/\/$/, "") + "/models";

    try {
      const t0 = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const resp = await fetch(modelsUrl, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      const latencyMs = Date.now() - t0;

      if (!resp.ok) {
        res
          .status(resp.status)
          .send(
            `Endpoint reachable but returned HTTP ${resp.status}. ` +
              `Check your API key and base URL.`,
          );
        return;
      }

      const json = (await resp.json()) as
        | { data?: Array<{ id?: string }> }
        | { models?: Array<{ id?: string; name?: string }> }
        | Array<{ id?: string; name?: string }>;

      // Normalize across the two common shapes (OpenAI's `{data: [{id}]}`
      // and Ollama's `{models: [{name}]}`)
      const ids: string[] = Array.isArray(json)
        ? json.map((m) => m?.id ?? m?.name ?? "")
        : "data" in json && Array.isArray(json.data)
          ? json.data.map((m) => m?.id ?? "")
          : "models" in json && Array.isArray(json.models)
            ? json.models.map((m) => m?.id ?? m?.name ?? "")
            : [];

      const wanted = body.model.toLowerCase();
      const modelFound = ids.some((id) => id.toLowerCase() === wanted);
      const sample = ids
        .filter(Boolean)
        .slice(0, 4)
        .join(", ");

      res.json({
        ok: true,
        latencyMs,
        modelFound,
        modelsCount: ids.length,
        sampleModels: sample,
        note: modelFound
          ? `Endpoint reachable, "${body.model}" is available.`
          : `Endpoint reachable, but "${body.model}" wasn't in the model list (${sample}…). The request may still work if your provider doesn't enumerate models, but double-check the name.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res
        .status(400)
        .send(
          msg.includes("aborted")
            ? `Connection timed out after 10 s — is ${body.baseUrl} reachable from the Pulse server?`
            : msg.slice(0, 500),
        );
    }
  }),
);

/**
 * @openapi
 * /settings/llm:
 *   put:
 *     tags: [Settings]
 *     summary: Update LLM configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [provider, baseUrl, model]
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [ollama-local, openai, anthropic-compat, custom]
 *               baseUrl:
 *                 type: string
 *               model:
 *                 type: string
 *               apiKey:
 *                 type: string
 *               temperature:
 *                 type: number
 *               maxTokens:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Updated settings
 */
settingsRouter.put(
  "/llm",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const body = UpsertSchema.parse(req.body);
    const existing = await LlmSettingsModel.findOne({ userId });

    // If the client sent an empty apiKey, keep the existing one (avoid wiping
    // on every save). To explicitly clear, send "__clear__".
    let nextApiKey = existing?.apiKey ?? "";
    if (body.apiKey === "__clear__") nextApiKey = "";
    else if (body.apiKey && body.apiKey.length > 0) nextApiKey = body.apiKey;

    const updated = await LlmSettingsModel.findOneAndUpdate(
      { userId },
      {
        userId,
        provider: body.provider,
        baseUrl: body.baseUrl,
        model: body.model,
        apiKey: nextApiKey,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
      },
      { upsert: true, new: true },
    );

    res.json({
      provider: updated.provider,
      baseUrl: updated.baseUrl,
      model: updated.model,
      apiKeyConfigured: Boolean(updated.apiKey),
      temperature: updated.temperature,
      maxTokens: updated.maxTokens,
    });
  }),
);
