"use client";

import { useEffect, useRef, useState } from "react";
import { type UseTimerResult } from "@/lib/client/useTimer";
import styles from "./BulletJotter.module.css";

export interface BulletJotterProps {
  timerState: Partial<UseTimerResult>;
  updateDraft: (patch: { bullets?: string[] }) => void;
}

export function BulletJotter({ timerState, updateDraft }: BulletJotterProps) {
  const { mode = "running" } = timerState;
  // The composer invariant: the last row is ALWAYS an empty input inviting
  // the next bullet. A seeded draft (an away bullet, an unaccounted-gap
  // note) used to fill the only row, leaving no visible way to add more —
  // you had to know to click in and press Enter.
  const rawBullets = timerState.draftBullets ?? [];
  const draftBullets =
    rawBullets.length > 0 && rawBullets[rawBullets.length - 1].trim() === ""
      ? rawBullets
      : [...rawBullets, ""];

  const isRecap = mode === "recap";

  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(
    isRecap ? draftBullets.length - 1 : null,
  );

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Keep the ref array in sync with bullet array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, draftBullets.length);
  }, [draftBullets.length]);

  // Apply pending focus after state update
  useEffect(() => {
    if (pendingFocusIndex !== null && inputRefs.current[pendingFocusIndex]) {
      inputRefs.current[pendingFocusIndex]?.focus();
      setPendingFocusIndex(null);
    }
  }, [pendingFocusIndex]);

  const handleBulletChange = (index: number, value: string) => {
    const newBullets = [...draftBullets];
    newBullets[index] = value;
    updateDraft({ bullets: newBullets });
  };

  const handleBulletKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // No stacking empties: an empty bullet can't spawn another (Enter-spam
      // was persisting rows of empty strings into the draft).
      if (draftBullets[index].trim() === "") return;
      const newBullets = [...draftBullets];
      newBullets.splice(index + 1, 0, "");
      inputRefs.current.splice(index + 1, 0, null);
      setPendingFocusIndex(index + 1);
      updateDraft({ bullets: newBullets });
    } else if (
      e.key === "Backspace" &&
      draftBullets[index] === "" &&
      draftBullets.length > 1
    ) {
      e.preventDefault();
      const newBullets = [...draftBullets];
      newBullets.splice(index, 1);
      inputRefs.current.splice(index, 1);
      setPendingFocusIndex(Math.max(0, index - 1));
      updateDraft({ bullets: newBullets });
    }
  };

  // The live marker is core branding — always accent red, never tag-colored.
  const markerColor = "#ec3013";

  const jotHeading = isRecap ? "What did you actually do?" : "As you go";
  const jotHint = isRecap ? "Tidy it up" : "Enter for the next bullet";

  const getPlaceholder = (index: number): string => {
    // The composer (always the last, always empty) carries the invitation;
    // filled rows above it need no prompt.
    if (index === draftBullets.length - 1) {
      return isRecap
        ? "Anything else worth noting?"
        : "Jot it down while it's fresh…";
    }
    return "…";
  };

  return (
    <div className={styles.scroller} data-testid="bullet-jotter">
      <div className={styles.heading}>
        <div className={styles.headingTitle}>{jotHeading}</div>
        <div className={styles.headingHint}>{jotHint}</div>
      </div>
      <div
        className={styles.bulletList}
        role="group"
        aria-label="Bullets for this hour"
      >
        {draftBullets.map((bullet, index) => (
          <div key={index} className={styles.bulletRow}>
            <span
              className={styles.marker}
              style={{ backgroundColor: markerColor }}
              data-testid={`bullet-marker-${index}`}
            />
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              value={bullet}
              onChange={(e) => handleBulletChange(index, e.target.value)}
              onKeyDown={(e) => handleBulletKeyDown(index, e)}
              placeholder={getPlaceholder(index)}
              className={styles.input}
              aria-label={`Bullet ${index + 1} for this hour`}
              data-testid={`bullet-input-${index}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
