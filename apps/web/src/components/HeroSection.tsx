"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { HeroPreview } from "@/components/marketing/HeroPreview";
import { CaseTrackingHeroPreview } from "@/components/marketing/CaseTrackingHeroPreview";

type SlideId = "review" | "tracking";

interface Slide {
  id: SlideId;
  eyebrow: string;
  headlineLines: [string, string];
  body: string;
  bullets: string[];
  Preview: React.FC;
}

const SLIDES: Slide[] = [
  {
    id: "review",
    eyebrow: "Petition risk review",
    headlineLines: ["Predict the RFE", "before USCIS does."],
    body: "Upload your O-1A or EB-1A petition and get a plain-English risk report — which of the USCIS criteria you've clearly met, where the evidence is thin, and exactly what to add before you file.",
    bullets: [
      "Your petition never leaves your computer",
      "A risk score in minutes — not weeks",
    ],
    Preview: HeroPreview,
  },
  {
    id: "tracking",
    eyebrow: "USCIS case tracking",
    headlineLines: ["Know where", "your case stands."],
    body: "Add your USCIS receipt number once your petition is filed. Pulse pulls the latest status daily, predicts the next milestone, and flags any case taking longer than typical for your service center.",
    bullets: [
      "Daily status updates pulled from USCIS",
      "Alerts the moment your case starts running slow",
    ],
    Preview: CaseTrackingHeroPreview,
  },
];

const ROTATE_MS = 10_000;

export function HeroSection() {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isPaused) return;
    if (typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mq.matches) return;
    }
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, ROTATE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, index]);

  const slide = SLIDES[index]!;
  const Preview = slide.Preview;

  function goTo(i: number) {
    setIndex(i);
  }

  return (
    <section
      className="relative overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(122,90,248,0.16) 0%, rgba(122,90,248,0) 60%), linear-gradient(180deg, #fafaff 0%, #ffffff 100%)",
        }}
      />

      <div className="mx-auto grid max-w-7xl items-start gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28 lg:pt-20">
        {/* left column — content changes with active slide */}
        <div className="lg:sticky lg:top-24 lg:pt-7">
          <div
            key={slide.id} // re-mount triggers fade-in
            className="animate-[fadeIn_400ms_ease-out]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
              {slide.eyebrow}
            </p>
            <h1 className="mt-3 text-5xl font-semibold leading-[1.05] tracking-tightish text-gray-900 sm:text-[64px]">
              {slide.headlineLines[0]}
              <br />
              <span className="bg-gradient-to-br from-brand-600 to-brand-800 bg-clip-text text-transparent">
                {slide.headlineLines[1]}
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-7 text-gray-600">
              {slide.body}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/app" className="btn-primary">
                Open the dashboard
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
              <Link href="#how" className="btn-secondary">
                See how it works
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-gray-500">
              {slide.bullets.map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success-500" />
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Pagination dots */}
          <nav
            className="mt-10 flex items-center gap-3"
            aria-label="Switch hero feature"
          >
            {SLIDES.map((s, i) => {
              const isActive = i === index;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={isActive ? "true" : "false"}
                  className="group flex items-center gap-2"
                >
                  <span
                    className={`relative block h-1.5 overflow-hidden rounded-full transition-all ${
                      isActive ? "w-12 bg-gray-200" : "w-6 bg-gray-200"
                    }`}
                  >
                    {isActive && !isPaused && (
                      <span
                        className="absolute inset-y-0 left-0 block bg-brand-600 animate-[progress_10000ms_linear]"
                      />
                    )}
                    {isActive && isPaused && (
                      <span className="absolute inset-0 block bg-brand-600" />
                    )}
                  </span>
                  <span
                    className={`text-xs font-medium transition-colors ${
                      isActive
                        ? "text-gray-900"
                        : "text-gray-400 group-hover:text-gray-600"
                    }`}
                  >
                    {s.eyebrow}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* right column — carousel of preview cards */}
        <div className="relative lg:pl-4">
          {SLIDES.map((s, i) => (
            <div
              key={s.id}
              className={`transition-opacity duration-500 ${
                i === index
                  ? "relative opacity-100"
                  : "absolute inset-0 pointer-events-none opacity-0"
              }`}
              aria-hidden={i !== index}
            >
              {(() => {
                const C = s.Preview;
                return <C />;
              })()}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
