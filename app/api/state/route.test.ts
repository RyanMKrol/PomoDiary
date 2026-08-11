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
import { GET } from "./route";

describe("GET /api/state", () => {
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

    const req = new NextRequest("http://localhost/api/state");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 42 });

    const req = new NextRequest("http://localhost/api/state");
    const res = await GET(req);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
  });

  it("creates initial state + default settings on first touch", async () => {
    const req = new NextRequest("http://localhost/api/state");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("running");
    expect(body.draftBullets).toEqual([]);
    expect(body.phraseIdx).toBe(0);
    expect(body.settings).toEqual({
      sessionMinutes: 60,
      soundOn: true,
      chimeVolume: 0.8,
      pauseAfterLog: false,
    });
    expect(body.count).toBeUndefined();
  });

  it("includes the entry count within [todayStart, todayEnd)", async () => {
    const todayStart = Date.parse("2026-08-11T00:00:00Z");
    const todayEnd = Date.parse("2026-08-12T00:00:00Z");

    const req = new NextRequest(
      `http://localhost/api/state?todayStart=${todayStart}&todayEnd=${todayEnd}`,
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(0);
  });

  it("rejects a todayStart/todayEnd span greater than 48h", async () => {
    const todayStart = Date.parse("2026-08-11T00:00:00Z");
    const todayEnd = todayStart + 49 * 60 * 60 * 1000;

    const req = new NextRequest(
      `http://localhost/api/state?todayStart=${todayStart}&todayEnd=${todayEnd}`,
    );
    const res = await GET(req);

    expect(res.status).toBe(400);
  });
});
