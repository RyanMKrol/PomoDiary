"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { padCount, fmtTodayLabel } from "@/lib/time";
import styles from "./Header.module.css";

interface StateResponse {
  count?: number;
}

const emptySubscribe = () => () => {};

export function Header() {
  const [hoursToday, setHoursToday] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  // Client-only value: the server can't render the user's local date (it runs
  // in UTC), so SSR gets an empty label and the client fills it immediately.
  const todayLabel = useSyncExternalStore(
    emptySubscribe,
    () => fmtTodayLabel(Date.now()),
    () => "",
  );

  useEffect(() => {
    async function fetchHoursToday() {
      try {
        const now = Date.now();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const params = new URLSearchParams({
          todayStart: todayStart.getTime().toString(),
          todayEnd: todayEnd.getTime().toString(),
        });

        const response = await fetch(`/api/state?${params}`);
        const data: StateResponse = await response.json();
        setHoursToday(data.count ?? 0);
      } catch (error) {
        console.error("Failed to fetch hours today:", error);
        setHoursToday(0);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHoursToday();
  }, []);

  const displayCount = isLoading ? "00" : padCount(hoursToday);

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
