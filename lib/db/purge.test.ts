import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { purgeUser } from "./purge";
import { entries, timerState, userSettings } from "./schema";
import { createTestDb, type TestDb } from "./test-db";

describe("purgeUser", () => {
  async function seedUser(db: TestDb, userId: string) {
    const from = new Date("2026-08-11T09:00:00Z");
    const to = new Date("2026-08-11T10:00:00Z");

    await db.insert(entries).values({
      userId,
      from,
      to,
      tag: "Deep work",
      feel: "Charged",
      bullets: ["did a thing"],
    });

    await db.insert(timerState).values({
      userId,
      mode: "running",
      hourStart: from,
      draftBullets: [],
      phraseIdx: 0,
    });

    await db.insert(userSettings).values({
      userId,
      pauseAfterLog: true,
    });
  }

  it("removes exactly the target user's rows across all three tables", async () => {
    const db = await createTestDb();
    await seedUser(db, "user_1");
    await seedUser(db, "user_2");

    const counts = await purgeUser(db, "user_1");

    expect(counts).toEqual({ entries: 1, timerState: 1, userSettings: 1 });

    const remainingEntries = await db
      .select()
      .from(entries)
      .where(eq(entries.userId, "user_1"));
    const remainingTimerState = await db
      .select()
      .from(timerState)
      .where(eq(timerState.userId, "user_1"));
    const remainingSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, "user_1"));

    expect(remainingEntries).toHaveLength(0);
    expect(remainingTimerState).toHaveLength(0);
    expect(remainingSettings).toHaveLength(0);
  });

  it("leaves another user's rows intact", async () => {
    const db = await createTestDb();
    await seedUser(db, "user_1");
    await seedUser(db, "user_2");

    await purgeUser(db, "user_1");

    const otherEntries = await db
      .select()
      .from(entries)
      .where(eq(entries.userId, "user_2"));
    const otherTimerState = await db
      .select()
      .from(timerState)
      .where(eq(timerState.userId, "user_2"));
    const otherSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, "user_2"));

    expect(otherEntries).toHaveLength(1);
    expect(otherTimerState).toHaveLength(1);
    expect(otherSettings).toHaveLength(1);
  });

  it("returns zero counts for a user with no rows", async () => {
    const db = await createTestDb();

    const counts = await purgeUser(db, "no_such_user");

    expect(counts).toEqual({ entries: 0, timerState: 0, userSettings: 0 });
  });
});
