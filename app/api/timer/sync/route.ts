import { NextRequest, NextResponse } from "next/server";

import { postTimerSyncHandler } from "@/lib/api/timer-sync";
import { handleRoute } from "@/lib/api/route-handler";

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleRoute(
    req,
    (userId) => postTimerSyncHandler(req, userId),
    "write",
  );
}
