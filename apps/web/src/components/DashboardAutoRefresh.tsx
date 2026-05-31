"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Polls `router.refresh()` every 10s while there's in-flight work,
 * so the dashboard catches up automatically when the user returns.
 *
 * Implementation note: `router.refresh()` must be called from an effect, NOT
 * from inside a state-updater callback, otherwise React complains:
 *   "Cannot update a component (Router) while rendering a different component"
 * We separate the countdown (state) from the refresh trigger (a ref-backed
 * tick counter) so the refresh fires from a non-render context.
 */
export function DashboardAutoRefresh({
  inFlightCount,
  awaitingSyncCount,
}: {
  inFlightCount: number;
  awaitingSyncCount: number;
}) {
  const router = useRouter();
  const active = inFlightCount > 0 || awaitingSyncCount > 0;
  const [secondsLeft, setSecondsLeft] = useState(10);
  // Increments every time the countdown hits zero. A separate effect watches
  // this ref-backed counter and calls router.refresh() outside of any state
  // updater, sidestepping the "setState during render" warning.
  const refreshTrigger = useRef(0);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    setSecondsLeft(10);
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          refreshTrigger.current += 1;
          // Defer the trigger update so it lands on the next tick / commit,
          // not inside this updater
          queueMicrotask(() => setRefreshTick(refreshTrigger.current));
          return 10;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [active, inFlightCount, awaitingSyncCount]);

  // Separate effect that actually calls router.refresh() — runs *after* commit
  // when refreshTick changes, so we're never inside a render path here.
  useEffect(() => {
    if (refreshTick === 0) return;
    router.refresh();
  }, [refreshTick, router]);

  if (!active) return null;

  const bits: string[] = [];
  if (inFlightCount > 0) {
    bits.push(
      `${inFlightCount} review${inFlightCount === 1 ? "" : "s"} in progress`,
    );
  }
  if (awaitingSyncCount > 0) {
    bits.push(
      `${awaitingSyncCount} receipt${awaitingSyncCount === 1 ? "" : "s"} awaiting first sync`,
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      <span>{bits.join(" · ")}</span>
      <span className="text-brand-400">·</span>
      <span className="font-mono tabular-nums text-[10px] text-brand-500">
        refreshing in {secondsLeft}s
      </span>
    </div>
  );
}
