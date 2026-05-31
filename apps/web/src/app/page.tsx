import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ShieldCheck,
  Clock,
  Upload,
  Brain,
  AlertTriangle,
  CheckCircle2,
  FileSearch,
} from "lucide-react";
import { HeroSection } from "@/components/HeroSection";
import { CriterionPreview } from "@/components/marketing/CriterionPreview";
import { ReceiptPreview } from "@/components/marketing/ReceiptPreview";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <div className="bg-white">
      <Header />

      {/* ─── Hero (carousel) ────────────────────────────────────── */}
      <HeroSection />

      {/* ─── What you get ───────────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-700">
            What you get
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tightish text-gray-900 sm:text-5xl">
            Two independent tools.
          </h2>
          <p className="mt-4 text-lg leading-7 text-gray-600">
            Use either one on its own &mdash; or both together for the same
            applicant. They do not depend on each other.
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          {/* Petition review */}
          <div className="card overflow-hidden p-0">
            <div className="border-b border-gray-100 p-6 sm:p-8">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
                    Before you file
                  </p>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Petition risk review
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    Upload your petition PDF and Pulse goes through it the way
                    a USCIS adjudicator would &mdash; checking each
                    eligibility criterion, the strength of the evidence
                    you&rsquo;ve provided, and what&rsquo;s most likely to
                    trigger a Request for Evidence.
                  </p>
                </div>
              </div>
              <ul className="mt-6 space-y-2.5">
                <Bullet>An overall risk score and a breakdown by criterion</Bullet>
                <Bullet>Specific checks for low citations, weak salary evidence, and other common pitfalls</Bullet>
                <Bullet>Live updates as the review runs &mdash; usually under two minutes</Bullet>
                <Bullet>Plain-language suggestions for every weakness</Bullet>
              </ul>
            </div>
            <div className="bg-gray-25 p-6 sm:p-8">
              <CriterionPreview />
            </div>
          </div>

          {/* Case tracking */}
          <div className="card overflow-hidden p-0">
            <div className="border-b border-gray-100 p-6 sm:p-8">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Clock className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
                    After you file
                  </p>
                  <h3 className="text-xl font-semibold text-gray-900">
                    USCIS case tracking
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    Add your USCIS receipt number once your petition is filed.
                    Pulse pulls the latest status daily, predicts the next
                    milestone, and flags any case taking longer than typical
                    for your service center.
                  </p>
                </div>
              </div>
              <ul className="mt-6 space-y-2.5">
                <Bullet>Latest status pulled automatically every day</Bullet>
                <Bullet>An estimated date for the next milestone, based on real USCIS processing times</Bullet>
                <Bullet>
                  A clear <strong className="font-semibold">stuck</strong>{" "}
                  alert if your case is taking longer than typical
                </Bullet>
                <Bullet>One-click refresh whenever you want a fresh update</Bullet>
              </ul>
            </div>
            <div className="bg-gray-25 p-6 sm:p-8">
              <ReceiptPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pipeline diagram ─────────────────────────────────────── */}
      <section className="relative overflow-hidden border-y border-gray-100 bg-gradient-to-b from-brand-50/40 to-white">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-700">
              How it works
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tightish text-gray-900">
              Four simple steps.
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              No setup, no spreadsheets. Drop in your petition, get a
              detailed review, and follow your case to a decision.
            </p>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-4">
            <Step
              n="01"
              icon={<Upload className="h-4 w-4" />}
              title="Upload"
              body="Drag in your petition PDF or pick it from your computer."
            />
            <Step
              n="02"
              icon={<FileSearch className="h-4 w-4" />}
              title="Review"
              body="Pulse reads the petition the way a USCIS officer would &mdash; criterion by criterion."
            />
            <Step
              n="03"
              icon={<Brain className="h-4 w-4" />}
              title="Understand"
              body="See a clear risk score, the weakest parts of your case, and exactly what to add before you file."
            />
            <Step
              n="04"
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Track"
              body="Add your receipt number after filing. Pulse keeps tabs on USCIS and alerts you when something changes."
            />
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 px-8 py-14 text-center shadow-lg sm:px-16">
          <h2 className="text-3xl font-semibold tracking-tightish text-white sm:text-4xl">
            Spot the weak spots before USCIS does.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-brand-100">
            Open the dashboard, upload a sample petition, and see your risk
            report come together in under two minutes.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/app"
              className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-700 shadow-sm transition-colors hover:bg-brand-50"
            >
              Open dashboard
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
            <Link
              href="#how"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// ─── Building blocks ─────────────────────────────────────────────

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white shadow-xs">
            <Activity className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight text-gray-900">
            Pulse
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="#how"
            className="hidden text-sm font-medium text-gray-700 hover:text-gray-900 sm:inline-block sm:px-3"
          >
            How it works
          </Link>
          <Link href="/app" className="btn-primary py-2">
            Open dashboard
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-6 text-gray-700">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
      <span>{children}</span>
    </li>
  );
}

function Step({
  n,
  icon,
  title,
  body,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card relative p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">
          {icon}
        </span>
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-gray-500">
          step {n}
        </span>
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-gray-600">{body}</p>
    </div>
  );
}
