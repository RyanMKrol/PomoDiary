"use client";

import { type UseTimerResult } from "@/lib/client/useTimer";
import styles from "./ControlBar.module.css";

export interface ControlBarProps {
  timerState: Partial<UseTimerResult>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  restart: () => Promise<void>;
  awayStart: (kind: "sleep" | "work") => Promise<void>;
}

export function ControlBar({
  timerState,
  pause,
  resume,
  restart,
  awayStart,
}: ControlBarProps) {
  const { mode = "running" } = timerState;

  if (mode === "chime" || mode === "recap" || mode === "away") {
    return null;
  }

  const isPaused = mode === "paused";
  const pauseResumeLabel = isPaused ? "Resume" : "Pause";

  return (
    <div className={styles.bar} data-testid="control-bar">
      <button
        className={`${styles.button} ${styles.pauseResumeButton}`}
        onClick={() => (isPaused ? resume() : pause())}
        data-testid="control-pause-resume"
      >
        <span
          className={styles.swatch}
          style={{ backgroundColor: "#ec3013" }}
          data-testid="control-swatch-pause-resume"
        />
        {pauseResumeLabel}
      </button>

      <button
        className={`${styles.button} ${styles.restartButton}`}
        onClick={() => restart()}
        data-testid="control-restart"
      >
        Restart
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
