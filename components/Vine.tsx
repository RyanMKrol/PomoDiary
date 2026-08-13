"use client";

import { useRef, useState } from "react";
import { fmtDayTitle } from "@/lib/time";
import { DayView } from "./DayView";
import { GridView } from "./GridView";
import { SettingsPanel } from "./SettingsPanel";
import styles from "./Vine.module.css";

interface VineProps {
  timerState: {
    mode?: string;
    settings?: {
      soundOn?: boolean;
      chimeVolume?: number;
      pauseAfterLog?: boolean;
      recentAwayLabels?: string[];
    };
    updateSettings?: (patch: Record<string, unknown>) => Promise<void>;
  };
}

export function Vine({ timerState }: VineProps) {
  const [view, setView] = useState<"day" | "grid">("day");
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  const closeSettingsPanel = () => {
    setSettingsPanelOpen(false);
    settingsButtonRef.current?.focus();
  };

  // "Today" is re-read on EVERY render, never memoized: the vine stays
  // mounted for days at a time, and an overnight away (Asleep at 23:00,
  // back the next morning) crosses midnight with selectedDayIndex still 0.
  // A cached day-start kept the view pinned to yesterday after the return.
  // Renders happen on every timer tick, so the shown day flips at (or
  // moments after) midnight; the values are plain numbers, stable within a
  // day, so DayView's fetch effect only refires when the day truly changes.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const displayStart = new Date(now);
  displayStart.setHours(0, 0, 0, 0);
  if (selectedDayIndex > 0) {
    displayStart.setDate(displayStart.getDate() - selectedDayIndex);
  }
  const displayEnd = new Date(displayStart);
  displayEnd.setDate(displayEnd.getDate() + 1);
  const dayInfo = {
    dayStart: displayStart.getTime(),
    dayEnd: displayEnd.getTime(),
    now,
  };

  const handleSelectDay = (dayIndex: number) => {
    setSelectedDayIndex(dayIndex);
    setView("day");
  };

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
          ref={settingsButtonRef}
          className={styles.settingsButton}
          onClick={() => setSettingsPanelOpen(!settingsPanelOpen)}
          data-testid="vine-settings-button"
        >
          <span className={styles.settingsLabel}>Settings</span>
        </button>
        <button
          className={styles.zoomButton}
          onClick={() => {
            if (view === "day") {
              setView("grid");
            } else {
              // "Back to the day" always means TODAY, not whichever past
              // day was last opened from the grid.
              setSelectedDayIndex(0);
              setView("day");
            }
          }}
          data-testid="vine-zoom-button"
        >
          <span className={styles.zoomLabel}>
            {view === "day" ? "Zoom out" : "Back to the day"}
          </span>
          <span className={styles.zoomSquare} />
        </button>
      </div>
      {settingsPanelOpen &&
        timerState.settings &&
        timerState.updateSettings && (
          <SettingsPanel
            settings={
              timerState.settings as Record<string, unknown> & {
                soundOn: boolean;
                chimeVolume: number;
                pauseAfterLog: boolean;
                recentAwayLabels: string[];
              }
            }
            updateSettings={timerState.updateSettings}
            onClose={closeSettingsPanel}
            isOpen={settingsPanelOpen}
          />
        )}
      {view === "day" && (
        <DayView
          dayStart={dayInfo.dayStart}
          dayEnd={dayInfo.dayEnd}
          timerState={timerState}
        />
      )}
      {view === "grid" && (
        <GridView onSelectDay={handleSelectDay} timerState={timerState} />
      )}
    </div>
  );
}
