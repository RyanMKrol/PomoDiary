import {
  deriveNow,
  initialState,
  type AwayKind,
  type Mode,
  type Settings as EngineSettings,
  type TimerState as EngineTimerState,
} from "../timer/engine";
import type {
  Db,
  TimerState as TimerStateRow,
  TimerStateInput,
} from "../db/timer-state.store";
import {
  getSettings,
  getTimerState,
  upsertTimerState,
} from "../db/timer-state.store";

export interface ApiSettings {
  sessionMinutes: number;
  soundOn: boolean;
  chimeVolume: number;
  pauseAfterLog: boolean;
}

export interface StatePayload {
  mode: Mode;
  remainingSeconds: number;
  chimeFrom: number | null;
  chimeTo: number | null;
  /** Which away kind is active and since when — REQUIRED for an away state to
   *  survive a reload; without them the client can't render the away card. */
  awayKind: AwayKind | null;
  awaySince: number | null;
  draftBullets: string[];
  draftTag: string | null;
  draftFeel: string | null;
  draftIntent: string | null;
  phraseIdx: number;
  settings: ApiSettings;
  count?: number;
}

function rowToEngineState(row: TimerStateRow): EngineTimerState {
  return {
    mode: row.mode as Mode,
    hourStart: row.hourStart.getTime(),
    pausedRemaining: row.pausedRemaining,
    chimeFrom: row.chimeFrom ? row.chimeFrom.getTime() : null,
    chimeTo: row.chimeTo ? row.chimeTo.getTime() : null,
    awayKind: row.awayKind as AwayKind | null,
    awaySince: row.awaySince ? row.awaySince.getTime() : null,
    draftBullets: row.draftBullets,
    draftTag: row.draftTag,
    draftFeel: row.draftFeel,
    draftIntent: row.draftIntent,
    phraseIdx: row.phraseIdx,
  };
}

export function engineStateToInput(state: EngineTimerState): TimerStateInput {
  return {
    mode: state.mode,
    hourStart: new Date(state.hourStart),
    pausedRemaining: state.pausedRemaining,
    chimeFrom: state.chimeFrom !== null ? new Date(state.chimeFrom) : null,
    chimeTo: state.chimeTo !== null ? new Date(state.chimeTo) : null,
    awayKind: state.awayKind,
    awaySince: state.awaySince !== null ? new Date(state.awaySince) : null,
    draftBullets: state.draftBullets,
    draftTag: state.draftTag,
    draftFeel: state.draftFeel,
    draftIntent: state.draftIntent,
    phraseIdx: state.phraseIdx,
  };
}

export async function loadOrCreateState(
  db: Db,
  userId: string,
  now: number,
): Promise<EngineTimerState> {
  const row = await getTimerState(db, userId);
  if (row) return rowToEngineState(row);

  const state = initialState(now);
  await upsertTimerState(db, userId, engineStateToInput(state));
  return state;
}

export async function loadSettings(
  db: Db,
  userId: string,
): Promise<ApiSettings> {
  const result = await getSettings(db, userId);
  return {
    sessionMinutes: result.sessionMinutes ?? 60,
    soundOn: result.soundOn ?? true,
    chimeVolume: result.chimeVolume ?? 0.8,
    pauseAfterLog: result.pauseAfterLog ?? false,
  };
}

export function toEngineSettings(settings: ApiSettings): EngineSettings {
  return {
    sessionMinutes: settings.sessionMinutes,
    pauseAfterLog: settings.pauseAfterLog,
  };
}

export function buildStatePayload(
  state: EngineTimerState,
  settings: ApiSettings,
  now: number,
  count?: number,
): StatePayload {
  const derived = deriveNow(state, toEngineSettings(settings), now);

  return {
    mode: derived.state.mode,
    remainingSeconds: derived.remainingSeconds,
    chimeFrom: derived.state.chimeFrom,
    chimeTo: derived.state.chimeTo,
    awayKind: derived.state.awayKind,
    awaySince: derived.state.awaySince,
    draftBullets: derived.state.draftBullets,
    draftTag: derived.state.draftTag,
    draftFeel: derived.state.draftFeel,
    draftIntent: derived.state.draftIntent,
    phraseIdx: derived.state.phraseIdx,
    settings,
    ...(count !== undefined ? { count } : {}),
  };
}
