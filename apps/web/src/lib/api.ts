/**
 * Server-side fetch wrapper for the Express API.
 * Auth is intentionally disabled — the API runs in demo mode using a fixed userId.
 */

const INTERNAL = process.env.API_INTERNAL_URL ?? "http://api:4000";

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${INTERNAL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${path}: ${text.slice(0, 400)}`);
  }
  return res.json() as Promise<T>;
}

export interface CaseSummary {
  _id: string;
  name: string;
  visaType: string;
  createdAt: string;
  updatedAt: string;
  petitionCount?: number;
  receiptCount?: number;
  latestRiskScore?: number | null;
  latestAnalysisStatus?:
    | "queued"
    | "running"
    | "done"
    | "failed"
    | null;
  latestAnalysisProgressLabel?: string | null;
  latestAnalysisProgressPct?: number | null;
  latestAnalysisUpdatedAt?: string | null;
  inFlightAnalysisCount?: number;
  failedAnalysisCount?: number;
  doneAnalysisCount?: number;
  awaitingFirstSyncCount?: number;
  stuckReceiptCount?: number;
  hasStuckReceipt?: boolean;
}

export async function listCases(): Promise<CaseSummary[]> {
  return apiFetch<CaseSummary[]>("/cases");
}

export async function createCase(body: {
  name: string;
  visaType: string;
}): Promise<CaseSummary> {
  return apiFetch<CaseSummary>("/cases", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getCase(id: string): Promise<CaseDetail> {
  return apiFetch<CaseDetail>(`/cases/${id}`);
}

export async function deletePetition(id: string): Promise<void> {
  await apiFetch<unknown>(`/petitions/${id}`, { method: "DELETE" });
}

export async function deleteReceipt(id: string): Promise<void> {
  await apiFetch<unknown>(`/receipts/${id}`, { method: "DELETE" });
}

export interface CaseDetail extends CaseSummary {
  petitions: Array<{
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
  }>;
  receipts: Array<{
    _id: string;
    receiptNumber: string;
    formType: string;
    serviceCenter: string;
    lastStatusCode: string;
    lastStatusTitle: string;
    lastStatusDetail: string;
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
  }>;
}
