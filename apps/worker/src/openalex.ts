/**
 * Thin OpenAlex client (https://api.openalex.org/). No API key required, but
 * adding `mailto=` raises your rate limit into the "polite pool".
 *
 * Config resolution (per user):
 *   1. OpenAlexSettings document keyed on userId (set via the Settings page)
 *   2. Worker env vars (OPENALEX_MAILTO, OPENALEX_API_KEY)
 */
import { OpenAlexSettingsModel } from "./db.js";

const BASE = "https://api.openalex.org";
const ENV_MAILTO = process.env.OPENALEX_MAILTO ?? "pulse-demo@example.com";
const ENV_API_KEY = process.env.OPENALEX_API_KEY ?? "";
const TIMEOUT_MS = 15_000;

// ── Per-user config resolution with short cache ──────────────────────
interface OpenAlexConfig {
  mailto: string;
  apiKey: string;
}

const CACHE_TTL_MS = 30_000;
const configCache = new Map<string, { config: OpenAlexConfig; expiresAt: number }>();

async function resolveConfig(userId?: string): Promise<OpenAlexConfig> {
  if (!userId) return { mailto: ENV_MAILTO, apiKey: ENV_API_KEY };

  const cached = configCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.config;

  const settings = await OpenAlexSettingsModel.findOne({ userId }).lean();
  const config: OpenAlexConfig = {
    mailto: (settings as any)?.mailto || ENV_MAILTO,
    apiKey: (settings as any)?.apiKey || ENV_API_KEY,
  };
  configCache.set(userId, { config, expiresAt: Date.now() + CACHE_TTL_MS });
  return config;
}

// ── Core fetch helper ────────────────────────────────────────────────

async function fetchJson<T>(path: string, userId?: string): Promise<T | null> {
  const config = await resolveConfig(userId);
  const url = new URL(path, BASE);
  if (!url.searchParams.has("mailto")) {
    url.searchParams.set("mailto", config.mailto);
  }
  if (config.apiKey && !url.searchParams.has("api_key")) {
    url.searchParams.set("api_key", config.apiKey);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface OpenAlexAuthor {
  id: string; // e.g. "https://openalex.org/A1234..."
  display_name: string;
  works_count: number;
  cited_by_count: number;
  summary_stats?: { h_index?: number; i10_index?: number };
  affiliations?: Array<{ institution: { display_name: string } }>;
}

export interface OpenAlexWork {
  id: string;
  title: string;
  publication_year: number;
  cited_by_count: number;
  authorships: Array<{
    author: { id: string; display_name: string };
  }>;
}

/**
 * Find the most-cited author matching this name. We rank by cited_by_count
 * because a real petitioner is almost always the high-impact person with
 * that name (vs. a long-tail of namesakes).
 */
export async function findAuthor(name: string, userId?: string): Promise<OpenAlexAuthor | null> {
  const cleaned = name.trim().replace(/\s+/g, " ");
  if (cleaned.length < 3) return null;
  const data = await fetchJson<{ results: OpenAlexAuthor[] }>(
    `/authors?search=${encodeURIComponent(cleaned)}&per-page=5`,
    userId,
  );
  if (!data?.results || data.results.length === 0) return null;
  // Sort by citation count, pick highest
  return [...data.results].sort(
    (a, b) => b.cited_by_count - a.cited_by_count,
  )[0]!;
}

export async function getAuthorWorks(
  authorId: string,
  limit = 50,
  userId?: string,
): Promise<OpenAlexWork[]> {
  const idShort = authorId.replace("https://openalex.org/", "");
  const data = await fetchJson<{ results: OpenAlexWork[] }>(
    `/works?filter=authorships.author.id:${idShort}&per-page=${limit}`,
    userId,
  );
  return data?.results ?? [];
}

/**
 * Build a Set of author display names the given author has co-published with.
 * Used to test recommender independence.
 */
export async function getCoauthorNames(authorId: string, userId?: string): Promise<Set<string>> {
  const works = await getAuthorWorks(authorId, 50, userId);
  const names = new Set<string>();
  for (const w of works) {
    for (const a of w.authorships ?? []) {
      if (a.author?.id !== authorId && a.author?.display_name) {
        names.add(normalizeName(a.author.display_name));
      }
    }
  }
  return names;
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compare two names with simple fuzz: tolerate middle initials, suffixes,
 * and reordering of first/last name.
 */
export function namesLikelyMatch(a: string, b: string): boolean {
  const an = normalizeName(a);
  const bn = normalizeName(b);
  if (an === bn) return true;
  const aTokens = an.split(" ").filter((t) => t.length > 1);
  const bTokens = bn.split(" ").filter((t) => t.length > 1);
  if (aTokens.length < 2 || bTokens.length < 2) return false;
  const aFirst = aTokens[0]!;
  const aLast = aTokens[aTokens.length - 1]!;
  const bFirst = bTokens[0]!;
  const bLast = bTokens[bTokens.length - 1]!;
  return aFirst === bFirst && aLast === bLast;
}
