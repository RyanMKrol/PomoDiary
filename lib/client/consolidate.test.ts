import { describe, expect, it } from "vitest";

import {
  deriveNow,
  dispatch,
  initialState,
  type Action,
  type AwayKind,
  type DraftPatch,
  type EntryToInsert,
  type LogPayload,
  type Settings,
  type TimerState,
} from "../timer/engine";
import { consolidate } from "./consolidate";
import type { WalRecord } from "./wal";

const HOUR = 3600000;
// An exact epoch-hour boundary so blocks start clean.
const T0 = 472222 * HOUR;

let seq = 0;

function rec(action: Action, at?: number): WalRecord {
  seq += 1;
  return { id: `id-${seq}`, at: at ?? T0 + seq * 1000, action };
}

const LOG_PAYLOAD: LogPayload = {
  bullets: ["wrote tests"],
  tag: "Deep work",
  feel: "good",
  intent: "yes",
};

describe("consolidate", () => {
  it("merges consecutive draftUpdates left-to-right, keeping the last id/at", () => {
    const a = rec({ type: "draftUpdate", patch: { tag: "A", feel: "meh" } });
    const b = rec({ type: "draftUpdate", patch: { tag: "B" } });
    const c = rec({ type: "draftUpdate", patch: { bullets: ["x"] } });

    const out = consolidate([a, b, c]);

    expect(out).toEqual([
      {
        id: c.id,
        at: c.at,
        action: {
          type: "draftUpdate",
          patch: { tag: "B", feel: "meh", bullets: ["x"] },
        },
      },
    ]);
  });

  it("does not merge draftUpdate runs separated by another action", () => {
    const a = rec({ type: "draftUpdate", patch: { tag: "A" } });
    const ring = rec({ type: "ringNow" });
    const b = rec({ type: "draftUpdate", patch: { tag: "B" } });

    const out = consolidate([a, ring, b]);
    expect(out).toEqual([a, ring, b]);
  });

  it("drops a draftUpdate followed later by a log", () => {
    const draft = rec({ type: "draftUpdate", patch: { tag: "A" } });
    const ring = rec({ type: "ringNow" });
    const log = rec({ type: "log", payload: LOG_PAYLOAD });

    expect(consolidate([draft, ring, log])).toEqual([ring, log]);
  });

  it("drops a draftUpdate followed later by a skip", () => {
    const draft = rec({ type: "draftUpdate", patch: { tag: "A" } });
    const skip = rec({ type: "skip" });

    expect(consolidate([draft, skip])).toEqual([skip]);
  });

  it("KEEPS a draftUpdate followed by an awayReturn — the return folds drafts into the pushed hour", () => {
    const draft = rec({ type: "draftUpdate", patch: { bullets: ["kept"] } });
    const away = rec({ type: "awayStart", kind: "work" });
    const back = rec({ type: "awayReturn" });

    expect(consolidate([draft, away, back])).toEqual([draft, away, back]);
  });

  it("keeps a draftUpdate followed only by a bare awayStart", () => {
    const draft = rec({ type: "draftUpdate", patch: { tag: "A" } });
    const away = rec({ type: "awayStart", kind: "sleep" });

    expect(consolidate([draft, away])).toEqual([draft, away]);
  });

  it("keeps draftUpdates after the last resetting action", () => {
    const skip = rec({ type: "skip" });
    const draft = rec({ type: "draftUpdate", patch: { tag: "After" } });

    expect(consolidate([skip, draft])).toEqual([skip, draft]);
  });

  it("never reorders, merges, or drops non-draftUpdate actions", () => {
    const actions: WalRecord[] = [
      rec({ type: "ringNow" }),
      rec({ type: "acknowledge" }),
      rec({ type: "log", payload: LOG_PAYLOAD }),
      rec({ type: "resume" }),
      rec({ type: "awayStart", kind: "custom", label: "Errands" }),
      rec({ type: "awayReturn" }),
      rec({ type: "skip" }),
    ];

    expect(consolidate(actions)).toEqual(actions);
  });

  it("returns an empty list unchanged", () => {
    expect(consolidate([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The load-bearing property: replaying consolidate(records) through the real
// engine yields the IDENTICAL final state and entriesToInsert as replaying
// the original records.
// ---------------------------------------------------------------------------

/** mulberry32 — tiny seeded PRNG so failures reproduce. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function randomPatch(rng: () => number): DraftPatch {
  const patch: DraftPatch = {};
  if (rng() < 0.6) {
    patch.bullets = Array.from({ length: Math.floor(rng() * 3) }, (_, i) => {
      return `bullet ${i} ${Math.floor(rng() * 100)}`;
    });
  }
  if (rng() < 0.4) patch.tag = pick(rng, ["Deep work", "Chores", null]);
  if (rng() < 0.4) patch.feel = pick(rng, ["good", "meh", null]);
  if (rng() < 0.3) patch.intent = pick(rng, ["yes", "no", null]);
  return patch;
}

function randomLogPayload(rng: () => number): LogPayload {
  return {
    bullets: rng() < 0.8 ? [`did thing ${Math.floor(rng() * 100)}`] : [],
    tag: rng() < 0.7 ? pick(rng, ["Deep work", "Chores", "Email"]) : null,
    feel: rng() < 0.7 ? pick(rng, ["good", "meh"]) : null,
    intent: rng() < 0.5 ? pick(rng, ["yes", "no"]) : null,
  };
}

/** An action the local engine would actually accept in this mode — the WAL
 *  only ever contains actions the client dispatched locally. draftUpdate is
 *  weighted heavily: that is what consolidation exists to shrink. */
function plausibleAction(rng: () => number, state: TimerState): Action {
  const draft = (): Action => ({
    type: "draftUpdate",
    patch: randomPatch(rng),
  });
  const awayStart = (): Action => {
    const kind = pick<AwayKind>(rng, ["sleep", "work", "gym", "custom"]);
    return kind === "custom"
      ? { type: "awayStart", kind, label: "Errands" }
      : { type: "awayStart", kind };
  };

  switch (state.mode) {
    case "running":
      return pick<() => Action>(rng, [
        draft,
        draft,
        draft,
        () => ({ type: "ringNow" }),
        awayStart,
      ])();
    case "paused":
      return pick<() => Action>(rng, [
        draft,
        () => ({ type: "resume" }),
        () => ({ type: "ringNow" }),
        awayStart,
      ])();
    case "chime":
      return pick<() => Action>(rng, [
        draft,
        draft,
        () => ({ type: "acknowledge" }),
        () => ({ type: "log", payload: randomLogPayload(rng) }),
        () => ({ type: "skip" }),
      ])();
    case "recap":
      return pick<() => Action>(rng, [
        draft,
        draft,
        draft,
        () => ({ type: "log", payload: randomLogPayload(rng) }),
        () => ({ type: "skip" }),
      ])();
    case "away":
      return { type: "awayReturn" };
  }
}

function replay(
  initial: TimerState,
  settings: Settings,
  records: WalRecord[],
): { state: TimerState; entries: EntryToInsert[] } {
  let state = initial;
  const entries: EntryToInsert[] = [];
  for (const record of records) {
    state = deriveNow(state, record.at).state;
    const result = dispatch(state, settings, record.action, record.at);
    state = result.state;
    entries.push(...result.entriesToInsert);
  }
  return { state, entries };
}

describe("consolidate — replay equivalence property", () => {
  it("consolidated replay matches the original replay for ~200 random sequences", () => {
    for (let run = 0; run < 200; run++) {
      const rng = makeRng(run + 1);
      const settings: Settings = { pauseAfterLog: rng() < 0.5 };
      // Random-but-valid start: a fresh running block at a random instant.
      const start = T0 + Math.floor(rng() * 24 * HOUR);
      const initial = initialState(start);

      const records: WalRecord[] = [];
      let simState = initial;
      let t = start;
      const count = 5 + Math.floor(rng() * 40);
      for (let i = 0; i < count; i++) {
        t += 1000 + Math.floor(rng() * 2 * HOUR);
        simState = deriveNow(simState, t).state;
        const action = plausibleAction(rng, simState);
        records.push({ id: `r${run}-${i}`, at: t, action });
        simState = dispatch(simState, settings, action, t).state;
      }

      const consolidated = consolidate(records);
      const original = replay(initial, settings, records);
      const shrunk = replay(initial, settings, consolidated);

      expect(consolidated.length).toBeLessThanOrEqual(records.length);
      expect(shrunk.state, `seed ${run + 1}: final state diverged`).toEqual(
        original.state,
      );
      expect(shrunk.entries, `seed ${run + 1}: entries diverged`).toEqual(
        original.entries,
      );
    }
  });
});
