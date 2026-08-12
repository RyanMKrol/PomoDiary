"use client";

import { type UseTimerResult } from "@/lib/client/useTimer";
import styles from "./ControlBar.module.css";

export interface ControlBarProps {
  timerState: Partial<UseTimerResult>;
  ringNow: () => Promise<void>;
  awayStart: (kind: "sleep" | "work") => Promise<void>;
}

export function ControlBar({
  timerState,
  ringNow,
  awayStart,
}: ControlBarProps) {
  const { mode = "running" } = timerState;

  if (mode === "chime" || mode === "recap" || mode === "away") {
    return null;
  }

  return (
    <div className={styles.bar} data-testid="control-bar">
      {/* Mid-hour pause was removed deliberately: hours are real wall-clock
          blocks, and pausing relabelled time (the block slid forward on
          resume). Ending the hour early and accounting for it is the honest
          equivalent. */}
      <button
        className={`${styles.button} ${styles.pauseResumeButton}`}
        onClick={() => ringNow()}
        data-testid="control-end-early"
      >
        <span
          className={styles.swatch}
          style={{ backgroundColor: "#ec3013" }}
          data-testid="control-swatch-end-early"
        />
        End early
      </button>

      <button
        className={`${styles.button} ${styles.sleepButton}`}
        onClick={() => awayStart("sleep")}
        data-testid="control-sleep"
      >
        <span
          className={styles.swatch}
          style={{ backgroundColor: "oklch(0.38 0.055 275)" }}
          data-testid="control-swatch-sleep"
        />
        Sleep
      </button>

      <button
        className={`${styles.button} ${styles.workButton} ${styles.buttonLast}`}
        onClick={() => awayStart("work")}
        data-testid="control-work"
      >
        <span
          className={styles.swatch}
          style={{ backgroundColor: "oklch(0.50 0.075 235)" }}
          data-testid="control-swatch-work"
        />
        Work
      </button>
    </div>
  );
}
