"use client";

import { useEffect, useState } from "react";
import { padCount, fmtTodayLabel } from "@/lib/time";
import styles from "./Header.module.css";

interface StateResponse {
  count?: number;
}

export function Header() {
  const [hoursToday, setHoursToday] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [todayLabel, setTodayLabel] = useState("");

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
        setTodayLabel(fmtTodayLabel(now));
      } catch (error) {
        console.error("Failed to fetch hours today:", error);
        setHoursToday(0);
        setTodayLabel(fmtTodayLabel(Date.now()));
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
      <div className={styles.wordmark}>POMODIARY</div>
      <div className={styles.tagline}>One hour. One honest account of it.</div>
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
