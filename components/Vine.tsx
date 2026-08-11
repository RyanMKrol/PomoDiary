"use client";

import { useState, useMemo } from "react";
import { fmtDayTitle } from "@/lib/time";
import { DayView } from "./DayView";
import styles from "./Vine.module.css";

interface VineProps {
  timerState: {
    mode?: string;
  };
}

export function Vine({ timerState }: VineProps) {
  const [view, setView] = useState<"day" | "grid">("day");

  const dayInfo = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {
      dayStart: start.getTime(),
      dayEnd: end.getTime(),
      now,
    };
  }, []);

  const viewTitle =
    view === "day" ? fmtDayTitle(dayInfo.dayStart, dayInfo.now) : "Every day";

  return (
    <div className={styles.vineContainer} data-testid="vine-container">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.label}>The vine</span>
        </div>
        <div className={styles.viewTitle}>{viewTitle}</div>
        <div className={styles.spacer} />
        <button
          className={styles.zoomButton}
          onClick={() => setView(view === "day" ? "grid" : "day")}
          data-testid="vine-zoom-button"
        >
          <span className={styles.zoomLabel}>
            {view === "day" ? "Zoom out" : "Back to the day"}
          </span>
          <span className={styles.zoomSquare} />
        </button>
      </div>
      {view === "day" && (
        <DayView
          dayStart={dayInfo.dayStart}
          dayEnd={dayInfo.dayEnd}
          timerState={timerState}
        />
      )}
    </div>
  );
}
