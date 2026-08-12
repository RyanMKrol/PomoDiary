import { AWAY, inferTag } from "../domain";

export type Mode = "running" | "paused" | "chime" | "recap" | "away";

export type AwayKind = keyof typeof AWAY;

export interface Settings {
  sessionMinutes: number;
  pauseAfterLog: boolean;
}

export interface TimerState {
  mode: Mode;
  hourStart: number;
  pausedRemaining: number | null;
  chimeFrom: number | null;
  chimeTo: number | null;
  awayKind: AwayKind | null;
  awaySince: number | null;
  draftBullets: string[];
  draftTag: string | null;
  draftFeel: string | null;
  draftIntent: string | null;
  phraseIdx: number;
}

export interface DraftPatch {
  bullets?: string[];
  tag?: string | null;
  feel?: string | null;
  intent?: string | null;
}

export interface LogPayload {
  bullets: string[];
  tag: string | null;
  feel: string | null;
  intent: string | null;
}

export interface EntryToInsert {
  from: number;
  to: number;
  tag: string;
  feel: string;
  intent: string | null;
  bullets: string[];
}

export type Action =
  | { type: "pause" }
  | { type: "resume" }
  | { type: "ringNow" }
  | { type: "acknowledge" }
  | { type: "log"; payload: LogPayload }
  | { type: "skip" }
  | { type: "awayStart"; kind: AwayKind }
  | { type: "awayReturn" }
  | { type: "draftUpdate"; patch: DraftPatch };

export interface DispatchResult {
  state: TimerState;
  entriesToInsert: EntryToInsert[];
}

const NOOP = (state: TimerState): DispatchResult => ({
  state,
  entriesToInsert: [],
});

function sessionMs(settings: Settings): number {
  return settings.sessionMinutes * 60 * 1000;
}

function runningRemainingSeconds(
  hourStart: number,
  ms: number,
  now: number,
): number {
  return Math.max(0, Math.floor((ms - (now - hourStart)) / 1000));
}

export function initialState(now: number): TimerState {
  return {
    mode: "running",
    hourStart: now,
    pausedRemaining: null,
    chimeFrom: null,
    chimeTo: null,
    awayKind: null,
    awaySince: null,
    draftBullets: [],
    draftTag: null,
    draftFeel: null,
    draftIntent: null,
    phraseIdx: 0,
  };
}

export function deriveNow(
  state: TimerState,
  settings: Settings,
  now: number,
): { state: TimerState; remainingSeconds: number } {
  const ms = sessionMs(settings);

  if (state.mode === "running" && now >= state.hourStart + ms) {
    return {
      state: {
        ...state,
        mode: "chime",
        chimeFrom: state.hourStart,
        chimeTo: state.hourStart + ms,
      },
      remainingSeconds: 0,
    };
  }

  if (state.mode === "running") {
    return {
      state,
      remainingSeconds: runningRemainingSeconds(state.hourStart, ms, now),
    };
  }

  if (state.mode === "paused") {
    return { state, remainingSeconds: state.pausedRemaining ?? 0 };
  }

  return { state, remainingSeconds: 0 };
}

function resetForNextHour(
  state: TimerState,
  settings: Settings,
  now: number,
  mode: "running" | "paused",
  phraseIdx: number,
): TimerState {
  return {
    ...state,
    mode,
    hourStart: now,
    pausedRemaining:
      mode === "paused" ? Math.round(sessionMs(settings) / 1000) : null,
    chimeFrom: null,
    chimeTo: null,
    awayKind: null,
    awaySince: null,
    draftBullets: [],
    draftTag: null,
    draftFeel: null,
    draftIntent: null,
    phraseIdx,
  };
}

function buildEntry(
  state: TimerState,
  payload: LogPayload,
  now: number,
): EntryToInsert {
  const trimmed = payload.bullets.map((b) => b.trim()).filter(Boolean);
  const bullets = trimmed.length ? trimmed : ["(nothing written down)"];
  const tag = payload.tag || inferTag(payload.bullets) || "Unfiled";
  const feel = payload.feel || "—";

  return {
    from: state.chimeFrom ?? state.hourStart,
    to: state.chimeTo ?? now,
    tag,
    feel,
    intent: payload.intent ?? null,
    bullets,
  };
}

export function dispatch(
  state: TimerState,
  settings: Settings,
  action: Action,
  now: number,
): DispatchResult {
  switch (action.type) {
    case "pause": {
      if (state.mode !== "running") return NOOP(state);
      const remaining = runningRemainingSeconds(
        state.hourStart,
        sessionMs(settings),
        now,
      );
      return {
        state: { ...state, mode: "paused", pausedRemaining: remaining },
        entriesToInsert: [],
      };
    }

    case "resume": {
      if (state.mode !== "paused") return NOOP(state);
      const ms = sessionMs(settings);
      const remaining = state.pausedRemaining ?? 0;
      const hourStart = now - (ms - remaining * 1000);
      return {
        state: {
          ...state,
          mode: "running",
          hourStart,
          pausedRemaining: null,
        },
        entriesToInsert: [],
      };
    }

    case "ringNow": {
      if (state.mode !== "running" && state.mode !== "paused")
        return NOOP(state);
      return {
        state: {
          ...state,
          mode: "chime",
          chimeFrom: state.hourStart,
          chimeTo: now,
        },
        entriesToInsert: [],
      };
    }

    case "acknowledge": {
      if (state.mode !== "chime") return NOOP(state);
      return { state: { ...state, mode: "recap" }, entriesToInsert: [] };
    }

    case "log": {
      if (state.mode !== "recap" && state.mode !== "chime") return NOOP(state);
      const entry = buildEntry(state, action.payload, now);
      const nextState = resetForNextHour(
        state,
        settings,
        now,
        settings.pauseAfterLog ? "paused" : "running",
        (state.phraseIdx + 1) % 5,
      );
      return { state: nextState, entriesToInsert: [entry] };
    }

    case "skip": {
      if (state.mode !== "recap" && state.mode !== "chime") return NOOP(state);
      const nextState = resetForNextHour(
        state,
        settings,
        now,
        settings.pauseAfterLog ? "paused" : "running",
        (state.phraseIdx + 1) % 5,
      );
      return { state: nextState, entriesToInsert: [] };
    }

    case "awayStart": {
      if (state.mode !== "running" && state.mode !== "paused")
        return NOOP(state);
      return {
        state: {
          ...state,
          mode: "away",
          awayKind: action.kind,
          awaySince: now,
        },
        entriesToInsert: [],
      };
    }

    case "awayReturn": {
      if (state.mode !== "away" || state.awayKind === null) return NOOP(state);
      const cfg = AWAY[state.awayKind];
      const hourMs = 3600000;
      const blocks: EntryToInsert[] = [];
      let from = state.awaySince ?? now;

      while (now - from > 60000 && blocks.length < 24) {
        const to = Math.min(from + hourMs, now);
        blocks.push({
          from,
          to,
          tag: cfg.tag,
          feel: "—",
          intent: "yes",
          bullets: [cfg.bullet],
        });
        from = to;
      }
      blocks.reverse();

      const nextState = resetForNextHour(
        state,
        settings,
        now,
        "running",
        state.phraseIdx,
      );
      return { state: nextState, entriesToInsert: blocks };
    }

    case "draftUpdate": {
      if (state.mode === "away") return NOOP(state);
      return {
        state: {
          ...state,
          draftBullets:
            action.patch.bullets !== undefined
              ? action.patch.bullets
              : state.draftBullets,
          draftTag:
            action.patch.tag !== undefined ? action.patch.tag : state.draftTag,
          draftFeel:
            action.patch.feel !== undefined
              ? action.patch.feel
              : state.draftFeel,
          draftIntent:
            action.patch.intent !== undefined
              ? action.patch.intent
              : state.draftIntent,
        },
        entriesToInsert: [],
      };
    }

    default:
      return NOOP(state);
  }
}
