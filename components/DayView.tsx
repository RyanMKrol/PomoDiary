"use client";

import { useEffect, useRef, useState } from "react";
import type { Entry } from "@/lib/db/entries.store";
import { fmtClock } from "@/lib/time";
import { tagColor } from "@/lib/domain";
import { EntryEditor } from "./EntryEditor";
import styles from "./DayView.module.css";

export interface DayViewProps {
  dayStart: number;
  dayEnd: number;
  timerState: {
    mode?: string;
  };
}

export function DayView({ dayStart, dayEnd, timerState }: DayViewProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const prevRef = useRef<{
    dayStart: number;
    dayEnd: number;
    mode?: string;
  } | null>(null);

  useEffect(() => {
    // Refetch on the first load, when the shown day changes, or when the timer
    // LEAVES an entry-creating mode (log from recap/chime, backfill from away).
    // Refetching on every mode change doubled the network calls at page load
    // (undefined -> running) for no new data.
    const prev = prevRef.current;
    prevRef.current = { dayStart, dayEnd, mode: timerState.mode };
    if (prev !== null) {
      const dayChanged = prev.dayStart !== dayStart || prev.dayEnd !== dayEnd;
      const leftEntryCreatingMode =
        prev.mode !== timerState.mode &&
        (prev.mode === "recap" ||
          prev.mode === "away" ||
          prev.mode === "chime");
      if (!dayChanged && !leftEntryCreatingMode) return;
    }

    // Refetches keep the previous entries on screen until fresh data lands —
    // only the very first load shows the blank container. Blanking on every
    // refetch made the whole panel flash empty right after page load.
    let cancelled = false;
    const fetchEntries = async () => {
      try {
        setError(null);
        const response = await fetch(
          `/api/entries?from=${dayStart}&to=${dayEnd}`,
        );
        if (!response.ok) {
          throw new Error("Failed to fetch entries");
        }
        const data = await response.json();
        if (!cancelled) setEntries(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchEntries();
    return () => {
      cancelled = true;
    };
  }, [dayStart, dayEnd, timerState.mode]);

  if (loading) {
    return <div className={styles.container} />;
  }

  if (error) {
    return <div className={styles.container} />;
  }

  if (entries.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptySquare} />
          <h2 className={styles.emptyHeadline}>Nothing in the basket yet.</h2>
          <p className={styles.emptyBody}>
            The ring fills as the hour passes. Jot things down as you go if you
            like — when it chimes, you tidy up what the hour was, and the next
            one starts on its own.
          </p>
        </div>
      </div>
    );
  }

  const handleEditSave = (updated: Entry) => {
    setEntries(entries.map((e) => (e.id === updated.id ? updated : e)));
    setEditingId(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  return (
    <div className={styles.container}>
      {entries.map((entry) => {
        const isEditing = editingId === entry.id;

        return (
          <article
            key={entry.id}
            className={styles.entry}
            data-testid={`entry-${entry.id}`}
          >
            <div
              className={styles.left}
              style={{
                borderLeftColor: tagColor(entry.tag),
              }}
            >
              <div className={styles.startTime}>
                {fmtClock(
                  typeof entry.from === "string"
                    ? new Date(entry.from).getTime()
                    : entry.from.getTime(),
                )}
              </div>
              <div className={styles.endTime}>
                to{" "}
                {fmtClock(
                  typeof entry.to === "string"
                    ? new Date(entry.to).getTime()
                    : entry.to.getTime(),
                )}
              </div>
            </div>
            <div className={styles.right}>
              {isEditing ? (
                <EntryEditor
                  entry={entry}
                  onSave={handleEditSave}
                  onCancel={handleEditCancel}
                />
              ) : (
                <>
                  <div className={styles.chipRowContainer}>
                    <div className={styles.chipRow}>
                      <div
                        className={styles.tagChip}
                        style={{
                          backgroundColor: tagColor(entry.tag),
                          borderColor: tagColor(entry.tag),
                        }}
                        data-testid={`chip-tag-${entry.id}`}
                      >
                        {entry.tag}
                      </div>
                      <div
                        className={styles.feelChip}
                        data-testid={`chip-feel-${entry.id}`}
                      >
                        {entry.tag === "Asleep" || entry.tag === "At work"
                          ? "—"
                          : entry.feel}
                      </div>
                      <div
                        className={`${styles.intentChip} ${
                          entry.intent === "no" ? styles.intentNo : ""
                        }`}
                        style={
                          entry.intent === "no"
                            ? { backgroundColor: "oklch(0.42 0.012 40)" }
                            : {}
                        }
                        data-testid={`chip-intent-${entry.id}`}
                      >
                        {entry.intent === "yes"
                          ? "Intentional"
                          : entry.intent === "no"
                            ? "Got away"
                            : "Unmarked"}
                      </div>
                    </div>
                    <button
                      className={styles.editButton}
                      onClick={() => {
                        if (editingId) {
                          setEditingId(null);
                        }
                        setEditingId(entry.id);
                      }}
                      data-testid={`edit-button-${entry.id}`}
                      title="Edit this entry"
                    >
                      Edit
                    </button>
                  </div>
                  <ul className={styles.bulletList}>
                    {entry.bullets.map((bullet, idx) => (
                      <li
                        key={idx}
                        className={styles.bullet}
                        style={
                          {
                            "--marker-color": tagColor(entry.tag),
                          } as React.CSSProperties
                        }
                        data-testid={`bullet-${entry.id}-${idx}`}
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
