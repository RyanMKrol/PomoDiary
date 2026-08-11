import { NextRequest, NextResponse } from "next/server";

import { getEntriesHandler } from "../../../lib/api/entries";
import { handleRoute } from "../../../lib/api/route-handler";

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleRoute(req, (userId) => getEntriesHandler(req, userId), "read");
}
