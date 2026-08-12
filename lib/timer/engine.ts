import { AWAY, awayConfig, inferTag } from "../domain";

export type Mode = "running" | "paused" | "chime" | "recap" | "away";

export type AwayKind = keyof typeof AWAY | "custom";

export interface Settings {
  pauseAfterLog: boolean;
}

export interface TimerState {
  mode: Mode;
  hourStart: number;
  chimeFrom: number | null;
  chimeTo: number | null;
  awayKind: AwayKind | null;
  awaySince: number | null;
  /** The user-typed label when awayKind is "custom"; null otherwise. */
  awayLabel: string | null;
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
  | { type: "resume" }
  | { type: "ringNow" }
  | { type: "acknowledge" }
  | { type: "log"; payload: LogPayload }
  | { type: "skip" }
  | { type: "awayStart"; kind: AwayKind; label?: string }
  | { type: "awayReturn" }
  | { type: "draftUpdate"; patch: DraftPatch };

export interface DispatchResult {
  state: TimerState;
  entriesToInsert: EntryToInsert[];
}

export const HOUR_MS = 3_600_000;
export const MIN_BLOCK_MS = 60_000;
export const MAX_AWAY_BLOCKS = 48;

const NOOP = (state: TimerState): DispatchResult => ({
  state,
  entriesToInsert: [],
});

/** The epoch-hour boundary strictly after t. Epoch hours coincide with local
 *  :00 in every whole-hour-offset timezone; half-hour zones (India, Nepal)
 *  would chime at local :30 — accepted, since computing local boundaries
 *  would need environment access and the engine must stay pure. */
export function nextHourBoundary(t: number): number {
  return (Math.floor(t / HOUR_MS) + 1) * HOUR_MS;
}

/** Where a block started at `start` ends: the next :00, rolling one hour
 *  forward when the block would be under a minute long (a block picked up
 *  at 11:59:30 runs to 13:00, not for 30 seconds). */
export function blockEndFor(start: number): number {
  const boundary = nextHourBoundary(start);
  return boundary - start < MIN_BLOCK_MS ? boundary + HOUR_MS : boundary;
}

function runningRemainingSeconds(hourStart: number, now: number): number {
  return Math.max(0, Math.floor((blockEndFor(hourStart) - now) / 1000));
}

export function initialState(now: number): TimerState {
  return {
    mode: "running",
    hourStart: now,
    chimeFrom: null,
    chimeTo: null,
    awayKind: null,
    awaySince: null,
    awayLabel: null,
    draftBullets: [],
    draftTag: null,
    draftFeel: null,
    draftIntent: null,
    phraseIdx: 0,
  };
}

export function deriveNow(
  state: TimerState,
  now: number,
): { state: TimerState; remainingSeconds: number } {
  if (state.mode === "running" && now >= blockEndFor(state.hourStart)) {
    return {
      state: {
        ...state,
        mode: "chime",
        chimeFrom: state.hourStart,
        chimeTo: blockEndFor(state.hourStart),
      },
      remainingSeconds: 0,
    };
  }

  if (state.mode === "running") {
    return {
      state,
      remainingSeconds: runningRemainingSeconds(state.hourStart, now),
    };
  }

  return { state, remainingSeconds: 0 };
}

function resetForNextBlock(
  state: TimerState,
  now: number,
  mode: "running" | "paused",
  phraseIdx: number,
): TimerState {
  return {
    ...state,
    mode,
    hourStart: now,
    chimeFrom: null,
    chimeTo: null,
    awayKind: null,
    awaySince: null,
    awayLabel: null,
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
    case "resume": {
      if (state.mode !== "paused") return NOOP(state);
      // The paused hold sits between blocks, so resuming starts a fresh
      // block from now to the next hour boundary — nothing to rebase.
      return {
        state: { ...state, mode: "running", hourStart: now },
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
      const nextState = resetForNextBlock(
        state,
        now,
        settings.pauseAfterLog ? "paused" : "running",
        (state.phraseIdx + 1) % 5,
      );
      return { state: nextState, entriesToInsert: [entry] };
    }

    case "skip": {
      if (state.mode !== "recap" && state.mode !== "chime") return NOOP(state);
      const nextState = resetForNextBlock(
        state,
        now,
        settings.pauseAfterLog ? "paused" : "running",
        (state.phraseIdx + 1) % 5,
      );
      return { state: nextState, entriesToInsert: [] };
    }

    case "awayStart": {
      if (state.mode !== "running" && state.mode !== "paused")
        return NOOP(state);
      const label = action.kind === "custom" ? (action.label ?? "").trim() : "";
      // A custom away with no label has nothing to tag its hours with —
      // belt under the zod strap, which already rejects it.
      if (action.kind === "custom" && label === "") return NOOP(state);
      return {
        state: {
          ...state,
          mode: "away",
          awayKind: action.kind,
          awaySince: now,
          awayLabel: action.kind === "custom" ? label : null,
        },
        entriesToInsert: [],
      };
    }

    case "awayReturn": {
      if (state.mode !== "away" || state.awayKind === null) return NOOP(state);
      const cfg = awayConfig(state.awayKind, state.awayLabel);
      const since = state.awaySince ?? now;
      const interruptedBlockEnd = blockEndFor(state.hourStart);
      const keptDraft = state.draftBullets.filter((b) => b.trim() !== "");

      // The away interrupted an hour with a story in progress — the draft
      // bullets must never be lost to it.
      if (now < interruptedBlockEnd) {
        // Back within the same block: no entry yet. Resume the SAME hour
        // with its drafts intact, folding the absence in as a bullet (a
        // sub-minute blip adds nothing). The hour is logged as one story
        // when it chimes at :00.
        const awayMinutes = Math.round((now - since) / 60000);
        const draftBullets =
          now - since >= MIN_BLOCK_MS
            ? [...keptDraft, `${cfg.bullet} (${awayMinutes} min)`]
            : state.draftBullets;
        return {
          state: {
            ...state,
            mode: "running",
            awayKind: null,
            awaySince: null,
            awayLabel: null,
            draftBullets,
          },
          entriesToInsert: [],
        };
      }

      // The away crossed the interrupted block's end, so that hour is over:
      // auto-push it spanning the WHOLE block, carrying the pre-away drafts
      // plus the away bullet. Whole aligned hours follow with just the away
      // bullet; the final block ends at the return time (a trailing sliver
      // under a minute is dropped, matching the running-block floor).
      const blocks: EntryToInsert[] = [
        {
          from: state.hourStart,
          to: interruptedBlockEnd,
          tag: cfg.tag,
          feel: "—",
          intent: "yes",
          bullets: [...keptDraft, cfg.bullet],
        },
      ];
      let from = interruptedBlockEnd;
      while (now - from >= MIN_BLOCK_MS && blocks.length < MAX_AWAY_BLOCKS) {
        const to = Math.min(blockEndFor(from), now);
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

      const nextState = resetForNextBlock(
        state,
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
