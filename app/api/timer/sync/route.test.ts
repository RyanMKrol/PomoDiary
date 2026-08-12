import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "../../../../lib/db/test-db";
import { listAllEntries } from "../../../../lib/db/entries.store";
import { upsertTimerState } from "../../../../lib/db/timer-state.store";
import { getLastBatchId } from "../../../../lib/db/sync.store";
import {
  clampAt,
  replayActions,
  MAX_FUTURE_SKEW_MS,
} from "../../../../lib/api/timer-sync";
import {
  blockEndFor,
  initialState,
  HOUR_MS,
} from "../../../../lib/timer/engine";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../../lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../../../lib/ratelimit", () => ({
  checkRateLimit: vi.fn(),
  userKey: vi.fn((userId: string) => `user:${userId}`),
  ipKey: vi.fn((ip: string) => `ip:${ip}`),
}));

import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "../../../../lib/ratelimit";
import { getDb } from "../../../../lib/db";
import { POST } from "./route";

const SETTINGS = { pauseAfterLog: false };

// An exact epoch-hour boundary, so blocks in fixtures are whole hours.
const T0H = 1_699_999_200_000;

let uuidCounter = 0;
function uuid(): string {
  uuidCounter += 1;
  return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, "0")}`;
}

function record(action: unknown, at: number) {
  return { id: uuid(), at, action };
}

function postSync(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/timer/sync", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const LOG_PAYLOAD = {
  bullets: ["did the thing"],
  tag: "Admin",
  feel: "Steady",
  intent: "yes",
};

describe("clampAt", () => {
  it("clamps timestamps beyond the future skew allowance to serverNow", () => {
    const serverNow = T0H;
    expect(clampAt(serverNow + MAX_FUTURE_SKEW_MS + 1, 0, serverNow)).toBe(
      serverNow,
    );
  });

  it("accepts small future skew and the arbitrarily old past", () => {
    const serverNow = T0H;
    expect(clampAt(serverNow + 1000, 0, serverNow)).toBe(serverNow + 1000);
    expect(clampAt(serverNow - 30 * 24 * HOUR_MS, 0, serverNow)).toBe(
      serverNow - 30 * 24 * HOUR_MS,
    );
  });

  it("never rewinds time within a batch", () => {
    const serverNow = T0H;
    expect(clampAt(serverNow - 5000, serverNow - 1000, serverNow)).toBe(
      serverNow - 1000,
    );
  });
});

describe("replayActions", () => {
  it("applies each record at its own timestamp, not arrival time", () => {
    const state = initialState(T0H);
    const serverNow = T0H + 5 * HOUR_MS; // flush arrives much later

    // ringNow twenty minutes in, then log ten minutes after that.
    const { state: next, entries } = replayActions(
      state,
      SETTINGS,
      [
        record({ type: "ringNow" }, T0H + 20 * 60 * 1000),
        record({ type: "log", payload: LOG_PAYLOAD }, T0H + 30 * 60 * 1000),
      ] as never,
      serverNow,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].from).toBe(T0H);
    expect(entries[0].to).toBe(T0H + 20 * 60 * 1000);
    // The next block snaps to the :00 bucket enclosing the log's client
    // time (not flush time), and the 30-minute stretch before the log is
    // accounted inside the bucket as a seeded draft bullet.
    expect(next.hourStart).toBe(T0H);
    expect(next.draftBullets).toEqual(["(first 30 min unaccounted)"]);
  });

  it("derives the lazy chime before dispatch, so acknowledge+log after an elapsed block land", () => {
    const state = initialState(T0H); // block ends T0H + 1h
    const ackAt = T0H + HOUR_MS + 60_000;

    const { state: next, entries } = replayActions(
      state,
      SETTINGS,
      [
        record({ type: "acknowledge" }, ackAt),
        record({ type: "log", payload: LOG_PAYLOAD }, ackAt + 1000),
      ] as never,
      ackAt + 5000,
    );

    expect(entries).toHaveLength(1);
    // The entry spans the elapsed block exactly.
    expect(entries[0].from).toBe(T0H);
    expect(entries[0].to).toBe(blockEndFor(T0H));
    expect(next.mode).toBe("running");
  });

  it("is NOT engine-level idempotent — the protocol must never double-replay (documented hazard)", () => {
    // Replaying [ringNow, acknowledge, log] on the post-apply state produces
    // a SECOND entry: the cycle ends back in "running", so ringNow's guard
    // passes again. Exactly-once therefore lives in the protocol — the
    // lastBatchId dedupe (route test below) plus the client rule that a
    // recovered in-flight batch is flushed and rebased on the response, not
    // replayed locally over fetched state. If this test ever starts failing
    // because the engine became replay-idempotent, the client shortcut can
    // be revisited.
    const state = initialState(T0H);
    const records = [
      record({ type: "ringNow" }, T0H + 10 * 60 * 1000),
      record({ type: "acknowledge" }, T0H + 11 * 60 * 1000),
      record({ type: "log", payload: LOG_PAYLOAD }, T0H + 12 * 60 * 1000),
    ] as never[];
    const serverNow = T0H + 20 * 60 * 1000;

    const first = replayActions(state, SETTINGS, records as never, serverNow);
    const second = replayActions(
      first.state,
      SETTINGS,
      records as never,
      serverNow,
    );

    expect(first.entries).toHaveLength(1);
    expect(second.entries).toHaveLength(1);
  });

  it("collects custom away labels that actually entered away mode", () => {
    const state = initialState(T0H);
    const { customAwayLabels } = replayActions(
      state,
      SETTINGS,
      [
        record(
          { type: "awayStart", kind: "custom", label: "Travelling" },
          T0H + 1000,
        ),
        // A second custom start while already away NOOPs; its label must
        // not be collected.
        record(
          { type: "awayStart", kind: "custom", label: "Ignored" },
          T0H + 2000,
        ),
      ] as never,
      T0H + 5000,
    );
    expect(customAwayLabels).toEqual(["Travelling"]);
  });
});

describe("POST /api/timer/sync", () => {
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

  async function seedRunning(hourStart: number): Promise<void> {
    await upsertTimerState(db, "user_1", {
      mode: "running",
      hourStart: new Date(hourStart),
      draftBullets: [],
      phraseIdx: 0,
    });
  }

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(
      postSync({
        batchId: uuid(),
        actions: [record({ type: "ringNow" }, Date.now())],
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid body (empty actions)", async () => {
    const res = await POST(postSync({ batchId: uuid(), actions: [] }));
    expect(res.status).toBe(400);
  });

  it("applies a batch and reports applied: true with the new state", async () => {
    const start = Date.now() - 10 * 60 * 1000;
    await seedRunning(start);

    // Timestamps sit seconds before "now" so the block the log starts
    // cannot itself have crossed a wall-clock :00 by response time (the
    // response derives at now; a stale fixed offset made this flake near
    // the top of the hour).
    const nowish = Date.now();
    const res = await POST(
      postSync({
        batchId: uuid(),
        actions: [
          record({ type: "ringNow" }, nowish - 3_000),
          record({ type: "acknowledge" }, nowish - 2_500),
          record({ type: "log", payload: LOG_PAYLOAD }, nowish - 2_000),
        ],
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applied).toBe(true);
    expect(body.state.mode).toBe("running");
    expect(body.state.userKey).toBe("user_1");
    expect(typeof body.state.serverNow).toBe("number");

    const rows = await listAllEntries(db, "user_1");
    expect(rows).toHaveLength(1);
    expect(rows[0].tag).toBe("Admin");
  });

  it("skips a duplicate batchId: applied false, no new entries, state unchanged", async () => {
    const start = Date.now() - 10 * 60 * 1000;
    await seedRunning(start);
    const batchId = uuid();
    const nowish = Date.now();
    const body = {
      batchId,
      actions: [
        record({ type: "ringNow" }, nowish - 3_000),
        record({ type: "log", payload: LOG_PAYLOAD }, nowish - 2_000),
      ],
    };

    const first = await POST(postSync(body));
    expect((await first.json()).applied).toBe(true);
    expect(await listAllEntries(db, "user_1")).toHaveLength(1);

    const second = await POST(postSync(body));
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.applied).toBe(false);
    expect(await listAllEntries(db, "user_1")).toHaveLength(1);
    expect(await getLastBatchId(db, "user_1")).toBe(batchId);
  });

  it("includes a fresh count when todayStart/todayEnd are sent", async () => {
    const start = Date.now() - 10 * 60 * 1000;
    await seedRunning(start);
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const nowish = Date.now();
    const res = await POST(
      postSync({
        batchId: uuid(),
        actions: [
          record({ type: "ringNow" }, nowish - 3_000),
          record({ type: "log", payload: LOG_PAYLOAD }, nowish - 2_000),
        ],
        todayStart: dayStart.getTime(),
        todayEnd: dayStart.getTime() + 24 * HOUR_MS,
      }),
    );

    const body = await res.json();
    expect(body.state.count).toBe(1);
  });

  it("returns 422 on a cap violation and leaves lastBatchId unset (batch not applied)", async () => {
    const start = Date.now() - 10 * 60 * 1000;
    await seedRunning(start);
    const tooManyBullets = Array.from({ length: 31 }, (_, i) => `b${i}`);

    const res = await POST(
      postSync({
        batchId: uuid(),
        actions: [
          record({ type: "ringNow" }, start + 60_000),
          record(
            {
              type: "log",
              payload: { ...LOG_PAYLOAD, bullets: tooManyBullets },
            },
            start + 62_000,
          ),
        ],
      }),
    );

    // bulletsSchema already caps at 30 in validation, producing a 400 —
    // either failure code means "not applied"; assert the invariant that
    // matters: nothing was written.
    expect([400, 422]).toContain(res.status);
    expect(await listAllEntries(db, "user_1")).toHaveLength(0);
    expect(await getLastBatchId(db, "user_1")).toBeNull();
  });

  it("updates recent away labels for a custom awayStart in the batch", async () => {
    const start = Date.now() - 10 * 60 * 1000;
    await seedRunning(start);

    const res = await POST(
      postSync({
        batchId: uuid(),
        actions: [
          record(
            { type: "awayStart", kind: "custom", label: "Travelling" },
            start + 60_000,
          ),
        ],
      }),
    );

    const body = await res.json();
    expect(body.applied).toBe(true);
    expect(body.state.awayKind).toBe("custom");
    expect(body.state.awayLabel).toBe("Travelling");
    expect(body.state.settings.recentAwayLabels[0]).toBe("Travelling");
  });

  it("creates initial state for a brand-new user and applies the batch", async () => {
    const res = await POST(
      postSync({
        batchId: uuid(),
        actions: [
          record(
            { type: "draftUpdate", patch: { bullets: ["first note"] } },
            Date.now(),
          ),
        ],
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applied).toBe(true);
    expect(body.state.draftBullets).toEqual(["first note"]);
  });
});
