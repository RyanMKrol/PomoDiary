// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deriveNow,
  dispatch,
  initialState,
  type EntryToInsert,
  type TimerState as EngineTimerState,
} from "../timer/engine";
import {
  buildStatePayload,
  toEngineSettings,
  type ApiSettings,
  type StatePayload,
} from "../api/timer-state";
import { walKey, type WalRecord } from "./wal";
import {
  createTimerClient,
  payloadToEngineState,
  todayBoundsFor,
} from "./useTimer";

const HOUR = 3600000;
const MIN = 60_000;
// An exact epoch-hour boundary (472222 * HOUR), so a block started at T0
// runs a full hour to the next wall-clock :00.
const T0 = 472222 * HOUR;
const USER = "test-user";

const SETTINGS: ApiSettings = {
  soundOn: true,
  chimeVolume: 0.8,
  pauseAfterLog: false,
  recentAwayLabels: [],
};

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    headers: new Headers(),
    json: async () => ({}),
    text: async () => "boom",
  } as unknown as Response;
}

interface SyncRequestBody {
  batchId: string;
  actions: WalRecord[];
  todayStart: number;
  todayEnd: number;
}

/**
 * A tiny in-memory stand-in for the real /api/state + /api/timer/sync
 * routes, modelled on the flow-check fixture: it holds an engine state and
 * replays sync batches through the REAL engine (deriveNow at rec.at, then
 * dispatch at rec.at), dedupes by batchId, and answers with the same
 * StatePayload shape the server builds — so the client tests exercise the
 * true optimistic/rebase rules without a server.
 */
function createFakeSyncServer(
  initial: EngineTimerState,
  opts: { settings?: ApiSettings; entries?: EntryToInsert[] } = {},
) {
  let state = initial;
  const settings = opts.settings ?? { ...SETTINGS };
  const entries: EntryToInsert[] = [...(opts.entries ?? [])];
  let lastBatchId: string | null = null;

  /** Every POSTed body, including ones answered with an error. */
  const syncRequests: SyncRequestBody[] = [];

  let failNextStateGet = false;
  let failSyncTimes = 0;
  let failSyncStatus = 500;
  let holdNextSync = false;
  let releaseHeld: (() => void) | null = null;

  function countFor(todayStart: number, todayEnd: number): number {
    return entries.filter((e) => e.from >= todayStart && e.from < todayEnd)
      .length;
  }

  function payload(todayStart: number, todayEnd: number): StatePayload {
    return buildStatePayload(
      state,
      settings,
      Date.now(),
      USER,
      countFor(todayStart, todayEnd),
    );
  }

  function handleSync(body: SyncRequestBody): Response {
    if (lastBatchId !== null && lastBatchId === body.batchId) {
      return jsonResponse({
        applied: false,
        state: payload(body.todayStart, body.todayEnd),
      });
    }
    for (const rec of body.actions) {
      state = deriveNow(state, rec.at).state;
      const result = dispatch(
        state,
        toEngineSettings(settings),
        rec.action,
        rec.at,
      );
      state = result.state;
      entries.push(...result.entriesToInsert);
    }
    lastBatchId = body.batchId;
    return jsonResponse({
      applied: true,
      state: payload(body.todayStart, body.todayEnd),
    });
  }

  const fetchImpl = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input), "http://localhost");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/state" && method === "GET") {
        if (failNextStateGet) {
          failNextStateGet = false;
          return errorResponse(500);
        }
        const todayStart = Number(url.searchParams.get("todayStart"));
        const todayEnd = Number(url.searchParams.get("todayEnd"));
        return jsonResponse(payload(todayStart, todayEnd));
      }

      if (url.pathname === "/api/timer/sync" && method === "POST") {
        const body = JSON.parse(init?.body as string) as SyncRequestBody;
        syncRequests.push(body);
        if (failSyncTimes > 0) {
          failSyncTimes -= 1;
          return errorResponse(failSyncStatus);
        }
        const res = handleSync(body);
        if (holdNextSync) {
          holdNextSync = false;
          return new Promise<Response>((resolve) => {
            releaseHeld = () => resolve(res);
          });
        }
        return res;
      }

      throw new Error(`unexpected fetch: ${url.pathname} ${method}`);
    },
  );

  return {
    fetchImpl,
    syncRequests,
    getServerState: () => state,
    getEntries: () => entries,
    failNextStateGet: () => {
      failNextStateGet = true;
    },
    failSync: (times: number, status = 500) => {
      failSyncTimes = times;
      failSyncStatus = status;
    },
    holdNextSyncResponse: () => {
      holdNextSync = true;
    },
    releaseHeldResponse: () => {
      releaseHeld?.();
      releaseHeld = null;
    },
  };
}

type FakeServer = ReturnType<typeof createFakeSyncServer>;

function totalFetches(server: FakeServer): number {
  return server.fetchImpl.mock.calls.length;
}

function syncPosts(server: FakeServer): number {
  return server.fetchImpl.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === "POST",
  ).length;
}

/** Runs due timers (including freshly scheduled 0ms ones) plus microtasks. */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

/** Flushes microtasks WITHOUT running any timers — lets a test observe the
 *  published state after the initial GET but before the flusher's 0ms
 *  flushNow timer fires. */
async function microtasks(turns = 20): Promise<void> {
  for (let i = 0; i < turns; i++) await Promise.resolve();
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("todayBoundsFor", () => {
  it("returns local midnight to midnight, 24h apart", () => {
    const { todayStart, todayEnd } = todayBoundsFor(T0);
    expect(todayEnd - todayStart).toBe(24 * 60 * 60 * 1000);
    expect(new Date(todayStart).getHours()).toBe(0);
    expect(todayStart).toBeLessThanOrEqual(T0);
    expect(todayEnd).toBeGreaterThan(T0);
  });
});

describe("payloadToEngineState", () => {
  it("copies every raw engine field from the payload verbatim", () => {
    const away = dispatch(
      initialState(T0),
      toEngineSettings(SETTINGS),
      { type: "awayStart", kind: "custom", label: "Travelling" },
      T0 + MIN,
    ).state;
    const payload = buildStatePayload(away, SETTINGS, T0 + 2 * MIN, USER);

    const engine = payloadToEngineState(payload);

    expect(engine.mode).toBe("away");
    expect(engine.hourStart).toBe(T0);
    expect(engine.awayKind).toBe("custom");
    expect(engine.awaySince).toBe(T0 + MIN);
    expect(engine.awayLabel).toBe("Travelling");
    expect(engine.draftBullets).toEqual([]);
    expect(engine.phraseIdx).toBe(0);
  });
});

describe("createTimerClient", () => {
  it("start() fetches state once and publishes a ClientState mirroring the payload", async () => {
    const seeded = dispatch(
      initialState(T0),
      toEngineSettings(SETTINGS),
      { type: "draftUpdate", patch: { bullets: ["seeded bullet"] } },
      T0,
    ).state;
    const server = createFakeSyncServer(seeded, {
      entries: [
        {
          from: T0,
          to: T0 + HOUR,
          tag: "Deep work",
          feel: "—",
          intent: null,
          bullets: ["earlier hour"],
        },
      ],
    });
    const client = createTimerClient(server.fetchImpl);

    expect(client.isLoading()).toBe(true);
    client.start();
    await settle();

    const state = client.getState();
    expect(client.isLoading()).toBe(false);
    expect(state?.mode).toBe("running");
    expect(state?.hourStart).toBe(T0);
    expect(state?.blockEnd).toBe(T0 + HOUR);
    expect(state?.remainingSeconds).toBe(3600);
    expect(state?.draftBullets).toEqual(["seeded bullet"]);
    expect(state?.settings).toEqual(SETTINGS);
    expect(state?.hoursToday).toBe(1); // from payload.count
    expect(state?.entriesVersion).toBe(0);

    // Exactly one GET /api/state; the idle flusher never fetches.
    expect(totalFetches(server)).toBe(1);
    const [url, init] = server.fetchImpl.mock.calls[0];
    expect(String(url)).toMatch(/^\/api\/state\?todayStart=\d+&todayEnd=\d+$/);
    expect(init?.method ?? "GET").toBe("GET");

    await vi.advanceTimersByTimeAsync(10_000);
    expect(totalFetches(server)).toBe(1);
    client.stop();
  });

  it("retries the initial state fetch on a 3s cadence after a failure", async () => {
    const server = createFakeSyncServer(initialState(T0));
    server.failNextStateGet();
    const client = createTimerClient(server.fetchImpl);

    client.start();
    await settle();
    expect(client.getState()).toBeNull();
    expect(client.isLoading()).toBe(true);
    expect(totalFetches(server)).toBe(1);

    await vi.advanceTimersByTimeAsync(3000);
    expect(totalFetches(server)).toBe(2);
    expect(client.getState()?.mode).toBe("running");
    client.stop();
  });

  it("applies actions locally with zero fetches, then flushes ONE batch on the 3s cadence", async () => {
    const server = createFakeSyncServer(initialState(T0));
    const client = createTimerClient(server.fetchImpl);
    client.start();
    await settle();
    expect(totalFetches(server)).toBe(1);

    await vi.advanceTimersByTimeAsync(20 * MIN);
    await client.ringNow();

    // Synchronous local flip — and NO new fetch at dispatch time.
    expect(client.getState()?.mode).toBe("chime");
    expect(client.getState()?.chimeFrom).toBe(T0);
    expect(client.getState()?.chimeTo).toBe(T0 + 20 * MIN);
    expect(totalFetches(server)).toBe(1);

    await vi.advanceTimersByTimeAsync(3500);

    expect(syncPosts(server)).toBe(1);
    const body = server.syncRequests[0];
    expect(body.batchId).toMatch(/[0-9a-f-]{36}/);
    expect(body.actions).toHaveLength(1);
    expect(body.actions[0].action).toEqual({ type: "ringNow" });
    expect(typeof body.todayStart).toBe("number");
    expect(typeof body.todayEnd).toBe("number");
    expect(server.getServerState().mode).toBe("chime");
    client.stop();
  });

  it("shows every keystroke instantly and consolidates them into fewer flushed records", async () => {
    const server = createFakeSyncServer(initialState(T0));
    const client = createTimerClient(server.fetchImpl);
    client.start();
    await settle();

    const keystrokes = [["h"], ["he"], ["hel"], ["hello"]];
    for (const bullets of keystrokes) {
      client.updateDraft({ bullets });
      expect(client.getState()?.draftBullets).toEqual(bullets);
    }
    client.updateDraft({ tag: "Admin" });
    expect(client.getState()?.draftTag).toBe("Admin");

    // Still nothing on the wire.
    expect(totalFetches(server)).toBe(1);

    await vi.advanceTimersByTimeAsync(3500);

    expect(syncPosts(server)).toBe(1);
    const body = server.syncRequests[0];
    expect(body.actions.length).toBeLessThan(keystrokes.length + 1);
    expect(server.getServerState().draftBullets).toEqual(["hello"]);
    expect(server.getServerState().draftTag).toBe("Admin");
    client.stop();
  });

  it("log() flushes immediately, bumps entriesVersion on ack, and corrects hoursToday from count", async () => {
    const server = createFakeSyncServer(initialState(T0));
    const client = createTimerClient(server.fetchImpl);
    client.start();
    await settle();
    expect(client.getState()?.hoursToday).toBe(0);

    await vi.advanceTimersByTimeAsync(10 * MIN);
    await client.ringNow();
    await client.acknowledge();
    expect(client.getState()?.mode).toBe("recap");

    await client.log({
      bullets: ["wrote the tests"],
      tag: "Deep work",
      feel: "Steady",
      intent: "yes",
    });

    // Optimistic, before any ack: the entry counted locally.
    expect(client.getState()?.mode).toBe("running");
    expect(client.getState()?.hoursToday).toBe(1);
    expect(client.getState()?.entriesVersion).toBe(0);
    expect(syncPosts(server)).toBe(0);

    // flushNow: the POST fires at +0ms, no 3s wait.
    await settle();
    expect(syncPosts(server)).toBe(1);
    expect(server.getEntries()).toHaveLength(1);
    expect(server.getEntries()[0].bullets).toEqual(["wrote the tests"]);
    expect(client.getState()?.entriesVersion).toBe(1);
    expect(client.getState()?.hoursToday).toBe(1); // payload.count
    client.stop();
  });

  it("never clobbers keystrokes typed while a flush is in flight (rebase)", async () => {
    const server = createFakeSyncServer(initialState(T0));
    const client = createTimerClient(server.fetchImpl);
    client.start();
    await settle();

    client.updateDraft({ bullets: ["first thought"] });
    server.holdNextSyncResponse();
    await vi.advanceTimersByTimeAsync(3000);
    expect(syncPosts(server)).toBe(1); // in flight, response held

    // Keep typing while the flush hangs.
    client.updateDraft({ bullets: ["first thought", "typed in flight"] });
    expect(client.getState()?.draftBullets).toEqual([
      "first thought",
      "typed in flight",
    ]);

    // The held response carries the OLD draft ("first thought" only). On ack
    // the client must rebase the newer keystrokes on top, not adopt it raw.
    server.releaseHeldResponse();
    await settle();
    expect(client.getState()?.draftBullets).toEqual([
      "first thought",
      "typed in flight",
    ]);

    // And the next cadence flush persists the newer keystrokes.
    await vi.advanceTimersByTimeAsync(3500);
    expect(server.getServerState().draftBullets).toEqual([
      "first thought",
      "typed in flight",
    ]);
    expect(server.syncRequests[1].batchId).not.toBe(
      server.syncRequests[0].batchId,
    );
    client.stop();
  });

  it("retries the SAME batchId after a 5xx and loses no user-visible state", async () => {
    const server = createFakeSyncServer(initialState(T0));
    const client = createTimerClient(server.fetchImpl);
    client.start();
    await settle();

    await vi.advanceTimersByTimeAsync(5 * MIN);
    await client.ringNow();
    expect(client.getState()?.mode).toBe("chime");

    server.failSync(1, 500);
    await vi.advanceTimersByTimeAsync(3000);
    expect(server.syncRequests).toHaveLength(1);
    // The failed flush left the optimistic state untouched.
    expect(client.getState()?.mode).toBe("chime");
    expect(client.getState()?.chimeTo).toBe(T0 + 5 * MIN);

    // Retry after backoff: identical batchId, identical records.
    await vi.advanceTimersByTimeAsync(3000);
    expect(server.syncRequests).toHaveLength(2);
    expect(server.syncRequests[1].batchId).toBe(server.syncRequests[0].batchId);
    expect(server.syncRequests[1].actions).toEqual(
      server.syncRequests[0].actions,
    );

    // Acked and rebased: still chiming over the same range, server agrees.
    expect(client.getState()?.mode).toBe("chime");
    expect(client.getState()?.chimeFrom).toBe(T0);
    expect(client.getState()?.chimeTo).toBe(T0 + 5 * MIN);
    expect(server.getServerState().mode).toBe("chime");
    client.stop();
  });

  it("replays unflushed WAL records over the fetched payload after a reload", async () => {
    const server = createFakeSyncServer(initialState(T0));

    // Client A types a draft and dies before its flusher ever runs.
    const a = createTimerClient(server.fetchImpl);
    a.start();
    await settle();
    a.updateDraft({ bullets: ["survives reload"] });
    a.stop();

    const persisted = JSON.parse(localStorage.getItem(walKey(USER))!);
    expect(persisted.inFlight).toBeNull(); // plain records, nothing frozen
    expect(persisted.records).toHaveLength(1);
    expect(syncPosts(server)).toBe(0);

    // Client B: fresh tab, same localStorage, same server (no draft on it).
    const b = createTimerClient(server.fetchImpl);
    b.start();
    await settle();
    expect(b.getState()?.draftBullets).toEqual(["survives reload"]);

    // And a flush persists it.
    await vi.advanceTimersByTimeAsync(3500);
    expect(server.getServerState().draftBullets).toEqual(["survives reload"]);
    const drained = JSON.parse(localStorage.getItem(walKey(USER))!);
    expect(drained.inFlight).toBeNull();
    expect(drained.records).toHaveLength(0);
    b.stop();
  });

  it("does NOT replay a recovered in-flight batch locally; the flusher retry resolves it", async () => {
    const ringAt = T0 + 5 * MIN;
    // A tab died mid-flush: the frozen batch sits in localStorage and we
    // cannot know whether the server saw it.
    localStorage.setItem(
      walKey(USER),
      JSON.stringify({
        v: 1,
        inFlight: {
          batchId: "recovered-batch-1",
          records: [
            { id: "r1", at: ringAt, action: { type: "ringNow" } },
          ] satisfies WalRecord[],
        },
        records: [],
      }),
    );
    vi.setSystemTime(ringAt + MIN);

    const server = createFakeSyncServer(initialState(T0));
    const client = createTimerClient(server.fetchImpl);
    client.start();

    // After the GET but before the flusher's retry: plain server state,
    // WITHOUT the in-flight ringNow's effect.
    await microtasks();
    expect(client.getState()?.mode).toBe("running");

    // The flusher re-sends the frozen batch verbatim; the ack rebases.
    await settle();
    expect(server.syncRequests[0].batchId).toBe("recovered-batch-1");
    expect(client.getState()?.mode).toBe("chime");
    expect(client.getState()?.chimeFrom).toBe(T0);
    expect(client.getState()?.chimeTo).toBe(ringAt);
    client.stop();
  });

  it("chimes locally at the block boundary with no fetch at all", async () => {
    vi.setSystemTime(T0 + HOUR - 2000);
    const server = createFakeSyncServer(initialState(T0));
    const client = createTimerClient(server.fetchImpl);

    let chimeCount = 0;
    client.onChime(() => {
      chimeCount += 1;
    });

    client.start();
    await settle();
    expect(client.getState()?.mode).toBe("running");
    expect(client.getState()?.remainingSeconds).toBe(2);
    expect(totalFetches(server)).toBe(1);

    // Cross the wall-clock boundary: the flip is pure local derivation —
    // the old client refetched here; the new one must not.
    await vi.advanceTimersByTimeAsync(3000);
    expect(client.getState()?.mode).toBe("chime");
    expect(client.getState()?.chimeFrom).toBe(T0);
    expect(client.getState()?.chimeTo).toBe(T0 + HOUR);
    expect(chimeCount).toBe(1);
    expect(totalFetches(server)).toBe(1);

    // Further ticks neither re-fire the chime nor fetch.
    await vi.advanceTimersByTimeAsync(5000);
    expect(chimeCount).toBe(1);
    expect(totalFetches(server)).toBe(1);
    client.stop();
  });
});
