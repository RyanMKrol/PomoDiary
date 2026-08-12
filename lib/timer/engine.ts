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

/** The :00 that begins the hour containing t. */
export function floorHourBoundary(t: number): number {
  return t - (t % HOUR_MS);
}

/** Gaps at a bucket's start shorter than this stay silent — a couple of
 *  minutes dwelling at the recap is part of the hour's story, not a hole
 *  worth a bullet. */
export const GAP_BULLET_MIN_MS = 5 * 60_000;

/** Every entry is a wall-clock hour bucket, so a fresh block snaps its
 *  start back to the enclosing :00. The stretch between the boundary and
 *  the actual start is accounted inside the bucket with a bullet when it
 *  is long enough to matter (a wait-for-me hold, a long recap dwell). */
function bucketStart(now: number): { hourStart: number; gapBullets: string[] } {
  const hourStart = floorHourBoundary(now);
  const gapMs = now - hourStart;
  return {
    hourStart,
    // Seeded drafts end with an empty slot: the client's composer is
    // always the LAST draft slot, so seeds must arrive as committed rows
    // with a fresh slot after them.
    gapBullets:
      gapMs >= GAP_BULLET_MIN_MS
        ? [`(first ${Math.round(gapMs / 60_000)} min unaccounted)`, ""]
        : [],
  };
}

function runningRemainingSeconds(hourStart: number, now: number): number {
  return Math.max(0, Math.floor((blockEndFor(hourStart) - now) / 1000));
}

export function initialState(now: number): TimerState {
  return {
    mode: "running",
    hourStart: floorHourBoundary(now),
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
  seedBullets: string[] = [],
): TimerState {
  const { hourStart, gapBullets } = bucketStart(now);
  return {
    ...state,
    mode,
    hourStart,
    chimeFrom: null,
    chimeTo: null,
    awayKind: null,
    awaySince: null,
    awayLabel: null,
    draftBullets: seedBullets.length > 0 ? seedBullets : gapBullets,
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
      // The paused hold sits between blocks; resuming starts the hour
      // bucket that contains now, with the held stretch accounted as an
      // unaccounted-gap bullet when it is long enough to matter.
      const { hourStart, gapBullets } = bucketStart(now);
      return {
        state: {
          ...state,
          mode: "running",
          hourStart,
          draftBullets: gapBullets,
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
            ? [...keptDraft, `${cfg.bullet} (${awayMinutes} min)`, ""]
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
      // plus the away bullet. WHOLE aligned hours follow with just the away
      // bullet. The trailing partial hour is NOT its own entry: entries are
      // hour buckets, so it seeds the resumed hour's draft as an away
      // bullet with its duration instead (no more 8:00-8:01 slivers).
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
      const lastBoundary = floorHourBoundary(now);
      let from = interruptedBlockEnd;
      while (from < lastBoundary && blocks.length < MAX_AWAY_BLOCKS) {
        const to = Math.min(blockEndFor(from), lastBoundary);
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

      const trailingMs = now - lastBoundary;
      const seedBullets =
        trailingMs >= MIN_BLOCK_MS
          ? [`${cfg.bullet} (${Math.round(trailingMs / 60_000)} min)`, ""]
          : [];
      const nextState = resetForNextBlock(
        state,
        now,
        "running",
        state.phraseIdx,
        seedBullets,
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
