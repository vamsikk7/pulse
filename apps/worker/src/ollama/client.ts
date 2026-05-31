import OpenAI from "openai";
import { LlmSettingsModel } from "../db.js";

const DEFAULTS = {
  baseURL: process.env.OLLAMA_BASE_URL ?? "http://host.docker.internal:11434/v1",
  model: process.env.OLLAMA_MODEL ?? "deepseek-r1:8b",
  apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
};

export const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE ?? "10m";

export interface ResolvedLlmConfig {
  client: OpenAI;
  baseURL: string;
  model: string;
  temperature: number;
  maxTokens: number;
  source: "user-config" | "env-default";
}

const cache = new Map<
  string,
  { config: ResolvedLlmConfig; expiresAt: number }
>();
const CACHE_TTL_MS = 30_000;

/**
 * Resolve the LLM config for a given user. Reads from Mongo first
 * (user-configured) and falls back to env-var defaults. Cached for 30s.
 */
export async function resolveLlmConfig(
  userId: string,
): Promise<ResolvedLlmConfig> {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.config;

  const settings = await LlmSettingsModel.findOne({ userId }).lean();
  const baseURL = settings?.baseUrl?.trim() || DEFAULTS.baseURL;
  const model = settings?.model?.trim() || DEFAULTS.model;
  const apiKey = settings?.apiKey?.trim() || DEFAULTS.apiKey;
  const temperature =
    typeof settings?.temperature === "number" ? settings.temperature : 0.2;
  const maxTokens =
    typeof settings?.maxTokens === "number" ? settings.maxTokens : 4096;

  const client = new OpenAI({ baseURL, apiKey });
  const config: ResolvedLlmConfig = {
    client,
    baseURL,
    model,
    temperature,
    maxTokens,
    source: settings ? "user-config" : "env-default",
  };

  cache.set(userId, { config, expiresAt: Date.now() + CACHE_TTL_MS });
  return config;
}

export function invalidateLlmConfigCache(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}

/**
 * Pre-warm the model so the first real job doesn't pay the cold-start cost.
 * Uses the env-default config (we don't know the user at boot time).
 */
let warmed = false;
export async function ensureWarm(): Promise<void> {
  if (warmed) return;
  try {
    const client = new OpenAI({
      baseURL: DEFAULTS.baseURL,
      apiKey: DEFAULTS.apiKey,
    });
    const start = Date.now();
    await client.chat.completions.create({
      model: DEFAULTS.model,
      messages: [{ role: "user", content: 'Reply with exactly: {"ok":true}' }],
      max_tokens: 32,
      temperature: 0,
      // @ts-expect-error Ollama-specific
      keep_alive: OLLAMA_KEEP_ALIVE,
    });
    warmed = true;
    console.log(`[llm] warm: ${DEFAULTS.model} (${Date.now() - start}ms)`);
  } catch (err) {
    console.warn("[llm] warm-up failed (will retry per job):", err);
  }
}
