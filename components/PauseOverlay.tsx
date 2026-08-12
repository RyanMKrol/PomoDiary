"use client";

import styles from "./PauseOverlay.module.css";

export interface PauseOverlayProps {
  onResume: () => void;
}

export function PauseOverlay({ onResume }: PauseOverlayProps) {
  return (
    // Clicking anywhere on the card resumes — same interaction contract as
    // the away cards; the labeled button stays as the keyboard affordance.
    <div
      className={styles.overlay}
      data-testid="pause-overlay"
      onClick={onResume}
    >
      <div className={styles.content}>
        <h1 className={styles.headline}>Paused.</h1>

        <div className={styles.rule} />

        <p className={styles.elapsed}>Holding between hours</p>

        <p className={styles.note}>
          The clock waits for you. Click anywhere to start a block that runs to
          the next :00.
        </p>
      </div>

      <button
        className={styles.resumeButton}
        onClick={(e) => {
          e.stopPropagation();
          onResume();
        }}
        data-testid="pause-overlay-resume"
      >
        <span className={styles.swatch} />
        Resume
      </button>
    </div>
  );
}
