import type { WalRecord } from "./wal";

/** Action types whose dispatch calls resetForNextBlock, wiping all drafts.
 *  (awayStart does NOT — it leaves drafts intact for the return.) */
const DRAFT_RESETTING = new Set(["log", "skip", "awayReturn"]);

/**
 * Shrinks a WAL record list without changing what replaying it through the
 * engine produces (same final state, same entriesToInsert):
 *
 * 1. Any draftUpdate followed LATER in the list by a log, skip, or awayReturn
 *    is dropped — those actions wipe the drafts, so its effect never survives.
 *    draftUpdates after the last such action are kept, as are draftUpdates
 *    followed only by non-resetting actions (e.g. a bare awayStart).
 * 2. Consecutive runs of the surviving draftUpdates merge into one record:
 *    patches shallow-merge left-to-right, keeping the LAST record's id and at.
 *
 * Non-draftUpdate actions are never reordered, merged, or dropped.
 */
export function consolidate(records: WalRecord[]): WalRecord[] {
  // Rule 2 first: find the last draft-resetting action; every draftUpdate
  // before it is dead weight.
  let lastReset = -1;
  for (let i = records.length - 1; i >= 0; i--) {
    if (DRAFT_RESETTING.has(records[i].action.type)) {
      lastReset = i;
      break;
    }
  }
  const survivors = records.filter(
    (record, i) => !(record.action.type === "draftUpdate" && i < lastReset),
  );

  // Rule 1: merge consecutive draftUpdate runs.
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
