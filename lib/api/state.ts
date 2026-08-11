import { NextRequest, NextResponse } from "next/server";

import { getDb } from "../db";
import { countEntriesForDay } from "../db/entries.store";
import { BadRequestError } from "./route-handler";
import {
  buildStatePayload,
  loadOrCreateState,
  loadSettings,
} from "./timer-state";

const MAX_SPAN_MS = 48 * 60 * 60 * 1000;

export async function getStateHandler(
  req: NextRequest,
  userId: string,
): Promise<NextResponse> {
  const db = getDb();
  const now = Date.now();
  const url = new URL(req.url);
  const todayStartParam = url.searchParams.get("todayStart");
  const todayEndParam = url.searchParams.get("todayEnd");

  let count: number | undefined;
  if (todayStartParam !== null && todayEndParam !== null) {
    const todayStart = Number(todayStartParam);
    const todayEnd = Number(todayEndParam);
    if (
      !Number.isFinite(todayStart) ||
      !Number.isFinite(todayEnd) ||
      todayEnd < todayStart ||
      todayEnd - todayStart > MAX_SPAN_MS
    ) {
      throw new BadRequestError("Invalid todayStart/todayEnd span");
    }
    count = await countEntriesForDay(
      db,
      userId,
      new Date(todayStart),
      new Date(todayEnd),
    );
  }

  const [state, settings] = await Promise.all([
    loadOrCreateState(db, userId, now),
    loadSettings(db, userId),
  ]);

  return NextResponse.json(buildStatePayload(state, settings, now, count));
}
