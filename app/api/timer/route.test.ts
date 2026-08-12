import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "../../../lib/db/test-db";
import { listAllEntries } from "../../../lib/db/entries.store";
import { upsertTimerState } from "../../../lib/db/timer-state.store";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../../lib/ratelimit", () => ({
  checkRateLimit: vi.fn(),
  userKey: vi.fn((userId: string) => `user:${userId}`),
  ipKey: vi.fn((ip: string) => `ip:${ip}`),
}));

import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "../../../lib/ratelimit";
import { getDb } from "../../../lib/db";
import { POST } from "./route";

function postAction(action: unknown): NextRequest {
  return new NextRequest("http://localhost/api/timer", {
    method: "POST",
    body: JSON.stringify(action),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/timer", () => {
  let db: TestDb;
  const mockAuth = auth as unknown as {
    mockResolvedValue: (v: { userId: string | null }) => void;
  };
  const mockCheckRateLimit = checkRateLimit as unknown as {
    mockResolvedValue: (v: { ok: boolean; retryAfterSeconds?: number }) => void;
  };
  const mockGetDb = getDb as unknown as {
    mockReturnValue: (db: TestDb) => void;
  };

  beforeEach(async () => {
    db = await createTestDb();
    vi.clearAllMocks();
    mockGetDb.mockReturnValue(db);
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCheckRateLimit.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const res = await POST(postAction({ type: "ringNow" }));

    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 7 });

    const res = await POST(postAction({ type: "ringNow" }));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("7");
  });

  it("returns 400 for an invalid action body", async () => {
    const res = await POST(postAction({ type: "not-a-real-action" }));

    expect(res.status).toBe(400);
  });

  it("returns 400 for the removed pause action", async () => {
    const res = await POST(postAction({ type: "pause" }));

    expect(res.status).toBe(400);
  });

  it("runs a full ringNow -> acknowledge -> log cycle, inserting an entry and resetting drafts", async () => {
    const ring = await POST(postAction({ type: "ringNow" }));
    expect(ring.status).toBe(200);
    const ringBody = await ring.json();
    expect(ringBody.mode).toBe("chime");

    const ack = await POST(postAction({ type: "acknowledge" }));
    expect(ack.status).toBe(200);
    const ackBody = await ack.json();
    expect(ackBody.mode).toBe("recap");

    const log = await POST(
      postAction({
        type: "log",
        payload: {
          bullets: ["did the thing"],
          tag: "Deep work",
          feel: "Charged",
          intent: "yes",
        },
      }),
    );
    expect(log.status).toBe(200);
    const logBody = await log.json();

    expect(logBody.mode).toBe("running");
    expect(logBody.draftBullets).toEqual([]);
    expect(logBody.draftTag).toBeNull();

    const entries = await listAllEntries(db, "user_1");
    expect(entries).toHaveLength(1);
    expect(entries[0].bullets).toEqual(["did the thing"]);
    expect(entries[0].tag).toBe("Deep work");
  });

  it("acknowledges a naturally-elapsed block: a stored running state whose boundary has passed rolls to chime before dispatch, so acknowledge lands in recap", async () => {
    // Stored mode is still "running" but the block's wall-clock hour boundary
    // is long past — the handler must derive the elapsed chime before
    // dispatching, otherwise acknowledge NOOPs against the stale mode.
    const staleHourStart = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await upsertTimerState(db, "user_1", {
      mode: "running",
      hourStart: staleHourStart,
      draftBullets: [],
      phraseIdx: 0,
    });

    const res = await POST(postAction({ type: "acknowledge" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("recap");
  });
});
