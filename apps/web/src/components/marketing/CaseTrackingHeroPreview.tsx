import { AlertTriangle, Clock, MailCheck } from "lucide-react";

/**
 * Static, representative facsimile of a tracked USCIS case.
 * Mirrors HeroPreview but for the post-filing case-tracking feature.
 */
export function CaseTrackingHeroPreview() {
  return (
    <div className="card overflow-hidden border-gray-200 shadow-lg">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-25 px-4 py-3">
        <div className="flex items-center gap-2">
          <MailCheck className="h-4 w-4 text-gray-500" />
          <span className="font-mono text-xs font-semibold text-gray-700">
            EAC2490012345
          </span>
          <span className="pill border border-success-200 bg-success-50 text-success-700">
            Live from USCIS
          </span>
        </div>
        <span className="text-[10px] font-mono text-gray-500">
          Vermont · I-129
        </span>
      </div>

      <div className="space-y-4 p-6">
        {/* Current status */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500">
            Current status
          </p>
          <p className="mt-1.5 text-sm font-semibold text-gray-900">
            Request for Initial Evidence Was Sent
          </p>
          <p className="mt-0.5 text-xs leading-5 text-gray-600">
            On March 12, 2026, USCIS mailed a request for additional evidence
            for your Form I-129.
          </p>
        </div>

        {/* Stuck banner */}
        <div className="rounded-xl border border-error-200 bg-error-50 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error-700" />
            <div className="text-xs leading-5">
              <p className="font-semibold text-error-700">
                Your case is taking longer than usual
              </p>
              <p className="mt-0.5 text-error-700/90">
                142 days at this step. Most similar cases at the Vermont
                service center move on within 95 days.
              </p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500">
            Timeline
          </p>
          <ul className="space-y-1.5">
            <TimelineRow
              date="Mar 12"
              title="USCIS asked for more evidence"
              current
            />
            <TimelineRow date="Feb 2" title="Case is being actively reviewed" />
            <TimelineRow date="Jan 3" title="Case received by USCIS" />
          </ul>
        </div>

        {/* Next milestone */}
        <div className="rounded-lg border border-brand-100 bg-brand-25 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs text-gray-700">
            <Clock className="h-3.5 w-3.5 text-brand-500" />
            Likely next:{" "}
            <strong className="font-semibold text-gray-900">
              Your response to USCIS
            </strong>
            <span className="text-gray-400">·</span>
            <span>
              by{" "}
              <strong className="font-semibold text-gray-900">Jun 12</strong>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  date,
  title,
  current,
}: {
  date: string;
  title: string;
  current?: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1 flex h-2.5 w-2.5 shrink-0 items-center justify-center">
        <span
          className={`block h-2 w-2 rounded-full ${
            current ? "bg-error-500 ring-2 ring-error-200" : "bg-gray-300"
          }`}
        />
      </span>
      <span className="font-mono text-[10px] uppercase tracking-wide text-gray-500 w-12 shrink-0">
        {date}
      </span>
      <span
        className={`text-xs leading-5 ${
          current ? "font-semibold text-gray-900" : "text-gray-600"
        }`}
      >
        {title}
      </span>
    </li>
  );
}
