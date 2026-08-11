"use client";

import { AWAY } from "@/lib/domain";
import { fmtClock, fmtAwayElapsed } from "@/lib/time";
import type { AwayKind } from "@/lib/timer/engine";
import styles from "./AwayOverlay.module.css";

export interface AwayOverlayProps {
  awayKind: AwayKind;
  awaySince: number;
  now: number;
  onReturn: () => void;
}

export function AwayOverlay({
  awayKind,
  awaySince,
  now,
  onReturn,
}: AwayOverlayProps) {
  const mode = AWAY[awayKind];

  return (
    <div
      className={styles.overlay}
      style={{ backgroundColor: mode.color }}
      data-testid="away-overlay"
    >
      <div className={styles.content}>
        <h1 className={styles.headline}>{mode.title}</h1>

        <div className={styles.rule} />

        <p className={styles.elapsed}>
          Since {fmtClock(awaySince)} · {fmtAwayElapsed(awaySince, now)} so far
        </p>

        <p className={styles.note}>{mode.note}</p>
      </div>

      <button
        className={styles.returnButton}
        onClick={onReturn}
        data-testid="away-return-button"
      >
        <span
          className={styles.swatch}
          style={{ backgroundColor: mode.color }}
        />
        {mode.end}
      </button>
    </div>
  );
}
