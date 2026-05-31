import type { Job } from "bullmq";
import { LenientRfeAnalysisResultSchema } from "@pulse/shared";
import { PetitionModel, RfeAnalysisModel, CaseModel } from "../db.js";
import { fetchObject } from "../minio.js";
import { extractPdf, clipForLlm } from "../pdf/extract.js";
import { ocrPdf } from "../pdf/ocr.js";
import { resolveLlmConfig, OLLAMA_KEEP_ALIVE, ensureWarm } from "../ollama/client.js";
import { buildSystemPrompt, buildUserPrompt } from "../ollama/prompts.js";
import { stripThink, extractJsonObject } from "../ollama/strip-think.js";
import { runHeuristics, type CheckOutcome } from "../heuristics/index.js";
import { preflight, type PreflightSignal } from "../preflight.js";
import {
  findAuthor,
  getCoauthorNames,
  namesLikelyMatch,
  normalizeName,
} from "../openalex.js";
import {
  extractPetitionerName,
  extractRecommenderNames,
  extractClaimedCitations,
} from "../extractors.js";

interface AnalyzePayload {
  petitionId: string;
  analysisId: string;
}

export async function analyzePetition(job: Job<AnalyzePayload>): Promise<void> {
  const { petitionId, analysisId } = job.data;
  const startedAt = Date.now();

  const analysis = await RfeAnalysisModel.findById(analysisId);
  if (!analysis) throw new Error(`analysis ${analysisId} not found`);
  const petition = await PetitionModel.findById(petitionId);
  if (!petition) throw new Error(`petition ${petitionId} not found`);

  // If the petition was withdrawn before the worker picked up the job, bail.
  if (petition.deletedAt) {
    await RfeAnalysisModel.updateOne(
      { _id: analysisId },
      {
        $set: {
          status: "cancelled",
          progressLabel: "Cancelled — petition was withdrawn",
        },
      },
    );
    console.log(
      `[analyze] skipped petition=${petitionId} (deletedAt=${petition.deletedAt.toISOString()})`,
    );
    return;
  }

  const kase = await CaseModel.findById(petition.caseId);
  if (!kase) throw new Error(`case ${petition.caseId} not found`);

  const visa: "O-1A" | "EB-1A" = kase.visaType === "EB-1A" ? "EB-1A" : "O-1A";

  // ─── Build the file list (back-compat: synth from primary if files[] empty) ─
  const inputFiles: Array<{
    role: "brief" | "exhibit";
    filename: string;
    fileKey: string;
    fileSize: number;
  }> =
    Array.isArray(petition.files) && petition.files.length > 0
      ? petition.files.map((f: any) => ({
          role: f.role === "brief" ? "brief" : "exhibit",
          filename: f.filename,
          fileKey: f.fileKey,
          fileSize: f.fileSize ?? 0,
        }))
      : [
          {
            role: "brief",
            filename: petition.filename,
            fileKey: petition.fileKey,
            fileSize: petition.fileSize ?? 0,
          },
        ];

  await setProgress(
    analysisId,
    "running",
    0.1,
    inputFiles.length === 1
      ? "Fetching petition from storage"
      : `Fetching ${inputFiles.length} files from storage`,
  );

  const perFile: Array<{
    role: "brief" | "exhibit";
    filename: string;
    fileKey: string;
    fileSize: number;
    text: string;
    pageCount: number;
    textChars: number;
    ocrUsed: boolean;
  }> = [];
  let usedOcr = false;

  for (let i = 0; i < inputFiles.length; i++) {
    const f = inputFiles[i]!;
    await setProgress(
      analysisId,
      "running",
      0.15 + (0.1 * i) / inputFiles.length,
      `Reading ${f.filename} (${i + 1}/${inputFiles.length})`,
    );

    let buf: Buffer;
    try {
      buf = await fetchObject(f.fileKey);
    } catch (err) {
      console.warn(`[analyze] couldn't fetch ${f.fileKey}:`, err);
      continue;
    }

    let ex: { text: string; pageCount: number; charCount: number };
    try {
      ex = await extractPdf(buf);
    } catch (err) {
      const detail =
        err instanceof Error && /invalid pdf|bad xref|FormatError/i.test(err.message)
          ? `${f.filename}: file isn't a valid PDF or is corrupted.`
          : `${f.filename}: couldn't read this PDF.`;
      if (f.role === "brief") {
        await RfeAnalysisModel.updateOne(
          { _id: analysisId },
          {
            $set: {
              status: "failed",
              progressLabel: "We couldn't read the brief",
              errorMessage: detail,
              preflightSignals: [
                {
                  code: "pdf-parse-error",
                  severity: "fatal",
                  title: "We couldn't read the brief",
                  detail,
                },
              ],
              durationMs: Date.now() - startedAt,
            },
          },
        );
        console.warn(`[analyze] brief pdf-parse failed petition=${petitionId}:`, err);
        return;
      }
      console.warn(`[analyze] exhibit pdf-parse failed (${f.filename}):`, err);
      continue;
    }

    let ocrUsed = false;
    if (ex.charCount < 300 && ex.pageCount > 0) {
      await setProgress(
        analysisId,
        "running",
        0.18 + (0.1 * i) / inputFiles.length,
        `${f.filename} looks scanned — running OCR`,
      );
      try {
        const ocr = await ocrPdf(buf);
        if (ocr.text.length > ex.text.length) {
          ex = {
            text: ocr.text,
            pageCount: ocr.pageCount,
            charCount: ocr.text.length,
          };
          ocrUsed = true;
          usedOcr = true;
        }
      } catch (err) {
        console.warn(
          `[analyze] OCR failed for ${f.filename}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    perFile.push({
      role: f.role,
      filename: f.filename,
      fileKey: f.fileKey,
      fileSize: f.fileSize,
      text: ex.text,
      pageCount: ex.pageCount,
      textChars: ex.charCount,
      ocrUsed,
    });
  }

  if (perFile.length === 0) {
    await RfeAnalysisModel.updateOne(
      { _id: analysisId },
      {
        $set: {
          status: "failed",
          progressLabel: "We couldn't read any of the uploaded files",
          errorMessage:
            "None of the uploaded PDFs could be read. Save them from a different viewer and re-upload.",
        },
      },
    );
    return;
  }

  // Build the merged corpus the LLM will see
  const combined = perFile
    .map((p) => {
      const heading =
        p.role === "brief"
          ? `=== BRIEF: ${p.filename} ===`
          : `=== EXHIBIT: ${p.filename} ===`;
      return `${heading}\n\n${p.text}`;
    })
    .join("\n\n\n");

  const extracted = {
    text: combined,
    charCount: combined.length,
    pageCount: perFile.reduce((sum, p) => sum + p.pageCount, 0),
  };

  // Persist back to petition (top-level totals + per-file stats). Use
  // updateOne so the files[] replacement writes through reliably.
  await PetitionModel.updateOne(
    { _id: petition._id },
    {
      $set: {
        textExtracted: combined,
        textChars: combined.length,
        pageCount: extracted.pageCount,
        files: perFile.map((p) => ({
          role: p.role,
          filename: p.filename,
          fileKey: p.fileKey,
          fileSize: p.fileSize,
          contentType: "application/pdf",
          pageCount: p.pageCount,
          textChars: p.textChars,
          ocrUsed: p.ocrUsed,
        })),
      },
    },
  );

  // ─── Pre-flight: refuse to analyze garbage ─────────────────────
  await setProgress(analysisId, "running", 0.25, "Checking the document");
  const pf = preflight({
    pageCount: extracted.pageCount,
    charCount: extracted.charCount,
    text: extracted.text,
    declaredVisa: visa,
  });

  // If we OCR'd, add an info signal so the user knows accuracy may vary.
  if (usedOcr) {
    pf.signals.unshift({
      code: "ocr-used",
      severity: "info",
      title: "This PDF was scanned — Pulse used OCR to read it",
      detail:
        "Findings are based on text recovered by optical character recognition. Some words may be misread. For best results, upload a text-based PDF generated from Word or LaTeX.",
    });
  }

  // Persist preflight signals onto the analysis row immediately so the UI can
  // show them even if we later bail out.
  await RfeAnalysisModel.updateOne(
    { _id: analysisId },
    { $set: { preflightSignals: pf.signals } },
  );

  if (pf.blocked) {
    const fatal = pf.signals.find((s) => s.severity === "fatal");
    await RfeAnalysisModel.updateOne(
      { _id: analysisId },
      {
        $set: {
          status: "failed",
          progressLabel: fatal?.title ?? "Analysis blocked",
          errorMessage: fatal?.detail ?? "Pre-flight check failed",
          durationMs: Date.now() - startedAt,
        },
      },
    );
    console.warn(
      `[analyze] preflight blocked petition=${petitionId}: ${fatal?.code}`,
    );
    return;
  }

  // ─── LLM analysis ──────────────────────────────────────────────
  const clipped = clipForLlm(extracted.text, 22_000);

  await setProgress(analysisId, "running", 0.35, "Warming up the analysis engine");
  const llm = await resolveLlmConfig(petition.userId);
  await ensureWarm();

  await setProgress(
    analysisId,
    "running",
    0.45,
    `Analyzing ${visa} regulatory criteria`,
  );

  const system = buildSystemPrompt(visa);
  const user = buildUserPrompt(clipped);

  let parsed: import("@pulse/shared").RfeAnalysisResult;
  let reasoningOut = "";
  let rawOut = "";

  try {
    const result = await callOllama(llm, system, user);
    rawOut = result.raw;
    reasoningOut = result.reasoning;
    parsed = result.parsed;
  } catch (err) {
    console.warn("[analyze] first attempt failed; retrying with stricter prompt", err);
    await setProgress(
      analysisId,
      "running",
      0.6,
      "First parse failed — retrying with stricter prompt",
    );
    const retrySystem =
      system +
      "\n\nIMPORTANT: Your previous response failed to parse as JSON. Respond ONLY with a valid JSON object. No prose, no markdown, no <think> blocks in your final answer.";
    const result = await callOllama(llm, retrySystem, user);
    rawOut = result.raw;
    reasoningOut = result.reasoning;
    parsed = result.parsed;
  }

  // ─── OpenAlex external verification ───────────────────────────
  await setProgress(
    analysisId,
    "running",
    0.78,
    "Cross-checking claims against OpenAlex",
  );
  const openalex = await runOpenAlexChecks(extracted.text);

  // ─── Heuristics layer ──────────────────────────────────────────
  await setProgress(analysisId, "running", 0.85, "Running deterministic checks");
  const heuristics = runHeuristics(extracted.text);
  for (const signal of heuristics.signals) {
    parsed.weaknesses.push({
      severity: signal.severity,
      title: signal.title,
      detail: signal.detail,
      suggestedFix: suggestFix(signal.code),
    });
  }

  // OpenAlex-derived weaknesses
  for (const signal of openalex.signals) {
    parsed.weaknesses.push({
      severity: signal.severity,
      title: signal.title,
      detail: signal.detail,
      suggestedFix: signal.suggestedFix,
    });
  }

  // Add preflight warnings (non-fatal ones)
  for (const signal of pf.signals.filter((s) => s.severity !== "fatal")) {
    parsed.weaknesses.push({
      severity: signal.severity === "warn" ? "major" : "info",
      title: signal.title,
      detail: signal.detail,
      suggestedFix: preflightFix(signal.code),
    });
  }

  const boost = [...heuristics.signals, ...openalex.signals].reduce(
    (sum, s) =>
      sum + (s.severity === "critical" ? 8 : s.severity === "major" ? 5 : 1),
    0,
  );
  parsed.riskScore = Math.min(100, parsed.riskScore + boost);

  await RfeAnalysisModel.updateOne(
    { _id: analysisId },
    {
      $set: {
        status: "done",
        progressLabel: "Analysis complete",
        progressPct: 1,
        riskScore: parsed.riskScore,
        overallSummary: parsed.overallSummary,
        criteriaFindings: parsed.criteriaFindings,
        weaknesses: parsed.weaknesses,
        preflightSignals: pf.signals,
        checks: [
          ...heuristics.checks.map(serializeCheck),
          ...openalex.checks,
        ],
        rawModelOutput: rawOut.slice(0, 60_000),
        rawReasoning: reasoningOut.slice(0, 60_000),
        model: llm.model,
        durationMs: Date.now() - startedAt,
      },
    },
  );

  console.log(
    `[analyze] done petition=${petitionId} score=${parsed.riskScore} heuristic-signals=${heuristics.signals.length} openalex-signals=${openalex.signals.length} in ${Date.now() - startedAt}ms`,
  );
}

interface OpenAlexCheck {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
}

interface OpenAlexSignal {
  severity: "info" | "minor" | "major" | "critical";
  title: string;
  detail: string;
  suggestedFix: string;
}

async function runOpenAlexChecks(text: string): Promise<{
  checks: OpenAlexCheck[];
  signals: OpenAlexSignal[];
}> {
  const checks: OpenAlexCheck[] = [];
  const signals: OpenAlexSignal[] = [];

  const petitionerName = extractPetitionerName(text);
  if (!petitionerName) {
    checks.push({
      code: "openalex-citations",
      label: "Citation count verified on OpenAlex",
      passed: false,
      detail:
        "Pulse couldn't identify the petitioner's name from the brief — skipped external verification.",
    });
    return { checks, signals };
  }

  const author = await findAuthor(petitionerName);
  if (!author) {
    checks.push({
      code: "openalex-citations",
      label: "Citation count verified on OpenAlex",
      passed: false,
      detail: `No OpenAlex profile found for "${petitionerName}". The petitioner may publish under a different name, or their work isn't indexed there.`,
    });
    return { checks, signals };
  }

  const claimed = extractClaimedCitations(text);
  const actual = author.cited_by_count;

  if (claimed === null) {
    checks.push({
      code: "openalex-citations",
      label: "Citation count verified on OpenAlex",
      passed: true,
      detail: `OpenAlex profile found for ${author.display_name}: ${actual} total citations across ${author.works_count} works. Petition makes no specific citation claim to cross-check.`,
    });
  } else {
    const diff = Math.abs(claimed - actual);
    const ratio = claimed > 0 ? actual / claimed : 0;
    const matches = diff < 5 || (ratio >= 0.75 && ratio <= 1.25);
    if (matches) {
      checks.push({
        code: "openalex-citations",
        label: "Citation count verified on OpenAlex",
        passed: true,
        detail: `Petition claims ~${claimed}; OpenAlex reports ${actual} for ${author.display_name}. Consistent.`,
      });
    } else if (claimed > actual * 1.5) {
      checks.push({
        code: "openalex-citations",
        label: "Citation count verified on OpenAlex",
        passed: false,
        detail: `Petition claims ~${claimed} citations but OpenAlex reports only ${actual} for ${author.display_name}.`,
      });
      signals.push({
        severity: "major",
        title: "Citation count claim looks inflated",
        detail: `Petition references ~${claimed} citations; OpenAlex reports ${actual} for ${author.display_name}. USCIS adjudicators sometimes cross-check on Google Scholar — a discrepancy undermines credibility.`,
        suggestedFix:
          "Re-check the figure used in the brief. If a higher number is genuinely defensible (e.g., includes citations beyond OpenAlex's index), back it up with a screenshot of the source.",
      });
    } else {
      checks.push({
        code: "openalex-citations",
        label: "Citation count verified on OpenAlex",
        passed: false,
        detail: `Petition claims ~${claimed}; OpenAlex shows ${actual}. The brief may be under-selling the petitioner's impact.`,
      });
      signals.push({
        severity: "minor",
        title: "Citation count looks under-reported",
        detail: `OpenAlex shows ${actual} citations for ${author.display_name}, but the petition references only ~${claimed}. You may be selling yourself short.`,
        suggestedFix:
          "Pull a fresh citation count from OpenAlex or Google Scholar and update the brief to the higher number.",
      });
    }
  }

  const recommenders = extractRecommenderNames(text);
  if (recommenders.length === 0) {
    checks.push({
      code: "openalex-recommender-independence",
      label: "Recommender independence verified on OpenAlex",
      passed: false,
      detail:
        "Pulse couldn't identify recommender names in the brief — skipped independence verification.",
    });
  } else {
    const coauthors = await getCoauthorNames(author.id);
    const conflicts = recommenders.filter((r) =>
      [...coauthors].some((c) => namesLikelyMatch(c, r)),
    );
    if (conflicts.length === 0) {
      checks.push({
        code: "openalex-recommender-independence",
        label: "Recommender independence verified on OpenAlex",
        passed: true,
        detail: `Cross-checked ${recommenders.length} recommender name(s) against ${coauthors.size} co-authors on OpenAlex — no overlaps.`,
      });
    } else {
      checks.push({
        code: "openalex-recommender-independence",
        label: "Recommender independence verified on OpenAlex",
        passed: false,
        detail: `${conflicts.length} of ${recommenders.length} recommender(s) appear as co-authors of the petitioner on OpenAlex: ${conflicts.join(", ")}.`,
      });
      signals.push({
        severity: "major",
        title: "Recommender(s) appear as past co-authors on OpenAlex",
        detail: `${conflicts.join(", ")} ${conflicts.length === 1 ? "has" : "have"} co-authored work with ${author.display_name} according to OpenAlex. USCIS gives less weight to letters from people who've collaborated with the petitioner.`,
        suggestedFix:
          "Swap at least one of these for an independent expert who has cited the petitioner's work but never co-authored with them.",
      });
    }
  }

  // Defensive: silence unused-import warnings
  void normalizeName;

  return { checks, signals };
}

function serializeCheck(c: CheckOutcome) {
  return {
    code: c.code,
    label: c.label,
    passed: c.passed,
    detail: c.passed ? c.passDetail ?? "" : c.signal?.detail ?? "",
  };
}

async function callOllama(
  llm: Awaited<ReturnType<typeof resolveLlmConfig>>,
  system: string,
  user: string,
): Promise<{
  raw: string;
  reasoning: string;
  parsed: import("@pulse/shared").RfeAnalysisResult;
}> {
  const completion = await llm.client.chat.completions.create({
    model: llm.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: llm.temperature,
    max_tokens: llm.maxTokens,
    response_format: { type: "json_object" },
    // @ts-expect-error — Ollama-specific
    keep_alive: OLLAMA_KEEP_ALIVE,
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const { content, reasoning } = stripThink(raw);
  const jsonStr = extractJsonObject(content) ?? content;
  const json = JSON.parse(jsonStr);
  const parsed = LenientRfeAnalysisResultSchema.parse(json);
  return { raw, reasoning, parsed };
}

async function setProgress(
  analysisId: string,
  status: "running" | "done" | "failed",
  pct: number,
  label: string,
): Promise<void> {
  await RfeAnalysisModel.updateOne(
    { _id: analysisId },
    { $set: { status, progressPct: pct, progressLabel: label } },
  );
}

function suggestFix(code: string): string {
  switch (code) {
    case "low-citation-count":
      return "Pull a refreshed citation count from Google Scholar / OpenAlex and add an exhibit with per-paper citation breakdowns and field-normalized comparisons.";
    case "no-citations":
      return "Add a citation summary exhibit — total citations, h-index, and the top 5 papers that cite your work — so adjudicators can see the impact at a glance.";
    case "salary-no-comparator":
      return "Add a BLS OEWS exhibit (or SHRM/peer salary survey) showing the petitioner's compensation is at or above the 90th percentile for the role.";
    case "few-recommenders":
      return "Add 2–3 additional letters from independent experts (no prior co-authorship) at distinguished institutions.";
    case "no-recommenders":
      return "Add 5–8 letters from recognized experts in the field. The strongest are from independent reviewers who cite the petitioner's work but never collaborated with them.";
    case "potential-recommender-coauthor":
      return "Swap at least one collaborator letter for an independent expert who has cited but not co-authored with the petitioner.";
    case "stale-judging":
      return "Add a recent (within 12 months) judging or peer-review engagement to demonstrate ongoing reputation.";
    case "low-publications":
      return "Expand the scholarly-articles exhibit. If publications are genuinely few, lean harder on other criteria and drop this one rather than weaken the case.";
    default:
      return "Review and address.";
  }
}

function preflightFix(code: string): string {
  switch (code) {
    case "short-extract":
      return "Confirm the upload was the complete petition. If only a portion was uploaded, replace it with the full draft.";
    case "visa-mismatch":
      return "Create a new applicant with the correct visa type and re-upload the petition there.";
    case "visa-unclear":
      return "Make sure the petition opens with a clear regulatory citation (8 C.F.R. § 204.5(h) for EB-1A or 8 C.F.R. § 214.2(o) for O-1A).";
    default:
      return "Review and address.";
  }
}

export async function markAnalysisFailed(
  analysisId: string,
  err: unknown,
): Promise<void> {
  await RfeAnalysisModel.updateOne(
    { _id: analysisId },
    {
      $set: {
        status: "failed",
        progressLabel: "Analysis failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    },
  );
}
