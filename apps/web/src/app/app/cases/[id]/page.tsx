import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCase } from "@/lib/api";
import { PetitionUploader } from "@/components/PetitionUploader";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { ReceiptPanel } from "@/components/ReceiptPanel";
import { CaseTabs } from "@/components/CaseTabs";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const c = await getCase(id).catch(() => null);
  if (!c) return notFound();

  const hasPetition = c.petitions.length > 0;
  const hasReceipts = c.receipts.length > 0;
  const stuckCount = c.receipts.filter((r) => r.prediction?.isStuck).length;

  // Default tab: whichever has activity. Fall back to review.
  const initialTab: "review" | "tracking" =
    tab === "tracking" || tab === "review"
      ? tab
      : hasPetition
        ? "review"
        : hasReceipts
          ? "tracking"
          : "review";

  const reviewContent = (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-gray-600">
        Get a clear-eyed look at your draft before you submit it to USCIS. This
        tool works independently of case tracking — you can use it without ever
        filing through Pulse.
      </p>
      {hasPetition ? (
        <>
          <div className="mb-6">
            <PetitionUploader caseId={c._id} />
          </div>
          {c.petitions.map((p, index) => (
            <AnalysisPanel key={p._id} petition={p} defaultCollapsed={index > 0} />
          ))}
        </>
      ) : (
        <PetitionUploader caseId={c._id} />
      )}
    </div>
  );

  const trackingContent = (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-gray-600">
        Already filed? Add the USCIS receipt printed on your receipt notice.
        Pulse will follow the case through to a decision — whether or not the
        petition was reviewed here.
      </p>
      <ReceiptPanel caseId={c._id} receipts={c.receipts} />
    </div>
  );

  return (
    <div className="space-y-8">
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
          {c.visaType}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
          {c.name}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Created {new Date(c.createdAt).toLocaleDateString()}
        </p>
      </header>

      <CaseTabs
        initial={initialTab}
        reviewSummary={{
          hasPetition,
          petitionCount: c.petitions.length,
        }}
        trackingSummary={{
          hasReceipts,
          receiptCount: c.receipts.length,
          stuckCount,
        }}
        reviewContent={reviewContent}
        trackingContent={trackingContent}
      />
    </div>
  );
}
