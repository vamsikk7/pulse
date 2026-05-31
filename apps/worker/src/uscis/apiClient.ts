import { request } from "undici";
import type { UscisStatusResult } from "@pulse/shared";
import { UscisSettingsModel } from "../db.js";

/**
 * Client for the USCIS Developer Hub Case Status API.
 * https://developer.uscis.gov/
 *
 * Two-step auth:
 *   1. POST client_id + client_secret to {baseUrl}/oauth/accesstoken → Bearer token (~1h)
 *   2. GET {baseUrl}/case-status/v1/case-status/{receiptNumber} with that token → JSON
 *
 * Config resolution order (per user):
 *   1. UscisSettings document keyed on userId (set via the Settings page)
 *   2. Worker env vars (USCIS_API_*)
 *
 * If nothing's configured, this returns null so the caller falls through to
 * HTML scraping → mock fixtures.
 */

const ENV_BASE = (process.env.USCIS_API_BASE ?? "https://api-int.uscis.gov").replace(
  /\/$/,
  "",
);
const ENV_CLIENT_ID = process.env.USCIS_API_CLIENT_ID ?? "";
const ENV_CLIENT_SECRET = process.env.USCIS_API_CLIENT_SECRET ?? "";
const TIMEOUT_MS = 15_000;

/**
 * Valid staging receipt numbers from the USCIS Developer Hub sandbox.
 * Only these receipt numbers are accepted by the sandbox API.
 */
export const STAGING_RECEIPTS_WITH_HISTORY = new Set([
  "EAC9999103403", "EAC9999103404", "EAC9999103405", "EAC9999103410",
  "EAC9999103411", "EAC9999103416", "EAC9999103419",
  "LIN9999106498", "LIN9999106499", "LIN9999106504", "LIN9999106505", "LIN9999106506",
  "SRC9999102777", "SRC9999102778", "SRC9999102779", "SRC9999102780",
  "SRC9999102781", "SRC9999102782", "SRC9999102783", "SRC9999102784",
  "SRC9999102785", "SRC9999102786", "SRC9999102787",
  "SRC9999132710", "SRC9999132719",
]);

export const STAGING_RECEIPTS_WITHOUT_HISTORY = new Set([
  "EAC9999103400", "EAC9999103402", "EAC9999103406", "EAC9999103407",
  "EAC9999103408", "EAC9999103409", "EAC9999103412", "EAC9999103413",
  "EAC9999103414", "EAC9999103415", "EAC9999103420", "EAC9999103421",
  "EAC9999103424", "EAC9999103425", "EAC9999103426", "EAC9999103428",
  "EAC9999103429", "EAC9999103431", "EAC9999103432",
  "LIN9999106501", "LIN9999106507",
  "SRC9999132694", "SRC9999132695", "SRC9999132706", "SRC9999132707",
]);

export const ALL_STAGING_RECEIPTS = new Set([
  ...STAGING_RECEIPTS_WITH_HISTORY,
  ...STAGING_RECEIPTS_WITHOUT_HISTORY,
]);

function isSandboxUrl(base: string): boolean {
  return base.includes("api-int.uscis.gov");
}

export interface UscisApiConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  enabled: boolean;
  source: "user-config" | "env-default" | "none";
}

const CACHE_TTL_MS = 30_000;
const configCache = new Map<string, { config: UscisApiConfig; expiresAt: number }>();

export async function resolveUscisConfig(userId: string): Promise<UscisApiConfig> {
  const cached = configCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[uscis-api] resolveUscisConfig cached for userId=${userId} enabled=${cached.config.enabled} source=${cached.config.source}`);
    return cached.config;
  }

  const settings = await UscisSettingsModel.findOne({ userId }).lean();
  console.log(`[uscis-api] resolveUscisConfig db settings for userId=${userId}:`, settings);

  let config: UscisApiConfig;
  if (settings && (settings.clientId || ENV_CLIENT_ID)) {
    config = {
      baseUrl: (settings.baseUrl || ENV_BASE).replace(/\/$/, ""),
      clientId: settings.clientId || ENV_CLIENT_ID,
      clientSecret: settings.clientSecret || ENV_CLIENT_SECRET,
      enabled: settings.enabled !== false,
      source: settings.clientId ? "user-config" : "env-default",
    };
  } else if (ENV_CLIENT_ID && ENV_CLIENT_SECRET) {
    config = {
      baseUrl: ENV_BASE,
      clientId: ENV_CLIENT_ID,
      clientSecret: ENV_CLIENT_SECRET,
      enabled: true,
      source: "env-default",
    };
  } else {
    config = {
      baseUrl: ENV_BASE,
      clientId: "",
      clientSecret: "",
      enabled: false,
      source: "none",
    };
  }

  console.log(`[uscis-api] resolveUscisConfig final resolved config for userId=${userId}: enabled=${config.enabled} source=${config.source} clientId=${config.clientId ? "present" : "missing"}`);
  configCache.set(userId, { config, expiresAt: Date.now() + CACHE_TTL_MS });
  return config;
}

export function invalidateUscisConfigCache(userId?: string): void {
  if (userId) configCache.delete(userId);
  else configCache.clear();
}

// Per-config OAuth token cache (keyed on clientId since the same key
// works against any user that paste it in)
const tokenCache = new Map<
  string,
  { accessToken: string; expiresAt: number }
>();

async function getAccessToken(
  config: UscisApiConfig,
  opts: { forceRefresh?: boolean } = {},
): Promise<string | null> {
  console.log(
    `[uscis-api] getAccessToken starting for baseUrl=${config.baseUrl} clientId=${config.clientId}${opts.forceRefresh ? " (forceRefresh)" : ""}`,
  );
  if (!config.clientId || !config.clientSecret) {
    console.warn(`[uscis-api] getAccessToken missing clientId or clientSecret`);
    return null;
  }
  const key = `${config.baseUrl}::${config.clientId}`;
  const cached = tokenCache.get(key);
  if (!opts.forceRefresh && cached && cached.expiresAt - 60_000 > Date.now()) {
    console.log(`[uscis-api] getAccessToken returning cached token`);
    return cached.accessToken;
  }
  if (opts.forceRefresh) {
    tokenCache.delete(key);
  }
  try {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }).toString();
    console.log(`[uscis-api] getAccessToken POSTing to ${config.baseUrl}/oauth/accesstoken`);
    const res = await request(`${config.baseUrl}/oauth/accesstoken`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      bodyTimeout: TIMEOUT_MS,
      headersTimeout: TIMEOUT_MS,
    });
    console.log(`[uscis-api] getAccessToken token request status: ${res.statusCode}`);
    if (res.statusCode >= 400) {
      const errBody = await res.body.text();
      console.warn(`[uscis-api] token fetch HTTP ${res.statusCode}: ${errBody}`);
      return null;
    }
    const json = (await res.body.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    console.log(`[uscis-api] getAccessToken response JSON:`, json);
    if (!json.access_token) {
      console.warn(`[uscis-api] token response has no access_token`);
      return null;
    }
    tokenCache.set(key, {
      accessToken: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    });
    return json.access_token;
  } catch (err) {
    console.warn("[uscis-api] token fetch failed:", err);
    return null;
  }
}

/**
 * Fetch case status using the resolved per-user config. Returns null on any
 * failure so the caller can fall through to HTML scraping / mock.
 */
export async function fetchCaseStatusViaApi(
  receiptNumber: string,
  userId: string,
): Promise<UscisStatusResult | null> {
  console.log(`[uscis-api] fetchCaseStatusViaApi starting for receipt=${receiptNumber} userId=${userId}`);
  const config = await resolveUscisConfig(userId);
  if (!config.enabled || !config.clientId || !config.clientSecret) {
    console.warn(`[uscis-api] API not enabled or credentials missing: enabled=${config.enabled} clientId=${config.clientId ? "yes" : "no"}`);
    return null;
  }

  // Sandbox validation: only allow known staging receipt numbers
  if (isSandboxUrl(config.baseUrl) && !ALL_STAGING_RECEIPTS.has(receiptNumber.toUpperCase())) {
    console.warn(
      `[uscis-api] receipt ${receiptNumber} is not a valid staging receipt — skipping API call`,
    );
    return null;
  }

  const url = `${config.baseUrl}/case-status/${encodeURIComponent(receiptNumber)}`;

  // One retry with a fresh token if the first attempt comes back 401/403.
  // Covers the case where a token was cached but invalidated server-side
  // (manually revoked, expires_in shorter than advertised, clock skew, etc.).
  for (let attempt = 0; attempt < 2; attempt++) {
    const forceRefresh = attempt > 0;
    const token = await getAccessToken(config, { forceRefresh });
    if (!token) {
      console.warn(
        `[uscis-api] couldn't obtain access token (attempt ${attempt + 1}/2)`,
      );
      return null;
    }
    console.log(
      `[uscis-api] fetchCaseStatusViaApi GET ${url} (attempt ${attempt + 1}/2${forceRefresh ? ", fresh token" : ""})`,
    );
    try {
      const res = await request(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        bodyTimeout: TIMEOUT_MS,
        headersTimeout: TIMEOUT_MS,
      });
      console.log(`[uscis-api] case-status HTTP ${res.statusCode}`);
      if (res.statusCode === 401 || res.statusCode === 403) {
        console.warn(
          `[uscis-api] token rejected (HTTP ${res.statusCode}); clearing cache${attempt === 0 ? " and retrying with fresh token" : ""}`,
        );
        tokenCache.delete(`${config.baseUrl}::${config.clientId}`);
        if (attempt === 0) continue; // retry once with a fresh token
        return null;
      }
      if (res.statusCode === 404 || res.statusCode >= 400) {
        const errText = await res.body.text();
        console.warn(
          `[uscis-api] error response HTTP ${res.statusCode}: ${errText.slice(0, 300)}`,
        );
        return null;
      }
      const json = (await res.body.json()) as ApiCaseStatusResponse;
      return mapApiResponseToResult(json);
    } catch (err) {
      console.warn(
        `[uscis-api] case-status failed for ${receiptNumber} (attempt ${attempt + 1}/2):`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }
  return null;
}

interface ApiCaseStatusResponse {
  case_status?: {
    receiptNumber?: string;
    formNumber?: string;
    submittedDate?: string;
    modifiedDate?: string;
    current_case_status_text_en?: string;
    current_case_status_desc_en?: string;
  };
  message?: string;
}

function mapApiResponseToResult(json: ApiCaseStatusResponse): UscisStatusResult | null {
  const cs = json.case_status;
  if (!cs) return null;
  const title = cs.current_case_status_text_en?.trim();
  if (!title) return null;
  return {
    statusCode: normalize(title),
    statusTitle: title,
    statusDetail: cs.current_case_status_desc_en?.trim() ?? "",
    source: "live",
    scrapedAt: new Date().toISOString(),
    formNumber: cs.formNumber?.trim() || undefined,
  };
}

function normalize(title: string): string {
  return title
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}
