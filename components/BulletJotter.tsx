"use client";

import { useEffect, useRef } from "react";
import { type UseTimerResult } from "@/lib/client/useTimer";
import styles from "./BulletJotter.module.css";

export interface BulletJotterProps {
  timerState: Partial<UseTimerResult>;
  updateDraft: (patch: { bullets?: string[] }) => void;
}

/**
 * The jotter is a fixed composer plus a list. You only ever TYPE in the
 * composer, pinned at the top; Enter commits its text as a bullet in the
 * list below and the cursor never leaves the composer. Rows below stay
 * editable in place (typos), Enter there just returns you to the composer,
 * and Backspace on an emptied row deletes it.
 *
 * Under the hood the composer is the LAST slot of the draft array, live-
 * persisted on every keystroke so a crashing tab never loses the line in
 * progress. Committing appends a fresh empty slot, which the composer then
 * represents.
 */
export function BulletJotter({ timerState, updateDraft }: BulletJotterProps) {
  const { mode = "running" } = timerState;
  // The composer IS the draft's last slot, verbatim — never re-derived
  // from its content, or typing would re-bind the input mid-word. The
  // engine seeds drafts with a trailing empty slot so seeded bullets land
  // as committed rows; an empty draft just pads one.
  const rawBullets = timerState.draftBullets ?? [];
  const draftBullets = rawBullets.length > 0 ? rawBullets : [""];
  const composerIndex = draftBullets.length - 1;

  const isRecap = mode === "recap";

  const composerRef = useRef<HTMLInputElement | null>(null);
  const rowRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    rowRefs.current = rowRefs.current.slice(0, composerIndex);
  }, [composerIndex]);

  // Focus the composer when the recap opens — synchronizing the DOM with
  // React state, no setState involved.
  const wasRecapRef = useRef(false);
  useEffect(() => {
    if (isRecap && !wasRecapRef.current) {
      composerRef.current?.focus();
    }
    wasRecapRef.current = isRecap;
  }, [isRecap]);

  const setBullet = (index: number, value: string) => {
    const newBullets = [...draftBullets];
    newBullets[index] = value;
    updateDraft({ bullets: newBullets });
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    // No stacking empties: an empty composer commits nothing.
    if (draftBullets[composerIndex].trim() === "") return;
    // Commit: the typed text stays in its slot (now a list row) and a fresh
    // empty slot becomes the composer. The input element itself is stable
    // (keyed "composer"), so focus never moves.
    updateDraft({ bullets: [...draftBullets, ""] });
  };

  const handleRowKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      // Rows below never spawn rows — Enter hands you back to the composer.
      e.preventDefault();
      composerRef.current?.focus();
    } else if (
      e.key === "Backspace" &&
      draftBullets[index] === "" &&
      draftBullets.length > 1
    ) {
      e.preventDefault();
      const newBullets = [...draftBullets];
      newBullets.splice(index, 1);
      rowRefs.current.splice(index, 1);
      // The target elements exist right now (only the removed row leaves
      // the DOM), so focus directly — no state round-trip needed.
      if (index > 0) {
        rowRefs.current[index - 1]?.focus();
      } else {
        composerRef.current?.focus();
      }
      updateDraft({ bullets: newBullets });
    }
  };

  // The live marker is core branding — always accent red, never tag-colored.
  const markerColor = "#ec3013";

  const jotHeading = isRecap ? "What did you actually do?" : "As you go";
  const jotHint = isRecap ? "Tidy it up" : "Enter for the next bullet";
  const composerPlaceholder = isRecap
    ? "Anything else worth noting?"
    : "Jot it down while it's fresh…";

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
        {/* The composer: pinned first, stable element, cursor home. */}
        <div key="composer" className={styles.bulletRow}>
          <span
            className={styles.marker}
            style={{ backgroundColor: markerColor }}
            data-testid={`bullet-marker-${composerIndex}`}
          />
          <input
            ref={composerRef}
            type="text"
            value={draftBullets[composerIndex]}
            onChange={(e) => setBullet(composerIndex, e.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={composerPlaceholder}
            className={styles.input}
            aria-label="New bullet for this hour"
            data-testid={`bullet-input-${composerIndex}`}
          />
        </div>

        {/* Committed bullets, in the order the hour wrote them. */}
        {draftBullets.slice(0, composerIndex).map((bullet, index) => (
          <div key={index} className={styles.bulletRow}>
            <span
              className={styles.marker}
              style={{ backgroundColor: markerColor }}
              data-testid={`bullet-marker-${index}`}
            />
            <input
              ref={(el) => {
                rowRefs.current[index] = el;
              }}
              type="text"
              value={bullet}
              onChange={(e) => setBullet(index, e.target.value)}
              onKeyDown={(e) => handleRowKeyDown(index, e)}
              placeholder="…"
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
