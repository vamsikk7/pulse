/**
 * Daily check against eCFR for any change in the criteria sections that
 * the LLM system prompt loads.
 *
 * Sections we care about:
 *   8 CFR § 214.2(o)(3)(iii)   O-1A criteria
 *   8 CFR § 204.5(h)(3)        EB-1A criteria
 *
 * eCFR's "versioner" API returns structured JSON. The endpoint we use:
 *   https://www.ecfr.gov/api/versioner/v1/full/{YYYY-MM-DD}/title-8.json
 *     ?section=204.5
 *     ?section=214.2
 *
 * We don't replace the in-code taxonomy automatically (that needs human
 * review). Instead we:
 *   1. Hash the relevant section nodes
 *   2. Compare against the last recorded hash
 *   3. If anything changed (or if there's no recorded hash), write a
 *      `CriteriaSnapshot` doc to Mongo with the new hash + timestamp +
 *      raw payload, and log a STALE warning so the dashboard can surface it
 *
 * Worst case (eCFR is unreachable, schema changes, etc.) we just log and
 * try again tomorrow. Never breaks the rest of the system.
 */

import * as crypto from "node:crypto";
import mongoose from "mongoose";
const { Schema } = mongoose;
type Model<T> = mongoose.Model<T>;

const ECFR_BASE = "https://www.ecfr.gov/api/versioner/v1/full";
const TIMEOUT_MS = 30_000;

interface SectionFetch {
  section: "204.5" | "214.2";
  hash: string;
  fetchedAt: string;
  size: number;
  ok: boolean;
  error?: string;
}

const CriteriaSnapshotSchema = new Schema(
  {
    fetchedAt: { type: Date, default: () => new Date(), index: true },
    sections: [
      {
        section: String,
        hash: String,
        size: Number,
        ok: Boolean,
        error: String,
      },
    ],
    changed: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "criteria_snapshots" },
);

export const CriteriaSnapshotModel: Model<any> =
  (mongoose.models.CriteriaSnapshot as Model<any>) ??
  mongoose.model("CriteriaSnapshot", CriteriaSnapshotSchema);

/**
 * Singleton document holding the freshness state for the criteria taxonomy.
 * Updated on every successful (or attempted) refresh so the API / UI can
 * say "last verified against eCFR at TIMESTAMP" without scanning snapshots.
 */
const CriteriaFreshnessSchema = new Schema(
  {
    key: { type: String, default: "criteria", unique: true, index: true },
    lastSyncedAt: { type: Date, default: null, index: true },
    lastSuccessfulSyncAt: { type: Date, default: null },
    lastChangedAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    consecutiveFailures: { type: Number, default: 0 },
    sectionsHash: { type: Map, of: String, default: {} },
  },
  { timestamps: true, collection: "criteria_freshness" },
);

export const CriteriaFreshnessModel: Model<any> =
  (mongoose.models.CriteriaFreshness as Model<any>) ??
  mongoose.model("CriteriaFreshness", CriteriaFreshnessSchema);

async function fetchSection(
  section: "204.5" | "214.2",
  isoDate: string,
): Promise<SectionFetch> {
  const url = `${ECFR_BASE}/${isoDate}/title-8.json?section=${section}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Pulse/0.1" },
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        section,
        hash: "",
        fetchedAt: new Date().toISOString(),
        size: 0,
        ok: false,
        error: `HTTP ${res.status}`,
      };
    }
    const text = await res.text();
    const json = JSON.parse(text);
    // Hash only the relevant subtree — the surrounding "content" wrapper can
    // change without the regulation changing.
    const relevant = extractSection(json, section);
    const stable = JSON.stringify(relevant);
    const hash = crypto.createHash("sha256").update(stable).digest("hex");
    return {
      section,
      hash,
      fetchedAt: new Date().toISOString(),
      size: stable.length,
      ok: true,
    };
  } catch (err) {
    return {
      section,
      hash: "",
      fetchedAt: new Date().toISOString(),
      size: 0,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Walk the eCFR JSON tree, return the deepest node whose `label_level` (or
 * equivalent) matches the section identifier. The actual eCFR JSON has a
 * nested structure; we look up by `identifier` field.
 */
function extractSection(payload: unknown, section: string): unknown {
  function walk(node: unknown): unknown | null {
    if (!node || typeof node !== "object") return null;
    const obj = node as Record<string, unknown>;
    if (obj.identifier === section) return obj;
    if (Array.isArray(obj.children)) {
      for (const c of obj.children) {
        const hit = walk(c);
        if (hit) return hit;
      }
    }
    return null;
  }
  return walk(payload) ?? payload;
}

export async function refreshCriteria(): Promise<{
  changed: boolean;
  sections: SectionFetch[];
}> {
  // eCFR allows historic dates; we ask for today's regulation snapshot.
  const today = new Date().toISOString().slice(0, 10);

  const sections = await Promise.all([
    fetchSection("204.5", today),
    fetchSection("214.2", today),
  ]);

  // Compare against the most recent successful snapshot
  const previous = await CriteriaSnapshotModel.findOne({
    "sections.ok": true,
  })
    .sort({ fetchedAt: -1 })
    .lean();

  let changed = false;
  if (!previous) {
    changed = true; // first run — record baseline
  } else {
    for (const s of sections) {
      if (!s.ok) continue;
      const prevSection = (previous.sections ?? []).find(
        (p: { section: string }) => p.section === s.section,
      );
      if (!prevSection || prevSection.hash !== s.hash) {
        changed = true;
        break;
      }
    }
  }

  await CriteriaSnapshotModel.create({
    fetchedAt: new Date(),
    sections,
    changed,
  });

  // ─── Update the freshness singleton (the "last synced at" record) ─
  const okCount = sections.filter((s) => s.ok).length;
  const allFailed = okCount === 0;
  const now = new Date();

  const sectionsHashEntries: [string, string][] = sections
    .filter((s) => s.ok)
    .map((s) => [s.section, s.hash]);

  const freshnessUpdate: Record<string, unknown> = {
    key: "criteria",
    lastSyncedAt: now,
  };
  if (!allFailed) {
    freshnessUpdate.lastSuccessfulSyncAt = now;
    freshnessUpdate.lastError = "";
    freshnessUpdate.consecutiveFailures = 0;
    if (sectionsHashEntries.length > 0) {
      freshnessUpdate.sectionsHash = Object.fromEntries(sectionsHashEntries);
    }
    if (changed) freshnessUpdate.lastChangedAt = now;
  } else {
    const lastErr =
      sections.find((s) => s.error)?.error ?? "all sections failed to fetch";
    freshnessUpdate.lastError = lastErr;
  }

  const setOps: Record<string, unknown> = { ...freshnessUpdate };
  const incOps: Record<string, number> | null = allFailed
    ? { consecutiveFailures: 1 }
    : null;

  await CriteriaFreshnessModel.updateOne(
    { key: "criteria" },
    {
      $set: setOps,
      ...(incOps ? { $inc: incOps } : {}),
    },
    { upsert: true },
  );

  if (changed && previous) {
    console.warn(
      `[criteria] ⚠ eCFR sections changed since last check (${okCount}/${sections.length} fetched OK). ` +
        "Review packages/shared/src/criteria.ts against the latest eCFR text.",
    );
  } else if (changed) {
    console.log(
      `[criteria] Recorded initial snapshot (${okCount}/${sections.length} sections fetched OK).`,
    );
  } else {
    console.log(
      `[criteria] No change since last check (${okCount}/${sections.length} sections fetched OK).`,
    );
  }

  return { changed, sections };
}
