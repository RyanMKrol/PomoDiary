"use client";

import { useEffect, useState } from "react";

import { TAGS, FEELS, INTENTS, tagColor, inferTag } from "@/lib/domain";
import { type UseTimerResult } from "@/lib/client/useTimer";
import styles from "./PickerStrip.module.css";

/** Below this viewport height the pickers start collapsed so the bullet
 *  jotter — the part that matters mid-hour — keeps its room. */
const SHORT_VIEWPORT_QUERY = "(max-height: 720px)";

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
    mode = "running",
    draftBullets = [""],
    draftTag = null,
    draftFeel = null,
    draftIntent = null,
  } = timerState;

  // Accordion: the "Call the hour" header toggles the pickers; short viewports
  // start (and re-)collapse them automatically, and a manual toggle holds
  // until the viewport crosses the threshold again.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    // jsdom (tests) has no matchMedia; treat it as a tall viewport.
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(SHORT_VIEWPORT_QUERY);
    setCollapsed(media.matches);
    const onChange = (e: MediaQueryListEvent) => setCollapsed(e.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, []);

  const inference = inferTag(draftBullets);
  const showInference = inference && !draftTag;

  // The chips are how an hour gets called, so the accordion never hides
  // them while the user is actually recapping.
  const isRecapping = mode === "recap" || mode === "chime";
  const isCollapsed = collapsed && !isRecapping;

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
      {/* Label row doubles as the accordion toggle */}
      <button
        className={styles.labelRow}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!isCollapsed}
        data-testid="picker-strip-toggle"
      >
        <div className={styles.label}>Call the hour</div>
        {showInference && (
          <div
            className={styles.inferenceHint}
            style={{ color: tagColor(inference) }}
          >
            ↳ reads like {inference.toLowerCase()}
          </div>
        )}
        <span className={styles.collapseHint}>{isCollapsed ? "+" : "–"}</span>
      </button>

      {isCollapsed ? null : (
        <>
          {/* Tag chips */}
          <div className={`${styles.miniLabel} ${styles.sentenceLabel}`}>
            It was mostly…
          </div>
          <div
            className={styles.chipsContainer}
            role="group"
            aria-label="It was mostly…"
          >
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
          <div className={`${styles.miniLabel} ${styles.sentenceLabel}`}>
            It felt…
          </div>
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
          <div className={`${styles.miniLabel} ${styles.sentenceLabel}`}>
            And it was…
          </div>
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
        </>
      )}
    </div>
  );
}
