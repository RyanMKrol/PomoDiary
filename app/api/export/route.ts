import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { listAllEntries } from "../../../lib/db/entries.store";
import { getSettings } from "../../../lib/db/timer-state.store";
import { handleRoute } from "../../../lib/api/route-handler";

async function exportHandler(userId: string): Promise<NextResponse> {
  const db = getDb();

  const [entries, settings] = await Promise.all([
    listAllEntries(db, userId),
    getSettings(db, userId),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    userId,
    settings,
    entries,
  };

  const jsonString = JSON.stringify(exportData, null, 2);

  return new NextResponse(jsonString, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="pomodiary-export.json"',
    },
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleRoute(req, exportHandler, "write");
}
