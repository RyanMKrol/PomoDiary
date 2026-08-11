import { NextRequest, NextResponse } from "next/server";

import {
  patchEntryHandler,
  entryPatchParsedSchema,
} from "../../../../lib/api/entries";
import { handleRoute } from "../../../../lib/api/route-handler";
import { parseJsonBody } from "../../../../lib/api/route-handler";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return handleRoute(
    req,
    async (userId) => {
      const { id } = await params;
      const patch = await parseJsonBody(req, entryPatchParsedSchema);
      return patchEntryHandler(req, userId, id, patch);
    },
    "write",
  );
}
