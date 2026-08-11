import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { Db } from "../db/entries.store";
import {
  listAllEntries,
  listEntriesForRange,
  updateEntry as storeUpdateEntry,
  type Entry,
  type EntryPatch,
} from "../db/entries.store";
import { getDb } from "../db";
import { BadRequestError } from "./route-handler";
import { entries } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { tagSchema, feelSchema, intentSchema } from "../validation";

const MAX_SPAN_MS = 31 * 24 * 60 * 60 * 1000;

// Schema for PATCH that doesn't validate bullet sizes/count
// (letting the store handle CapError validation for 422 responses)
export const entryPatchParsedSchema = z
  .object({
    bullets: z.array(z.string()).optional(),
    tag: tagSchema.optional(),
    feel: feelSchema.optional(),
    intent: intentSchema.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "entryPatch must include at least one field",
  });

export async function getEntriesHandler(
  req: NextRequest,
  userId: string,
): Promise<NextResponse> {
  const db = getDb();
  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  // No range at all = the user's full history (the grid view grows one row
  // per day back to the first entry). Auth-scoped and rate-limited, and a
  // personal diary's volume (24 rows/day) keeps this cheap. The 31-day span
  // cap below still applies to explicit ranges.
  if (fromParam === null && toParam === null) {
    const all = await listAllEntries(db, userId);
    return NextResponse.json(all);
  }

  if (fromParam === null || toParam === null) {
    throw new BadRequestError(
      "Provide both 'from' and 'to', or neither for full history",
    );
  }

  const from = Number(fromParam);
  const to = Number(toParam);

  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    throw new BadRequestError("'from' and 'to' must be valid integers");
  }

  if (from >= to) {
    throw new BadRequestError("'from' must be less than 'to'");
  }

  const span = to - from;
  if (span > MAX_SPAN_MS) {
    throw new BadRequestError(
      `Time span cannot exceed 31 days (${span}ms > ${MAX_SPAN_MS}ms)`,
    );
  }

  const entries_list = await listEntriesForRange(
    db,
    userId,
    new Date(from),
    new Date(to),
  );

  return NextResponse.json(entries_list);
}

async function getEntry(
  db: Db,
  userId: string,
  entryId: string,
): Promise<Entry | null> {
  const result = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, entryId), eq(entries.userId, userId)))
    .limit(1);

  return result[0] || null;
}

export async function patchEntryHandler(
  req: NextRequest,
  userId: string,
  entryId: string,
  patch: EntryPatch,
): Promise<NextResponse> {
  const db = getDb();

  const entry = await getEntry(db, userId, entryId);
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  await storeUpdateEntry(db, userId, entryId, patch);

  const updatedEntry = await getEntry(db, userId, entryId);
  if (!updatedEntry) {
    return NextResponse.json(
      { error: "Failed to fetch updated entry" },
      { status: 500 },
    );
  }

  return NextResponse.json(updatedEntry);
}
