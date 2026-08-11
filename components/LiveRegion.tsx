"use client";

import { useState } from "react";
import { fmtChimeRange, fmtClock } from "@/lib/time";
import { AWAY } from "@/lib/domain";
import { type UseTimerResult } from "@/lib/client/useTimer";
import { type AwayKind } from "@/lib/timer/engine";

export interface LiveRegionProps {
  timerState: Partial<UseTimerResult>;
  awayKind?: AwayKind | null;
  awaySince?: number | null;
}

/** Visually-hidden aria-live region that announces the three timer
 * transitions (entering chime, entering away, returning from away) to
 * screen reader users as they happen. */
export function LiveRegion({
  timerState,
  awayKind = null,
  awaySince = null,
}: LiveRegionProps) {
  const { mode, chimeFrom, chimeTo, hoursToday } = timerState;

  const [message, setMessage] = useState("");
  const [prevMode, setPrevMode] = useState(mode);

  if (mode !== prevMode) {
    setPrevMode(mode);

    if (mode === "chime" && chimeFrom != null && chimeTo != null) {
      setMessage(
        `Time's ripe. ${fmtChimeRange(chimeFrom, chimeTo)}. Click anywhere to account for the hour.`,
      );
    } else if (mode === "away" && awayKind && awaySince != null) {
      setMessage(`${AWAY[awayKind].tag} since ${fmtClock(awaySince)}`);
    } else if (prevMode === "away" && mode !== "away") {
      setMessage(`Back. ${hoursToday ?? 0} hours logged.`);
    }
  }

  return (
    <div
      aria-live="assertive"
      role="status"
      className="visually-hidden"
      data-testid="live-region"
    >
      {message}
    </div>
  );
}
