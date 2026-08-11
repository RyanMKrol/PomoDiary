import { NextRequest, NextResponse } from "next/server";

import { postTimerHandler } from "../../../lib/api/timer";
import { handleRoute } from "../../../lib/api/route-handler";

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleRoute(req, (userId) => postTimerHandler(req, userId), "write");
}
