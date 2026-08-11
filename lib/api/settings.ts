import { NextRequest, NextResponse } from "next/server";

import { getDb } from "../db";
import { upsertSettings } from "../db/timer-state.store";
import { settingsPatchSchema } from "../validation";
import { parseJsonBody } from "./route-handler";
import { loadSettings } from "./timer-state";

export async function getSettingsHandler(
  userId: string,
): Promise<NextResponse> {
  const db = getDb();
  const settings = await loadSettings(db, userId);
  return NextResponse.json(settings);
}

export async function patchSettingsHandler(
  req: NextRequest,
  userId: string,
): Promise<NextResponse> {
  const patch = await parseJsonBody(req, settingsPatchSchema);

  const db = getDb();
  await upsertSettings(db, userId, patch);
  const settings = await loadSettings(db, userId);

  return NextResponse.json(settings);
}
