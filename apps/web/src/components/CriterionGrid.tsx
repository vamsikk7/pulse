"use client";

import { X, AlertCircle } from "lucide-react";

interface Finding {
  criterionCode: string;
  claimed: boolean;
  strength: "weak" | "moderate" | "strong";
  evidenceSummary: string;
  critique: string;
}

const STRENGTH = {
  weak: "border border-error-200 bg-error-50 text-error-700",
  moderate: "border border-warning-200 bg-warning-50 text-warning-700",
  strong: "border border-success-200 bg-success-50 text-success-700",
};

const STRENGTH_LABEL = {
  weak: "Needs work",
  moderate: "Borderline",
  strong: "Looks strong",
};

const CRITERION_TITLES: Record<string, string> = {
  // O-1A
  "O1A-AWARDS": "Nationally or internationally recognized awards",
  "O1A-MEMBERSHIPS": "Membership in associations requiring outstanding achievement",
  "O1A-PUBLISHED-MATERIAL": "Published material about you in major media",
  "O1A-JUDGING": "Participation as a judge of others' work",
  "O1A-ORIGINAL-CONTRIBUTIONS": "Original contributions of major significance",
  "O1A-SCHOLARLY-ARTICLES": "Authorship of scholarly articles",
  "O1A-CRITICAL-EMPLOYMENT": "Critical employment at distinguished organizations",
  "O1A-HIGH-SALARY": "High salary or remuneration",
  // EB-1A
  "EB1A-AWARDS": "Nationally or internationally recognized awards",
  "EB1A-MEMBERSHIPS": "Membership in associations requiring outstanding achievement",
  "EB1A-PUBLISHED-MATERIAL": "Published material about you",
  "EB1A-JUDGING": "Participation as a judge",
  "EB1A-ORIGINAL-CONTRIBUTIONS": "Original contributions of major significance",
  "EB1A-SCHOLARLY-ARTICLES": "Authorship of scholarly articles",
  "EB1A-EXHIBITIONS": "Artistic exhibitions or showcases",
  "EB1A-LEADING-ROLE": "Leading or critical role at distinguished organizations",
  "EB1A-HIGH-SALARY": "High salary or remuneration",
  "EB1A-COMMERCIAL-SUCCESS": "Commercial success in the performing arts",
};

function titleForCode(code: string): string {
  return CRITERION_TITLES[code] ?? code;
}

export function CriterionGrid({ findings }: { findings: Finding[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {findings.map((f) => (
        <div
          key={f.criterionCode}
          className="card p-4 transition-shadow hover:shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold leading-5 text-gray-900">
              {titleForCode(f.criterionCode)}
            </p>
            {f.claimed ? (
              <span className={`pill shrink-0 ${STRENGTH[f.strength]}`}>
                {STRENGTH_LABEL[f.strength]}
              </span>
            ) : (
              <span className="pill shrink-0 border border-gray-200 bg-gray-50 text-gray-600">
                <X className="mr-0.5 h-3 w-3" /> not claimed
              </span>
            )}
          </div>
          <p className="mt-2.5 text-sm leading-6 text-gray-700">
            {f.evidenceSummary}
          </p>
          {f.critique && (
            <p className="mt-2 flex gap-1.5 text-xs leading-5 text-gray-500">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{f.critique}</span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
