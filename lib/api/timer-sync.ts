import { NextRequest, NextResponse } from "next/server";

import { getDb } from "../db";
import { assertEntryCaps, type EntryInput } from "../db/entries.store";
import { applySyncWrite } from "../db/sync.store";
import {
  getTimerState,
  pushRecentAwayLabel,
  upsertTimerState,
} from "../db/timer-state.store";
import { countEntriesForDay } from "../db/entries.store";
import {
  deriveNow,
  dispatch,
  initialState,
  type Action,
  type EntryToInsert,
  type Settings as EngineSettings,
  type TimerState as EngineTimerState,
} from "../timer/engine";
import { syncRequestSchema } from "../validation";
import { parseJsonBody } from "./route-handler";
import {
  buildStatePayload,
  engineStateToInput,
  loadSettings,
  rowToEngineState,
  toEngineSettings,
  type StatePayload,
} from "./timer-state";

export interface WalRecord {
  id: string;
  at: number;
  action: Action;
}

export interface SyncResponse {
  /** false = duplicate batchId; nothing was written and the state returned
   *  is simply the current one. */
  applied: boolean;
  state: StatePayload;
}

/** Client clocks more than this far ahead of the server are clamped. */
export const MAX_FUTURE_SKEW_MS = 30_000;

/** Clamp policy for a record's client timestamp:
 *  - future beyond the skew allowance clamps to serverNow (a wrong client
 *    clock must not plant blocks in the future);
 *  - the past is accepted as-is — recovered WALs are legitimately old;
 *  - within a batch, time never rewinds (monotonic non-decreasing). */
export function clampAt(at: number, prevAt: number, serverNow: number): number {
  const capped = at > serverNow + MAX_FUTURE_SKEW_MS ? serverNow : at;
  return Math.max(capped, prevAt);
}

export interface ReplayResult {
  state: EngineTimerState;
  entries: EntryToInsert[];
  /** Labels of custom awayStarts that actually entered away mode, in order —
   *  fed to the recent-labels MRU after the write commits. */
  customAwayLabels: string[];
}

/** Pure replay of a batch: each record is applied AT ITS OWN client
 *  timestamp, running deriveNow before dispatch so a block that elapsed
 *  between records chimes exactly as it would have live (this is also what
 *  fixes the lazy-chime NOOP bug for replayed acknowledge/log). */
export function replayActions(
  state: EngineTimerState,
  settings: EngineSettings,
  records: WalRecord[],
  serverNow: number,
): ReplayResult {
  let current = state;
  const entries: EntryToInsert[] = [];
  const customAwayLabels: string[] = [];
  let prevAt = 0;

  for (const record of records) {
    const at = clampAt(record.at, prevAt, serverNow);
    prevAt = at;

    current = deriveNow(current, at).state;
    const before = current;
    const result = dispatch(current, settings, record.action, at);
    current = result.state;
    entries.push(...result.entriesToInsert);

    // Identity check: a NOOP dispatch returns the same object, so a custom
    // awayStart that was ignored (already away) must not touch the MRU.
    if (
      record.action.type === "awayStart" &&
      record.action.kind === "custom" &&
      current !== before &&
      current.mode === "away" &&
      current.awayLabel
    ) {
      customAwayLabels.push(current.awayLabel);
    }
  }

  return { state: current, entries, customAwayLabels };
}

function toEntryInputs(entryList: EntryToInsert[]): EntryInput[] {
  return entryList.map((entry) => ({
    from: new Date(entry.from),
    to: new Date(entry.to),
    tag: entry.tag,
    feel: entry.feel,
    intent: entry.intent,
    bullets: entry.bullets,
  }));
}

export async function postTimerSyncHandler(
  req: NextRequest,
  userId: string,
): Promise<NextResponse> {
  const body = await parseJsonBody(req, syncRequestSchema);

  const db = getDb();
  const now = Date.now();

  const [row, settings] = await Promise.all([
    getTimerState(db, userId),
    loadSettings(db, userId),
  ]);

  let state: EngineTimerState;
  if (row) {
    state = rowToEngineState(row);
  } else {
    state = initialState(now);
    await upsertTimerState(db, userId, engineStateToInput(state));
  }

  const respond = async (applied: boolean): Promise<NextResponse> => {
    let count: number | undefined;
    if (body.todayStart !== undefined && body.todayEnd !== undefined) {
      count = await countEntriesForDay(
        db,
        userId,
        new Date(body.todayStart),
        new Date(body.todayEnd),
      );
    }
    const response: SyncResponse = {
      applied,
      state: buildStatePayload(state, settings, now, userId, count),
    };
    return NextResponse.json(response);
  };

  // A retried batch (response lost, tab crashed mid-flush, keepalive beacon
  // raced a later retry) is detected by id and skipped — the client only
  // ever retries its single in-flight batch, so remembering one id is enough.
  if (row?.lastBatchId === body.batchId) {
    return respond(false);
  }

  const replay = replayActions(
    state,
    toEngineSettings(settings),
    body.actions,
    now,
  );

  const entryInputs = toEntryInputs(replay.entries);
  // Validate before the atomic write so a CapError (422) leaves lastBatchId
  // untouched and the batch clearly un-applied.
  await assertEntryCaps(db, userId, entryInputs);

  await applySyncWrite(
    db,
    userId,
    engineStateToInput(replay.state),
    body.batchId,
    entryInputs,
  );

  for (const label of replay.customAwayLabels) {
    await pushRecentAwayLabel(db, userId, label);
    settings.recentAwayLabels = [
      label,
      ...settings.recentAwayLabels.filter(
        (l) => l.toLowerCase() !== label.toLowerCase(),
      ),
    ].slice(0, 5);
  }

  state = replay.state;
  return respond(true);
}
