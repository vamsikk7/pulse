"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  RefreshCw,
  AlertTriangle,
  Check,
  Clock,
  Trash2,
  Loader2,
} from "lucide-react";

interface Receipt {
  _id: string;
  receiptNumber: string;
  formType: string;
  serviceCenter: string;
  lastStatusTitle: string;
  lastStatusDetail: string;
  lastStatusCode?: string | null;
  lastSource: string;
  lastSyncedAt: string | null;
  prediction?: {
    nextMilestone: string;
    predictedDate: string | null;
    isStuck: boolean;
    currentDaysAtStep: number;
    p50Days: number;
    p80Days: number;
  } | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const SERVICE_CENTER_NAMES: Record<string, string> = {
  NSC: "Nebraska",
  TSC: "Texas",
  CSC: "California",
  VSC: "Vermont",
  MSC: "National Benefits Center",
  NBC: "National Benefits Center",
  YSC: "Potomac",
  EAC: "Vermont",
  WAC: "California",
  LIN: "Nebraska",
  SRC: "Texas",
  IOE: "Electronic processing",
};

function friendlyCenter(code: string): string {
  return SERVICE_CENTER_NAMES[code] ?? code;
}

const FORM_DESCRIPTIONS: Record<string, string> = {
  "I-129": "Nonimmigrant worker petition (I-129)",
  "I-140": "Immigrant worker petition (I-140)",
  "I-485": "Adjustment of status (I-485)",
  "I-765": "Work authorization (I-765)",
};

function friendlyForm(code: string): string {
  return FORM_DESCRIPTIONS[code] ?? code;
}

export function ReceiptPanel({
  caseId,
  receipts: initialReceipts,
}: {
  caseId: string;
  receipts: Receipt[];
}) {
  const [receiptNumber, setReceiptNumber] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Manage receipts in local state so refresh updates land immediately,
  // independent of router.refresh() / Next.js's RSC re-fetch timing.
  // We seed once and from then on this is a client-owned store — props
  // changing mid-flight (e.g. from router.refresh) won't blow our fresh
  // data away. Remount (navigating away and back) re-seeds via useState.
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts);

  // Per-receipt "✓ Updated just now" confirmation. Stores the timestamp so
  // we can clear the pill after a few seconds.
  const [justUpdated, setJustUpdated] = useState<Record<string, number>>({});
  useEffect(() => {
    const ids = Object.keys(justUpdated);
    if (ids.length === 0) return;
    const t = setTimeout(() => setJustUpdated({}), 4000);
    return () => clearTimeout(t);
  }, [justUpdated]);

  async function refetchReceipts(): Promise<Receipt[]> {
    const res = await fetch(`${API_URL}/cases/${caseId}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`fetch /cases/${caseId} → ${res.status}`);
    const data = (await res.json()) as { receipts: Receipt[] };
    setReceipts(data.receipts);
    // Also let RSCs know — keeps the dashboard stats etc. in sync next nav
    startTransition(() => router.refresh());
    return data.receipts;
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          caseId,
          receiptNumber: receiptNumber.toUpperCase().trim(),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      setReceiptNumber("");
      await refetchReceipts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setAdding(false);
    }
  }

  // Track which receipts are currently being refreshed so we can show a
  // spinner + inline status. The scrape worker is rate-limited to 1 req/10s,
  // so a refresh can take 5–30s depending on queue depth.
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const REFRESH_POLL_INTERVAL_MS = 2000;
  const REFRESH_TIMEOUT_MS = 90_000;

  async function onRefresh(id: string, receiptNumber: string) {
    // Anchor against wall-clock time: any lastSyncedAt strictly newer than
    // refreshStartedAt means the worker has processed our request. This is
    // immune to string/format mismatches and races where the row already had
    // a recent sync from elsewhere.
    const refreshStartedAt = Date.now();
    setRefreshingIds((s) => new Set(s).add(id));

    try {
      const r = await fetch(`${API_URL}/receipts/${id}/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error(`enqueue failed: HTTP ${r.status}`);

      const deadline = refreshStartedAt + REFRESH_TIMEOUT_MS;
      let detected = false;
      while (Date.now() < deadline) {
        await new Promise((resolve) =>
          setTimeout(resolve, REFRESH_POLL_INTERVAL_MS),
        );
        const res = await fetch(`${API_URL}/receipts/${id}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) continue;
        const data = await res.json();
        const ts =
          data && data.lastSyncedAt
            ? new Date(data.lastSyncedAt).getTime()
            : 0;
        if (ts > refreshStartedAt) {
          detected = true;
          break;
        }
      }

      // Always refetch the whole case so prediction etc. update too.
      await refetchReceipts();

      // Guarantee the spinner stays up for at least 1.2 s so the click
      // doesn't feel like it did nothing on a fast queue.
      const minVisibleMs = 1200;
      const elapsed = Date.now() - refreshStartedAt;
      if (elapsed < minVisibleMs) {
        await new Promise((r) => setTimeout(r, minVisibleMs - elapsed));
      }

      if (detected) {
        setJustUpdated((m) => ({ ...m, [id]: Date.now() }));
      } else {
        window.alert(
          `Refresh for ${receiptNumber} took longer than expected. USCIS may be slow right now — the row will catch up on the next page load.`,
        );
      }
    } catch (err) {
      window.alert(
        err instanceof Error
          ? `Couldn't refresh ${receiptNumber}: ${err.message}`
          : `Couldn't refresh ${receiptNumber}`,
      );
    } finally {
      setRefreshingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  const [removingId, setRemovingId] = useState<string | null>(null);
  async function onRemove(id: string, receiptNumber: string) {
    if (
      !window.confirm(
        `Stop tracking ${receiptNumber}?\n\nThe receipt will be removed from your dashboard. Status history is kept for audit but is no longer shown.`,
      )
    ) {
      return;
    }
    setRemovingId(id);
    try {
      const res = await fetch(`${API_URL}/receipts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      // Drop from local state immediately for snappy UX; refetch for the rest
      setReceipts((curr) => curr.filter((x) => x._id !== id));
      await refetchReceipts();
    } catch (err) {
      window.alert(
        err instanceof Error ? `Couldn't remove: ${err.message}` : "Couldn't remove the receipt",
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={onAdd}
        className="card flex flex-wrap items-end gap-3 p-4 sm:p-5"
      >
        <div className="min-w-[220px] flex-1">
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            USCIS receipt number
          </label>
          <input
            value={receiptNumber}
            onChange={(e) => setReceiptNumber(e.target.value)}
            placeholder="e.g. EAC2490012345"
            pattern="[A-Za-z]{3}\d{10}"
            required
            className="input font-mono uppercase"
          />
        </div>
        <button type="submit" disabled={adding} className="btn-primary">
          <Plus className="mr-1.5 h-4 w-4" />
          {adding ? "Adding…" : "Add receipt"}
        </button>
      </form>
      <p className="text-[11px] text-gray-500">
        Pulse picks up the form type automatically from USCIS once the first
        status check comes back &mdash; you don&rsquo;t need to enter it.
      </p>
      {error && <p className="text-sm text-error-700">{error}</p>}

      {receipts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500">
          No receipts added yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {receipts.map((r) => (
            <li key={r._id} className="card overflow-hidden">
              <div className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {r.receiptNumber}
                    </span>
                    <SourcePill source={r.lastSource} />
                    <span className="pill border border-gray-200 bg-gray-50 text-gray-600">
                      {r.formType
                        ? `${friendlyForm(r.formType)} · ${friendlyCenter(r.serviceCenter)}`
                        : friendlyCenter(r.serviceCenter)}
                    </span>
                    {refreshingIds.has(r._id) && (
                      <span className="pill border border-brand-200 bg-brand-50 text-brand-700">
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Checking USCIS…
                      </span>
                    )}
                    {!refreshingIds.has(r._id) && justUpdated[r._id] && (
                      <span className="pill border border-success-200 bg-success-50 text-success-700">
                        <Check className="mr-1 h-3 w-3" />
                        Updated just now
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-gray-900">
                    {r.lastStatusTitle || "Awaiting first sync…"}
                  </p>
                  {r.lastStatusDetail && (
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      {r.lastStatusDetail}
                    </p>
                  )}
                  {r.prediction?.isStuck && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 px-3.5 py-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error-500" />
                      <div>
                        <p className="text-sm font-semibold text-error-700">
                          Your case is taking longer than usual
                        </p>
                        <p className="mt-0.5 text-xs leading-5 text-error-700">
                          {r.prediction.currentDaysAtStep} days at this step.
                          Most similar cases at the{" "}
                          {friendlyCenter(r.serviceCenter)} service center
                          move on within {r.prediction.p80Days} days. It may
                          be worth checking in with USCIS or speaking to your
                          attorney.
                        </p>
                      </div>
                    </div>
                  )}
                  {r.prediction &&
                    !r.prediction.isStuck &&
                    r.prediction.predictedDate && (
                      <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                        <Clock className="h-3.5 w-3.5 text-brand-500" />
                        Likely next:{" "}
                        <span className="font-semibold text-gray-900">
                          {r.prediction.nextMilestone}
                        </span>
                        <span className="text-gray-400">·</span>
                        <span>
                          around{" "}
                          <span className="font-semibold text-gray-900">
                            {new Date(
                              r.prediction.predictedDate,
                            ).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </span>
                      </p>
                    )}
                  {r.lastStatusCode === "CASE_WAS_APPROVED" && (
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700">
                      <Check className="h-3.5 w-3.5" />
                      Approved
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => onRefresh(r._id, r.receiptNumber)}
                    disabled={refreshingIds.has(r._id)}
                    className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Refresh status from USCIS"
                    aria-label="Refresh status from USCIS"
                  >
                    {refreshingIds.has(r._id) ? (
                      <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                    ) : (
                      <RefreshCw className="h-4 w-4 text-gray-600" />
                    )}
                  </button>
                  <button
                    onClick={() => onRemove(r._id, r.receiptNumber)}
                    disabled={removingId === r._id}
                    className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-error-50 hover:border-error-200 hover:text-error-600 disabled:opacity-50"
                    title="Stop tracking this receipt"
                    aria-label="Remove receipt"
                  >
                    {removingId === r._id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SourcePill({ source }: { source: string }) {
  const map: Record<string, { className: string; label: string }> = {
    live: {
      className: "border border-success-200 bg-success-50 text-success-700",
      label: "Live from USCIS",
    },
    mock: {
      className: "border border-warning-200 bg-warning-50 text-warning-700",
      label: "Sample data",
    },
    fixture: {
      className: "border border-warning-200 bg-warning-50 text-warning-700",
      label: "Sample data",
    },
    unknown: {
      className: "border border-gray-200 bg-gray-50 text-gray-600",
      label: "Waiting on first update",
    },
  };
  const cfg = map[source] || map.unknown || { className: "", label: source };
  return <span className={`pill ${cfg.className}`}>{cfg.label}</span>;
}

// Worker source types we know about, mapped for the UI:
//   "live" — either USCIS API or HTML scrape succeeded
//   "mock" / "fixture" — fell through to local fixtures
//   "unknown" — no scrape attempt has run yet
void SourcePill;
