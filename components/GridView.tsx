"use client";

import { useEffect, useState, useMemo } from "react";
import type { Entry } from "@/lib/db/entries.store";
import {
  dayKey,
  fmtGridDayLabel,
  gridCellTitle,
  gridCellEmptyTitle,
  padCount,
} from "@/lib/time";
import { tagColor, TAGS, AWAY } from "@/lib/domain";
import styles from "./GridView.module.css";

export interface GridViewProps {
  onSelectDay: (dayIndex: number) => void;
  timerState: {
    mode?: string;
  };
}

export function GridView({ onSelectDay, timerState }: GridViewProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // No range params = the user's full history: the grid shows every day
    // since first use, not a fixed window. Refetches keep the previous rows
    // on screen until fresh data lands (no blank flash).
    let cancelled = false;
    const fetchEntries = async () => {
      try {
        setError(null);
        const response = await fetch(`/api/entries`);
        if (!response.ok) {
          throw new Error("Failed to fetch entries");
        }
        const data = await response.json();
        if (!cancelled) setEntries(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchEntries();
    return () => {
      cancelled = true;
    };
  }, [timerState.mode]);

  const days = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // One row per day from today back to the earliest entry (minimum 10 rows),
    // so the grid grows with use and quiet days still show at a glance.
    let earliest = today.getTime();
    for (const entry of entries) {
      const t =
        typeof entry.from === "string"
          ? new Date(entry.from).getTime()
          : entry.from.getTime();
      const d = new Date(t);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() < earliest) earliest = d.getTime();
    }
    const daysBack = Math.round((today.getTime() - earliest) / 86_400_000);
    const totalDays = Math.max(10, daysBack + 1);

    const dayList = [];
    for (let i = 0; i < totalDays; i++) {
      const dayStart = new Date(today);
      dayStart.setDate(dayStart.getDate() - i);
      dayList.push(dayStart);
    }
    return dayList;
  }, [entries]);

  if (loading) {
    return <div className={styles.container} />;
  }

  if (error) {
    return <div className={styles.container} />;
  }

  // Create a map of dayKey -> entries for that day, sorted by start hour
  const entriesByDay: Map<string, Entry[]> = new Map();
  for (const entry of entries) {
    const key = dayKey(
      typeof entry.from === "string"
        ? new Date(entry.from).getTime()
        : entry.from.getTime(),
    );
    if (!entriesByDay.has(key)) {
      entriesByDay.set(key, []);
    }
    entriesByDay.get(key)!.push(entry);
  }

  // Create a map of dayKey -> entries by start hour
  const entriesByHour: Map<string, Map<number, Entry>> = new Map();
  for (const [key, dayEntries] of entriesByDay.entries()) {
    const hourMap = new Map<number, Entry>();
    for (const entry of dayEntries) {
      const entryTime =
        typeof entry.from === "string"
          ? new Date(entry.from).getTime()
          : entry.from.getTime();
      const hour = new Date(entryTime).getHours();
      // First match wins when two entries share a start hour
      if (!hourMap.has(hour)) {
        hourMap.set(hour, entry);
      }
    }
    entriesByHour.set(key, hourMap);
  }

  const handleRowClick = (index: number) => {
    onSelectDay(index);
  };

  return (
    <div className={styles.container}>
      <div className={styles.gridWrapper}>
        {/* Ruler row */}
        <div className={styles.rulerRow}>
          <div className={styles.rulerLeft} />
          <div className={styles.rulerMiddle}>
            {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
              <div
                key={hour}
                className={styles.rulerLabel}
                data-testid={`ruler-label-${hour}`}
              >
                {padCount(hour)}
              </div>
            ))}
          </div>
          <div className={styles.rulerRight}>HRS</div>
        </div>

        {/* 10 day rows */}
        {days.map((day, dayIndex) => {
          const key = dayKey(day.getTime());
          const hourMap = entriesByHour.get(key) || new Map();
          const dayEntries = entriesByDay.get(key) || [];
          const count = dayEntries.length;
          const dayLabel = fmtGridDayLabel(day.getTime(), dayIndex);
          const rowLabel = `${dayLabel}, ${count} hour${count === 1 ? "" : "s"} logged. Open day.`;

          return (
            <button
              key={dayIndex}
              className={styles.dayRow}
              onClick={() => handleRowClick(dayIndex)}
              aria-label={rowLabel}
              data-testid={`day-row-${dayIndex}`}
            >
              <div
                className={styles.dayLabel}
                data-testid={`day-label-${dayIndex}`}
              >
                {dayLabel}
              </div>
              <div className={styles.hourCells}>
                {Array.from({ length: 24 }, (_, hour) => {
                  const entry = hourMap.get(hour);
                  const cellColor = entry
                    ? tagColor(entry.tag)
                    : "var(--empty-cell)";
                  const cellTitle = entry
                    ? gridCellTitle(hour, entry.tag, entry.bullets[0] || "")
                    : gridCellEmptyTitle(hour);

                  return (
                    <div
                      key={hour}
                      className={styles.cell}
                      style={{ backgroundColor: cellColor }}
                      title={cellTitle}
                      role="img"
                      aria-label={cellTitle}
                      data-testid={`cell-${dayIndex}-${hour}`}
                      data-hour={hour}
                      data-has-entry={!!entry}
                    />
                  );
                })}
              </div>
              <div
                className={styles.dayCount}
                data-testid={`day-count-${dayIndex}`}
              >
                {padCount(count)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend and footer */}
      <div className={styles.footer}>
        <div className={styles.divider} />
        <div className={styles.legend}>
          {TAGS.map((tag) => (
            <div key={tag.label} className={styles.legendItem}>
              <div
                className={styles.legendSquare}
                style={{ backgroundColor: tag.color }}
              />
              <span className={styles.legendLabel}>{tag.label}</span>
            </div>
          ))}
          <div key="asleep" className={styles.legendItem}>
            <div
              className={styles.legendSquare}
              style={{ backgroundColor: AWAY.sleep.color }}
            />
            <span className={styles.legendLabel}>Asleep</span>
          </div>
          <div key="at-work" className={styles.legendItem}>
            <div
              className={styles.legendSquare}
              style={{ backgroundColor: AWAY.work.color }}
            />
            <span className={styles.legendLabel}>At work</span>
          </div>
        </div>
        <div className={styles.footerText}>
          Click a day to read the hours back.
        </div>
      </div>
    </div>
  );
}
