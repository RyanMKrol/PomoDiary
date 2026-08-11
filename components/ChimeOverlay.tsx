"use client";

import { fmtChimeRange } from "@/lib/time";
import styles from "./ChimeOverlay.module.css";

export interface ChimeOverlayProps {
  chimeFrom: number;
  chimeTo: number;
  onAcknowledge: () => void;
}

export function ChimeOverlay({
  chimeFrom,
  chimeTo,
  onAcknowledge,
}: ChimeOverlayProps) {
  const label = `Time's ripe. ${fmtChimeRange(chimeFrom, chimeTo)}. Click anywhere to account for the hour.`;

  return (
    <button
      className={styles.overlay}
      onClick={onAcknowledge}
      aria-label={label}
      data-testid="chime-overlay"
    >
      <div className={styles.pulseBox}>
        <div className={styles.solid} />
        <div className={styles.outline} />
      </div>

      <div className={styles.content}>
        <h1 className={styles.headline}>
          TIME&rsquo;S
          <br />
          RIPE.
        </h1>

        <div className={styles.rule} />

        <p className={styles.footer}>
          {fmtChimeRange(chimeFrom, chimeTo)} — click anywhere to account for it
        </p>
      </div>
    </button>
  );
}
