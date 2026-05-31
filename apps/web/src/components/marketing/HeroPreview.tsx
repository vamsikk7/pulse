import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";

// AlertTriangle is used inside the warning card below; keep the import.
void AlertTriangle;

/**
 * Static, representative facsimile of a completed RFE review.
 * Live/streaming states are reserved for the actual dashboard.
 */
export function HeroPreview() {
  const score = 62;

  return (
    <div className="relative">
      {/* Main card */}
      <div className="card overflow-hidden border-gray-200 shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-25 px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-500" />
            <span className="font-mono text-xs text-gray-600">
              synthetic-eb1a-petition.pdf
            </span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
            <CheckCircle2 className="h-3 w-3" />
            Review complete
          </span>
        </div>

        <div className="space-y-6 p-6">
          {/* Gauge */}
          <div className="flex items-center gap-6">
            <Gauge score={score} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                Moderate RFE risk
              </p>
              <p className="mt-1.5 max-w-[220px] text-xs leading-5 text-gray-600">
                Material gaps that USCIS adjudicators routinely cite in
                Requests for Evidence.
              </p>
            </div>
          </div>

          {/* Criteria findings preview */}
          <div className="space-y-2">
            <CriterionRow label="Scholarly articles" strength="strong" />
            <CriterionRow label="Original contributions" strength="strong" />
            <CriterionRow label="Memberships" strength="moderate" />
            <CriterionRow label="Judging others' work" strength="moderate" />
            <CriterionRow label="High salary" strength="weak" />
          </div>

          {/* Weakness mini-card */}
          <div className="rounded-xl border border-warning-200 bg-warning-50 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-700" />
              <div className="text-xs leading-5">
                <p className="font-semibold text-warning-700">
                  Citation count below approval threshold
                </p>
                <p className="mt-0.5 text-warning-700/90">
                  ~14 citations across 2 papers — USCIS commonly cites this for
                  EB-1A &ldquo;original contributions&rdquo;.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Gauge({ score }: { score: number }) {
  const size = 110;
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color = score < 35 ? "#17b26a" : score < 65 ? "#f79009" : "#f04438";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 transform">
        <circle cx={cx} cy={cy} r={r} stroke="#eaecf0" strokeWidth={8} fill="none" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums text-gray-900">
          {score}
        </span>
        <span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-gray-500">
          RFE risk
        </span>
      </div>
    </div>
  );
}

function CriterionRow({
  label,
  strength,
}: {
  label: string;
  strength: "weak" | "moderate" | "strong";
}) {
  const map = {
    weak: { fill: "30%", color: "bg-error-500", text: "text-error-700", label: "Needs work" },
    moderate: { fill: "60%", color: "bg-warning-500", text: "text-warning-700", label: "Borderline" },
    strong: { fill: "92%", color: "bg-success-500", text: "text-success-700", label: "Strong" },
  };
  const v = map[strength];
  return (
    <div className="flex items-center gap-3">
      <span className="w-[170px] truncate text-[11px] font-medium text-gray-700">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full ${v.color}`} style={{ width: v.fill }} />
      </div>
      <span className={`pill border border-current/20 bg-white text-[10px] ${v.text}`}>
        {v.label}
      </span>
    </div>
  );
}
