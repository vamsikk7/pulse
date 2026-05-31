"use client";

import { useState, type ReactNode } from "react";
import { FileText, Clock, AlertTriangle } from "lucide-react";

interface TabDef {
  id: "review" | "tracking";
  icon: ReactNode;
  label: string;
  subtitle: string;
  badge?: { kind: "neutral" | "warn" | "good"; text: string };
  content: ReactNode;
}

export function CaseTabs({
  reviewSummary,
  reviewContent,
  trackingSummary,
  trackingContent,
  initial,
}: {
  reviewSummary: { hasPetition: boolean; petitionCount: number };
  reviewContent: ReactNode;
  trackingSummary: {
    hasReceipts: boolean;
    receiptCount: number;
    stuckCount: number;
  };
  trackingContent: ReactNode;
  initial: "review" | "tracking";
}) {
  const [active, setActive] = useState<TabDef["id"]>(initial);

  const tabs: TabDef[] = [
    {
      id: "review",
      icon: <FileText className="h-4 w-4" />,
      label: "Petition review",
      subtitle: "Before you file — get a plain-English risk report",
      badge: reviewSummary.hasPetition
        ? {
            kind: "good",
            text: `${reviewSummary.petitionCount} reviewed`,
          }
        : { kind: "neutral", text: "Not started" },
      content: reviewContent,
    },
    {
      id: "tracking",
      icon: <Clock className="h-4 w-4" />,
      label: "Case tracking",
      subtitle: "After you file — follow USCIS to a decision",
      badge: !trackingSummary.hasReceipts
        ? { kind: "neutral", text: "Not added" }
        : trackingSummary.stuckCount > 0
          ? {
              kind: "warn",
              text: `${trackingSummary.receiptCount} receipt${trackingSummary.receiptCount === 1 ? "" : "s"} · ${trackingSummary.stuckCount} stuck`,
            }
          : {
              kind: "good",
              text: `${trackingSummary.receiptCount} receipt${trackingSummary.receiptCount === 1 ? "" : "s"}`,
            },
      content: trackingContent,
    },
  ];

  return (
    <div>
      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="Tools for this applicant"
        className="card grid grid-cols-1 gap-0 overflow-hidden p-0 sm:grid-cols-2"
      >
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`tabpanel-${t.id}`}
              id={`tab-${t.id}`}
              onClick={() => setActive(t.id)}
              className={`group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors ${
                isActive
                  ? "bg-white border-b-2 border-brand-600 sm:border-b-2"
                  : "bg-gray-25 hover:bg-gray-50 border-b-2 border-transparent"
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  isActive
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {t.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={`text-sm font-semibold ${
                      isActive ? "text-gray-900" : "text-gray-700"
                    }`}
                  >
                    {t.label}
                  </p>
                  {t.badge && <Badge {...t.badge} />}
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">
                  {t.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Panels */}
      <div className="mt-6">
        {tabs.map((t) => (
          <div
            key={t.id}
            role="tabpanel"
            id={`tabpanel-${t.id}`}
            aria-labelledby={`tab-${t.id}`}
            hidden={t.id !== active}
          >
            {t.id === active && t.content}
          </div>
        ))}
      </div>
    </div>
  );
}

function Badge({
  kind,
  text,
}: {
  kind: "neutral" | "warn" | "good";
  text: string;
}) {
  const map = {
    neutral: "border border-gray-200 bg-white text-gray-600",
    good: "border border-success-200 bg-success-50 text-success-700",
    warn: "border border-error-200 bg-error-50 text-error-700",
  };
  return (
    <span className={`pill ${map[kind]}`}>
      {kind === "warn" && <AlertTriangle className="mr-0.5 h-3 w-3" />}
      {text}
    </span>
  );
}
