import { z } from "zod";

import { FEELS } from "../domain";

export const LIMITS = {
  MAX_BULLETS_PER_ENTRY: 30,
  MAX_BULLET_LENGTH: 500,
  MAX_ENTRIES_PER_DAY: 100,
  MAX_TAG_LENGTH: 40,
};

const FEEL_LABELS = [...FEELS, "—"] as unknown as [string, ...string[]];

export const bulletsSchema = z
  .array(z.string().max(LIMITS.MAX_BULLET_LENGTH))
  .max(LIMITS.MAX_BULLETS_PER_ENTRY);

// A bounded string, not an enum: custom away kinds tag their hours with a
// user-typed label, so the tag vocabulary is open-ended. Feel and intent
// stay closed.
export const tagSchema = z.string().trim().min(1).max(LIMITS.MAX_TAG_LENGTH);

export const awayLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(LIMITS.MAX_TAG_LENGTH);

export const feelSchema = z.enum(FEEL_LABELS);

export const intentSchema = z.union([
  z.literal("yes"),
  z.literal("no"),
  z.literal("mixed"),
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
  z.object({ type: z.literal("resume") }),
  z.object({ type: z.literal("ringNow") }),
  z.object({ type: z.literal("acknowledge") }),
  z.object({ type: z.literal("log"), payload: logPayloadSchema }),
  z.object({ type: z.literal("skip") }),
  z
    .object({
      type: z.literal("awayStart"),
      kind: z.enum(["sleep", "work", "gym", "custom"]),
      label: awayLabelSchema.optional(),
    })
    .refine((a) => a.kind !== "custom" || a.label !== undefined, {
      message: "custom away requires a label",
    }),
  z.object({ type: z.literal("awayReturn") }),
  z.object({ type: z.literal("draftUpdate"), patch: draftPatchSchema }),
]);

export const MAX_SYNC_ACTIONS = 200;

export const walRecordSchema = z.object({
  id: z.uuid(),
  at: z.number().int().positive(),
  action: timerActionSchema,
});

export const syncRequestSchema = z.object({
  batchId: z.uuid(),
  actions: z.array(walRecordSchema).min(1).max(MAX_SYNC_ACTIONS),
  todayStart: z.number().int().optional(),
  todayEnd: z.number().int().optional(),
});

export const settingsPatchSchema = z
  .object({
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
