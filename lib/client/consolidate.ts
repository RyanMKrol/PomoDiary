import type { WalRecord } from "./wal";

/** Action types that make earlier draftUpdates irrelevant: log builds its
 *  entry solely from its own payload, skip wipes drafts without reading
 *  them. awayReturn deliberately does NOT belong here — it folds the
 *  current drafts into the hour it pushes (or keeps them on resume), so a
 *  draftUpdate before it is load-bearing. awayStart also leaves drafts
 *  intact for the return. */
const DRAFT_RESETTING = new Set(["log", "skip"]);

/**
 * Shrinks a WAL record list without changing what replaying it through the
 * engine produces (same final state, same entriesToInsert):
 *
 * 1. A draftUpdate whose FIRST draft-touching successor is a log or skip
 *    is dropped — those wipe the drafts without reading them, so its
 *    effect never survives. A draftUpdate whose first such successor is an
 *    awayReturn is kept (the return folds the drafts into the hour it
 *    pushes), as are draftUpdates with no draft-touching successor at all
 *    (awayStart preserves drafts and does not count).
 * 2. Consecutive runs of the surviving draftUpdates merge into one record:
 *    patches shallow-merge left-to-right, keeping the LAST record's id and at.
 *
 * Non-draftUpdate actions are never reordered, merged, or dropped.
 */
export function consolidate(records: WalRecord[]): WalRecord[] {
  // Rule 1: a draftUpdate is dead only if the FIRST draft-touching action
  // after it wipes drafts without reading them (log/skip). An intervening
  // awayReturn reads the drafts — it folds them into the hour it pushes —
  // so anything before one is load-bearing even when a log follows later.
  const survivors = records.filter((record, i) => {
    if (record.action.type !== "draftUpdate") return true;
    for (let j = i + 1; j < records.length; j++) {
      const type = records[j].action.type;
      if (type === "awayReturn") return true;
      if (DRAFT_RESETTING.has(type)) return false;
    }
    return true;
  });

  // Rule 2: merge consecutive draftUpdate runs.
  const out: WalRecord[] = [];
  for (const record of survivors) {
    const prev = out[out.length - 1];
    if (
      record.action.type === "draftUpdate" &&
      prev !== undefined &&
      prev.action.type === "draftUpdate"
    ) {
      out[out.length - 1] = {
        id: record.id,
        at: record.at,
        action: {
          type: "draftUpdate",
          patch: { ...prev.action.patch, ...record.action.patch },
        },
      };
    } else {
      out.push(record);
    }
  }
  return out;
}
