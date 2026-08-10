import { describe, expect, it } from "vitest";

import {
  deriveNow,
  dispatch,
  initialState,
  type Settings,
  type TimerState,
} from "./engine";

const HOUR = 3600000;
const SETTINGS: Settings = { sessionMinutes: 60, pauseAfterLog: false };
const SETTINGS_PAUSE_AFTER_LOG: Settings = {
  sessionMinutes: 60,
  pauseAfterLog: true,
};
const T0 = 1_700_000_000_000;

function running(overrides: Partial<TimerState> = {}): TimerState {
  return { ...initialState(T0), ...overrides };
}

describe("initialState", () => {
  it("starts a first-time user running with empty drafts and phrase 0", () => {
    const s = initialState(T0);
    expect(s.mode).toBe("running");
    expect(s.hourStart).toBe(T0);
    expect(s.pausedRemaining).toBeNull();
    expect(s.chimeFrom).toBeNull();
    expect(s.chimeTo).toBeNull();
    expect(s.awayKind).toBeNull();
    expect(s.awaySince).toBeNull();
    expect(s.draftBullets).toEqual([]);
    expect(s.draftTag).toBeNull();
    expect(s.draftFeel).toBeNull();
    expect(s.draftIntent).toBeNull();
    expect(s.phraseIdx).toBe(0);
  });
});

describe("deriveNow", () => {
  it("computes remaining seconds mid-hour while running", () => {
    const s = running({ hourStart: T0 });
    const { state, remainingSeconds } = deriveNow(
      s,
      SETTINGS,
      T0 + 10 * 60 * 1000,
    );
    expect(state.mode).toBe("running");
    expect(remainingSeconds).toBe(50 * 60);
  });

  it("floors remaining at 0 rather than going negative", () => {
    const s = running({ hourStart: T0, mode: "paused", pausedRemaining: 0 });
    const { remainingSeconds } = deriveNow(s, SETTINGS, T0 + HOUR + 5000);
    expect(remainingSeconds).toBe(0);
  });

  it("derives chime from a running state whose hour has elapsed (closed laptop)", () => {
    const s = running({ hourStart: T0 });
    const threeHoursLater = T0 + 3 * HOUR;
    const { state, remainingSeconds } = deriveNow(s, SETTINGS, threeHoursLater);
    expect(state.mode).toBe("chime");
    // The chime keeps the ORIGINAL hour span, not "now".
    expect(state.chimeFrom).toBe(T0);
    expect(state.chimeTo).toBe(T0 + HOUR);
    expect(remainingSeconds).toBe(0);
  });

  it("returns paused remaining verbatim while paused", () => {
    const s = running({ mode: "paused", pausedRemaining: 42 });
    const { remainingSeconds } = deriveNow(s, SETTINGS, T0 + HOUR * 5);
    expect(remainingSeconds).toBe(42);
  });

  it("does not lazily chime a state that is already paused", () => {
    const s = running({ mode: "paused", pausedRemaining: 10 });
    const { state } = deriveNow(s, SETTINGS, T0 + 10 * HOUR);
    expect(state.mode).toBe("paused");
  });
});

describe("pause", () => {
  it("freezes remaining seconds and switches to paused", () => {
    const s = running({ hourStart: T0 });
    const { state, entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "pause" },
      T0 + 20 * 60 * 1000,
    );
    expect(state.mode).toBe("paused");
    expect(state.pausedRemaining).toBe(40 * 60);
    expect(entriesToInsert).toEqual([]);
  });

  it("is a no-op outside running", () => {
    for (const mode of ["paused", "chime", "recap", "away"] as const) {
      const s = running({ mode });
      const { state } = dispatch(s, SETTINGS, { type: "pause" }, T0 + 1000);
      expect(state).toBe(s);
    }
  });
});

describe("resume", () => {
  it("rebases hourStart so the wall-clock derivation stays correct", () => {
    // Paused with 40 minutes remaining out of 60.
    const s = running({ mode: "paused", pausedRemaining: 40 * 60 });
    const resumeAt = T0 + 5 * HOUR;
    const { state, entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "resume" },
      resumeAt,
    );
    expect(state.mode).toBe("running");
    expect(state.pausedRemaining).toBeNull();
    // hourStart = now - (sessionMs - pausedRemaining*1000)
    expect(state.hourStart).toBe(resumeAt - (HOUR - 40 * 60 * 1000));
    expect(entriesToInsert).toEqual([]);

    // Deriving remaining right after resume should still be ~40 minutes.
    const { remainingSeconds } = deriveNow(state, SETTINGS, resumeAt);
    expect(remainingSeconds).toBe(40 * 60);
  });

  it("is a no-op outside paused", () => {
    for (const mode of ["running", "chime", "recap", "away"] as const) {
      const s = running({ mode });
      const { state } = dispatch(s, SETTINGS, { type: "resume" }, T0 + 1000);
      expect(state).toBe(s);
    }
  });
});

describe("restart", () => {
  it("resets hourStart to now but preserves drafts and does not advance phraseIdx", () => {
    const s = running({
      mode: "running",
      hourStart: T0,
      draftBullets: ["did a thing"],
      draftTag: "Deep work",
      draftFeel: "Charged",
      draftIntent: "yes",
      phraseIdx: 2,
    });
    const now = T0 + 30 * 60 * 1000;
    const { state, entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "restart" },
      now,
    );
    expect(state.mode).toBe("running");
    expect(state.hourStart).toBe(now);
    expect(state.draftBullets).toEqual(["did a thing"]);
    expect(state.draftTag).toBe("Deep work");
    expect(state.draftFeel).toBe("Charged");
    expect(state.draftIntent).toBe("yes");
    expect(state.phraseIdx).toBe(2);
    expect(entriesToInsert).toEqual([]);
  });

  it("works from paused too", () => {
    const s = running({ mode: "paused", pausedRemaining: 100 });
    const { state } = dispatch(s, SETTINGS, { type: "restart" }, T0 + 1000);
    expect(state.mode).toBe("running");
    expect(state.pausedRemaining).toBeNull();
  });

  it("is a no-op in chime/recap/away", () => {
    for (const mode of ["chime", "recap", "away"] as const) {
      const s = running({ mode });
      const { state } = dispatch(s, SETTINGS, { type: "restart" }, T0 + 1000);
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
    const s = running({ mode: "paused", hourStart: T0, pausedRemaining: 10 });
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
    expect(state.hourStart).toBe(now);
    expect(state.chimeFrom).toBeNull();
    expect(state.chimeTo).toBeNull();
    expect(state.draftBullets).toEqual([]);
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
          bullets: ["  wrote and shipped the design doc  "],
          tag: null,
          feel: "Charged",
          intent: "yes",
        },
      },
      T0 + HOUR + 1000,
    );
    expect(entriesToInsert[0].tag).toBe("Deep work");
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
    expect(state.pausedRemaining).toBe(60 * 60);
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
  it("resets the hour with no entry, but still advances phraseIdx", () => {
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
    expect(state.hourStart).toBe(now);
    expect(state.chimeFrom).toBeNull();
    expect(state.draftBullets).toEqual([]);
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
    const s = running({ mode: "paused", pausedRemaining: 10 });
    const { state } = dispatch(
      s,
      SETTINGS,
      { type: "awayStart", kind: "work" },
      T0 + 1000,
    );
    expect(state.mode).toBe("away");
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
  function away(sinceOffsetMs: number, kind: "sleep" | "work" = "sleep") {
    return running({
      mode: "away",
      awayKind: kind,
      awaySince: T0 + sinceOffsetMs,
      phraseIdx: 1,
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

  it("90 minutes away backfills a 1h block plus a 30min block, newest first", () => {
    const s = away(0);
    const now = T0 + 90 * 60 * 1000;
    const { entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "awayReturn" },
      now,
    );
    expect(entriesToInsert).toHaveLength(2);
    // Newest first.
    expect(entriesToInsert[0]).toEqual({
      from: T0 + HOUR,
      to: now,
      tag: "Asleep",
      feel: "—",
      intent: "yes",
      bullets: ["Asleep"],
    });
    expect(entriesToInsert[1]).toEqual({
      from: T0,
      to: T0 + HOUR,
      tag: "Asleep",
      feel: "—",
      intent: "yes",
      bullets: ["Asleep"],
    });
  });

  it("60min30s away backfills exactly one 1h block", () => {
    const s = away(0, "work");
    const now = T0 + 60 * 60 * 1000 + 30 * 1000;
    const { entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "awayReturn" },
      now,
    );
    expect(entriesToInsert).toHaveLength(1);
    expect(entriesToInsert[0]).toEqual({
      from: T0,
      to: T0 + HOUR,
      tag: "At work",
      feel: "—",
      intent: "yes",
      bullets: ["At work"],
    });
  });

  it("45s away backfills nothing", () => {
    const s = away(0);
    const now = T0 + 45 * 1000;
    const { entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "awayReturn" },
      now,
    );
    expect(entriesToInsert).toEqual([]);
  });

  it("30h away backfills exactly 24 blocks (hard cap)", () => {
    const s = away(0);
    const now = T0 + 30 * HOUR;
    const { entriesToInsert } = dispatch(
      s,
      SETTINGS,
      { type: "awayReturn" },
      now,
    );
    expect(entriesToInsert).toHaveLength(24);
    // Oldest block (last, since newest-first) starts at T0.
    expect(entriesToInsert[23].from).toBe(T0);
    expect(entriesToInsert[23].to).toBe(T0 + HOUR);
    // Newest block ends 24h after T0 (6h of the 30h away span is dropped).
    expect(entriesToInsert[0].to).toBe(T0 + 24 * HOUR);
  });

  it("always returns to running (ignores pauseAfterLog) and does not advance phraseIdx", () => {
    const s = away(0);
    const now = T0 + 2 * HOUR;
    const { state } = dispatch(
      s,
      SETTINGS_PAUSE_AFTER_LOG,
      { type: "awayReturn" },
      now,
    );
    expect(state.mode).toBe("running");
    expect(state.hourStart).toBe(now);
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
