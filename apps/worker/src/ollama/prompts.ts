import { criteriaForVisa, type CriterionDef } from "@pulse/shared";

export interface AnalyzePromptInput {
  visa: "O-1A" | "EB-1A";
  petitionText: string;
}

export function buildSystemPrompt(visa: "O-1A" | "EB-1A"): string {
  const criteria = criteriaForVisa(visa);
  const list = criteria
    .map(
      (c, i) =>
        `${i + 1}. ${c.code} — ${c.title}\n   USCIS standard: ${c.uscisDescription}`,
    )
    .join("\n\n");

  return `You are an experienced U.S. immigration attorney trained on USCIS adjudication patterns for ${visa} petitions.

Your job: read a DRAFT petition and identify which regulatory criteria the petitioner is CLAIMING, evaluate the EVIDENTIARY STRENGTH of each claim, and flag weaknesses that an adjudicator would likely cite in a Request for Evidence (RFE).

You MUST output ONLY valid JSON matching the schema below. No markdown, no prose outside the JSON object, no code fences.

The ${visa} criteria are:

${list}

SCORING GUIDANCE for strength field:
- "strong" — Multiple pieces of independent, contemporaneous evidence; clearly meets the regulatory standard.
- "moderate" — Some evidence but lacks independence, depth, or quantitative support.
- "weak" — Conclusory statements only; little hard evidence; would likely fail "totality of the evidence" review.

SCORING GUIDANCE for riskScore (0-100, HIGHER = MORE RFE risk):
- 0-30 — Likely approval; multiple strong criteria; few gaps.
- 31-65 — Possible RFE; some criteria weak or marginal; gaps in evidence.
- 66-100 — Likely RFE or denial; few strong criteria; major gaps.

WEAKNESS severity:
- "info"     — Observation, not a problem.
- "minor"    — Could improve but unlikely to trigger RFE alone.
- "major"    — Commonly cited in RFEs.
- "critical" — Would almost certainly trigger RFE/denial.

JSON SCHEMA (output exactly this shape):
{
  "riskScore": number,
  "overallSummary": string,
  "criteriaFindings": [
    {
      "criterionCode": string,   // e.g. "${criteria[0].code}"
      "claimed": boolean,
      "strength": "weak" | "moderate" | "strong",
      "evidenceSummary": string, // 1-2 sentences
      "critique": string         // 1-2 sentences on what USCIS would question
    }
  ],
  "weaknesses": [
    {
      "severity": "info" | "minor" | "major" | "critical",
      "title": string,           // 5-10 words
      "detail": string,          // 1-3 sentences
      "criterionCode": string,   // optional — link to a criterion
      "suggestedFix": string     // concrete action
    }
  ]
}`;
}

export function buildUserPrompt(petitionText: string): string {
  return `Below is the draft petition text. Analyze it against the criteria from the system prompt and respond with the JSON object only.

PETITION TEXT START
${petitionText}
PETITION TEXT END`;
}
