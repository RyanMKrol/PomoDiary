import { eq } from "drizzle-orm";

import type { getDb } from "./index";
import type { TestDb } from "./test-db";
import { timerState, userSettings } from "./schema";

export type Db = TestDb | ReturnType<typeof getDb>;

export type TimerState = typeof timerState.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;

export interface TimerStateInput {
  mode: string;
  hourStart: Date;
  chimeFrom?: Date | null;
  chimeTo?: Date | null;
  awayKind?: string | null;
  awaySince?: Date | null;
  awayLabel?: string | null;
  draftBullets: string[];
  draftTag?: string | null;
  draftFeel?: string | null;
  draftIntent?: string | null;
  phraseIdx: number;
}

export interface UserSettingsInput {
  soundOn?: boolean;
  chimeVolume?: number;
  pauseAfterLog?: boolean;
}

const DEFAULT_SETTINGS = {
  soundOn: true,
  chimeVolume: 1,
  pauseAfterLog: false,
  recentAwayLabels: [] as string[],
};

export async function getTimerState<T extends Db>(
  db: T,
  userId: string,
): Promise<TimerState | null> {
  const result = await db
    .select()
    .from(timerState)
    .where(eq(timerState.userId, userId));
  return result[0] || null;
}

/** The column mapping shared by upsertTimerState and the sync path's atomic
 *  write, so the two can never drift. */
export function timerStateUpdateData(state: TimerStateInput) {
  return {
    mode: state.mode,
    hourStart: state.hourStart,
    chimeFrom: state.chimeFrom || null,
    chimeTo: state.chimeTo || null,
    awayKind: state.awayKind || null,
    awaySince: state.awaySince || null,
    awayLabel: state.awayLabel || null,
    draftBullets: state.draftBullets,
    draftTag: state.draftTag || null,
    draftFeel: state.draftFeel || null,
    draftIntent: state.draftIntent || null,
    phraseIdx: state.phraseIdx,
    updatedAt: new Date(),
  };
}

export async function upsertTimerState<T extends Db>(
  db: T,
  userId: string,
  state: TimerStateInput,
): Promise<void> {
  const updateData = timerStateUpdateData(state);

  await db
    .insert(timerState)
    .values({
      userId,
      ...updateData,
    })
    .onConflictDoUpdate({
      target: timerState.userId,
      set: updateData,
    });
}

export async function getSettings<T extends Db>(
  db: T,
  userId: string,
): Promise<UserSettings | Partial<UserSettings>> {
  const result = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  if (result[0]) {
    return result[0];
  }

  return DEFAULT_SETTINGS;
}

export async function upsertSettings<T extends Db>(
  db: T,
  userId: string,
  patch: UserSettingsInput,
): Promise<void> {
  const updateData: Partial<UserSettings> = {};
  if (patch.soundOn !== undefined) updateData.soundOn = patch.soundOn;
  if (patch.chimeVolume !== undefined)
    updateData.chimeVolume = patch.chimeVolume;
  if (patch.pauseAfterLog !== undefined)
    updateData.pauseAfterLog = patch.pauseAfterLog;

  await db
    .insert(userSettings)
    .values({
      userId,
      ...updateData,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: updateData,
    });
}

export const MAX_RECENT_AWAY_LABELS = 5;

/** Pushes a custom away label onto the user's most-recent-first list:
 *  case-insensitive dedupe, newest first, capped. Server-managed — the
 *  settings PATCH schema deliberately does not accept this field. */
export async function pushRecentAwayLabel<T extends Db>(
  db: T,
  userId: string,
  label: string,
): Promise<void> {
  const current = await getSettings(db, userId);
  const existing = current.recentAwayLabels ?? [];
  const next = [
    label,
    ...existing.filter((l) => l.toLowerCase() !== label.toLowerCase()),
  ].slice(0, MAX_RECENT_AWAY_LABELS);

  await db
    .insert(userSettings)
    .values({ userId, recentAwayLabels: next })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { recentAwayLabels: next },
    });
}
