import { NextRequest, NextResponse } from "next/server";

import {
  getSettingsHandler,
  patchSettingsHandler,
} from "../../../lib/api/settings";
import { handleRoute } from "../../../lib/api/route-handler";

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleRoute(req, (userId) => getSettingsHandler(userId), "read");
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  return handleRoute(
    req,
    (userId) => patchSettingsHandler(req, userId),
    "write",
  );
}
