import { AlertTriangle, Clock, Mail, FileCheck, FileX, Check } from "lucide-react";

/**
 * Larger, dedicated visualization of the case-tracking feature for the home page.
 * Two halves: a full case timeline on the left, processing-time benchmark on the right.
 */
export function TrackingShowcase() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <TimelineCard />
      <BenchmarkCard />
    </div>
  );
}

// ─── Timeline card ──────────────────────────────────────────────

function TimelineCard() {
  const events: TimelineEvent[] = [
    {
      date: "May 28",
      title: "Likely next: Your response to USCIS",
      hint: "Predicted by Jun 12 — start drafting now.",
      kind: "predicted",
    },
    {
      date: "Mar 12",
      title: "Request for Evidence sent",
      hint: "USCIS asked for additional documentation.",
      kind: "current",
    },
    {
      date: "Feb 2",
      title: "Case is being actively reviewed",
      hint: "An officer at the Vermont service center.",
      kind: "past",
    },
    {
      date: "Jan 3",
      title: "Case received",
      hint: "USCIS confirmed receipt of your I-129.",
      kind: "past",
    },
  ];

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-25 px-5 py-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-gray-500" />
          <span className="font-mono text-sm font-semibold text-gray-900">
            EAC2490012345
          </span>
          <span className="pill border border-success-200 bg-success-50 text-success-700">
            Live from USCIS
          </span>
        </div>
        <span className="text-xs text-gray-500">
          Nonimmigrant worker (I-129) · Vermont
        </span>
      </div>
      <div className="p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500">
          Case timeline
        </h3>
        <ul className="mt-4 space-y-4">
          {events.map((e, i) => (
            <TimelineRow key={i} {...e} last={i === events.length - 1} />
          ))}
        </ul>

        <div className="mt-6 flex items-start gap-2 rounded-xl border border-error-200 bg-error-50 px-3.5 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error-500" />
          <div className="text-xs leading-5">
            <p className="font-semibold text-error-700">
              Currently 142 days at this step
            </p>
            <p className="mt-0.5 text-error-700/90">
              Pulse flagged this case as taking longer than usual on day 96
              (when it crossed the typical 95-day threshold for Vermont).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TimelineEvent {
  date: string;
  title: string;
  hint: string;
  kind: "past" | "current" | "predicted";
}

function TimelineRow({
  date,
  title,
  hint,
  kind,
  last,
}: TimelineEvent & { last?: boolean }) {
  const style =
    kind === "current"
      ? {
          dot: "bg-error-500 ring-4 ring-error-100",
          icon: <AlertTriangle className="h-3 w-3 text-white" />,
          titleClass: "text-gray-900 font-semibold",
        }
      : kind === "predicted"
        ? {
            dot: "border-2 border-dashed border-brand-400 bg-white",
            icon: <Clock className="h-3 w-3 text-brand-500" />,
            titleClass: "text-brand-700 font-semibold italic",
          }
        : {
            dot: "bg-success-500",
            icon: <Check className="h-3 w-3 text-white" />,
            titleClass: "text-gray-700",
          };

  return (
    <li className="relative flex gap-4">
      {!last && (
        <span
          aria-hidden
          className="absolute left-[10px] top-6 h-[calc(100%+8px)] w-px bg-gray-200"
        />
      )}
      <span
        className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${style.dot}`}
      >
        {style.icon}
      </span>
      <div className="flex-1 pb-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className={`text-sm leading-5 ${style.titleClass}`}>{title}</p>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-gray-500">
            {date}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-5 text-gray-500">{hint}</p>
      </div>
    </li>
  );
}

// ─── Benchmark card ─────────────────────────────────────────────

function BenchmarkCard() {
  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-25 px-5 py-3">
        <div className="flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900">
            Vermont service center
          </span>
        </div>
        <span className="text-xs text-gray-500">I-129 processing</span>
      </div>
      <div className="p-6">
        <p className="text-sm leading-6 text-gray-600">
          Pulse pulls processing-time data from USCIS so you know what
          &ldquo;normal&rdquo; looks like for your form and service center.
          When a case crosses the typical threshold, you get an alert.
        </p>

        <div className="mt-6 space-y-5">
          <BenchmarkRow
            label="Half of cases (median)"
            sublabel="Most cases finish this step by here"
            color="bg-success-500"
            widthPct={42}
            days={60}
          />
          <BenchmarkRow
            label="Typical maximum"
            sublabel="When Pulse starts flagging your case as slow"
            color="bg-warning-500"
            widthPct={66}
            days={95}
          />
          <BenchmarkRow
            label="Outlier range"
            sublabel="Worth a call to USCIS or your attorney"
            color="bg-error-500"
            widthPct={88}
            days={150}
          />
          <BenchmarkRow
            label="Your case today"
            sublabel="142 days · past the typical maximum"
            color="bg-gray-900"
            widthPct={94}
            days={142}
            current
          />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          <SummaryStat
            icon={<Check className="h-3.5 w-3.5" />}
            label="On time"
            tint="text-success-700 bg-success-50 border-success-200"
            value="0 – 60d"
          />
          <SummaryStat
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Watching"
            tint="text-warning-700 bg-warning-50 border-warning-200"
            value="60 – 95d"
          />
          <SummaryStat
            icon={<FileX className="h-3.5 w-3.5" />}
            label="Outlier"
            tint="text-error-700 bg-error-50 border-error-200"
            value="95d+"
          />
        </div>
      </div>
    </div>
  );
}

function BenchmarkRow({
  label,
  sublabel,
  color,
  widthPct,
  days,
  current,
}: {
  label: string;
  sublabel: string;
  color: string;
  widthPct: number;
  days: number;
  current?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p
          className={`text-xs font-medium ${current ? "text-gray-900" : "text-gray-700"}`}
        >
          {label}
        </p>
        <span
          className={`font-mono text-[11px] tabular-nums ${
            current ? "font-semibold text-gray-900" : "text-gray-500"
          }`}
        >
          {days} days
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] leading-4 text-gray-500">{sublabel}</p>
    </div>
  );
}

function SummaryStat({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className={`rounded-lg border px-2 py-2 ${tint}`}>
      <div className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-mono text-[11px] font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}
