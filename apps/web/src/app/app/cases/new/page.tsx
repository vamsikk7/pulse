import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Clock } from "lucide-react";
import { createCase } from "@/lib/api";

interface SearchParams {
  focus?: string;
}

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { focus } = await searchParams;

  async function action(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const visaType = String(formData.get("visaType") ?? "").trim();
    if (!name || !visaType) return;
    const created = await createCase({ name, visaType });
    redirect(`/app/cases/${created._id}`);
  }

  const focusInfo =
    focus === "review"
      ? {
          icon: <ShieldCheck className="h-4 w-4" />,
          eyebrow: "Petition risk review",
          body: "After creating the applicant, you can upload a draft petition for a per-criterion risk review.",
        }
      : focus === "track"
        ? {
            icon: <Clock className="h-4 w-4" />,
            eyebrow: "USCIS case tracking",
            body: "After creating the applicant, you can add a USCIS receipt number to follow the case through to a decision.",
          }
        : null;

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/app"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <h1 className="text-2xl font-semibold tracking-tightish text-gray-900">
        Add an applicant
      </h1>
      <p className="mt-1.5 text-sm text-gray-500">
        Every petition review and USCIS receipt is filed under an applicant.
      </p>

      {focusInfo && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-25 px-3.5 py-3 text-xs leading-5 text-brand-900">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-100 text-brand-700">
            {focusInfo.icon}
          </span>
          <div>
            <p className="font-semibold">{focusInfo.eyebrow}</p>
            <p className="mt-0.5">{focusInfo.body}</p>
          </div>
        </div>
      )}

      <form action={action} className="card mt-6 space-y-6 p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Applicant name
          </label>
          <input
            name="name"
            required
            placeholder="e.g. Dr. Patel"
            className="input"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Visa type
          </label>
          <select name="visaType" required defaultValue="O-1A" className="input">
            <option value="O-1A">O-1A — Extraordinary ability</option>
            <option value="O-1B">O-1B — Arts</option>
            <option value="EB-1A">EB-1A — Extraordinary ability (green card)</option>
            <option value="EB-1C">EB-1C — Multinational executive</option>
            <option value="EB-2-NIW">EB-2 NIW — National interest waiver</option>
            <option value="H-1B">H-1B — Specialty occupation</option>
            <option value="L-1A">L-1A — Intracompany executive</option>
            <option value="L-1B">L-1B — Intracompany specialized knowledge</option>
            <option value="TN">TN — NAFTA professional</option>
          </select>
        </div>
        <button type="submit" className="btn-primary w-full">
          Create applicant
        </button>
      </form>
    </div>
  );
}
