"use client";

import { useEffect, useRef, useState } from "react";
import type { Entry } from "@/lib/db/entries.store";
import {
  entriesCacheKey,
  getCachedEntries,
  setCachedEntries,
  invalidateEntriesCache,
} from "@/lib/client/entriesCache";
import { fmtClock, gridCellTitle, gridCellEmptyTitle } from "@/lib/time";
import { tagColor, INTENTS } from "@/lib/domain";
import { EntryEditor } from "./EntryEditor";
import styles from "./DayView.module.css";

export interface DayViewProps {
  dayStart: number;
  dayEnd: number;
  timerState: {
    mode?: string;
    entriesVersion?: number;
  };
}

export function DayView({ dayStart, dayEnd, timerState }: DayViewProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const entriesVersion = timerState.entriesVersion ?? 0;

  const prevRef = useRef<{
    dayStart: number;
    dayEnd: number;
    entriesVersion: number;
  } | null>(null);

  useEffect(() => {
    // Refetch on the first load, when the shown day changes, or when
    // entriesVersion bumps — the timer client increments it when a flush
    // ack confirms new entries reached the database. (The old trigger,
    // "left an entry-creating mode", broke under the optimistic client:
    // mode transitions are now local and happen BEFORE the server insert,
    // so refetching on them raced the flush and missed the new entry.)
    const prev = prevRef.current;
    prevRef.current = { dayStart, dayEnd, entriesVersion };
    // Never early-return until the first load has actually SETTLED: React
    // StrictMode (dev) runs the effect twice, cancelling the first fetch —
    // an early return on the second run left the vine loading forever. And
    // a failed fetch must never be sticky: in the error state, any trigger
    // retries.
    if (prev !== null && !loading && error === null) {
      const dayChanged = prev.dayStart !== dayStart || prev.dayEnd !== dayEnd;
      const entriesChanged = prev.entriesVersion !== entriesVersion;
      if (!dayChanged && !entriesChanged) return;
    }

    // A fetch would fire here — consult the session cache first. A hit
    // (same key, same entriesVersion) means the database can't have
    // anything newer than what we already fetched, so skip the network
    // entirely. Toggling day<->grid remounts this component; without the
    // cache every toggle refetched from the database.
    const cacheKey = entriesCacheKey(dayStart, dayEnd);
    const cached = getCachedEntries(cacheKey, entriesVersion);
    if (cached !== null) {
      // Synchronous setState here is deliberate: this branch replaces the
      // async fetch path's setState with the cached copy of the same data —
      // it runs at most once per mount/day/version change, never cascades.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEntries(cached);
      setLoading(false);
      setError(null);
      return;
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
        if (!cancelled) {
          setCachedEntries(cacheKey, entriesVersion, data);
          setEntries(data);
        }
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
    // `error` is deliberately NOT a dependency: it gates the early return so
    // day/version changes retry a failed fetch, but including it would make
    // the effect refire on its own setError and hammer a persistently-down
    // API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayStart, dayEnd, entriesVersion]);

  if (loading) {
    return <div className={styles.container} />;
  }

  if (error) {
    return <div className={styles.container} />;
  }

  const hourMap = new Map<number, Entry>();
  for (const entry of entries) {
    const t =
      typeof entry.from === "string"
        ? new Date(entry.from).getTime()
        : entry.from.getTime();
    const hour = new Date(t).getHours();
    if (!hourMap.has(hour)) hourMap.set(hour, entry);
  }
  const hourStrip = (
    <div className={styles.hourStrip} data-testid="day-hour-strip">
      {Array.from({ length: 24 }, (_, hour) => {
        const entry = hourMap.get(hour);
        return (
          <div
            key={hour}
            className={styles.hourCell}
            style={{
              backgroundColor: entry
                ? tagColor(entry.tag)
                : "var(--empty-cell)",
            }}
            title={
              entry
                ? gridCellTitle(hour, entry.tag, entry.bullets[0] || "")
                : gridCellEmptyTitle(hour)
            }
            data-testid={`day-hour-cell-${hour}`}
          />
        );
      })}
    </div>
  );

  if (entries.length === 0) {
    return (
      <div className={styles.container}>
        {hourStrip}
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
    // The local array patch is the immediate UI; the cache must not keep
    // serving the pre-edit copy to the grid or a re-toggle, so drop it all.
    invalidateEntriesCache();
    setEntries(entries.map((e) => (e.id === updated.id ? updated : e)));
    setEditingId(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  return (
    <div className={styles.container}>
      {hourStrip}
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
                      {entry.tag !== "Unfiled" && (
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
                      )}
                      {/* Away entries always carry feel "—", so this one
                          check covers every away kind, custom included. */}
                      {entry.feel !== "—" && entry.feel && (
                        <div
                          className={styles.feelChip}
                          data-testid={`chip-feel-${entry.id}`}
                        >
                          {entry.feel}
                        </div>
                      )}
                      {(entry.intent === "yes" ||
                        entry.intent === "no" ||
                        entry.intent === "mixed") && (
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
                          {INTENTS[entry.intent]}
                        </div>
                      )}
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
