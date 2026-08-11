"use client";

import { type UseTimerResult, type LogPayload } from "@/lib/client/useTimer";
import styles from "./RecapBar.module.css";

export interface RecapBarProps {
  timerState: Partial<UseTimerResult>;
  log: (payload: LogPayload) => Promise<void>;
  skip: () => Promise<void>;
}

export function RecapBar({ timerState, log, skip }: RecapBarProps) {
  const {
    mode = "running",
    draftBullets = [],
    draftTag = null,
    draftFeel = null,
    draftIntent = null,
  } = timerState;

  if (mode !== "recap") {
    return null;
  }

  const handleLogIt = async () => {
    await log({
      bullets: draftBullets,
      tag: draftTag,
      feel: draftFeel,
      intent: draftIntent,
    });
  };

  return (
    <div className={styles.bar} data-testid="recap-bar">
      <button
        className={styles.logItButton}
        onClick={handleLogIt}
        data-testid="recap-log-it"
      >
        <span
          className={styles.logItSwatch}
          data-testid="recap-swatch-log-it"
        />
        Log it & start the next hour
      </button>

      <button
        className={styles.skipButton}
        onClick={() => skip()}
        data-testid="recap-skip"
      >
        Skip
      </button>
    </div>
  );
}
