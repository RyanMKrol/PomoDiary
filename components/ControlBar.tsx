"use client";

import { useEffect, useRef, useState } from "react";

import { type UseTimerResult } from "@/lib/client/useTimer";
import type { AwayKind } from "@/lib/timer/engine";
import { AWAY } from "@/lib/domain";
import { LIMITS } from "@/lib/validation";
import styles from "./ControlBar.module.css";

export interface ControlBarProps {
  timerState: Partial<UseTimerResult>;
  ringNow: () => Promise<void>;
  awayStart: (kind: AwayKind, label?: string) => Promise<void>;
}

const AWAY_BUTTONS = Object.entries(AWAY).map(([kind, cfg]) => ({
  kind: kind as keyof typeof AWAY,
  label: kind.charAt(0).toUpperCase() + kind.slice(1),
  color: cfg.color,
}));

export function ControlBar({
  timerState,
  ringNow,
  awayStart,
}: ControlBarProps) {
  const { mode = "running", settings } = timerState;
  const [customOpen, setCustomOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (customOpen) inputRef.current?.focus();
  }, [customOpen]);

  if (mode === "chime" || mode === "recap" || mode === "away") {
    return null;
  }

  const recentLabels = settings?.recentAwayLabels ?? [];

  const closeCustom = () => {
    setCustomOpen(false);
    setCustomLabel("");
  };

  const submitCustom = (label: string) => {
    const trimmed = label.trim();
    if (trimmed === "") return;
    closeCustom();
    void awayStart("custom", trimmed);
  };

  return (
    <div className={styles.bar} data-testid="control-bar">
      {/* Mid-hour pause was removed deliberately: hours are real wall-clock
          blocks, and pausing relabelled time (the block slid forward on
          resume). Ending the hour early and accounting for it is the honest
          equivalent. */}
      <div className={styles.row}>
        <button
          className={`${styles.button} ${styles.endEarlyButton} ${styles.buttonLast}`}
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
      </div>

      {customOpen ? (
        <div className={styles.customArea} data-testid="control-custom-area">
          {recentLabels.length > 0 && (
            <div className={styles.recentChips}>
              {recentLabels.map((label, i) => (
                <button
                  key={label}
                  className={styles.recentChip}
                  onClick={() => submitCustom(label)}
                  data-testid={`control-recent-${i}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className={styles.customRow}>
            <input
              ref={inputRef}
              className={styles.customInput}
              value={customLabel}
              placeholder="Where to?"
              maxLength={LIMITS.MAX_TAG_LENGTH}
              onChange={(e) => setCustomLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCustom(customLabel);
                if (e.key === "Escape") closeCustom();
              }}
              data-testid="control-custom-input"
            />
            <button
              className={`${styles.button} ${styles.goButton}`}
              onClick={() => submitCustom(customLabel)}
              data-testid="control-custom-go"
            >
              Go
            </button>
            <button
              className={`${styles.button} ${styles.buttonLast} ${styles.cancelButton}`}
              onClick={closeCustom}
              aria-label="Cancel custom away"
              data-testid="control-custom-cancel"
            >
              ×
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.row}>
          {AWAY_BUTTONS.map(({ kind, label, color }) => (
            <button
              key={kind}
              className={styles.button}
              onClick={() => awayStart(kind)}
              data-testid={`control-${kind}`}
            >
              <span
                className={styles.swatch}
                style={{ backgroundColor: color }}
                data-testid={`control-swatch-${kind}`}
              />
              {label}
            </button>
          ))}
          <button
            className={`${styles.button} ${styles.moreButton} ${styles.buttonLast}`}
            onClick={() => setCustomOpen(true)}
            data-testid="control-away-more"
          >
            Else…
          </button>
        </div>
      )}
    </div>
  );
}
