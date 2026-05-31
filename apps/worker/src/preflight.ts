/**
 * Pre-flight checks run BEFORE the LLM is invoked. These guard against
 * obvious garbage-in and produce explicit, user-visible diagnostics
 * (rather than letting the model hallucinate findings on a recipe PDF).
 */

export type PreflightSeverity = "info" | "warn" | "fatal";

export interface PreflightSignal {
  code: string;
  severity: PreflightSeverity;
  title: string;
  detail: string;
}

export interface PreflightResult {
  signals: PreflightSignal[];
  blocked: boolean;
}

interface PreflightInput {
  pageCount: number;
  charCount: number;
  text: string;
  declaredVisa: "O-1A" | "EB-1A";
}

const VISA_HINTS: Record<"O-1A" | "EB-1A", RegExp[]> = {
  "O-1A": [
    /\bo[-\s]?1a?\b/i,
    /\bnonimmigrant\b/i,
    /\bextraordinary ability\b/i,
    /\bform\s+i[-\s]?129\b/i,
  ],
  "EB-1A": [
    /\beb[-\s]?1a?\b/i,
    /\bemployment[-\s]?based\b/i,
    /\bimmigrant\s+petition\b/i,
    /\bform\s+i[-\s]?140\b/i,
    /\b8\s*c\.?f\.?r\.?\s*[§sec.]+\s*204\.5/i,
  ],
};

const PETITION_MARKERS = [
  /\buscis\b/i,
  /\bpetition(er)?\b/i,
  /\bbeneficiary\b/i,
  /\bvisa\b/i,
  /\bcriteri(?:on|a)\b/i,
  /\bregulatory\b/i,
  /\b8\s*c\.?f\.?r\.?/i,
  /\bin\s+re:\s*petition\b/i,
];

export function preflight(input: PreflightInput): PreflightResult {
  const signals: PreflightSignal[] = [];
  const { pageCount, charCount, text, declaredVisa } = input;

  // ─── Empty / scanned PDF ──────────────────────────────────────
  if (charCount < 300) {
    signals.push({
      code: "empty-extract",
      severity: "fatal",
      title: "Pulse couldn't read meaningful text from this PDF",
      detail:
        charCount === 0
          ? "No text was extracted. This is usually a scanned (image-only) PDF. Pulse does not support OCR yet — please upload a text-based PDF."
          : `Only ${charCount} characters extracted. The document may be scanned, encrypted, or empty.`,
    });
  } else if (charCount < 1500) {
    signals.push({
      code: "short-extract",
      severity: "warn",
      title: "Petition is unusually short",
      detail: `Only ~${charCount} characters extracted across ${pageCount} page${pageCount === 1 ? "" : "s"}. Real O-1A / EB-1A briefs typically run thousands of words. Findings below may be incomplete.`,
    });
  }

  // ─── Doesn't look like a petition ─────────────────────────────
  const markerHits = PETITION_MARKERS.filter((re) => re.test(text)).length;
  if (charCount >= 300 && markerHits < 3) {
    signals.push({
      code: "non-petition",
      severity: "fatal",
      title: "This does not look like a U.S. immigration petition",
      detail: `Only ${markerHits} of the standard petition markers (USCIS, petitioner, beneficiary, criteria, regulatory citations) were found. Pulse will not analyze this document — please upload a draft petition.`,
    });
  }

  // ─── Visa-type mismatch ───────────────────────────────────────
  const sample = text.slice(0, 6000); // first 6k chars is usually intro + framework
  const declaredMatches = VISA_HINTS[declaredVisa].filter((re) =>
    re.test(sample),
  ).length;
  const otherVisa = declaredVisa === "O-1A" ? "EB-1A" : "O-1A";
  const otherMatches = VISA_HINTS[otherVisa].filter((re) => re.test(sample))
    .length;

  if (charCount >= 1500 && declaredMatches === 0 && otherMatches > 0) {
    signals.push({
      code: "visa-mismatch",
      severity: "warn",
      title: `Petition appears to be ${otherVisa}, not ${declaredVisa}`,
      detail: `The document references ${otherVisa} markers but none of the ${declaredVisa} markers Pulse expects. If you picked the wrong visa type when creating the applicant, create a new one and re-upload. Findings will be evaluated against ${declaredVisa} regardless.`,
    });
  } else if (charCount >= 1500 && declaredMatches === 0) {
    signals.push({
      code: "visa-unclear",
      severity: "info",
      title: `Couldn't confirm this is a ${declaredVisa} petition`,
      detail: `No clear ${declaredVisa} markers were found in the first few pages. Findings will still be evaluated against ${declaredVisa}.`,
    });
  }

  const blocked = signals.some((s) => s.severity === "fatal");
  return { signals, blocked };
}
