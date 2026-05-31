// @ts-expect-error — pdfkit ships its own types but they're a bit fussy
import PDFDocument from "pdfkit";
import type { Response } from "express";

interface CriterionFinding {
  criterionCode: string;
  claimed: boolean;
  strength: "weak" | "moderate" | "strong";
  evidenceSummary: string;
  critique: string;
}

interface Weakness {
  severity: "info" | "minor" | "major" | "critical";
  title: string;
  detail: string;
  suggestedFix?: string;
}

interface Check {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
}

interface PreflightSignal {
  severity: "info" | "warn" | "fatal";
  title: string;
  detail: string;
}

export interface ReportInput {
  caseName: string;
  visaType: string;
  filename: string;
  generatedAt: Date;
  riskScore: number;
  overallSummary: string;
  criteriaFindings: CriterionFinding[];
  weaknesses: Weakness[];
  checks: Check[];
  preflightSignals: PreflightSignal[];
}

const PURPLE = "#6938ef";
const PURPLE_DARK = "#5925dc";
const GRAY_900 = "#101828";
const GRAY_700 = "#344054";
const GRAY_500 = "#667085";
const GRAY_200 = "#eaecf0";
const SUCCESS = "#17b26a";
const WARNING = "#f79009";
const ERROR = "#f04438";

export function streamReportPdf(res: Response, input: ReportInput): void {
  const safeName = input.caseName.replace(/[^a-zA-Z0-9 _\-]/g, "_").slice(0, 80);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="pulse-report-${safeName}.pdf"`,
  );

  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 64, bottom: 56, left: 56, right: 56 },
    info: {
      Title: `Pulse petition review — ${input.caseName}`,
      Author: "Pulse",
      Subject: "RFE risk review",
    },
  });

  doc.pipe(res);

  // ─── Header ───────────────────────────────────────────────────
  doc
    .fontSize(10)
    .fillColor(GRAY_500)
    .text("Pulse · petition risk review", { align: "left" });
  doc.moveDown(0.5);
  doc
    .fontSize(22)
    .fillColor(GRAY_900)
    .font("Helvetica-Bold")
    .text(input.caseName);
  doc.moveDown(0.2);
  doc
    .fontSize(11)
    .fillColor(GRAY_500)
    .font("Helvetica")
    .text(
      `${input.visaType} · ${input.filename} · Generated ${input.generatedAt.toLocaleString()}`,
    );

  doc.moveDown(1);
  drawRule(doc);
  doc.moveDown(0.6);

  // ─── Risk score ───────────────────────────────────────────────
  drawRiskBlock(doc, input.riskScore);
  if (input.overallSummary) {
    doc.moveDown(0.8);
    doc.fontSize(10).fillColor(GRAY_700).font("Helvetica").text(input.overallSummary, {
      width: 480,
    });
  }

  // ─── Pre-flight notices ───────────────────────────────────────
  const visiblePreflight = input.preflightSignals.filter(
    (s) => s.severity !== "fatal",
  );
  if (visiblePreflight.length > 0) {
    doc.moveDown(1);
    sectionTitle(doc, "Notices");
    for (const s of visiblePreflight) {
      bulletBlock(doc, s.title, s.detail, s.severity === "warn" ? WARNING : GRAY_500);
    }
  }

  // ─── Criteria findings ────────────────────────────────────────
  if (input.criteriaFindings.length > 0) {
    doc.moveDown(1);
    sectionTitle(doc, "Where your petition stands");
    for (const f of input.criteriaFindings) {
      criterionBlock(doc, f);
    }
  }

  // ─── Ranked weaknesses ────────────────────────────────────────
  if (input.weaknesses.length > 0) {
    doc.moveDown(0.6);
    sectionTitle(doc, "Things to fix before filing");
    const ranked = [...input.weaknesses].sort(
      (a, b) => severityRank(b.severity) - severityRank(a.severity),
    );
    for (const w of ranked) {
      weaknessBlock(doc, w);
    }
  }

  // ─── Checks ───────────────────────────────────────────────────
  if (input.checks.length > 0) {
    doc.moveDown(0.6);
    sectionTitle(doc, "What Pulse looked for");
    for (const c of input.checks) {
      checkBlock(doc, c);
    }
  }

  // ─── Footer disclaimer ────────────────────────────────────────
  doc.moveDown(1.5);
  drawRule(doc);
  doc.moveDown(0.4);
  doc
    .fontSize(8)
    .fillColor(GRAY_500)
    .text(
      "Pulse is a software tool, not a law firm. This report is informational only and does not create an attorney–client relationship. Always consult a licensed immigration attorney before filing.",
      { align: "left", width: 480 },
    );

  doc.end();
}

function drawRule(doc: PDFKit.PDFDocument) {
  const y = doc.y;
  doc
    .strokeColor(GRAY_200)
    .lineWidth(0.5)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke();
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.4);
  doc.fontSize(13).fillColor(GRAY_900).font("Helvetica-Bold").text(text);
  doc.moveDown(0.3);
}

function drawRiskBlock(doc: PDFKit.PDFDocument, score: number) {
  const clamped = Math.max(0, Math.min(100, score));
  const band =
    clamped < 35
      ? { color: SUCCESS, label: "Low risk" }
      : clamped < 65
        ? { color: WARNING, label: "Moderate risk" }
        : { color: ERROR, label: "High risk" };

  const x = doc.page.margins.left;
  const y = doc.y;
  const w = 460;
  const barWidth = 380;
  const barX = x + 76;
  const barY = y + 26;
  const filledW = (clamped / 100) * barWidth;

  doc.roundedRect(x, y, w, 64, 8).fillColor("#fafaff").fill();

  doc
    .fontSize(28)
    .fillColor(band.color)
    .font("Helvetica-Bold")
    .text(`${clamped}`, x + 16, y + 16, { width: 60, align: "left" });
  doc
    .fontSize(8)
    .fillColor(GRAY_500)
    .font("Helvetica")
    .text("/ 100 RFE risk", x + 16, y + 47);

  // bar background
  doc.roundedRect(barX, barY, barWidth, 8, 4).fillColor(GRAY_200).fill();
  // bar filled
  doc.roundedRect(barX, barY, filledW, 8, 4).fillColor(band.color).fill();

  doc
    .fontSize(11)
    .fillColor(band.color)
    .font("Helvetica-Bold")
    .text(band.label, barX, barY + 14);

  doc.fillColor(GRAY_900).font("Helvetica").fontSize(10);
  doc.y = y + 70;
}

function criterionBlock(doc: PDFKit.PDFDocument, f: CriterionFinding) {
  const strengthColor = !f.claimed
    ? GRAY_500
    : f.strength === "strong"
      ? SUCCESS
      : f.strength === "moderate"
        ? WARNING
        : ERROR;
  const strengthLabel = !f.claimed
    ? "not claimed"
    : f.strength === "strong"
      ? "Looks strong"
      : f.strength === "moderate"
        ? "Borderline"
        : "Needs work";

  doc.fontSize(11).fillColor(GRAY_900).font("Helvetica-Bold");
  doc.text(humanizeCriterion(f.criterionCode), { continued: true });
  doc
    .fontSize(9)
    .fillColor(strengthColor)
    .font("Helvetica")
    .text(`  ·  ${strengthLabel}`);
  if (f.evidenceSummary) {
    doc
      .fontSize(10)
      .fillColor(GRAY_700)
      .font("Helvetica")
      .text(f.evidenceSummary, { width: 480 });
  }
  if (f.critique) {
    doc
      .fontSize(9)
      .fillColor(GRAY_500)
      .text(`Critique: ${f.critique}`, { width: 480 });
  }
  doc.moveDown(0.5);
}

function weaknessBlock(doc: PDFKit.PDFDocument, w: Weakness) {
  const sevColor =
    w.severity === "critical"
      ? ERROR
      : w.severity === "major"
        ? WARNING
        : w.severity === "minor"
          ? WARNING
          : GRAY_500;
  doc
    .fontSize(11)
    .fillColor(sevColor)
    .font("Helvetica-Bold")
    .text(`• ${w.title}`, { width: 480 });
  if (w.detail) {
    doc
      .fontSize(10)
      .fillColor(GRAY_700)
      .font("Helvetica")
      .text(w.detail, { width: 480 });
  }
  if (w.suggestedFix) {
    doc
      .fontSize(9)
      .fillColor(PURPLE_DARK)
      .text(`Fix: ${w.suggestedFix}`, { width: 480 });
  }
  doc.moveDown(0.5);
}

function checkBlock(doc: PDFKit.PDFDocument, c: Check) {
  const mark = c.passed ? "✓" : "✗";
  const color = c.passed ? SUCCESS : ERROR;
  doc
    .fontSize(10)
    .fillColor(color)
    .font("Helvetica-Bold")
    .text(`${mark}  ${c.label}`, { continued: false, width: 480 });
  if (c.detail) {
    doc
      .fontSize(9)
      .fillColor(GRAY_500)
      .font("Helvetica")
      .text(c.detail, { indent: 14, width: 466 });
  }
  doc.moveDown(0.3);
}

function bulletBlock(
  doc: PDFKit.PDFDocument,
  title: string,
  detail: string,
  color: string,
) {
  doc.fontSize(10).fillColor(color).font("Helvetica-Bold").text(`• ${title}`);
  if (detail) {
    doc
      .fontSize(9)
      .fillColor(GRAY_700)
      .font("Helvetica")
      .text(detail, { indent: 10, width: 470 });
  }
  doc.moveDown(0.3);
}

function severityRank(s: Weakness["severity"]): number {
  return { info: 0, minor: 1, major: 2, critical: 3 }[s];
}

const CRITERION_TITLES: Record<string, string> = {
  "O1A-AWARDS": "Nationally or internationally recognized awards",
  "O1A-MEMBERSHIPS": "Membership in associations requiring outstanding achievement",
  "O1A-PUBLISHED-MATERIAL": "Published material about the petitioner",
  "O1A-JUDGING": "Participation as a judge of others' work",
  "O1A-ORIGINAL-CONTRIBUTIONS": "Original contributions of major significance",
  "O1A-SCHOLARLY-ARTICLES": "Authorship of scholarly articles",
  "O1A-CRITICAL-EMPLOYMENT": "Critical employment at distinguished organizations",
  "O1A-HIGH-SALARY": "High salary or remuneration",
  "EB1A-AWARDS": "Nationally or internationally recognized awards",
  "EB1A-MEMBERSHIPS": "Membership in associations requiring outstanding achievement",
  "EB1A-PUBLISHED-MATERIAL": "Published material about the petitioner",
  "EB1A-JUDGING": "Participation as a judge",
  "EB1A-ORIGINAL-CONTRIBUTIONS": "Original contributions of major significance",
  "EB1A-SCHOLARLY-ARTICLES": "Authorship of scholarly articles",
  "EB1A-EXHIBITIONS": "Artistic exhibitions or showcases",
  "EB1A-LEADING-ROLE": "Leading or critical role at distinguished organizations",
  "EB1A-HIGH-SALARY": "High salary or remuneration",
  "EB1A-COMMERCIAL-SUCCESS": "Commercial success in the performing arts",
};

function humanizeCriterion(code: string): string {
  return CRITERION_TITLES[code] ?? code;
}

void PURPLE; // ESLint silencer
