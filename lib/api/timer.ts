import { NextRequest, NextResponse } from "next/server";

import { getDb } from "../db";
import { insertEntries } from "../db/entries.store";
import { dispatch } from "../timer/engine";
import { timerActionSchema } from "../validation";
import { parseJsonBody } from "./route-handler";
import {
  buildStatePayload,
  engineStateToInput,
  loadOrCreateState,
  loadSettings,
  toEngineSettings,
} from "./timer-state";
import { upsertTimerState } from "../db/timer-state.store";

export async function postTimerHandler(
  req: NextRequest,
  userId: string,
): Promise<NextResponse> {
  const action = await parseJsonBody(req, timerActionSchema);

  const db = getDb();
  const now = Date.now();

  const [state, settings] = await Promise.all([
    loadOrCreateState(db, userId, now),
    loadSettings(db, userId),
  ]);

  const result = dispatch(state, toEngineSettings(settings), action, now);

  await upsertTimerState(db, userId, engineStateToInput(result.state));

  if (result.entriesToInsert.length > 0) {
    await insertEntries(
      db,
      userId,
      result.entriesToInsert.map((entry) => ({
        from: new Date(entry.from),
        to: new Date(entry.to),
        tag: entry.tag,
        feel: entry.feel,
        intent: entry.intent,
        bullets: entry.bullets,
      })),
    );
  }

  return NextResponse.json(buildStatePayload(result.state, settings, now));
}
