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
  // The server's draft starts (and resets to) an empty array — always render
  // at least one input, or the jotter vanishes the moment real state loads.
  const rawBullets = timerState.draftBullets ?? [""];
  const draftBullets = rawBullets.length > 0 ? rawBullets : [""];

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
    if (index === 0) {
      return isRecap
        ? "Wrote the pricing page copy"
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
