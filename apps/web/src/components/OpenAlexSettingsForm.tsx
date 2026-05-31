"use client";

import { useState } from "react";
import { Loader2, Check, AlertTriangle, KeyRound, BookOpen } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Config {
  mailto: string;
  apiKeyConfigured: boolean;
}

export function OpenAlexSettingsForm({ initial }: { initial: Config }) {
  const [mailto, setMailto] = useState(initial.mailto);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(
    initial.apiKeyConfigured,
  );

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    | { ok: true; latencyMs: number; totalAuthors: number | null }
    | { ok: false; error: string }
    | null
  >(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/settings/openalex`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mailto,
          apiKey: apiKey || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated: Config = await res.json();
      setApiKeyConfigured(updated.apiKeyConfigured);
      setApiKey("");
      setSavedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function onClearKey() {
    if (!window.confirm("Remove the saved OpenAlex API key?")) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/settings/openalex`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mailto,
          apiKey: "__clear__",
        }),
      });
      setApiKeyConfigured(false);
      setApiKey("");
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/settings/openalex/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mailto,
          apiKey: apiKey || undefined,
        }),
      });
      if (!res.ok) {
        setTestResult({
          ok: false,
          error: (await res.text()) || `HTTP ${res.status}`,
        });
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
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              OpenAlex API (optional)
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-gray-500">
              Pulse uses{" "}
              <a
                href="https://openalex.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-700 underline hover:text-brand-800"
              >
                OpenAlex
              </a>{" "}
              to cross-check citation counts and co-author independence. No key
              is required, but providing one unlocks higher rate limits via the
              &ldquo;polite pool.&rdquo;
            </p>
          </div>
        </div>
      </div>

      <hr className="border-gray-100" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Contact email (mailto)
          </label>
          <input
            type="email"
            value={mailto}
            onChange={(e) => setMailto(e.target.value)}
            placeholder="you@example.com"
            className="input text-xs"
          />
          <p className="mt-1 text-[11px] text-gray-500">
            OpenAlex routes requests with a <code className="font-mono">mailto</code>{" "}
            param to the polite pool (faster, more generous limits).
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            API key
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  apiKeyConfigured
                    ? "•••••••• (saved — leave blank to keep)"
                    : ""
                }
                className="input pl-9 font-mono text-xs"
              />
            </div>
            {apiKeyConfigured && (
              <button
                type="button"
                onClick={onClearKey}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            Available from{" "}
            <a
              href="https://openalex.org/users"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-700 underline hover:text-brand-800"
            >
              openalex.org/users
            </a>
            . Optional — the free tier works fine for most users.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onTest}
          disabled={testing}
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
              OpenAlex OK · responded in {testResult.latencyMs} ms
              {testResult.totalAuthors != null
                ? ` · ${testResult.totalAuthors.toLocaleString()} authors indexed`
                : ""}
            </p>
          ) : (
            <>
              <p className="font-semibold">Connection failed</p>
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
