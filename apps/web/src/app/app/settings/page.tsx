import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LlmSettingsForm } from "@/components/LlmSettingsForm";
import { UscisSettingsForm } from "@/components/UscisSettingsForm";
import { OpenAlexSettingsForm } from "@/components/OpenAlexSettingsForm";

const INTERNAL = process.env.API_INTERNAL_URL ?? "http://api:4000";

export const dynamic = "force-dynamic";

interface LlmConfig {
  provider: "ollama-local" | "openai" | "anthropic-compat" | "custom";
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
  temperature: number;
  maxTokens: number;
}

interface UscisConfig {
  baseUrl: string;
  clientId: string;
  clientSecretConfigured: boolean;
  enabled: boolean;
}

interface OpenAlexConfig {
  mailto: string;
  apiKeyConfigured: boolean;
}

export default async function SettingsPage() {
  const [llmRes, uscisRes, openalexRes] = await Promise.all([
    fetch(`${INTERNAL}/settings/llm`, { cache: "no-store" }),
    fetch(`${INTERNAL}/settings/uscis`, { cache: "no-store" }),
    fetch(`${INTERNAL}/settings/openalex`, { cache: "no-store" }),
  ]);

  const llm: LlmConfig = llmRes.ok
    ? await llmRes.json()
    : {
        provider: "ollama-local",
        baseUrl: "http://host.docker.internal:11434/v1",
        model: "deepseek-r1:8b",
        apiKeyConfigured: false,
        temperature: 0.2,
        maxTokens: 4096,
      };

  const uscis: UscisConfig = uscisRes.ok
    ? await uscisRes.json()
    : {
        baseUrl: "https://api-int.uscis.gov",
        clientId: "",
        clientSecretConfigured: false,
        enabled: true,
      };

  const openalex: OpenAlexConfig = openalexRes.ok
    ? await openalexRes.json()
    : {
        mailto: "pulse-demo@example.com",
        apiKeyConfigured: false,
      };

  return (
    <div className="space-y-10">
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <header>
        <h1 className="text-3xl font-semibold tracking-tightish text-gray-900">
          Settings
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-gray-500">
          Configure the AI service used to review petitions, the USCIS API
          credentials for case status, and OpenAlex for citation verification.
          Changes take effect on the next analysis or scrape &mdash; no restart
          needed.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          Petition risk review
        </h2>
        <LlmSettingsForm initial={llm} />
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          USCIS case tracking
        </h2>
        <UscisSettingsForm initial={uscis} />
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          Citation verification
        </h2>
        <OpenAlexSettingsForm initial={openalex} />
      </section>
    </div>
  );
}
