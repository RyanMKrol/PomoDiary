import { eq } from "drizzle-orm";
import { describe, it, expect, beforeEach } from "vitest";

import {
  insertEntry,
  insertEntries,
  listEntriesForDay,
  listEntriesForRange,
  updateEntry,
  countEntriesForDay,
  CapError,
  CAPS,
} from "./entries.store";
import {
  getTimerState,
  upsertTimerState,
  getSettings,
  upsertSettings,
} from "./timer-state.store";
import { entries } from "./schema";
import { createTestDb, type TestDb } from "./test-db";

describe("entries.store", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  describe("insertEntry", () => {
    it("inserts a single entry", async () => {
      const from = new Date("2026-08-11T09:00:00Z");
      const to = new Date("2026-08-11T10:00:00Z");

      await insertEntry(db, "user_1", {
        from,
        to,
        tag: "Deep work",
        feel: "Charged",
        intent: "yes",
        bullets: ["worked on T007"],
      });

      const rows = await db
        .select()
        .from(entries)
        .where(eq(entries.userId, "user_1"));
      expect(rows).toHaveLength(1);
      expect(rows[0].bullets).toEqual(["worked on T007"]);
    });

    it("throws CapError when bullets exceed limit", async () => {
      const from = new Date("2026-08-11T09:00:00Z");
      const to = new Date("2026-08-11T10:00:00Z");
      const tooManyBullets = Array(31).fill("bullet");

      await expect(
        insertEntry(db, "user_1", {
          from,
          to,
          tag: "Deep work",
          feel: "Charged",
          bullets: tooManyBullets,
        }),
      ).rejects.toThrow(CapError);
    });

    it("allows 30 bullets (boundary case)", async () => {
      const from = new Date("2026-08-11T09:00:00Z");
      const to = new Date("2026-08-11T10:00:00Z");
      const bullets = Array(30).fill("bullet");

      await insertEntry(db, "user_1", {
        from,
        to,
        tag: "Deep work",
        feel: "Charged",
        bullets,
      });

      const rows = await db
        .select()
        .from(entries)
        .where(eq(entries.userId, "user_1"));
      expect(rows).toHaveLength(1);
      expect(rows[0].bullets).toHaveLength(30);
    });

    it("throws CapError when bullet exceeds char limit", async () => {
      const from = new Date("2026-08-11T09:00:00Z");
      const to = new Date("2026-08-11T10:00:00Z");
      const tooLongBullet = "x".repeat(501);

      await expect(
        insertEntry(db, "user_1", {
          from,
          to,
          tag: "Deep work",
          feel: "Charged",
          bullets: [tooLongBullet],
        }),
      ).rejects.toThrow(CapError);
    });

    it("allows 500-char bullet (boundary case)", async () => {
      const from = new Date("2026-08-11T09:00:00Z");
      const to = new Date("2026-08-11T10:00:00Z");
      const bullet = "x".repeat(500);

      await insertEntry(db, "user_1", {
        from,
        to,
        tag: "Deep work",
        feel: "Charged",
        bullets: [bullet],
      });

      const rows = await db
        .select()
        .from(entries)
        .where(eq(entries.userId, "user_1"));
      expect(rows).toHaveLength(1);
      expect(rows[0].bullets[0]).toHaveLength(500);
    });

    it("throws CapError when exceeding 100 entries per day", async () => {
      const from = new Date("2026-08-11T09:00:00Z");
      const to = new Date("2026-08-11T10:00:00Z");

      // Insert 100 entries
      for (let i = 0; i < CAPS.ENTRIES_PER_DAY; i++) {
        const entryFrom = new Date(from.getTime() + i * 1000);
        const entryTo = new Date(to.getTime() + i * 1000);
        await insertEntry(db, "user_1", {
          from: entryFrom,
          to: entryTo,
          tag: "Deep work",
          feel: "Charged",
          bullets: ["bullet"],
        });
      }

      // Try to insert the 101st
      const entryFrom = new Date(from.getTime() + CAPS.ENTRIES_PER_DAY * 1000);
      const entryTo = new Date(to.getTime() + CAPS.ENTRIES_PER_DAY * 1000);
      await expect(
        insertEntry(db, "user_1", {
          from: entryFrom,
          to: entryTo,
          tag: "Deep work",
          feel: "Charged",
          bullets: ["bullet"],
        }),
      ).rejects.toThrow(CapError);
    });

    it("allows 100 entries per day (boundary case)", async () => {
      const baseDate = new Date("2026-08-11T00:00:00Z");
      const endDate = new Date("2026-08-12T00:00:00Z");

      for (let i = 0; i < CAPS.ENTRIES_PER_DAY; i++) {
        const entryFrom = new Date(baseDate.getTime() + i * 864); // spread across the day
        const entryTo = new Date(entryFrom.getTime() + 3600000);
        await insertEntry(db, "user_1", {
          from: entryFrom,
          to: entryTo,
          tag: "Deep work",
          feel: "Charged",
          bullets: ["bullet"],
        });
      }

      const count = await countEntriesForDay(db, "user_1", baseDate, endDate);
      expect(count).toBe(CAPS.ENTRIES_PER_DAY);
    });
  });

  describe("insertEntries", () => {
    it("batch inserts multiple entries", async () => {
      const from1 = new Date("2026-08-11T09:00:00Z");
      const to1 = new Date("2026-08-11T10:00:00Z");
      const from2 = new Date("2026-08-11T10:00:00Z");
      const to2 = new Date("2026-08-11T11:00:00Z");

      await insertEntries(db, "user_1", [
        {
          from: from1,
          to: to1,
          tag: "Deep work",
          feel: "Charged",
          bullets: ["bullet 1"],
        },
        {
          from: from2,
          to: to2,
          tag: "Meetings",
          feel: "Steady",
          bullets: ["bullet 2"],
        },
      ]);

      const rows = await db
        .select()
        .from(entries)
        .where(eq(entries.userId, "user_1"));
      expect(rows).toHaveLength(2);
    });

    it("throws CapError when batch exceeds daily limit", async () => {
      const baseDate = new Date("2026-08-11T00:00:00Z");

      // Insert 100 entries first
      for (let i = 0; i < CAPS.ENTRIES_PER_DAY; i++) {
        const entryFrom = new Date(baseDate.getTime() + i * 864);
        const entryTo = new Date(entryFrom.getTime() + 3600000);
        await insertEntry(db, "user_1", {
          from: entryFrom,
          to: entryTo,
          tag: "Deep work",
          feel: "Charged",
          bullets: ["bullet"],
        });
      }

      // Try to batch insert 2 more
      const from1 = new Date(baseDate.getTime() + CAPS.ENTRIES_PER_DAY * 900);
      const to1 = new Date(from1.getTime() + 3600000);
      const from2 = new Date(from1.getTime() + 3600000);
      const to2 = new Date(from2.getTime() + 3600000);

      await expect(
        insertEntries(db, "user_1", [
          {
            from: from1,
            to: to1,
            tag: "Deep work",
            feel: "Charged",
            bullets: ["bullet"],
          },
          {
            from: from2,
            to: to2,
            tag: "Deep work",
            feel: "Charged",
            bullets: ["bullet"],
          },
        ]),
      ).rejects.toThrow(CapError);
    });
  });

  describe("listEntriesForDay", () => {
    it("lists entries within day boundary, newest first", async () => {
      const dayStart = new Date("2026-08-11T00:00:00Z");
      const dayEnd = new Date("2026-08-12T00:00:00Z");

      const from1 = new Date("2026-08-11T09:00:00Z");
      const to1 = new Date("2026-08-11T10:00:00Z");
      const from2 = new Date("2026-08-11T10:00:00Z");
      const to2 = new Date("2026-08-11T11:00:00Z");

      await insertEntry(db, "user_1", {
        from: from1,
        to: to1,
        tag: "Deep work",
        feel: "Charged",
        bullets: ["first"],
      });

      await insertEntry(db, "user_1", {
        from: from2,
        to: to2,
        tag: "Meetings",
        feel: "Steady",
        bullets: ["second"],
      });

      const result = await listEntriesForDay(db, "user_1", dayStart, dayEnd);
      expect(result).toHaveLength(2);
      expect(result[0].bullets).toEqual(["second"]);
      expect(result[1].bullets).toEqual(["first"]);
    });

    it("excludes entries outside day boundary", async () => {
      const dayStart = new Date("2026-08-11T00:00:00Z");
      const dayEnd = new Date("2026-08-12T00:00:00Z");

      const from1 = new Date("2026-08-10T23:00:00Z");
      const to1 = new Date("2026-08-11T00:00:00Z");
      const from2 = new Date("2026-08-11T09:00:00Z");
      const to2 = new Date("2026-08-11T10:00:00Z");

      await insertEntry(db, "user_1", {
        from: from1,
        to: to1,
        tag: "Deep work",
        feel: "Charged",
        bullets: ["before"],
      });

      await insertEntry(db, "user_1", {
        from: from2,
        to: to2,
        tag: "Meetings",
        feel: "Steady",
        bullets: ["during"],
      });

      const result = await listEntriesForDay(db, "user_1", dayStart, dayEnd);
      expect(result).toHaveLength(1);
      expect(result[0].bullets).toEqual(["during"]);
    });
  });

  describe("listEntriesForRange", () => {
    it("lists entries within range, newest first", async () => {
      const rangeStart = new Date("2026-08-10T00:00:00Z");
      const rangeEnd = new Date("2026-08-13T00:00:00Z");

      const from1 = new Date("2026-08-11T09:00:00Z");
      const to1 = new Date("2026-08-11T10:00:00Z");
      const from2 = new Date("2026-08-12T10:00:00Z");
      const to2 = new Date("2026-08-12T11:00:00Z");

      await insertEntry(db, "user_1", {
        from: from1,
        to: to1,
        tag: "Deep work",
        feel: "Charged",
        bullets: ["first"],
      });

      await insertEntry(db, "user_1", {
        from: from2,
        to: to2,
        tag: "Meetings",
        feel: "Steady",
        bullets: ["second"],
      });

      const result = await listEntriesForRange(
        db,
        "user_1",
        rangeStart,
        rangeEnd,
      );
      expect(result).toHaveLength(2);
      expect(result[0].bullets).toEqual(["second"]);
      expect(result[1].bullets).toEqual(["first"]);
    });
  });

  describe("updateEntry", () => {
    it("patches only allowed fields", async () => {
      const from = new Date("2026-08-11T09:00:00Z");
      const to = new Date("2026-08-11T10:00:00Z");

      await insertEntry(db, "user_1", {
        from,
        to,
        tag: "Deep work",
        feel: "Charged",
        intent: "yes",
        bullets: ["original"],
      });

      const rows = await db
        .select()
        .from(entries)
        .where(eq(entries.userId, "user_1"));
      const entryId = rows[0].id;

      await updateEntry(db, "user_1", entryId, {
        tag: "Meetings",
        feel: "Drained",
        bullets: ["updated"],
      });

      const updated = await db
        .select()
        .from(entries)
        .where(eq(entries.id, entryId));
      expect(updated[0].tag).toBe("Meetings");
      expect(updated[0].feel).toBe("Drained");
      expect(updated[0].bullets).toEqual(["updated"]);
    });

    it("allows intent patch including null", async () => {
      const from = new Date("2026-08-11T09:00:00Z");
      const to = new Date("2026-08-11T10:00:00Z");

      await insertEntry(db, "user_1", {
        from,
        to,
        tag: "Deep work",
        feel: "Charged",
        intent: "yes",
        bullets: ["original"],
      });

      const rows = await db
        .select()
        .from(entries)
        .where(eq(entries.userId, "user_1"));
      const entryId = rows[0].id;

      await updateEntry(db, "user_1", entryId, {
        intent: null,
      });

      const updated = await db
        .select()
        .from(entries)
        .where(eq(entries.id, entryId));
      expect(updated[0].intent).toBeNull();
    });

    it("enforces cross-user isolation on update", async () => {
      const from = new Date("2026-08-11T09:00:00Z");
      const to = new Date("2026-08-11T10:00:00Z");

      await insertEntry(db, "user_1", {
        from,
        to,
        tag: "Deep work",
        feel: "Charged",
        bullets: ["original"],
      });

      const rows = await db
        .select()
        .from(entries)
        .where(eq(entries.userId, "user_1"));
      const entryId = rows[0].id;

      // Try to update with different user
      await updateEntry(db, "user_2", entryId, {
        tag: "Hacked",
      });

      // Entry should be unchanged
      const result = await db
        .select()
        .from(entries)
        .where(eq(entries.id, entryId));
      expect(result[0].tag).toBe("Deep work");
    });

    it("throws CapError when patching with invalid bullets", async () => {
      const from = new Date("2026-08-11T09:00:00Z");
      const to = new Date("2026-08-11T10:00:00Z");

      await insertEntry(db, "user_1", {
        from,
        to,
        tag: "Deep work",
        feel: "Charged",
        bullets: ["original"],
      });

      const rows = await db
        .select()
        .from(entries)
        .where(eq(entries.userId, "user_1"));
      const entryId = rows[0].id;

      const tooManyBullets = Array(31).fill("bullet");
      await expect(
        updateEntry(db, "user_1", entryId, {
          bullets: tooManyBullets,
        }),
      ).rejects.toThrow(CapError);
    });
  });

  describe("countEntriesForDay", () => {
    it("counts entries within day boundary", async () => {
      const dayStart = new Date("2026-08-11T00:00:00Z");
      const dayEnd = new Date("2026-08-12T00:00:00Z");

      const from1 = new Date("2026-08-11T09:00:00Z");
      const to1 = new Date("2026-08-11T10:00:00Z");
      const from2 = new Date("2026-08-11T10:00:00Z");
      const to2 = new Date("2026-08-11T11:00:00Z");

      await insertEntry(db, "user_1", {
        from: from1,
        to: to1,
        tag: "Deep work",
        feel: "Charged",
        bullets: ["first"],
      });

      await insertEntry(db, "user_1", {
        from: from2,
        to: to2,
        tag: "Meetings",
        feel: "Steady",
        bullets: ["second"],
      });

      const count = await countEntriesForDay(db, "user_1", dayStart, dayEnd);
      expect(count).toBe(2);
    });
  });

  describe("cross-user isolation", () => {
    it("user A cannot read user B's entries", async () => {
      const from = new Date("2026-08-11T09:00:00Z");
      const to = new Date("2026-08-11T10:00:00Z");
      const dayStart = new Date("2026-08-11T00:00:00Z");
      const dayEnd = new Date("2026-08-12T00:00:00Z");

      await insertEntry(db, "user_1", {
        from,
        to,
        tag: "Deep work",
        feel: "Charged",
        bullets: ["user 1 secret"],
      });

      const result = await listEntriesForDay(db, "user_2", dayStart, dayEnd);
      expect(result).toHaveLength(0);
    });
  });
});

describe("timer-state.store", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  describe("getTimerState", () => {
    it("returns null when no state exists", async () => {
      const state = await getTimerState(db, "user_1");
      expect(state).toBeNull();
    });

    it("returns the timer state when it exists", async () => {
      const hourStart = new Date("2026-08-11T09:00:00Z");
      await upsertTimerState(db, "user_1", {
        mode: "running",
        hourStart,
        draftBullets: [],
        phraseIdx: 0,
      });

      const state = await getTimerState(db, "user_1");
      expect(state).not.toBeNull();
      expect(state!.mode).toBe("running");
    });
  });

  describe("upsertTimerState", () => {
    it("inserts new timer state", async () => {
      const hourStart = new Date("2026-08-11T09:00:00Z");
      await upsertTimerState(db, "user_1", {
        mode: "running",
        hourStart,
        draftBullets: ["draft bullet"],
        phraseIdx: 2,
      });

      const state = await getTimerState(db, "user_1");
      expect(state).not.toBeNull();
      expect(state!.mode).toBe("running");
      expect(state!.phraseIdx).toBe(2);
      expect(state!.draftBullets).toEqual(["draft bullet"]);
    });

    it("updates existing timer state", async () => {
      const hourStart = new Date("2026-08-11T09:00:00Z");
      await upsertTimerState(db, "user_1", {
        mode: "running",
        hourStart,
        draftBullets: [],
        phraseIdx: 0,
      });

      const newHourStart = new Date("2026-08-11T10:00:00Z");
      await upsertTimerState(db, "user_1", {
        mode: "paused",
        hourStart: newHourStart,
        pausedRemaining: 1800,
        draftBullets: ["new draft"],
        phraseIdx: 1,
      });

      const state = await getTimerState(db, "user_1");
      expect(state).not.toBeNull();
      expect(state!.mode).toBe("paused");
      expect(state!.pausedRemaining).toBe(1800);
      expect(state!.draftBullets).toEqual(["new draft"]);
    });

    it("handles away state", async () => {
      const hourStart = new Date("2026-08-11T09:00:00Z");
      const awaySince = new Date("2026-08-11T09:30:00Z");

      await upsertTimerState(db, "user_1", {
        mode: "away",
        hourStart,
        awayKind: "sleep",
        awaySince,
        draftBullets: [],
        phraseIdx: 0,
      });

      const state = await getTimerState(db, "user_1");
      expect(state).not.toBeNull();
      expect(state!.mode).toBe("away");
      expect(state!.awayKind).toBe("sleep");
    });
  });

  describe("getSettings", () => {
    it("returns default settings when none exist", async () => {
      const settings = await getSettings(db, "user_1");
      expect(settings.sessionMinutes).toBe(60);
      expect(settings.soundOn).toBe(true);
      expect(settings.chimeVolume).toBe(0.8);
      expect(settings.pauseAfterLog).toBe(false);
    });

    it("returns persisted settings", async () => {
      await upsertSettings(db, "user_1", {
        sessionMinutes: 45,
        soundOn: false,
      });

      const settings = await getSettings(db, "user_1");
      expect(settings.sessionMinutes).toBe(45);
      expect(settings.soundOn).toBe(false);
      expect(settings.chimeVolume).toBe(0.8);
    });
  });

  describe("upsertSettings", () => {
    it("inserts new settings", async () => {
      await upsertSettings(db, "user_1", {
        sessionMinutes: 30,
        chimeVolume: 0.5,
      });

      const settings = await getSettings(db, "user_1");
      expect(settings.sessionMinutes).toBe(30);
      expect(settings.chimeVolume).toBe(0.5);
    });

    it("patches existing settings", async () => {
      await upsertSettings(db, "user_1", {
        sessionMinutes: 45,
        soundOn: false,
      });

      await upsertSettings(db, "user_1", {
        chimeVolume: 0.3,
      });

      const settings = await getSettings(db, "user_1");
      expect(settings.sessionMinutes).toBe(45);
      expect(settings.soundOn).toBe(false);
      expect(settings.chimeVolume).toBe(0.3);
    });
  });

  describe("cross-user isolation", () => {
    it("timer state is per-user", async () => {
      const hourStart = new Date("2026-08-11T09:00:00Z");
      await upsertTimerState(db, "user_1", {
        mode: "running",
        hourStart,
        draftBullets: ["user 1 draft"],
        phraseIdx: 0,
      });

      const state2 = await getTimerState(db, "user_2");
      expect(state2).toBeNull();
    });

    it("settings are per-user", async () => {
      await upsertSettings(db, "user_1", {
        sessionMinutes: 30,
      });

      const settings2 = await getSettings(db, "user_2");
      expect(settings2.sessionMinutes).toBe(60);
    });
  });
});
