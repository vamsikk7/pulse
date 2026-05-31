"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { RfeRiskGauge } from "./RfeRiskGauge";
import { WeaknessList } from "./WeaknessList";
import { CriterionGrid } from "./CriterionGrid";

interface PetitionLite {
  _id: string;
  filename: string;
  pageCount: number;
  createdAt: string;
  files?: Array<{
    role: "brief" | "exhibit";
    filename: string;
    fileSize?: number;
    pageCount?: number;
    ocrUsed?: boolean;
  }>;
  latestAnalysisId?: string;
  latestAnalysisStatus?: string;
  riskScore?: number;
}

interface AnalysisSnapshot {
  status: "queued" | "running" | "done" | "failed";
  progressLabel?: string;
  progressPct?: number;
  riskScore?: number;
  overallSummary?: string;
  errorMessage?: string;
  criteriaFindings?: Array<{
    criterionCode: string;
    claimed: boolean;
    strength: "weak" | "moderate" | "strong";
    evidenceSummary: string;
    critique: string;
  }>;
  weaknesses?: Array<{
    severity: "info" | "minor" | "major" | "critical";
    title: string;
    detail: string;
    criterionCode?: string;
    suggestedFix: string;
  }>;
  preflightSignals?: Array<{
    code: string;
    severity: "info" | "warn" | "fatal";
    title: string;
    detail: string;
  }>;
  checks?: Array<{
    code: string;
    label: string;
    passed: boolean;
    detail: string;
  }>;
  rawReasoning?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const DEBUG = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";

export function AnalysisPanel({
  petition,
  defaultCollapsed = false,
}: {
  petition: PetitionLite;
  defaultCollapsed?: boolean;
}) {
  const [snap, setSnap] = useState<AnalysisSnapshot | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function onRemove() {
    if (
      !window.confirm(
        "Remove this petition from review?\n\nThis cancels the review (if it's still running) and hides the petition from the dashboard. The file itself stays in storage so you can audit later if needed.",
      )
    ) {
      return;
    }
    setRemoving(true);
    try {
      const res = await fetch(`${API_URL}/petitions/${petition._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);
      window.alert(
        err instanceof Error ? `Couldn't remove: ${err.message}` : "Couldn't remove the petition",
      );
      setRemoving(false);
    }
  }

  useEffect(() => {
    if (!petition.latestAnalysisId) return;
    const url = `${API_URL}/analyses/${petition.latestAnalysisId}/stream${DEBUG ? "?debug=1" : ""}`;
    const es = new EventSource(url, { withCredentials: true });
    es.addEventListener("snapshot", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setSnap(data);
      } catch {
        // ignore
      }
    });
    es.addEventListener("end", () => es.close());
    es.onerror = () => es.close();
    return () => es.close();
  }, [petition.latestAnalysisId]);

  const status = snap?.status ?? petition.latestAnalysisStatus ?? "queued";
  const score = snap?.riskScore ?? petition.riskScore ?? 0;

  return (
    <div className="card overflow-hidden">
      <div
        className={`flex items-center justify-between px-5 py-4 cursor-pointer select-none hover:bg-gray-50/50 transition-colors ${
          isCollapsed ? "" : "border-b border-gray-100"
        }`}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (
            target.closest("button") ||
            target.closest("a") ||
            target.closest("details")
          ) {
            return;
          }
          setIsCollapsed(!isCollapsed);
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-400">
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <FileText className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {petition.filename}
              {petition.files && petition.files.length > 1 && (
                <span className="ml-2 inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                  +{petition.files.length - 1} exhibit
                  {petition.files.length === 2 ? "" : "s"}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {petition.pageCount > 0
                ? `${petition.pageCount} page${petition.pageCount === 1 ? "" : "s"} total · `
                : ""}
              Uploaded {new Date(petition.createdAt).toLocaleString()}
            </p>
            {petition.files && petition.files.length > 1 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] font-medium text-brand-700 hover:text-brand-800">
                  View {petition.files.length} file
                  {petition.files.length === 1 ? "" : "s"}
                </summary>
                <ul className="mt-2 space-y-1 text-[11px]">
                  {petition.files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-600">
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide">
                        {f.role}
                      </span>
                      <span>{f.filename}</span>
                      <span className="text-gray-400">
                        ({f.pageCount ?? 0} pages
                        {f.ocrUsed ? " · OCR'd" : ""})
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          {status === "done" && petition.latestAnalysisId && (
            <a
              href={`${API_URL}/analyses/${petition.latestAnalysisId}/report.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              title="Download PDF report"
              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-700"
              aria-label="Download PDF report"
            >
              <Download className="h-4 w-4" />
            </a>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            title="Withdraw this petition from review"
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-error-50 hover:text-error-600 disabled:opacity-50"
            aria-label="Remove petition"
          >
            {removing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-6">
          {status === "queued" || status === "running" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
              <span>
                {snap?.progressLabel || "Queued — waiting for the worker"}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${Math.max(5, (snap?.progressPct ?? 0) * 100)}%` }}
              />
            </div>
          </div>
        ) : status === "failed" ? (
          <FailureBlock
            errorMessage={snap?.errorMessage}
            signals={snap?.preflightSignals}
          />
        ) : (
          <div className="space-y-8">
            {snap?.preflightSignals && snap.preflightSignals.length > 0 && (
              <PreflightWarnings signals={snap.preflightSignals} />
            )}
            <RfeRiskGauge score={score} />
            {snap?.overallSummary && (
              <p className="rounded-xl border border-gray-100 bg-gray-25 px-4 py-3 text-sm leading-6 text-gray-700">
                {snap.overallSummary}
              </p>
            )}
            {snap?.checks && snap.checks.length > 0 && (
              <ChecksRunCard checks={snap.checks} />
            )}
            {snap?.criteriaFindings && snap.criteriaFindings.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  Where your petition stands
                </h3>
                <p className="mb-3 text-sm text-gray-500">
                  How each USCIS criterion looks based on the evidence in your petition.
                </p>
                <CriterionGrid findings={snap.criteriaFindings} />
              </div>
            )}
            {snap?.weaknesses && snap.weaknesses.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  Things to fix before filing
                </h3>
                <p className="mb-3 text-sm text-gray-500">
                  In order of how likely they are to cause a problem with USCIS.
                </p>
                <WeaknessList weaknesses={snap.weaknesses} />
              </div>
            )}
            {DEBUG && snap?.rawReasoning && (
              <details
                open={showDebug}
                onToggle={(e) =>
                  setShowDebug((e.target as HTMLDetailsElement).open)
                }
                className="rounded-xl border border-warning-200 bg-warning-50 p-3"
              >
                <summary className="cursor-pointer text-xs font-semibold text-warning-700">
                  Show analysis trace (debug)
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs text-warning-700">
                  {snap.rawReasoning}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function FailureBlock({
  errorMessage,
  signals,
}: {
  errorMessage?: string;
  signals?: AnalysisSnapshot["preflightSignals"];
}) {
  const fatal = signals?.find((s) => s.severity === "fatal");
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-error-200 bg-error-50 p-4">
        <div className="flex items-start gap-2.5">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-error-500" />
          <div>
            <p className="text-sm font-semibold text-error-700">
              {fatal?.title ?? "We couldn't review this file"}
            </p>
            <p className="mt-1 text-sm leading-6 text-error-700/90">
              {fatal?.detail ?? errorMessage ?? "Re-upload to try again."}
            </p>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Upload a different file or fix the issue above and try again.
      </p>
    </div>
  );
}

function PreflightWarnings({
  signals,
}: {
  signals: NonNullable<AnalysisSnapshot["preflightSignals"]>;
}) {
  const visible = signals.filter((s) => s.severity !== "fatal");
  if (visible.length === 0) return null;
  return (
    <div className="space-y-2">
      {visible.map((s, i) => (
        <div
          key={i}
          className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-6 ${
            s.severity === "warn"
              ? "border-warning-200 bg-warning-50 text-warning-700"
              : "border-gray-200 bg-gray-50 text-gray-700"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{s.title}</p>
            <p className="mt-0.5 text-xs leading-5 opacity-90">{s.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChecksRunCard({
  checks,
}: {
  checks: NonNullable<AnalysisSnapshot["checks"]>;
}) {
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  return (
    <details className="rounded-xl border border-gray-200 bg-gray-25" open>
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            What Pulse looked for
          </p>
          <p className="text-xs text-gray-500">
            {checks.length} deterministic checks run on the petition text
          </p>
        </div>
        <span className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 font-semibold text-success-700">
            <CheckCircle2 className="h-3 w-3" />
            {passed} passed
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-error-200 bg-error-50 px-2 py-0.5 font-semibold text-error-700">
            <XCircle className="h-3 w-3" />
            {failed} flagged
          </span>
        </span>
      </summary>
      <ul className="border-t border-gray-200 divide-y divide-gray-100">
        {checks.map((c) => (
          <li
            key={c.code}
            className="flex items-start gap-3 px-4 py-2.5 text-xs leading-5"
          >
            {c.passed ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-500" />
            ) : (
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error-500" />
            )}
            <div className="flex-1">
              <p
                className={`font-medium ${c.passed ? "text-gray-700" : "text-gray-900"}`}
              >
                {c.label}
              </p>
              {c.detail && (
                <p className="mt-0.5 text-gray-500">{c.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { className: string; label: string }> = {
    queued: {
      className: "border border-gray-200 bg-gray-50 text-gray-700",
      label: "Waiting to start",
    },
    running: {
      className: "border border-brand-200 bg-brand-50 text-brand-700",
      label: "Reviewing…",
    },
    done: {
      className: "border border-success-200 bg-success-50 text-success-700",
      label: "Review complete",
    },
    failed: {
      className: "border border-error-200 bg-error-50 text-error-700",
      label: "Something went wrong",
    },
    cancelled: {
      className: "border border-gray-200 bg-gray-50 text-gray-600",
      label: "Cancelled",
    },
  };
  const cfg = map[status] || map.queued || { className: "", label: status };
  return (
    <span className={`pill ${cfg.className}`}>
      {status === "running" && (
        <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
      )}
      {cfg.label}
    </span>
  );
}
