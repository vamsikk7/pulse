"use client";

interface Props {
  score: number;
  size?: number;
}

export function RfeRiskGauge({ score, size = 200 }: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const dashLen = (clamped / 100) * circumference;
  const { color, label, description } = thresholds(clamped);

  return (
    <div className="flex items-center gap-8">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 transform">
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke="#eaecf0"
            strokeWidth={14}
            fill="none"
          />
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={color}
            strokeWidth={14}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dashLen} ${circumference}`}
            style={{
              transition:
                "stroke-dasharray 800ms cubic-bezier(0.4, 0, 0.2, 1), stroke 400ms",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-sans text-4xl font-semibold tabular-nums text-gray-900">
            {clamped}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500">
            RFE Risk
          </span>
        </div>
      </div>
      <div>
        <p className="text-base font-semibold" style={{ color }}>
          {label} risk
        </p>
        <p className="mt-1 max-w-xs text-sm leading-6 text-gray-600">
          {description}
        </p>
      </div>
    </div>
  );
}

function thresholds(score: number): {
  color: string;
  label: string;
  description: string;
} {
  if (score < 35) {
    return {
      color: "#17b26a",
      label: "Low",
      description:
        "Strong evidence across the claimed criteria. Few obvious gaps an adjudicator would flag.",
    };
  }
  if (score < 65) {
    return {
      color: "#f79009",
      label: "Moderate",
      description:
        "Reasonable petition with material gaps that USCIS adjudicators commonly cite in RFEs.",
    };
  }
  return {
    color: "#f04438",
    label: "High",
    description:
      "Significant weaknesses likely to trigger an RFE or NOID. Address the ranked items before filing.",
  };
}
