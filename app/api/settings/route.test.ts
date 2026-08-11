import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "../../../lib/db/test-db";

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
import { GET, PATCH } from "./route";

function patchBody(patch: unknown): NextRequest {
  return new NextRequest("http://localhost/api/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
    headers: { "Content-Type": "application/json" },
  });
}

describe("/api/settings", () => {
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

  it("GET returns default settings when none exist", async () => {
    const res = await GET(new NextRequest("http://localhost/api/settings"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      sessionMinutes: 60,
      soundOn: true,
      chimeVolume: 0.8,
      pauseAfterLog: false,
    });
  });

  it("PATCH rejects an invalid body", async () => {
    const res = await PATCH(patchBody({ sessionMinutes: -5 }));

    expect(res.status).toBe(400);
  });

  it("PATCH round-trips a settings update", async () => {
    const patchRes = await PATCH(
      patchBody({ sessionMinutes: 45, pauseAfterLog: true }),
    );

    expect(patchRes.status).toBe(200);
    const patchBodyJson = await patchRes.json();
    expect(patchBodyJson.sessionMinutes).toBe(45);
    expect(patchBodyJson.pauseAfterLog).toBe(true);
    expect(patchBodyJson.soundOn).toBe(true);

    const getRes = await GET(new NextRequest("http://localhost/api/settings"));
    const getBodyJson = await getRes.json();
    expect(getBodyJson.sessionMinutes).toBe(45);
    expect(getBodyJson.pauseAfterLog).toBe(true);
  });
});
