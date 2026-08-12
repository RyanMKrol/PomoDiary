import { eq } from "drizzle-orm";

import type { getDb } from "./index";
import type { TestDb } from "./test-db";
import { entries, timerState } from "./schema";
import type { EntryInput } from "./entries.store";
import {
  timerStateUpdateData,
  type TimerStateInput,
} from "./timer-state.store";

export type Db = TestDb | ReturnType<typeof getDb>;

type RealDb = ReturnType<typeof getDb>;

/** See lib/db/purge.ts: neon-http has no interactive transactions, so
 *  db.batch() is the atomic primitive in production; PGlite (tests) has
 *  real transactions instead. */
function hasBatch(db: Db): db is RealDb {
  return typeof (db as { batch?: unknown }).batch === "function";
}

/**
 * Atomically persists the post-replay timer state (stamped with the batch id)
 * and the entries the replay produced. Atomicity is what makes lastBatchId
 * dedupe sound: "state says the batch applied but its entries are missing"
 * cannot happen.
 */
export async function applySyncWrite(
  db: Db,
  userId: string,
  state: TimerStateInput,
  batchId: string,
  entryList: EntryInput[],
): Promise<void> {
  const updateData = { ...timerStateUpdateData(state), lastBatchId: batchId };
  const entryRows = entryList.map((entry) => ({
    userId,
    from: entry.from,
    to: entry.to,
    tag: entry.tag,
    feel: entry.feel,
    intent: entry.intent || null,
    bullets: entry.bullets,
  }));

  if (hasBatch(db)) {
    const upsert = db
      .insert(timerState)
      .values({ userId, ...updateData })
      .onConflictDoUpdate({ target: timerState.userId, set: updateData });

    if (entryRows.length > 0) {
      await db.batch([upsert, db.insert(entries).values(entryRows)]);
    } else {
      await db.batch([upsert]);
    }
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(timerState)
      .values({ userId, ...updateData })
      .onConflictDoUpdate({ target: timerState.userId, set: updateData });
    if (entryRows.length > 0) {
      await tx.insert(entries).values(entryRows);
    }
  });
}

/** The stored lastBatchId for a user, or null when no row / never synced. */
export async function getLastBatchId(
  db: Db,
  userId: string,
): Promise<string | null> {
  const rows = await db
    .select({ lastBatchId: timerState.lastBatchId })
    .from(timerState)
    .where(eq(timerState.userId, userId));
  return rows[0]?.lastBatchId ?? null;
}
