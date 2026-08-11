import { NextRequest, NextResponse } from "next/server";

import { getStateHandler } from "../../../lib/api/state";
import { handleRoute } from "../../../lib/api/route-handler";

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleRoute(req, (userId) => getStateHandler(req, userId), "read");
}
