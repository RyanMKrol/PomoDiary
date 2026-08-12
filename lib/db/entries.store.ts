import { and, desc, eq, gte, lt } from "drizzle-orm";

import type { getDb } from "./index";
import type { TestDb } from "./test-db";
import { entries } from "./schema";
import { LIMITS } from "../validation";

export type Db = TestDb | ReturnType<typeof getDb>;

export class CapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapError";
  }
}

export const CAPS = {
  ENTRIES_PER_DAY: LIMITS.MAX_ENTRIES_PER_DAY,
  BULLETS_PER_ENTRY: LIMITS.MAX_BULLETS_PER_ENTRY,
  CHARS_PER_BULLET: LIMITS.MAX_BULLET_LENGTH,
};

export interface EntryInput {
  from: Date;
  to: Date;
  tag: string;
  feel: string;
  intent?: string | null;
  bullets: string[];
}

export interface EntryPatch {
  tag?: string;
  feel?: string;
  intent?: string | null;
  bullets?: string[];
}

export type Entry = typeof entries.$inferSelect;

function validateBullets(bullets: string[]): void {
  if (bullets.length > CAPS.BULLETS_PER_ENTRY) {
    throw new CapError(
      `Entry cannot have more than ${CAPS.BULLETS_PER_ENTRY} bullets (got ${bullets.length})`,
    );
  }
  for (const bullet of bullets) {
    if (bullet.length > CAPS.CHARS_PER_BULLET) {
      throw new CapError(
        `Bullet cannot exceed ${CAPS.CHARS_PER_BULLET} characters (got ${bullet.length})`,
      );
    }
  }
}

export async function insertEntry<T extends Db>(
  db: T,
  userId: string,
  entry: EntryInput,
): Promise<void> {
  validateBullets(entry.bullets);

  const dayStart = new Date(entry.from);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const count = await countEntriesForDay(db, userId, dayStart, dayEnd);
  if (count >= CAPS.ENTRIES_PER_DAY) {
    throw new CapError(
      `Cannot add more than ${CAPS.ENTRIES_PER_DAY} entries per day`,
    );
  }

  await db.insert(entries).values({
    userId,
    from: entry.from,
    to: entry.to,
    tag: entry.tag,
    feel: entry.feel,
    intent: entry.intent || null,
    bullets: entry.bullets,
  });
}

/** The bullets + per-day cap validation insertEntries runs, exposed so the
 *  sync path can validate BEFORE its atomic state+entries batch write. */
export async function assertEntryCaps<T extends Db>(
  db: T,
  userId: string,
  entryList: EntryInput[],
): Promise<void> {
  for (const entry of entryList) {
    validateBullets(entry.bullets);
  }
  if (entryList.length === 0) return;

  const minFrom = Math.min(...entryList.map((e) => e.from.getTime()));
  const dayStart = new Date(minFrom);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const existingCount = await countEntriesForDay(db, userId, dayStart, dayEnd);
  if (existingCount + entryList.length > CAPS.ENTRIES_PER_DAY) {
    throw new CapError(
      `Cannot add more than ${CAPS.ENTRIES_PER_DAY} entries per day (currently ${existingCount}, trying to add ${entryList.length})`,
    );
  }
}

export async function insertEntries<T extends Db>(
  db: T,
  userId: string,
  entryList: EntryInput[],
): Promise<void> {
  await assertEntryCaps(db, userId, entryList);

  await db.insert(entries).values(
    entryList.map((entry) => ({
      userId,
      from: entry.from,
      to: entry.to,
      tag: entry.tag,
      feel: entry.feel,
      intent: entry.intent || null,
      bullets: entry.bullets,
    })),
  );
}

export async function listEntriesForDay<T extends Db>(
  db: T,
  userId: string,
  dayStartTs: Date,
  dayEndTs: Date,
): Promise<Entry[]> {
  return db
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        gte(entries.from, dayStartTs),
        lt(entries.from, dayEndTs),
      ),
    )
    .orderBy(desc(entries.from));
}

export async function listEntriesForRange<T extends Db>(
  db: T,
  userId: string,
  fromTs: Date,
  toTs: Date,
): Promise<Entry[]> {
  return db
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        gte(entries.from, fromTs),
        lt(entries.from, toTs),
      ),
    )
    .orderBy(desc(entries.from));
}

export async function updateEntry<T extends Db>(
  db: T,
  userId: string,
  entryId: string,
  patch: EntryPatch,
): Promise<void> {
  if (patch.bullets) {
    validateBullets(patch.bullets);
  }

  const updateData: Partial<Entry> = {};
  if (patch.tag !== undefined) updateData.tag = patch.tag;
  if (patch.feel !== undefined) updateData.feel = patch.feel;
  if (patch.intent !== undefined) updateData.intent = patch.intent;
  if (patch.bullets !== undefined) updateData.bullets = patch.bullets;

  await db
    .update(entries)
    .set(updateData)
    .where(and(eq(entries.id, entryId), eq(entries.userId, userId)));
}

export async function countEntriesForDay<T extends Db>(
  db: T,
  userId: string,
  dayStartTs: Date,
  dayEndTs: Date,
): Promise<number> {
  const rows = await db
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        gte(entries.from, dayStartTs),
        lt(entries.from, dayEndTs),
      ),
    );

  return rows.length;
}

export async function listAllEntries<T extends Db>(
  db: T,
  userId: string,
): Promise<Entry[]> {
  return db
    .select()
    .from(entries)
    .where(eq(entries.userId, userId))
    .orderBy(entries.from);
}
