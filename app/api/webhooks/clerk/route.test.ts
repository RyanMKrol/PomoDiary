import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { Webhook } from "svix";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { entries } from "../../../../lib/db/schema";
import { createTestDb, type TestDb } from "../../../../lib/db/test-db";

import { handleClerkWebhook } from "./route";

const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

function buildRequest(
  payload: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/clerk", {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json", ...headers },
  });
}

function signPayload(payload: string) {
  const wh = new Webhook(SECRET);
  const msgId = "msg_test_1";
  const timestamp = new Date();
  const signature = wh.sign(msgId, timestamp, payload);
  return {
    "svix-id": msgId,
    "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "svix-signature": signature,
  };
}

describe("POST /api/webhooks/clerk", () => {
  let db: TestDb;
  const originalSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    } else {
      process.env.CLERK_WEBHOOK_SIGNING_SECRET = originalSecret;
    }
  });

  it("returns 503 when the signing secret is unset", async () => {
    delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;

    const payload = JSON.stringify({
      type: "user.deleted",
      data: { id: "user_1" },
    });
    const res = await handleClerkWebhook(buildRequest(payload), db);

    expect(res.status).toBe(503);
  });

  it("returns 400 on a tampered payload", async () => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = SECRET;

    const payload = JSON.stringify({
      type: "user.deleted",
      data: { id: "user_1" },
    });
    const svixHeaders = signPayload(payload);

    const tamperedPayload = JSON.stringify({
      type: "user.deleted",
      data: { id: "someone_else" },
    });

    const res = await handleClerkWebhook(
      buildRequest(tamperedPayload, svixHeaders),
      db,
    );

    expect(res.status).toBe(400);
  });

  it("purges the user and returns 200 on a validly-signed user.deleted event", async () => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = SECRET;

    await db.insert(entries).values({
      userId: "user_1",
      from: new Date("2026-08-11T09:00:00Z"),
      to: new Date("2026-08-11T10:00:00Z"),
      tag: "Deep work",
      feel: "Charged",
      bullets: ["bye"],
    });

    const payload = JSON.stringify({
      type: "user.deleted",
      data: { id: "user_1" },
    });
    const svixHeaders = signPayload(payload);

    const res = await handleClerkWebhook(
      buildRequest(payload, svixHeaders),
      db,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.purged).toEqual({ entries: 1, timerState: 0, userSettings: 0 });

    const remaining = await db
      .select()
      .from(entries)
      .where(eq(entries.userId, "user_1"));
    expect(remaining).toHaveLength(0);
  });

  it("no-ops with 200 on other event types", async () => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = SECRET;

    const payload = JSON.stringify({
      type: "user.updated",
      data: { id: "user_1" },
    });
    const svixHeaders = signPayload(payload);

    const res = await handleClerkWebhook(
      buildRequest(payload, svixHeaders),
      db,
    );

    expect(res.status).toBe(200);
  });
});
