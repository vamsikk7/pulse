import { request } from "undici";
import { ProcessingTimesModel } from "../db.js";
import type { ProcessingTimeBand } from "@pulse/shared";

/**
 * USCIS publishes processing times at
 *   https://egov.uscis.gov/processing-times/
 * The page is React-driven and pulls data from an API of the shape:
 *   https://egov.uscis.gov/processing-times/api/processingtime/{formId}/{officeCode}
 *
 * Form codes (subset):
 *   I-129  → form code "I-129"  (with sub-categories like "O-1", "L-1")
 *   I-140  → form code "I-140"  (with sub-categories like "EB-1A")
 *   I-485  → form code "I-485"
 *
 * This endpoint is undocumented and may change. We attempt a live fetch then
 * fall back to a committed snapshot.
 */
const FALLBACK_SNAPSHOT: ProcessingTimeBand[] = [
  // I-129 — O-1A
  { form: "I-129", serviceCenter: "VSC", formCategory: "O-1A", p50Days: 60, p80Days: 95, p93Days: 150 },
  { form: "I-129", serviceCenter: "CSC", formCategory: "O-1A", p50Days: 45, p80Days: 75, p93Days: 130 },
  { form: "I-129", serviceCenter: "NSC", formCategory: "O-1A", p50Days: 50, p80Days: 80, p93Days: 140 },
  { form: "I-129", serviceCenter: "TSC", formCategory: "O-1A", p50Days: 70, p80Days: 110, p93Days: 180 },
  // I-129 — L-1
  { form: "I-129", serviceCenter: "VSC", formCategory: "L-1", p50Days: 75, p80Days: 120, p93Days: 200 },
  { form: "I-129", serviceCenter: "CSC", formCategory: "L-1", p50Days: 60, p80Days: 100, p93Days: 170 },
  // I-140 — EB-1A
  { form: "I-140", serviceCenter: "NSC", formCategory: "EB-1A", p50Days: 240, p80Days: 360, p93Days: 540 },
  { form: "I-140", serviceCenter: "TSC", formCategory: "EB-1A", p50Days: 270, p80Days: 420, p93Days: 600 },
  // I-140 — EB-2 NIW
  { form: "I-140", serviceCenter: "NSC", formCategory: "EB-2-NIW", p50Days: 360, p80Days: 540, p93Days: 720 },
  { form: "I-140", serviceCenter: "TSC", formCategory: "EB-2-NIW", p50Days: 390, p80Days: 600, p93Days: 780 },
  // I-485
  { form: "I-485", serviceCenter: "NBC", formCategory: "", p50Days: 365, p80Days: 540, p93Days: 760 },
];

export async function refreshProcessingTimes(): Promise<{ source: "live" | "snapshot"; count: number }> {
  let live: ProcessingTimeBand[] = [];
  try {
    live = await fetchLiveSnapshot();
  } catch (err) {
    console.warn("[processing-times] live fetch failed, using snapshot:", err);
  }

  const bands = live.length > 0 ? live : FALLBACK_SNAPSHOT;
  const source: "live" | "snapshot" = live.length > 0 ? "live" : "snapshot";

  await ProcessingTimesModel.deleteMany({});
  await ProcessingTimesModel.create({
    asOf: new Date(),
    source,
    bands,
  });

  console.log(`[processing-times] refreshed: ${bands.length} bands (${source})`);
  return { source, count: bands.length };
}

async function fetchLiveSnapshot(): Promise<ProcessingTimeBand[]> {
  // The actual USCIS endpoint requires a complex form lookup that changes
  // with the site's React build. Attempting once for I-129/VSC; if the
  // shape isn't recognized we throw and let the caller fall back.
  const url =
    "https://egov.uscis.gov/processing-times/api/processingtime/I-129/VSC";
  const res = await request(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 Chrome/120.0",
    },
    bodyTimeout: 15000,
  });
  if (res.statusCode >= 400) throw new Error(`HTTP ${res.statusCode}`);
  const text = await res.body.text();
  // If we got HTML, this is the wrong endpoint shape — give up.
  if (text.trim().startsWith("<")) {
    throw new Error("expected JSON, got HTML — endpoint shape changed");
  }
  // Conservative: if we ever land here, swallow and return [] to use snapshot.
  // Real parsing would require reverse-engineering the (changing) USCIS schema.
  console.log("[processing-times] live JSON received — schema parsing not implemented; using snapshot");
  return [];
}

export async function bandFor(
  form: string,
  serviceCenter: string,
  formCategory?: string,
): Promise<ProcessingTimeBand | null> {
  const pt = await ProcessingTimesModel.findOne().sort({ asOf: -1 }).lean();
  if (!pt) return null;
  const bands = pt.bands as ProcessingTimeBand[];
  const exact = bands.find(
    (b) =>
      b.form === form &&
      b.serviceCenter === serviceCenter &&
      (formCategory ? b.formCategory === formCategory : true),
  );
  if (exact) return exact;
  const formMatch = bands.find((b) => b.form === form && b.serviceCenter === serviceCenter);
  if (formMatch) return formMatch;
  const anyServiceCenter = bands.find(
    (b) => b.form === form && (formCategory ? b.formCategory === formCategory : true),
  );
  return anyServiceCenter ?? null;
}
