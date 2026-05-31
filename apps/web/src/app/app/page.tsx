import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  FileText,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  XCircle,
} from "lucide-react";
import { listCases, type CaseSummary } from "@/lib/api";
import { DashboardAutoRefresh } from "@/components/DashboardAutoRefresh";

export const dynamic = "force-dynamic";

export default async function CasesIndexPage() {
  const cases = await listCases();

  const totals = cases.reduce(
    (acc, c) => {
      acc.applicants += 1;
      acc.petitions += c.petitionCount ?? 0;
      acc.receipts += c.receiptCount ?? 0;
      acc.inFlight += c.inFlightAnalysisCount ?? 0;
      acc.failed += c.failedAnalysisCount ?? 0;
      acc.done += c.doneAnalysisCount ?? 0;
      acc.awaitingSync += c.awaitingFirstSyncCount ?? 0;
      // Sum actual stuck receipts, not "1 if any stuck"
      acc.stuck += c.stuckReceiptCount ?? 0;
      return acc;
    },
    {
      applicants: 0,
      petitions: 0,
      receipts: 0,
      done: 0,
      stuck: 0,
      inFlight: 0,
      failed: 0,
      awaitingSync: 0,
    },
  );

  return (
    <div className="space-y-10">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tightish text-gray-900">
            Dashboard
          </h1>
          <DashboardAutoRefresh
            inFlightCount={totals.inFlight}
            awaitingSyncCount={totals.awaitingSync}
          />
        </div>
        <p className="mt-1.5 max-w-2xl text-sm text-gray-500">
          Pulse gives you two independent tools &mdash; petition risk review and
          USCIS case tracking. Use either one on its own, or both together for
          the same applicant.
        </p>
      </header>

      {/* Two-tool entry points */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ToolCard
          icon={<ShieldCheck className="h-5 w-5" />}
          eyebrow="Before you file"
          title="Petition risk review"
          body="Upload a draft O-1A or EB-1A petition and get a per-criterion strength breakdown, a 0-100 risk score, and concrete fixes."
          stats={[
            {
              label: "petitions uploaded",
              value: String(totals.petitions),
            },
            {
              label: "reviews complete",
              value: String(totals.done),
              tone: totals.done > 0 ? ("good" as const) : ("neutral" as const),
            },
            ...(totals.inFlight > 0
              ? [
                  {
                    label: "in progress",
                    value: String(totals.inFlight),
                    tone: "live" as const,
                  },
                ]
              : []),
            ...(totals.failed > 0
              ? [
                  {
                    label: "failed",
                    value: String(totals.failed),
                    tone: "warn" as const,
                  },
                ]
              : []),
          ]}
          cta={{ label: "Start a review", href: "/app/cases/new?focus=review" }}
        />
        <ToolCard
          icon={<Clock className="h-5 w-5" />}
          eyebrow="After you file"
          title="USCIS case tracking"
          body="Add a USCIS receipt number once your petition is filed. Pulse pulls the latest status daily and flags any case taking longer than usual."
          stats={[
            {
              label: "receipts tracked",
              value: String(totals.receipts),
            },
            ...(totals.stuck > 0
              ? [
                  {
                    label: "stuck",
                    value: String(totals.stuck),
                    tone: "warn" as const,
                  },
                ]
              : []),
            ...(totals.awaitingSync > 0
              ? [
                  {
                    label: "awaiting sync",
                    value: String(totals.awaitingSync),
                    tone: "live" as const,
                  },
                ]
              : []),
          ]}
          cta={{ label: "Track a case", href: "/app/cases/new?focus=track" }}
        />
      </section>

      {/* Applicants list */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">
              Applicants
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {cases.length === 0
                ? "No applicants yet."
                : `${cases.length} ${cases.length === 1 ? "applicant" : "applicants"} — each one can have a petition review, a tracked receipt, or both.`}
            </p>
          </div>
          <Link href="/app/cases/new" className="btn-secondary">
            <Plus className="mr-1.5 h-4 w-4" />
            Add applicant
          </Link>
        </div>

        {cases.length === 0 ? (
          <div className="card flex flex-col items-center px-8 py-16 text-center">
            <p className="text-sm text-gray-600">No applicants yet.</p>
            <Link
              href="/app/cases/new"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              <Plus className="h-4 w-4" /> Add your first applicant
            </Link>
          </div>
        ) : (
          <ul className="card divide-y divide-gray-100 overflow-hidden">
            {cases.map((c) => (
              <li key={c._id}>
                <CaseRow c={c} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ─── Tool entry card ────────────────────────────────────────────

type StatTone = "neutral" | "warn" | "live" | "good";

function ToolCard({
  icon,
  eyebrow,
  title,
  body,
  stats,
  cta,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  stats: Array<{ label: string; value: string; tone?: StatTone }>;
  cta: { label: string; href: string };
}) {
  return (
    <div className="card flex h-full flex-col p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          {icon}
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
            {eyebrow}
          </p>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-gray-600">{body}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {stats.map((s) => {
          const isLive = s.tone === "live" && s.value !== "0";
          const isWarn = s.tone === "warn" && s.value !== "0";
          const isGood = s.tone === "good" && s.value !== "0";
          return (
            <div
              key={s.label}
              className={`rounded-lg border px-3 py-2 ${
                isWarn
                  ? "border-error-200 bg-error-50"
                  : isLive
                    ? "border-brand-200 bg-brand-50"
                    : isGood
                      ? "border-success-200 bg-success-50"
                      : "border-gray-200 bg-gray-25"
              }`}
            >
              <dt
                className={`text-[10px] font-medium uppercase tracking-wider ${
                  isWarn
                    ? "text-error-700"
                    : isLive
                      ? "text-brand-700"
                      : isGood
                        ? "text-success-700"
                        : "text-gray-500"
                }`}
              >
                {s.label}
              </dt>
              <dd
                className={`mt-0.5 flex items-center gap-1.5 text-xl font-semibold tabular-nums ${
                  isWarn
                    ? "text-error-700"
                    : isLive
                      ? "text-brand-700"
                      : isGood
                        ? "text-success-700"
                        : "text-gray-900"
                }`}
              >
                {isLive && <Loader2 className="h-4 w-4 animate-spin" />}
                {s.value}
              </dd>
            </div>
          );
        })}
      </dl>
      <div className="mt-auto pt-5">
        <Link href={cta.href} className="btn-primary">
          <Plus className="mr-1.5 h-4 w-4" />
          {cta.label}
        </Link>
      </div>
    </div>
  );
}

// ─── Applicant row ───────────────────────────────────────────────

function CaseRow({ c }: { c: CaseSummary }) {
  const petitionCount = c.petitionCount ?? 0;
  const receiptCount = c.receiptCount ?? 0;
  const hasReview = petitionCount > 0;
  const hasTracking = receiptCount > 0;

  return (
    <Link
      href={`/app/cases/${c._id}`}
      className="group flex items-center justify-between gap-4 px-6 py-5 transition-colors hover:bg-gray-25"
    >
      <div className="flex flex-1 items-center gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
          {initials(c.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-gray-900">{c.name}</p>
            <span className="pill border border-brand-200 bg-brand-50 text-brand-700">
              {c.visaType}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <ReviewBadge
              hasReview={hasReview}
              petitionCount={petitionCount}
              latestStatus={c.latestAnalysisStatus ?? null}
              progressLabel={c.latestAnalysisProgressLabel ?? null}
              progressPct={c.latestAnalysisProgressPct ?? null}
              riskScore={c.latestRiskScore ?? null}
              inFlightCount={c.inFlightAnalysisCount ?? 0}
              failedCount={c.failedAnalysisCount ?? 0}
            />
            <span className="text-gray-300">·</span>
            <TrackingBadge
              hasTracking={hasTracking}
              receiptCount={receiptCount}
              stuckCount={c.stuckReceiptCount ?? 0}
              awaitingFirstSync={c.awaitingFirstSyncCount ?? 0}
            />
          </div>
        </div>
      </div>
      <ArrowUpRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
    </Link>
  );
}

function ReviewBadge({
  hasReview,
  petitionCount,
  latestStatus,
  progressLabel,
  progressPct,
  riskScore,
  inFlightCount,
  failedCount,
}: {
  hasReview: boolean;
  petitionCount: number;
  latestStatus: "queued" | "running" | "done" | "failed" | null;
  progressLabel: string | null;
  progressPct: number | null;
  riskScore: number | null;
  inFlightCount: number;
  failedCount: number;
}) {
  if (!hasReview) {
    return (
      <span className="inline-flex items-center gap-1 text-gray-500">
        <FileText className="h-3 w-3" />
        No petition reviewed
      </span>
    );
  }

  // In-flight takes precedence over a stale prior score
  if (inFlightCount > 0 || latestStatus === "queued" || latestStatus === "running") {
    const pct =
      typeof progressPct === "number" ? Math.round(progressPct * 100) : null;
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-brand-700">
        <Loader2 className="h-3 w-3 animate-spin" />
        {progressLabel ?? "Reviewing…"}
        {pct !== null && pct > 0 ? ` · ${pct}%` : ""}
      </span>
    );
  }

  if (failedCount > 0 && latestStatus === "failed") {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-error-700">
        <XCircle className="h-3 w-3" />
        Last review failed — upload again
      </span>
    );
  }

  const band =
    riskScore === null
      ? null
      : riskScore < 35
        ? { label: "low risk", color: "text-success-700" }
        : riskScore < 65
          ? { label: "moderate risk", color: "text-warning-700" }
          : { label: "high risk", color: "text-error-700" };

  return (
    <span className="inline-flex items-center gap-1 text-gray-600">
      <FileText className="h-3 w-3 text-brand-500" />
      {petitionCount} petition{petitionCount === 1 ? "" : "s"} reviewed
      {band && (
        <>
          {" "}
          ·{" "}
          <span className={`font-semibold ${band.color}`}>
            {riskScore}/100 {band.label}
          </span>
        </>
      )}
    </span>
  );
}

function TrackingBadge({
  hasTracking,
  receiptCount,
  stuckCount,
  awaitingFirstSync,
}: {
  hasTracking: boolean;
  receiptCount: number;
  stuckCount: number;
  awaitingFirstSync: number;
}) {
  if (!hasTracking) {
    return (
      <span className="inline-flex items-center gap-1 text-gray-500">
        <Clock className="h-3 w-3" />
        No receipt tracked
      </span>
    );
  }

  // Always show "N receipts tracked" — even when some are stuck. The warning
  // chip after the dot shows the count of receipts that need attention.
  return (
    <span className="inline-flex items-center gap-1 text-gray-600">
      <Clock className="h-3 w-3 text-brand-500" />
      {receiptCount} receipt{receiptCount === 1 ? "" : "s"} tracked
      {awaitingFirstSync > 0 && (
        <>
          <span className="text-gray-300">·</span>
          <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
            <Loader2 className="h-3 w-3 animate-spin" />
            {awaitingFirstSync} awaiting first sync
          </span>
        </>
      )}
      {stuckCount > 0 && (
        <>
          <span className="text-gray-300">·</span>
          <span className="inline-flex items-center gap-1 font-semibold text-error-700">
            <AlertTriangle className="h-3 w-3" />
            {stuckCount} taking longer than usual
          </span>
        </>
      )}
    </span>
  );
}

function initials(name: string): string {
  const stripped = name.replace(/[—–-].*$/, "").trim();
  const parts = stripped.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
