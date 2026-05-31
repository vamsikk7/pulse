"use client";

import { useState } from "react";
import { Loader2, Check, AlertTriangle, KeyRound, Cloud } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Valid staging receipt numbers from the USCIS Developer Hub sandbox.
 * These are the only receipt numbers supported in the sandbox environment.
 */
const STAGING_RECEIPTS_WITH_HISTORY = [
  "EAC9999103403", "EAC9999103404", "EAC9999103405", "EAC9999103410",
  "EAC9999103411", "EAC9999103416", "EAC9999103419",
  "LIN9999106498", "LIN9999106499", "LIN9999106504", "LIN9999106505", "LIN9999106506",
  "SRC9999102777", "SRC9999102778", "SRC9999102779", "SRC9999102780",
  "SRC9999102781", "SRC9999102782", "SRC9999102783", "SRC9999102784",
  "SRC9999102785", "SRC9999102786", "SRC9999102787",
  "SRC9999132710", "SRC9999132719",
] as const;

const STAGING_RECEIPTS_WITHOUT_HISTORY = [
  "EAC9999103400", "EAC9999103402", "EAC9999103406", "EAC9999103407",
  "EAC9999103408", "EAC9999103409", "EAC9999103412", "EAC9999103413",
  "EAC9999103414", "EAC9999103415", "EAC9999103420", "EAC9999103421",
  "EAC9999103424", "EAC9999103425", "EAC9999103426", "EAC9999103428",
  "EAC9999103429", "EAC9999103431", "EAC9999103432",
  "LIN9999106501", "LIN9999106507",
  "SRC9999132694", "SRC9999132695", "SRC9999132706", "SRC9999132707",
] as const;

export const ALL_STAGING_RECEIPTS = [
  ...STAGING_RECEIPTS_WITH_HISTORY,
  ...STAGING_RECEIPTS_WITHOUT_HISTORY,
];

const SANDBOX_BASE_URL = "https://api-int.uscis.gov";

interface Config {
  baseUrl: string;
  clientId: string;
  clientSecretConfigured: boolean;
  enabled: boolean;
}

export function UscisSettingsForm({ initial }: { initial: Config }) {
  const [clientId, setClientId] = useState(initial.clientId);
  const [clientSecret, setClientSecret] = useState("");
  const [enabled, setEnabled] = useState(initial.enabled);
  const [secretConfigured, setSecretConfigured] = useState(
    initial.clientSecretConfigured,
  );

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    | { ok: true; latencyMs: number; expiresIn: number | null }
    | { ok: false; error: string }
    | null
  >(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/settings/uscis`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          baseUrl: SANDBOX_BASE_URL,
          clientId,
          clientSecret: clientSecret || undefined,
          enabled,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated: Config = await res.json();
      setSecretConfigured(updated.clientSecretConfigured);
      setClientSecret("");
      setSavedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function onClearSecret() {
    if (!window.confirm("Remove the saved client secret?")) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/settings/uscis`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          baseUrl: SANDBOX_BASE_URL,
          clientId,
          clientSecret: "__clear__",
          enabled,
        }),
      });
      setSecretConfigured(false);
      setClientSecret("");
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/settings/uscis/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          baseUrl: SANDBOX_BASE_URL,
          clientId,
          clientSecret: clientSecret || undefined,
        }),
      });
      if (!res.ok) {
        setTestResult({ ok: false, error: (await res.text()) || `HTTP ${res.status}` });
      } else {
        setTestResult(await res.json());
      }
    } catch (err) {
      setTestResult({
        ok: false,
        error: err instanceof Error ? err.message : "Couldn't reach the server",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <form onSubmit={onSave} className="card p-6 space-y-6">
      <div>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Cloud className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              USCIS Developer Hub API &mdash; Sandbox
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-gray-500">
              Pulse uses the USCIS sandbox environment to fetch case status as
              structured JSON. Only staging receipt numbers are supported.
              Apply for credentials at{" "}
              <a
                href="https://developer.uscis.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-700 underline hover:text-brand-800"
              >
                developer.uscis.gov
              </a>
              .
            </p>
          </div>
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Sandbox URL (read-only) */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Sandbox URL
        </label>
        <div className="flex items-center gap-2">
          <input
            value={SANDBOX_BASE_URL}
            readOnly
            className="input font-mono text-xs bg-gray-50 text-gray-500 cursor-not-allowed"
          />
          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
            Sandbox
          </span>
        </div>
        <p className="mt-1 text-[11px] text-gray-500">
          Case status endpoint:{" "}
          <code className="font-mono text-[10px]">
            {SANDBOX_BASE_URL}/case-status
          </code>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Client ID
          </label>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="from developer.uscis.gov"
            className="input font-mono text-xs"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Client secret
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={
                  secretConfigured
                    ? "•••••••• (saved — leave blank to keep)"
                    : ""
                }
                className="input pl-9 font-mono text-xs"
              />
            </div>
            {secretConfigured && (
              <button
                type="button"
                onClick={onClearSecret}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
        Enable USCIS API as the primary case-status source
      </label>

      {/* Staging receipt numbers reference */}
      <details className="rounded-lg border border-gray-100 bg-gray-25 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-gray-700">
          Valid staging receipt numbers
        </summary>
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">
              With historical case data ({STAGING_RECEIPTS_WITH_HISTORY.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {STAGING_RECEIPTS_WITH_HISTORY.map((r) => (
                <code
                  key={r}
                  className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600"
                >
                  {r}
                </code>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">
              Without historical case data ({STAGING_RECEIPTS_WITHOUT_HISTORY.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {STAGING_RECEIPTS_WITHOUT_HISTORY.map((r) => (
                <code
                  key={r}
                  className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600"
                >
                  {r}
                </code>
              ))}
            </div>
          </div>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onTest}
          disabled={testing || !clientId}
          className="btn-secondary"
        >
          {testing ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Testing…
            </>
          ) : (
            "Test connection"
          )}
        </button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save settings"
          )}
        </button>
        {savedAt && !error && (
          <span className="inline-flex items-center gap-1 text-xs text-success-700">
            <Check className="h-3.5 w-3.5" />
            Saved {savedAt.toLocaleTimeString()}
          </span>
        )}
        {error && (
          <span className="inline-flex items-center gap-1 text-xs text-error-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            {error.slice(0, 200)}
          </span>
        )}
      </div>

      {testResult && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            testResult.ok
              ? "border-success-200 bg-success-50 text-success-700"
              : "border-error-200 bg-error-50 text-error-700"
          }`}
        >
          {testResult.ok ? (
            <p className="font-semibold">
              OAuth handshake OK · responded in {testResult.latencyMs} ms
              {testResult.expiresIn
                ? ` · token TTL ${Math.round(testResult.expiresIn / 60)} min`
                : ""}
            </p>
          ) : (
            <>
              <p className="font-semibold">Credentials rejected</p>
              <p className="mt-1 font-mono text-[11px] opacity-80">
                {testResult.error.slice(0, 300)}
              </p>
            </>
          )}
        </div>
      )}
    </form>
  );
}
