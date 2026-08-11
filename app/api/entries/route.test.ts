import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "../../../lib/db/test-db";
import { insertEntry } from "../../../lib/db/entries.store";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../../lib/ratelimit", () => ({
  checkRateLimit: vi.fn(),
  userKey: vi.fn((userId: string) => `user:${userId}`),
}));

import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "../../../lib/ratelimit";
import { getDb } from "../../../lib/db";
import { GET } from "./route";

describe("GET /api/entries", () => {
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

    const req = new NextRequest("http://localhost/api/entries?from=0&to=1000");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 42 });

    const req = new NextRequest("http://localhost/api/entries?from=0&to=1000");
    const res = await GET(req);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
  });

  it("returns 400 when 'from' parameter is missing but 'to' is given", async () => {
    const req = new NextRequest("http://localhost/api/entries?to=1000");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Provide both");
  });

  it("returns 400 when 'to' parameter is missing but 'from' is given", async () => {
    const req = new NextRequest("http://localhost/api/entries?from=0");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Provide both");
  });

  it("returns the user's full history when no range is given (grid view)", async () => {
    const req = new NextRequest("http://localhost/api/entries");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("returns 400 when 'from' is not a valid integer", async () => {
    const req = new NextRequest(
      "http://localhost/api/entries?from=abc&to=1000",
    );
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("valid integers");
  });

  it("returns 400 when 'to' is not a valid integer", async () => {
    const req = new NextRequest("http://localhost/api/entries?from=0&to=xyz");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("valid integers");
  });

  it("returns 400 when 'from' >= 'to'", async () => {
    const req = new NextRequest(
      "http://localhost/api/entries?from=1000&to=1000",
    );
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("less than");
  });

  it("returns 400 when span exceeds 31 days", async () => {
    const from = 0;
    const to = 32 * 24 * 60 * 60 * 1000;
    const req = new NextRequest(
      `http://localhost/api/entries?from=${from}&to=${to}`,
    );
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("31 days");
  });

  it("returns entries in [from, to) range with newest-first ordering", async () => {
    const from = new Date("2026-08-11T00:00:00Z");
    const mid = new Date("2026-08-11T12:00:00Z");
    const to = new Date("2026-08-12T00:00:00Z");

    await insertEntry(db, "user_1", {
      from,
      to: new Date(from.getTime() + 3600000),
      tag: "Work",
      feel: "Good",
      bullets: ["entry 1"],
    });

    await insertEntry(db, "user_1", {
      from: mid,
      to: new Date(mid.getTime() + 3600000),
      tag: "Work",
      feel: "Good",
      bullets: ["entry 2"],
    });

    const fromMs = from.getTime();
    const toMs = to.getTime();
    const req = new NextRequest(
      `http://localhost/api/entries?from=${fromMs}&to=${toMs}`,
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].bullets).toEqual(["entry 2"]);
    expect(body[1].bullets).toEqual(["entry 1"]);
  });

  it("excludes entries at 'to' boundary (exclusive)", async () => {
    const from = new Date("2026-08-11T00:00:00Z");
    const to = new Date("2026-08-12T00:00:00Z");
    const exactlyAtTo = new Date("2026-08-12T00:00:00Z");

    await insertEntry(db, "user_1", {
      from,
      to: new Date(from.getTime() + 3600000),
      tag: "Work",
      feel: "Good",
      bullets: ["entry at from"],
    });

    await insertEntry(db, "user_1", {
      from: exactlyAtTo,
      to: new Date(exactlyAtTo.getTime() + 3600000),
      tag: "Work",
      feel: "Good",
      bullets: ["entry at to"],
    });

    const fromMs = from.getTime();
    const toMs = to.getTime();
    const req = new NextRequest(
      `http://localhost/api/entries?from=${fromMs}&to=${toMs}`,
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].bullets).toEqual(["entry at from"]);
  });

  it("includes entries at 'from' boundary (inclusive)", async () => {
    const from = new Date("2026-08-11T00:00:00Z");
    const to = new Date("2026-08-12T00:00:00Z");

    await insertEntry(db, "user_1", {
      from,
      to: new Date(from.getTime() + 3600000),
      tag: "Work",
      feel: "Good",
      bullets: ["entry at from"],
    });

    const fromMs = from.getTime();
    const toMs = to.getTime();
    const req = new NextRequest(
      `http://localhost/api/entries?from=${fromMs}&to=${toMs}`,
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].bullets).toEqual(["entry at from"]);
  });

  it("returns empty array when no entries match", async () => {
    const req = new NextRequest("http://localhost/api/entries?from=0&to=1000");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("returns only the authenticated user's entries", async () => {
    const from = new Date("2026-08-11T00:00:00Z");

    await insertEntry(db, "user_1", {
      from,
      to: new Date(from.getTime() + 3600000),
      tag: "Work",
      feel: "Good",
      bullets: ["user_1 entry"],
    });

    await insertEntry(db, "user_2", {
      from,
      to: new Date(from.getTime() + 3600000),
      tag: "Work",
      feel: "Good",
      bullets: ["user_2 entry"],
    });

    const fromMs = new Date("2026-08-11T00:00:00Z").getTime();
    const toMs = new Date("2026-08-12T00:00:00Z").getTime();
    const req = new NextRequest(
      `http://localhost/api/entries?from=${fromMs}&to=${toMs}`,
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].userId).toBe("user_1");
  });
});
