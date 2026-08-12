import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDb } from "./index";
import { entries, timerState } from "./schema";
import { createTestDb } from "./test-db";

describe("PGlite test harness", () => {
  it("applies migrations cleanly", async () => {
    await expect(createTestDb()).resolves.toBeDefined();
  });

  it("round-trips an entry's bullets as string[]", async () => {
    const db = await createTestDb();
    const from = new Date("2026-08-11T09:00:00Z");
    const to = new Date("2026-08-11T10:00:00Z");

    await db.insert(entries).values({
      userId: "user_123",
      from,
      to,
      tag: "Deep work",
      feel: "good",
      intent: "yes",
      bullets: ["wrote the schema", "generated migrations"],
    });

    const rows = await db
      .select()
      .from(entries)
      .where(eq(entries.userId, "user_123"));

    expect(rows).toHaveLength(1);
    expect(rows[0].bullets).toEqual([
      "wrote the schema",
      "generated migrations",
    ]);
    expect(Array.isArray(rows[0].bullets)).toBe(true);
  });

  it("upserts timerState per user", async () => {
    const db = await createTestDb();
    const hourStart = new Date("2026-08-11T09:00:00Z");

    const insert = () =>
      db
        .insert(timerState)
        .values({
          userId: "user_456",
          mode: "running",
          hourStart,
          draftBullets: [],
          phraseIdx: 0,
        })
        .onConflictDoUpdate({
          target: timerState.userId,
          set: {
            mode: "running",
            hourStart,
            draftBullets: [],
            phraseIdx: 0,
          },
        });

    await insert();
    await db
      .update(timerState)
      .set({ mode: "paused" })
      .where(eq(timerState.userId, "user_456"));
    await insert();

    const rows = await db
      .select()
      .from(timerState)
      .where(eq(timerState.userId, "user_456"));

    expect(rows).toHaveLength(1);
    expect(rows[0].mode).toBe("running");
  });

  it("getDb() throws under vitest", () => {
    expect(() => getDb()).toThrow(/vitest/i);
  });
});
