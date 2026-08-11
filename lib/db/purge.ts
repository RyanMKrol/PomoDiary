import { eq } from "drizzle-orm";

import type { getDb } from "./index";
import { entries, timerState, userSettings } from "./schema";
import type { TestDb } from "./test-db";

export type Db = TestDb | ReturnType<typeof getDb>;

export interface PurgeCounts {
  entries: number;
  timerState: number;
  userSettings: number;
}

type RealDb = ReturnType<typeof getDb>;

/**
 * The neon-http driver has no interactive transaction support (it's a stateless
 * HTTP client) — `db.batch()` is Neon's atomic multi-statement primitive instead.
 * PGlite (used in tests) has no `batch()`, but does support real transactions.
 */
function hasBatch(db: Db): db is RealDb {
  return typeof (db as { batch?: unknown }).batch === "function";
}

export async function purgeUser(db: Db, userId: string): Promise<PurgeCounts> {
  if (hasBatch(db)) {
    const [deletedEntries, deletedTimerState, deletedUserSettings] =
      await db.batch([
        db
          .delete(entries)
          .where(eq(entries.userId, userId))
          .returning({ id: entries.id }),
        db
          .delete(timerState)
          .where(eq(timerState.userId, userId))
          .returning({ userId: timerState.userId }),
        db
          .delete(userSettings)
          .where(eq(userSettings.userId, userId))
          .returning({ userId: userSettings.userId }),
      ]);

    return {
      entries: deletedEntries.length,
      timerState: deletedTimerState.length,
      userSettings: deletedUserSettings.length,
    };
  }

  return db.transaction(async (tx) => {
    const deletedEntries = await tx
      .delete(entries)
      .where(eq(entries.userId, userId))
      .returning({ id: entries.id });
    const deletedTimerState = await tx
      .delete(timerState)
      .where(eq(timerState.userId, userId))
      .returning({ userId: timerState.userId });
    const deletedUserSettings = await tx
      .delete(userSettings)
      .where(eq(userSettings.userId, userId))
      .returning({ userId: userSettings.userId });

    return {
      entries: deletedEntries.length,
      timerState: deletedTimerState.length,
      userSettings: deletedUserSettings.length,
    };
  });
}
