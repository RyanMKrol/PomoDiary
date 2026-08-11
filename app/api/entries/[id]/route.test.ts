import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "../../../../lib/db/test-db";
import { CAPS } from "../../../../lib/db/entries.store";
import { entries } from "../../../../lib/db/schema";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../../lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../../../lib/ratelimit", () => ({
  checkRateLimit: vi.fn(),
  userKey: vi.fn((userId: string) => `user:${userId}`),
}));

import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "../../../../lib/ratelimit";
import { getDb } from "../../../../lib/db";
import { PATCH } from "./route";

describe("PATCH /api/entries/[id]", () => {
  let db: TestDb;
  let entryId: string;
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

    const from = new Date("2026-08-11T09:00:00Z");
    const to = new Date("2026-08-11T10:00:00Z");
    const createdEntries = await db
      .insert(entries)
      .values({
        userId: "user_1",
        from,
        to,
        tag: "Work",
        feel: "Good",
        bullets: ["original bullet"],
      })
      .returning();
    entryId = createdEntries[0]?.id || "test_id";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const req = new NextRequest("http://localhost/api/entries/test_id", {
      method: "PATCH",
      body: JSON.stringify({ bullets: ["new bullet"] }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: entryId }) });

    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 42 });

    const req = new NextRequest("http://localhost/api/entries/test_id", {
      method: "PATCH",
      body: JSON.stringify({ bullets: ["new bullet"] }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: entryId }) });

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
  });

  it("returns 400 when body is invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/entries/test_id", {
      method: "PATCH",
      body: "not json",
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: entryId }) });

    expect(res.status).toBe(400);
  });

  it("returns 400 when patch has no fields", async () => {
    const req = new NextRequest("http://localhost/api/entries/test_id", {
      method: "PATCH",
      body: JSON.stringify({}),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: entryId }) });

    expect(res.status).toBe(400);
  });

  it("returns 404 when entry does not exist", async () => {
    const nonexistentUuid = "00000000-0000-0000-0000-000000000000";
    const req = new NextRequest("http://localhost/api/entries/nonexistent", {
      method: "PATCH",
      body: JSON.stringify({ bullets: ["new bullet"] }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: nonexistentUuid }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 when entry belongs to another user", async () => {
    const from = new Date("2026-08-11T09:00:00Z");
    const to = new Date("2026-08-11T10:00:00Z");
    const otherUserEntries = await db
      .insert(entries)
      .values({
        userId: "user_2",
        from,
        to,
        tag: "Work",
        feel: "Good",
        bullets: ["user_2 bullet"],
      })
      .returning();
    const otherUserId = otherUserEntries[0]?.id || "other_id";

    const req = new NextRequest("http://localhost/api/entries/test_id", {
      method: "PATCH",
      body: JSON.stringify({ bullets: ["new bullet"] }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: otherUserId }),
    });

    expect(res.status).toBe(404);
  });

  it("patches bullets successfully", async () => {
    const newBullets = ["new bullet 1", "new bullet 2"];
    const req = new NextRequest("http://localhost/api/entries/test_id", {
      method: "PATCH",
      body: JSON.stringify({ bullets: newBullets }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: entryId }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bullets).toEqual(newBullets);
  });

  it("patches tag successfully", async () => {
    const req = new NextRequest("http://localhost/api/entries/test_id", {
      method: "PATCH",
      body: JSON.stringify({ tag: "Deep work" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: entryId }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tag).toBe("Deep work");
  });

  it("patches feel successfully", async () => {
    const req = new NextRequest("http://localhost/api/entries/test_id", {
      method: "PATCH",
      body: JSON.stringify({ feel: "Steady" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: entryId }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.feel).toBe("Steady");
  });

  it("patches intent successfully", async () => {
    const req = new NextRequest("http://localhost/api/entries/test_id", {
      method: "PATCH",
      body: JSON.stringify({ intent: "yes" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: entryId }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).toBe("yes");
  });

  it("patches multiple fields at once", async () => {
    const req = new NextRequest("http://localhost/api/entries/test_id", {
      method: "PATCH",
      body: JSON.stringify({
        bullets: ["updated"],
        tag: "Deep work",
        feel: "Charged",
      }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: entryId }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bullets).toEqual(["updated"]);
    expect(body.tag).toBe("Deep work");
    expect(body.feel).toBe("Charged");
  });

  it("returns 422 when bullet count exceeds limit", async () => {
    const tooManyBullets = Array(CAPS.BULLETS_PER_ENTRY + 1).fill("bullet");
    const req = new NextRequest("http://localhost/api/entries/test_id", {
      method: "PATCH",
      body: JSON.stringify({ bullets: tooManyBullets }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: entryId }) });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("cannot have more than");
  });

  it("returns 422 when bullet exceeds char limit", async () => {
    const tooLongBullet = "x".repeat(CAPS.CHARS_PER_BULLET + 1);
    const req = new NextRequest("http://localhost/api/entries/test_id", {
      method: "PATCH",
      body: JSON.stringify({ bullets: [tooLongBullet] }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: entryId }) });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("cannot exceed");
  });

  it("preserves unpatched fields", async () => {
    const req = new NextRequest("http://localhost/api/entries/test_id", {
      method: "PATCH",
      body: JSON.stringify({ tag: "Admin" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: entryId }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tag).toBe("Admin");
    expect(body.bullets).toEqual(["original bullet"]);
    expect(body.feel).toBe("Good");
  });
});
