import { describe, expect, it } from "vitest";

import {
  blockEndFor,
  deriveNow,
  floorHourBoundary,
  dispatch,
  initialState,
  nextHourBoundary,
  HOUR_MS,
  MAX_AWAY_BLOCKS,
  MIN_BLOCK_MS,
  type Settings,
  type TimerState,
} from "./engine";

const HOUR = 3600000;
const SETTINGS: Settings = { pauseAfterLog: false };
const SETTINGS_PAUSE_AFTER_LOG: Settings = { pauseAfterLog: true };

// Deliberately NOT hour-aligned: 13m20s past the hour, so tests exercise the
// ragged-block math. T0_BOUNDARY is the wall-clock :00 that follows it.
const T0 = 1_700_000_000_000;
const T0_BOUNDARY = 1_700_002_800_000;
// An exactly-aligned instant for tests that want whole-hour blocks.
const T0H = 1_699_999_200_000;

function running(overrides: Partial<TimerState> = {}): TimerState {
  return { ...initialState(T0), ...overrides };
}

describe("boundary helpers", () => {
  it("T0 fixtures are what they claim to be", () => {
    expect(T0H % HOUR_MS).toBe(0);
    expect(T0 % HOUR_MS).toBe(800_000);
    expect(nextHourBoundary(T0)).toBe(T0_BOUNDARY);
  });

  it("nextHourBoundary is strictly after t, even on an exact boundary", () => {
    expect(nextHourBoundary(T0H)).toBe(T0H + HOUR);
    expect(nextHourBoundary(T0H + 1)).toBe(T0H + HOUR);
    expect(nextHourBoundary(T0H + HOUR - 1)).toBe(T0H + HOUR);
  });

  it("blockEndFor ends a block on the next :00", () => {
    expect(blockEndFor(T0H)).toBe(T0H + HOUR);
    expect(blockEndFor(T0)).toBe(T0_BOUNDARY);
  });

  it("blockEndFor rolls forward when the block would be under a minute", () => {
    const justBefore = T0H + HOUR - MIN_BLOCK_MS + 1;
    expect(blockEndFor(justBefore)).toBe(T0H + 2 * HOUR);
    // Exactly one minute before the boundary still ends on it.
    expect(blockEndFor(T0H + HOUR - MIN_BLOCK_MS)).toBe(T0H + HOUR);
  });
});

describe("initialState", () => {
  it("starts a first-time user in the hour bucket containing now", () => {
    const s = initialState(T0);
    expect(s.mode).toBe("running");
    // Buckets: the block snaps back to the enclosing :00.
    expect(s.hourStart).toBe(floorHourBoundary(T0));
    expect(s.chimeFrom).toBeNull();
    expect(s.chimeTo).toBeNull();
    expect(s.awayKind).toBeNull();
    expect(s.awaySince).toBeNull();
    expect(s.awayLabel).toBeNull();
    expect(s.draftBullets).toEqual([]);
    expect(s.draftTag).toBeNull();
    expect(s.draftFeel).toBeNull();
    expect(s.draftIntent).toBeNull();
    expect(s.phraseIdx).toBe(0);
  });
});

describe("deriveNow", () => {
  it("counts down to the next :00, not to sixty minutes from the start", () => {
    const s = running({ hourStart: T0 });
    const { state, remainingSeconds } = deriveNow(s, T0 + 10 * 60 * 1000);
    expect(state.mode).toBe("running");
    // The block T0 -> T0_BOUNDARY is 46m40s long; 10min in, 36m40s remain.
    expect(remainingSeconds).toBe(36 * 60 + 40);
  });

  it("gives a full hour to a block that starts exactly on a boundary", () => {
    const s = running({ hourStart: T0H });
    const { remainingSeconds } = deriveNow(s, T0H);
    expect(remainingSeconds).toBe(3600);
  });

  it("derives chime from a running state whose block has elapsed (closed laptop)", () => {
    const s = running({ hourStart: T0 });
    const threeHoursLater = T0 + 3 * HOUR;
    const { state, remainingSeconds } = deriveNow(s, threeHoursLater);
    expect(state.mode).toBe("chime");
    // The chime keeps the ORIGINAL block span, ending on its :00.
    expect(state.chimeFrom).toBe(T0);
    expect(state.chimeTo).toBe(T0_BOUNDARY);
    expect(remainingSeconds).toBe(0);
  });

  it("returns zero remaining while paused", () => {
    const s = running({ mode: "paused" });
    const { remainingSeconds } = deriveNow(s, T0 + HOUR * 5);
    expect(remainingSeconds).toBe(0);
  });

  it("does not lazily chime a state that is already paused", () => {
    const s = running({ mode: "paused" });
    const { state } = deriveNow(s, T0 + 10 * HOUR);
    expect(state.mode).toBe("paused");
  });
});

describe("resume", () => {
  it("resumes into the hour bucket containing now, accounting the held gap", () => {
    const s = running({ mode: "paused" });
    const resumeAt = T0 + 5 * HOUR; // 13m20s past the hour
    const { state, entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "resume" },
      resumeAt,
    );
    expect(state.mode).toBe("running");
    expect(state.hourStart).toBe(floorHourBoundary(resumeAt));
    // The 13-minute held stretch is accounted inside the bucket.
    expect(state.draftBullets).toEqual(["(first 13 min unaccounted)"]);
    expect(entriesToInsert).toEqual([]);

    const { remainingSeconds } = deriveNow(state, resumeAt);
    expect(remainingSeconds).toBe(
      Math.floor((blockEndFor(state.hourStart) - resumeAt) / 1000),
    );
  });

  it("resuming just past the hour seeds no gap bullet", () => {
    const s = running({ mode: "paused" });
    const resumeAt = T0H + 2 * 60_000; // 2 min past a boundary
    const { state } = dispatch(s, SETTINGS, { type: "resume" }, resumeAt);
    expect(state.hourStart).toBe(T0H);
    expect(state.draftBullets).toEqual([]);
  });

  it("is a no-op outside paused", () => {
    for (const mode of ["running", "chime", "recap", "away"] as const) {
      const s = running({ mode });
      const { state } = dispatch(s, SETTINGS, { type: "resume" }, T0 + 1000);
      expect(state).toBe(s);
    }
  });
});

describe("ringNow", () => {
  it("chimes immediately using hourStart..now as the span", () => {
    const s = running({ hourStart: T0 });
    const now = T0 + 12 * 60 * 1000;
    const { state, entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "ringNow" },
      now,
    );
    expect(state.mode).toBe("chime");
    expect(state.chimeFrom).toBe(T0);
    expect(state.chimeTo).toBe(now);
    expect(entriesToInsert).toEqual([]);
  });

  it("works from paused", () => {
    const s = running({ mode: "paused", hourStart: T0 });
    const { state } = dispatch(s, SETTINGS, { type: "ringNow" }, T0 + 5000);
    expect(state.mode).toBe("chime");
  });

  it("is a no-op in chime/recap/away", () => {
    for (const mode of ["chime", "recap", "away"] as const) {
      const s = running({ mode });
      const { state } = dispatch(s, SETTINGS, { type: "ringNow" }, T0 + 1000);
      expect(state).toBe(s);
    }
  });
});

describe("acknowledge", () => {
  it("moves chime to recap", () => {
    const s = running({ mode: "chime", chimeFrom: T0, chimeTo: T0 + HOUR });
    const { state, entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "acknowledge" },
      T0 + HOUR + 1000,
    );
    expect(state.mode).toBe("recap");
    expect(entriesToInsert).toEqual([]);
  });

  it("is a no-op outside chime", () => {
    for (const mode of ["running", "paused", "recap", "away"] as const) {
      const s = running({ mode });
      const { state } = dispatch(
        s,
        SETTINGS,
        { type: "acknowledge" },
        T0 + 1000,
      );
      expect(state).toBe(s);
    }
  });
});

describe("log", () => {
  const chimeState = () =>
    running({
      mode: "recap",
      hourStart: T0,
      chimeFrom: T0,
      chimeTo: T0 + HOUR,
      phraseIdx: 3,
    });

  it("trims bullets, drops empties, and uses the chime span", () => {
    const s = chimeState();
    const now = T0 + HOUR + 5000;
    const { state, entriesToInsert } = dispatch(
      s,
      SETTINGS,
      {
        type: "log",
        payload: {
          bullets: ["  wrote some code  ", "  ", "shipped it "],
          tag: "Deep work",
          feel: "Charged",
          intent: "yes",
        },
      },
      now,
    );
    expect(entriesToInsert).toHaveLength(1);
    expect(entriesToInsert[0]).toEqual({
      from: T0,
      to: T0 + HOUR,
      tag: "Deep work",
      feel: "Charged",
      intent: "yes",
      bullets: ["wrote some code", "shipped it"],
    });
    expect(state.mode).toBe("running");
    // The next block is the bucket containing now, and the late-recap
    // stretch is accounted (now is 13m25s past the hour, over the 5 min
    // silence threshold).
    expect(state.hourStart).toBe(floorHourBoundary(now));
    expect(state.chimeFrom).toBeNull();
    expect(state.chimeTo).toBeNull();
    expect(state.draftBullets).toEqual(["(first 13 min unaccounted)"]);
    expect(state.phraseIdx).toBe(4);
  });

  it("falls back to inferred tag from raw untrimmed bullets when no tag chosen", () => {
    const s = chimeState();
    const { entriesToInsert } = dispatch(
      s,
      SETTINGS,
      {
        type: "log",
        payload: {
          bullets: ["  did the laundry and cooked dinner  "],
          tag: null,
          feel: "Charged",
          intent: "yes",
        },
      },
      T0 + HOUR + 1000,
    );
    expect(entriesToInsert[0].tag).toBe("Chores");
  });

  it("falls back to Unfiled when tag is empty and nothing can be inferred", () => {
    const s = chimeState();
    const { entriesToInsert } = dispatch(
      s,
      SETTINGS,
      {
        type: "log",
        payload: { bullets: ["  "], tag: null, feel: "Charged", intent: "yes" },
      },
      T0 + HOUR + 1000,
    );
    expect(entriesToInsert[0].tag).toBe("Unfiled");
  });

  it("falls back to an em dash for feel", () => {
    const s = chimeState();
    const { entriesToInsert } = dispatch(
      s,
      SETTINGS,
      {
        type: "log",
        payload: {
          bullets: ["thing"],
          tag: "Admin",
          feel: null,
          intent: "yes",
        },
      },
      T0 + HOUR + 1000,
    );
    expect(entriesToInsert[0].feel).toBe("—");
  });

  it("stores null intent when never picked", () => {
    const s = chimeState();
    const { entriesToInsert } = dispatch(
      s,
      SETTINGS,
      {
        type: "log",
        payload: {
          bullets: ["thing"],
          tag: "Admin",
          feel: "Steady",
          intent: null,
        },
      },
      T0 + HOUR + 1000,
    );
    expect(entriesToInsert[0].intent).toBeNull();
  });

  it('becomes ["(nothing written down)"] when all bullets are empty', () => {
    const s = chimeState();
    const { entriesToInsert } = dispatch(
      s,
      SETTINGS,
      {
        type: "log",
        payload: {
          bullets: ["", "   "],
          tag: "Admin",
          feel: "Steady",
          intent: null,
        },
      },
      T0 + HOUR + 1000,
    );
    expect(entriesToInsert[0].bullets).toEqual(["(nothing written down)"]);
  });

  it("uses hourStart when chimeFrom is null and now when chimeTo is null", () => {
    const s = running({
      mode: "chime",
      hourStart: T0,
      chimeFrom: null,
      chimeTo: null,
    });
    const now = T0 + 45 * 60 * 1000;
    const { entriesToInsert } = dispatch(
      s,
      SETTINGS,
      {
        type: "log",
        payload: {
          bullets: ["thing"],
          tag: "Admin",
          feel: "Steady",
          intent: null,
        },
      },
      now,
    );
    expect(entriesToInsert[0].from).toBe(T0);
    expect(entriesToInsert[0].to).toBe(now);
  });

  it("goes to paused (not running) when settings.pauseAfterLog is set", () => {
    const s = chimeState();
    const now = T0 + HOUR + 1000;
    const { state } = dispatch(
      s,
      SETTINGS_PAUSE_AFTER_LOG,
      {
        type: "log",
        payload: {
          bullets: ["thing"],
          tag: "Admin",
          feel: "Steady",
          intent: null,
        },
      },
      now,
    );
    expect(state.mode).toBe("paused");
  });

  it("is a no-op outside recap/chime", () => {
    for (const mode of ["running", "paused", "away"] as const) {
      const s = running({ mode });
      const { state, entriesToInsert } = dispatch(
        s,
        SETTINGS,
        {
          type: "log",
          payload: { bullets: ["x"], tag: null, feel: null, intent: null },
        },
        T0 + 1000,
      );
      expect(state).toBe(s);
      expect(entriesToInsert).toEqual([]);
    }
  });
});

describe("skip", () => {
  it("resets the block with no entry, but still advances phraseIdx", () => {
    const s = running({
      mode: "recap",
      hourStart: T0,
      chimeFrom: T0,
      chimeTo: T0 + HOUR,
      phraseIdx: 4,
      draftBullets: ["stuff"],
    });
    const now = T0 + HOUR + 2000;
    const { state, entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "skip" },
      now,
    );
    expect(entriesToInsert).toEqual([]);
    expect(state.mode).toBe("running");
    expect(state.hourStart).toBe(floorHourBoundary(now));
    expect(state.chimeFrom).toBeNull();
    // Skipped at 13m22s past the hour: the dwell is accounted.
    expect(state.draftBullets).toEqual(["(first 13 min unaccounted)"]);
    expect(state.phraseIdx).toBe(0);
  });

  it("is a no-op outside recap/chime", () => {
    for (const mode of ["running", "paused", "away"] as const) {
      const s = running({ mode });
      const { state } = dispatch(s, SETTINGS, { type: "skip" }, T0 + 1000);
      expect(state).toBe(s);
    }
  });
});

describe("awayStart", () => {
  it("records awaySince and preserves drafts", () => {
    const s = running({
      mode: "running",
      draftBullets: ["half written"],
    });
    const now = T0 + 1000;
    const { state, entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "awayStart", kind: "sleep" },
      now,
    );
    expect(state.mode).toBe("away");
    expect(state.awayKind).toBe("sleep");
    expect(state.awaySince).toBe(now);
    expect(state.draftBullets).toEqual(["half written"]);
    expect(entriesToInsert).toEqual([]);
  });

  it("works from paused", () => {
    const s = running({ mode: "paused" });
    const { state } = dispatch(
      s,
      SETTINGS,
      { type: "awayStart", kind: "work" },
      T0 + 1000,
    );
    expect(state.mode).toBe("away");
  });

  it("stores the gym kind with no label", () => {
    const s = running();
    const now = T0 + 1000;
    const { state, entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "awayStart", kind: "gym" },
      now,
    );
    expect(state.mode).toBe("away");
    expect(state.awayKind).toBe("gym");
    expect(state.awaySince).toBe(now);
    expect(state.awayLabel).toBeNull();
    expect(entriesToInsert).toEqual([]);
  });

  it("stores the trimmed label for a custom away", () => {
    const s = running();
    const { state } = dispatch(
      s,
      SETTINGS,
      { type: "awayStart", kind: "custom", label: "  Travelling  " },
      T0 + 1000,
    );
    expect(state.mode).toBe("away");
    expect(state.awayKind).toBe("custom");
    expect(state.awayLabel).toBe("Travelling");
  });

  it("is a no-op for a custom away with an empty or whitespace label", () => {
    for (const label of [undefined, "", "   "]) {
      const s = running();
      const { state, entriesToInsert } = dispatch(
        s,
        SETTINGS,
        { type: "awayStart", kind: "custom", label },
        T0 + 1000,
      );
      expect(state).toBe(s);
      expect(entriesToInsert).toEqual([]);
    }
  });

  it("is a no-op in chime/recap/away", () => {
    for (const mode of ["chime", "recap", "away"] as const) {
      const s = running({ mode });
      const { state } = dispatch(
        s,
        SETTINGS,
        { type: "awayStart", kind: "sleep" },
        T0 + 1000,
      );
      expect(state).toBe(s);
    }
  });
});

describe("awayReturn", () => {
  function away(since: number, overrides = {}) {
    return running({
      mode: "away",
      awayKind: "sleep",
      awaySince: since,
      phraseIdx: 1,
      ...overrides,
    });
  }

  it("is a no-op outside away", () => {
    for (const mode of ["running", "paused", "chime", "recap"] as const) {
      const s = running({ mode });
      const { state } = dispatch(
        s,
        SETTINGS,
        { type: "awayReturn" },
        T0 + 1000,
      );
      expect(state).toBe(s);
    }
  });

  it("returning within the same block resumes the hour with drafts intact plus an away bullet", () => {
    // Block T0 -> T0_BOUNDARY. Away from T0+5min, back at T0+20min.
    const s = away(T0 + 5 * 60 * 1000, {
      hourStart: T0,
      draftBullets: ["wrote a bit"],
    });
    const now = T0 + 20 * 60 * 1000;
    const { state, entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "awayReturn" },
      now,
    );
    expect(entriesToInsert).toEqual([]);
    expect(state.mode).toBe("running");
    // The SAME hour continues — hourStart untouched.
    expect(state.hourStart).toBe(T0);
    expect(state.draftBullets).toEqual(["wrote a bit", "Asleep (15 min)"]);
    expect(state.awayKind).toBeNull();
    expect(state.awaySince).toBeNull();
  });

  it("a sub-minute blip within the block adds no bullet and keeps the draft verbatim", () => {
    const since = T0 + 5 * 60 * 1000;
    const s = away(since, { hourStart: T0, draftBullets: ["wrote a bit"] });
    const { state, entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "awayReturn" },
      since + 30 * 1000,
    );
    expect(entriesToInsert).toEqual([]);
    expect(state.mode).toBe("running");
    expect(state.hourStart).toBe(T0);
    expect(state.draftBullets).toEqual(["wrote a bit"]);
  });

  it("an away that crosses the hour's end auto-pushes the whole block with the pre-away drafts", () => {
    const s = away(T0 + 5 * 60 * 1000, {
      hourStart: T0,
      draftBullets: ["wrote a bit", "  "],
    });
    const now = T0 + 90 * 60 * 1000; // 43m20s past the boundary hour
    const { state, entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "awayReturn" },
      now,
    );
    // Only the interrupted hour is pushed: the trailing partial is NOT its
    // own sliver entry — it seeds the resumed bucket's draft instead.
    expect(entriesToInsert).toHaveLength(1);
    expect(entriesToInsert[0]).toEqual({
      from: T0,
      to: T0_BOUNDARY,
      tag: "Asleep",
      feel: "—",
      intent: "yes",
      bullets: ["wrote a bit", "Asleep"],
    });
    expect(state.hourStart).toBe(floorHourBoundary(now));
    expect(state.draftBullets).toEqual(["Asleep (43 min)"]);
  });

  it("whole away hours carry just the away bullet", () => {
    const s = away(T0H, { hourStart: T0H, draftBullets: [] });
    const now = T0H + 2 * HOUR;
    const { entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "awayReturn" },
      now,
    );
    expect(entriesToInsert).toHaveLength(2);
    expect(entriesToInsert[1]).toEqual({
      from: T0H,
      to: T0H + HOUR,
      tag: "Asleep",
      feel: "—",
      intent: "yes",
      bullets: ["Asleep"],
    });
    expect(entriesToInsert[0].from).toBe(T0H + HOUR);
    expect(entriesToInsert[0].to).toBe(T0H + 2 * HOUR);
  });

  it("drops a trailing sliver under a minute after the crossed hour", () => {
    const s = away(T0H, { hourStart: T0H, awayKind: "work" });
    const now = T0H + HOUR + 30 * 1000;
    const { entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "awayReturn" },
      now,
    );
    expect(entriesToInsert).toHaveLength(1);
    expect(entriesToInsert[0]).toEqual({
      from: T0H,
      to: T0H + HOUR,
      tag: "At work",
      feel: "—",
      intent: "yes",
      bullets: ["At work"],
    });
  });

  it("caps at MAX_AWAY_BLOCKS whole hours, oldest kept", () => {
    const s = away(T0H, { hourStart: T0H });
    const now = T0H + 50 * HOUR;
    const { entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "awayReturn" },
      now,
    );
    expect(entriesToInsert).toHaveLength(MAX_AWAY_BLOCKS);
    expect(entriesToInsert[MAX_AWAY_BLOCKS - 1].from).toBe(T0H);
    expect(entriesToInsert[MAX_AWAY_BLOCKS - 1].to).toBe(T0H + HOUR);
    expect(entriesToInsert[0].to).toBe(T0H + MAX_AWAY_BLOCKS * HOUR);
  });

  it("always returns to running (ignores pauseAfterLog) and does not advance phraseIdx", () => {
    const s = away(T0, { hourStart: T0 });
    const now = T0 + 2 * HOUR;
    const { state } = dispatch(
      s,
      SETTINGS_PAUSE_AFTER_LOG,
      { type: "awayReturn" },
      now,
    );
    expect(state.mode).toBe("running");
    expect(state.hourStart).toBe(floorHourBoundary(now));
    expect(state.awayKind).toBeNull();
    expect(state.awaySince).toBeNull();
    expect(state.phraseIdx).toBe(1);
  });
});

describe("draftUpdate", () => {
  it("patches only the provided fields", () => {
    const s = running({
      mode: "running",
      draftBullets: ["a"],
      draftTag: "Admin",
      draftFeel: "Steady",
      draftIntent: "yes",
    });
    const { state, entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "draftUpdate", patch: { bullets: ["a", "b"] } },
      T0 + 1000,
    );
    expect(state.draftBullets).toEqual(["a", "b"]);
    expect(state.draftTag).toBe("Admin");
    expect(state.draftFeel).toBe("Steady");
    expect(state.draftIntent).toBe("yes");
    expect(entriesToInsert).toEqual([]);
  });

  it("allows clearing a field back to null", () => {
    const s = running({ mode: "recap", draftTag: "Admin" });
    const { state } = dispatch(
      s,
      SETTINGS,
      { type: "draftUpdate", patch: { tag: null } },
      T0 + 1000,
    );
    expect(state.draftTag).toBeNull();
  });

  it("works in running, paused, chime, and recap", () => {
    for (const mode of ["running", "paused", "chime", "recap"] as const) {
      const s = running({ mode });
      const { state } = dispatch(
        s,
        SETTINGS,
        { type: "draftUpdate", patch: { feel: "Drained" } },
        T0 + 1000,
      );
      expect(state.draftFeel).toBe("Drained");
    }
  });

  it("is a no-op in away", () => {
    const s = running({ mode: "away", awayKind: "sleep", awaySince: T0 });
    const { state } = dispatch(
      s,
      SETTINGS,
      { type: "draftUpdate", patch: { feel: "Drained" } },
      T0 + 1000,
    );
    expect(state).toBe(s);
  });
});
