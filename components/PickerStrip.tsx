"use client";

import { TAGS, FEELS, INTENTS, tagColor, inferTag } from "@/lib/domain";
import { type UseTimerResult } from "@/lib/client/useTimer";
import styles from "./PickerStrip.module.css";

export interface PickerStripProps {
  timerState: Partial<UseTimerResult>;
  updateDraft: (patch: {
    tag?: string | null;
    feel?: string | null;
    intent?: string | null;
  }) => void;
}

export function PickerStrip({ timerState, updateDraft }: PickerStripProps) {
  const {
    draftBullets = [""],
    draftTag = null,
    draftFeel = null,
    draftIntent = null,
  } = timerState;

  const inference = inferTag(draftBullets);
  const showInference = inference && !draftTag;

  const handleChipClick = (tagLabel: string) => {
    if (draftTag === tagLabel) {
      // Deselect if already selected
      updateDraft({ tag: null });
    } else {
      // Select the tag
      updateDraft({ tag: tagLabel });
    }
  };

  const handleFeelClick = (feel: string) => {
    if (draftFeel === feel) {
      // Toggle off on reclick
      updateDraft({ feel: null });
    } else {
      updateDraft({ feel });
    }
  };

  const handleIntentClick = (intentKey: string) => {
    if (draftIntent === intentKey) {
      // Toggle off on reclick
      updateDraft({ intent: null });
    } else {
      updateDraft({ intent: intentKey });
    }
  };

  const getChipClass = (tagLabel: string): string => {
    if (draftTag === tagLabel) {
      return styles.chipSelected;
    }
    if (inference === tagLabel && !draftTag) {
      return styles.chipSuggested;
    }
    return styles.chipIdle;
  };

  return (
    <div className={styles.strip} data-testid="picker-strip">
      {/* Label row */}
      <div className={styles.labelRow}>
        <div className={styles.label}>Call it</div>
        {showInference && (
          <div
            className={styles.inferenceHint}
            style={{ color: tagColor(inference) }}
          >
            ↳ reads like {inference.toLowerCase()}
          </div>
        )}
      </div>

      {/* Tag chips */}
      <div className={styles.chipsContainer} role="group" aria-label="Call it">
        {TAGS.map((tag) => {
          const chipClass = getChipClass(tag.label);
          const isSelected = draftTag === tag.label;
          const isSuggested = inference === tag.label && !draftTag;
          const color = tagColor(tag.label);

          return (
            <button
              key={tag.label}
              data-testid={`chip-${tag.label}`}
              className={`${styles.chip} ${chipClass}`}
              onClick={() => handleChipClick(tag.label)}
              aria-pressed={isSelected}
              style={
                isSelected
                  ? { backgroundColor: color, borderColor: color }
                  : isSuggested
                    ? { borderColor: color, color }
                    : undefined
              }
            >
              {tag.label}
            </button>
          );
        })}
      </div>

      {/* Feeling row */}
      <div className={styles.miniLabel}>How it felt</div>
      <div className={styles.segmentedRow}>
        <div
          className={styles.segmentedContainer}
          role="group"
          aria-label="Feeling"
        >
          {FEELS.map((feel) => (
            <button
              key={feel}
              className={`${styles.segment} ${
                draftFeel === feel ? styles.feelSelected : ""
              }`}
              onClick={() => handleFeelClick(feel)}
              aria-pressed={draftFeel === feel}
              data-testid={`feel-${feel}`}
            >
              {feel}
            </button>
          ))}
        </div>
      </div>

      {/* Intent row */}
      <div className={styles.miniLabel}>Meant to?</div>
      <div className={styles.segmentedRow}>
        <div
          className={styles.segmentedContainer}
          role="group"
          aria-label="Intent"
        >
          {Object.entries(INTENTS).map(([key, label]) => (
            <button
              key={key}
              className={`${styles.intentSegment} ${
                draftIntent === key ? styles.intentSelected : ""
              }`}
              onClick={() => handleIntentClick(key)}
              aria-pressed={draftIntent === key}
              data-testid={`intent-${key}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
