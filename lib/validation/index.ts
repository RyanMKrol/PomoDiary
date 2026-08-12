import { z } from "zod";

import { AWAY, FEELS, TAGS } from "../domain";

export const LIMITS = {
  MAX_BULLETS_PER_ENTRY: 30,
  MAX_BULLET_LENGTH: 500,
  MAX_ENTRIES_PER_DAY: 100,
  SESSION_MINUTES_MIN: 1,
  SESSION_MINUTES_MAX: 180,
};

const TAG_LABELS = [
  ...TAGS.map((t) => t.label),
  AWAY.sleep.tag,
  AWAY.work.tag,
  "Unfiled",
] as unknown as [string, ...string[]];

const FEEL_LABELS = [...FEELS, "—"] as unknown as [string, ...string[]];

export const bulletsSchema = z
  .array(z.string().max(LIMITS.MAX_BULLET_LENGTH))
  .max(LIMITS.MAX_BULLETS_PER_ENTRY);

export const tagSchema = z.enum(TAG_LABELS);

export const feelSchema = z.enum(FEEL_LABELS);

export const intentSchema = z.union([
  z.literal("yes"),
  z.literal("no"),
  z.null(),
]);

const logPayloadSchema = z.object({
  bullets: bulletsSchema,
  tag: tagSchema.nullable(),
  feel: feelSchema.nullable(),
  intent: intentSchema,
});

// An empty draftUpdate patch is accepted (a no-op patch is harmless — the
// timer engine already treats every field as "leave as-is" when absent).
const draftPatchSchema = z.object({
  bullets: bulletsSchema.optional(),
  tag: tagSchema.nullable().optional(),
  feel: feelSchema.nullable().optional(),
  intent: intentSchema.optional(),
});

export const timerActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pause") }),
  z.object({ type: z.literal("resume") }),
  z.object({ type: z.literal("ringNow") }),
  z.object({ type: z.literal("acknowledge") }),
  z.object({ type: z.literal("log"), payload: logPayloadSchema }),
  z.object({ type: z.literal("skip") }),
  z.object({
    type: z.literal("awayStart"),
    kind: z.enum(["sleep", "work"]),
  }),
  z.object({ type: z.literal("awayReturn") }),
  z.object({ type: z.literal("draftUpdate"), patch: draftPatchSchema }),
]);

export const settingsPatchSchema = z
  .object({
    sessionMinutes: z
      .number()
      .int()
      .min(LIMITS.SESSION_MINUTES_MIN)
      .max(LIMITS.SESSION_MINUTES_MAX),
    soundOn: z.boolean(),
    chimeVolume: z.number().min(0).max(1),
    pauseAfterLog: z.boolean(),
  })
  .partial();

export const entryPatchSchema = z
  .object({
    bullets: bulletsSchema,
    tag: tagSchema,
    feel: feelSchema,
    intent: intentSchema,
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "entryPatch must include at least one field",
  });
