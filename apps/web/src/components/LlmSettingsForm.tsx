"use client";

import { useState } from "react";
import { Loader2, Check, AlertTriangle, KeyRound } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Provider = "ollama-local" | "openai" | "anthropic-compat" | "custom";

interface LlmConfig {
  provider: Provider;
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
  temperature: number;
  maxTokens: number;
}

const PRESETS: Record<
  Provider,
  { label: string; description: string; baseUrl: string; model: string; needsKey: boolean }
> = {
  "ollama-local": {
    label: "Local LLM via Ollama",
    description:
      "Runs entirely on your machine. Pulse hits host.docker.internal so the worker container can reach Ollama on your host.",
    baseUrl: "http://host.docker.internal:11434/v1",
    model: "deepseek-r1:8b",
    needsKey: false,
  },
  openai: {
    label: "OpenAI",
    description:
      "Hosted GPT models. Requires an OpenAI API key. Your petition text is sent to OpenAI's servers.",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    needsKey: true,
  },
  "anthropic-compat": {
    label: "Anthropic (OpenAI-compatible)",
    description:
      "Anthropic Claude via their OpenAI-compatible endpoint. Requires an Anthropic API key.",
    baseUrl: "https://api.anthropic.com/v1/",
    model: "claude-3-5-sonnet-20241022",
    needsKey: true,
  },
  custom: {
    label: "Custom OpenAI-compatible endpoint",
    description:
      "Any OpenAI-compatible API: vLLM, LM Studio, llama.cpp server, Together, Groq, Mistral, etc.",
    baseUrl: "",
    model: "",
    needsKey: true,
  },
};

export function LlmSettingsForm({ initial }: { initial: LlmConfig }) {
  const [provider, setProvider] = useState<Provider>(initial.provider);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [model, setModel] = useState(initial.model);
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(initial.temperature);
  const [maxTokens, setMaxTokens] = useState(initial.maxTokens);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(
    initial.apiKeyConfigured,
  );

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    | {
        ok: true;
        latencyMs: number;
        modelFound: boolean;
        modelsCount: number;
        sampleModels: string;
        note: string;
      }
    | { ok: false; error: string }
    | null
  >(null);

  function applyPreset(p: Provider) {
    setProvider(p);
    if (p !== "custom") {
      setBaseUrl(PRESETS[p].baseUrl);
      setModel(PRESETS[p].model);
    }
    setTestResult(null);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/settings/llm`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider,
          baseUrl,
          model,
          apiKey: apiKey || undefined,
          temperature,
          maxTokens,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated: LlmConfig = await res.json();
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
    if (!window.confirm("Remove the saved API key?")) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/settings/llm`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider,
          baseUrl,
          model,
          apiKey: "__clear__",
          temperature,
          maxTokens,
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
      const res = await fetch(`${API_URL}/settings/llm/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ provider, baseUrl, model, apiKey: apiKey || undefined }),
      });
      if (!res.ok) {
        const text = await res.text();
        setTestResult({ ok: false, error: text || `HTTP ${res.status}` });
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

  const preset = PRESETS[provider];

  return (
    <form onSubmit={onSave} className="card p-6 space-y-6">
      {/* Provider picker */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900">AI provider</h2>
        <p className="mt-1 text-xs text-gray-500">
          Pick a preset or configure your own. Pulse calls a standard
          OpenAI-compatible <code className="font-mono text-[11px]">/v1/chat/completions</code>{" "}
          endpoint &mdash; almost every modern LLM service supports it.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(Object.keys(PRESETS) as Provider[]).map((p) => {
            const def = PRESETS[p];
            const active = p === provider;
            return (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className={`text-left rounded-xl border p-3 transition ${
                  active
                    ? "border-brand-400 bg-brand-50 ring-2 ring-brand-100"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <p
                  className={`text-sm font-semibold ${
                    active ? "text-brand-700" : "text-gray-900"
                  }`}
                >
                  {def.label}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-gray-500">
                  {def.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Base URL + model */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Base URL
          </label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            required
            placeholder="https://api.openai.com/v1"
            className="input font-mono text-xs"
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Must end in <code className="font-mono">/v1</code> for most
            providers.
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Model
          </label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            required
            placeholder="gpt-4o-mini"
            className="input font-mono text-xs"
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Exact model name your provider exposes.
          </p>
        </div>
      </div>

      {/* API key */}
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
                apiKeyConfigured ? "•••••••• (saved — leave blank to keep)" : ""
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
              Clear key
            </button>
          )}
        </div>
        <p className="mt-1 text-[11px] text-gray-500">
          Stored on this server only. Never sent to the browser after saving.
          {preset.needsKey
            ? " Required for this provider."
            : " Optional for local LLMs."}
        </p>
      </div>

      {/* Advanced */}
      <details className="rounded-lg border border-gray-100 bg-gray-25 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-gray-700">
          Advanced
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Temperature ({temperature.toFixed(2)})
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="text-[11px] text-gray-500">
              Lower = more deterministic. 0.2 is the default.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Max output tokens
            </label>
            <input
              type="number"
              min={256}
              max={32000}
              step={256}
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
              className="input text-xs"
            />
          </div>
        </div>
      </details>

      {/* Test + save */}
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
            {error}
          </span>
        )}
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            testResult.ok
              ? testResult.modelFound
                ? "border-success-200 bg-success-50 text-success-700"
                : "border-warning-200 bg-warning-50 text-warning-700"
              : "border-error-200 bg-error-50 text-error-700"
          }`}
        >
          {testResult.ok ? (
            <div>
              <p className="font-semibold">
                {testResult.modelFound
                  ? "Endpoint reachable · model available"
                  : "Endpoint reachable · model name not found in list"}
                {" · "}
                {testResult.latencyMs} ms
              </p>
              <p className="mt-1 text-xs opacity-90">{testResult.note}</p>
              {testResult.sampleModels && (
                <p className="mt-1 font-mono text-[11px] opacity-70">
                  available: {testResult.sampleModels}
                  {testResult.modelsCount > 4
                    ? ` … (+${testResult.modelsCount - 4} more)`
                    : ""}
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="font-semibold">Connection failed</p>
              <p className="mt-1 font-mono text-[11px] opacity-80">
                {testResult.error.slice(0, 400)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Reasoning-model heads-up */}
      <div className="rounded-lg border border-gray-200 bg-gray-25 px-3 py-2 text-xs leading-5 text-gray-600">
        <p>
          <strong className="text-gray-900">Note on reasoning models.</strong>{" "}
          If you&rsquo;re using <code className="font-mono">deepseek-r1</code>,{" "}
          <code className="font-mono">o1</code>, or similar, expect a single
          petition review to take roughly 2–4 min on a local Mac. The model
          spends most of that time in a hidden{" "}
          <code className="font-mono">&lt;think&gt;</code> trace before producing
          the answer — that&rsquo;s also what makes the analysis deeper.
          Streaming progress on the petition page will keep you posted.
        </p>
      </div>
    </form>
  );
}
