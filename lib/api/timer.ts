import { NextRequest, NextResponse } from "next/server";

import { getDb } from "../db";
import { insertEntries } from "../db/entries.store";
import { deriveNow, dispatch } from "../timer/engine";
import { timerActionSchema } from "../validation";
import { parseJsonBody } from "./route-handler";
import {
  buildStatePayload,
  engineStateToInput,
  loadOrCreateState,
  loadSettings,
  toEngineSettings,
} from "./timer-state";
import { pushRecentAwayLabel, upsertTimerState } from "../db/timer-state.store";

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

  // Roll a naturally-elapsed block into its chime before dispatching:
  // the stored row can still say "running" after the boundary passed, and
  // acknowledge/log guard on the chime mode.
  const rolled = deriveNow(state, now).state;
  const result = dispatch(rolled, toEngineSettings(settings), action, now);

  await upsertTimerState(db, userId, engineStateToInput(result.state));

  // Remember the label of a custom away that actually entered away mode, so
  // the control bar can offer it as a quick pick next time.
  if (
    action.type === "awayStart" &&
    action.kind === "custom" &&
    result.state.mode === "away" &&
    result.state.awayLabel
  ) {
    await pushRecentAwayLabel(db, userId, result.state.awayLabel);
    settings.recentAwayLabels = [
      result.state.awayLabel,
      ...settings.recentAwayLabels.filter(
        (l) => l.toLowerCase() !== result.state.awayLabel!.toLowerCase(),
      ),
    ].slice(0, 5);
  }

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
