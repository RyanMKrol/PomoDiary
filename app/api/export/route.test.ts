import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { entries } from "../../../lib/db/schema";
import { createTestDb, type TestDb } from "../../../lib/db/test-db";
import { listAllEntries } from "../../../lib/db/entries.store";
import { getSettings } from "../../../lib/db/timer-state.store";

// Mock Clerk auth - must be before importing the route
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

// Mock the database getter
vi.mock("../../../lib/db", () => ({
  getDb: vi.fn(),
}));

// Mock rate limit
vi.mock("../../../lib/ratelimit", () => ({
  checkRateLimit: vi.fn(),
  userKey: vi.fn((userId: string) => `user:${userId}`),
  ipKey: vi.fn((ip: string) => `ip:${ip}`),
}));

// Import after mocks are set up
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "../../../lib/ratelimit";
import { getDb } from "../../../lib/db";
import { GET } from "./route";

describe("GET /api/export", () => {
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const req = new NextRequest("http://localhost/api/export", {
      method: "GET",
    });

    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCheckRateLimit.mockResolvedValue({
      ok: false,
      retryAfterSeconds: 60,
    });

    const req = new NextRequest("http://localhost/api/export", {
      method: "GET",
    });

    const res = await GET(req);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Rate limit exceeded");
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("exports user's entries in chronological order (oldest first)", async () => {
    const userId = "user_1";

    await db.insert(entries).values({
      userId,
      from: new Date("2026-08-11T15:00:00Z"),
      to: new Date("2026-08-11T16:00:00Z"),
      tag: "Meeting",
      feel: "Focused",
      bullets: ["Discussed Q3 goals"],
    });

    await db.insert(entries).values({
      userId,
      from: new Date("2026-08-11T14:00:00Z"),
      to: new Date("2026-08-11T15:00:00Z"),
      tag: "Deep Work",
      feel: "Charged",
      bullets: ["Implemented feature X"],
    });

    await db.insert(entries).values({
      userId,
      from: new Date("2026-08-11T13:00:00Z"),
      to: new Date("2026-08-11T14:00:00Z"),
      tag: "Admin",
      feel: "Neutral",
      bullets: ["Email", "Slack"],
    });

    const allEntries = await listAllEntries(db, userId);

    expect(allEntries).toHaveLength(3);
    expect(allEntries[0].from).toEqual(new Date("2026-08-11T13:00:00Z"));
    expect(allEntries[1].from).toEqual(new Date("2026-08-11T14:00:00Z"));
    expect(allEntries[2].from).toEqual(new Date("2026-08-11T15:00:00Z"));
  });

  it("exports only user's own entries, not another user's", async () => {
    const user1 = "user_1";
    const user2 = "user_2";

    await db.insert(entries).values([
      {
        userId: user1,
        from: new Date("2026-08-11T14:00:00Z"),
        to: new Date("2026-08-11T15:00:00Z"),
        tag: "Work",
        feel: "Good",
        bullets: ["User 1 entry"],
      },
      {
        userId: user2,
        from: new Date("2026-08-11T14:00:00Z"),
        to: new Date("2026-08-11T15:00:00Z"),
        tag: "Work",
        feel: "Good",
        bullets: ["User 2 entry"],
      },
    ]);

    const user1Entries = await listAllEntries(db, user1);
    const user2Entries = await listAllEntries(db, user2);

    expect(user1Entries).toHaveLength(1);
    expect(user1Entries[0].bullets).toEqual(["User 1 entry"]);

    expect(user2Entries).toHaveLength(1);
    expect(user2Entries[0].bullets).toEqual(["User 2 entry"]);
  });

  it("includes user settings in the export", async () => {
    const userId = "user_1";

    const settings = await getSettings(db, userId);

    expect(settings).toBeDefined();
    expect(settings).toHaveProperty("sessionMinutes");
    expect(settings).toHaveProperty("soundOn");
    expect(settings).toHaveProperty("chimeVolume");
    expect(settings).toHaveProperty("pauseAfterLog");
  });

  it("returns JSON with correct content-disposition header", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCheckRateLimit.mockResolvedValue({ ok: true });

    const user1 = "user_1";

    await db.insert(entries).values({
      userId: user1,
      from: new Date("2026-08-11T14:00:00Z"),
      to: new Date("2026-08-11T15:00:00Z"),
      tag: "Work",
      feel: "Good",
      bullets: ["Test entry"],
    });

    const req = new NextRequest("http://localhost/api/export", {
      method: "GET",
    });

    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Content-Disposition")).toContain(
      'attachment; filename="pomodiary-export.json"',
    );

    const body = await res.json();
    expect(body).toHaveProperty("exportedAt");
    expect(body).toHaveProperty("userId", user1);
    expect(body).toHaveProperty("settings");
    expect(body).toHaveProperty("entries");
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].bullets).toEqual(["Test entry"]);
  });
});
