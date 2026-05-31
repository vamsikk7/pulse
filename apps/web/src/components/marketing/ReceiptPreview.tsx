import { AlertTriangle, Check, Clock } from "lucide-react";

export function ReceiptPreview() {
  return (
    <div className="space-y-2.5">
      <ReceiptRow
        receipt="EAC2490012345"
        center="Vermont"
        status="USCIS asked for more evidence"
        stuck
        days={142}
        p80={95}
      />
      <ReceiptRow
        receipt="WAC2390098765"
        center="California"
        status="Case approved"
        approved
      />
      <ReceiptRow
        receipt="MSC2490055555"
        center="Missouri"
        status="USCIS received your case"
        nextMilestone="Biometrics appointment"
        eta="Jun 24"
      />
    </div>
  );
}

interface RowProps {
  receipt: string;
  center: string;
  status: string;
  stuck?: boolean;
  approved?: boolean;
  nextMilestone?: string;
  eta?: string;
  days?: number;
  p80?: number;
}

function ReceiptRow({
  receipt,
  center,
  status,
  stuck,
  approved,
  nextMilestone,
  eta,
  days,
  p80,
}: RowProps) {
  return (
    <div className="card border-gray-200 p-3.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold text-gray-900">
          {receipt}
        </span>
        <span className="pill border border-gray-200 bg-gray-50 text-gray-600">
          {center}
        </span>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-gray-900">
        {approved && <Check className="h-3.5 w-3.5 text-success-500" />}
        {status}
      </p>
      {stuck && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md border border-error-200 bg-error-50 px-2.5 py-1.5 text-[11px] leading-4 text-error-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            <strong>Taking longer than usual</strong> &middot; {days} days at
            this step (typical: under {p80})
          </span>
        </div>
      )}
      {nextMilestone && eta && (
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-gray-600">
          <Clock className="h-3 w-3 text-brand-500" />
          Likely next:{" "}
          <strong className="font-semibold text-gray-900">{nextMilestone}</strong>{" "}
          &middot; around{" "}
          <span className="font-semibold text-gray-900">{eta}</span>
        </p>
      )}
    </div>
  );
}
