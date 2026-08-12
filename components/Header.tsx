"use client";

import { useSyncExternalStore } from "react";
import { padCount, fmtTodayLabel } from "@/lib/time";
import type { UseTimerResult } from "@/lib/client/useTimer";
import styles from "./Header.module.css";

const emptySubscribe = () => () => {};

export interface HeaderProps {
  timerState: Partial<UseTimerResult>;
}

export function Header({ timerState }: HeaderProps) {
  // The count rides the shared timer client: incremented locally the moment
  // an hour is logged, corrected by every flush ack. The old per-mount fetch
  // both cost a request and went stale after the first log.
  const { hoursToday, loading = true } = timerState;
  // Client-only value: the server can't render the user's local date (it runs
  // in UTC), so SSR gets an empty label and the client fills it immediately.
  const todayLabel = useSyncExternalStore(
    emptySubscribe,
    () => fmtTodayLabel(Date.now()),
    () => "",
  );

  const displayCount = loading ? "00" : padCount(hoursToday ?? 0);

  return (
    <header className={styles.header}>
      <div className={styles.redSquare} />
      <div className={styles.brandGroup}>
        <div className={styles.wordmark}>POMODIARY</div>
        <div className={styles.tagline}>
          Hour by hour, an honest accounting.
        </div>
      </div>
      <div className={styles.spacer} />
      <div className={styles.countSection}>
        <span className={styles.count}>{displayCount}</span>
        <span className={styles.label}>
          picked today <span className={styles.separator}>·</span> {todayLabel}
        </span>
      </div>
    </header>
  );
}
