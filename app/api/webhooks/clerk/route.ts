import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";

import { getDb } from "../../../../lib/db";
import { purgeUser, type Db } from "../../../../lib/db/purge";

interface ClerkWebhookEvent {
  type: string;
  data: { id?: string };
}

/**
 * Exported separately from POST so tests can inject a PGlite test db and never
 * touch getDb() (which refuses to run under vitest).
 */
export async function handleClerkWebhook(
  req: NextRequest,
  db: Db,
): Promise<NextResponse> {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "webhook not configured" },
      { status: 503 },
    );
  }

  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: ClerkWebhookEvent;
  try {
    event = new Webhook(secret).verify(payload, headers) as ClerkWebhookEvent;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "user.deleted" && event.data.id) {
    const purged = await purgeUser(db, event.data.id);
    return NextResponse.json({ ok: true, purged }, { status: 200 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleClerkWebhook(req, getDb());
}
