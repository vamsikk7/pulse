"use client";

import { AlertTriangle, AlertCircle, Info, ShieldAlert } from "lucide-react";

interface Weakness {
  severity: "info" | "minor" | "major" | "critical";
  title: string;
  detail: string;
  suggestedFix: string;
  criterionCode?: string;
}

const ICON = {
  info: Info,
  minor: AlertCircle,
  major: AlertTriangle,
  critical: ShieldAlert,
};

const STYLE = {
  info: "border-gray-200 bg-gray-25 text-gray-700",
  minor: "border-warning-200 bg-warning-50 text-warning-700",
  major: "border-warning-200 bg-warning-50 text-warning-700",
  critical: "border-error-200 bg-error-50 text-error-700",
};

const PILL = {
  info: "border border-gray-200 bg-white text-gray-600",
  minor: "border border-warning-200 bg-white text-warning-700",
  major: "border border-warning-200 bg-white text-warning-700",
  critical: "border border-error-200 bg-white text-error-700",
};

export function WeaknessList({ weaknesses }: { weaknesses: Weakness[] }) {
  const ranked = [...weaknesses].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );
  return (
    <ul className="space-y-2">
      {ranked.map((w, i) => {
        const Icon = ICON[w.severity];
        return (
          <li
            key={i}
            className={`rounded-xl border px-4 py-3.5 ${STYLE[w.severity]}`}
          >
            <details>
              <summary className="flex cursor-pointer items-center justify-between gap-3 list-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2.5 text-sm font-semibold">
                  <Icon className="h-4 w-4 shrink-0" />
                  {w.title}
                </span>
                <span className={`pill ${PILL[w.severity]}`}>{w.severity}</span>
              </summary>
              <div className="mt-3 space-y-2 text-sm leading-6">
                <p>{w.detail}</p>
                {w.suggestedFix && (
                  <p className="rounded-lg border border-white/40 bg-white/70 px-3 py-2 text-xs leading-5 text-gray-700">
                    <span className="font-semibold">Suggested fix: </span>
                    {w.suggestedFix}
                  </p>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

function severityRank(s: Weakness["severity"]): number {
  return { info: 0, minor: 1, major: 2, critical: 3 }[s];
}
