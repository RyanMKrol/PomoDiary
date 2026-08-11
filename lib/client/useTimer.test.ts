import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dispatch, initialState, type TimerState } from "../timer/engine";
import {
  buildStatePayload,
  toEngineSettings,
  type ApiSettings,
  type StatePayload,
} from "../api/timer-state";
import {
  applyDraftPatchLocally,
  createTimerClient,
  reconstructShadow,
  toClientState,
  todayBoundsFor,
  type ClientState,
} from "./useTimer";

const HOUR = 3600000;
const T0 = 1_700_000_000_000;

const SETTINGS: ApiSettings = {
  sessionMinutes: 60,
  soundOn: true,
  chimeVolume: 0.8,
  pauseAfterLog: false,
};

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

/**
 * A tiny in-memory stand-in for the real /api/state + /api/timer + /api/settings
 * routes, built on the same engine dispatch/buildStatePayload the routes use,
 * so client tests exercise the real state-transition rules without a server.
 */
function createFakeServer(initial: TimerState, settings: ApiSettings) {
  let state = initial;
  let currentSettings = settings;

  const fetchImpl = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const now = Date.now();

      if (url.startsWith("/api/state")) {
        return jsonResponse(buildStatePayload(state, currentSettings, now));
      }

      if (url === "/api/timer" && init?.method === "POST") {
        const action = JSON.parse(init.body as string);
        const result = dispatch(
          state,
          toEngineSettings(currentSettings),
          action,
          now,
        );
        state = result.state;
        return jsonResponse(buildStatePayload(state, currentSettings, now));
      }

      if (url === "/api/settings" && init?.method === "PATCH") {
        const patch = JSON.parse(init.body as string);
        currentSettings = { ...currentSettings, ...patch };
        return jsonResponse(currentSettings);
      }

      throw new Error(
        `unexpected fetch: ${String(url)} ${init?.method ?? "GET"}`,
      );
    },
  );

  return {
    fetchImpl,
    getServerState: () => state,
  };
}

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("todayBoundsFor", () => {
  it("returns local midnight to midnight, 24h apart", () => {
    const { todayStart, todayEnd } = todayBoundsFor(T0);
    expect(todayEnd - todayStart).toBe(24 * 60 * 60 * 1000);
    expect(new Date(todayStart).getHours()).toBe(0);
  });
});

describe("reconstructShadow", () => {
  it("rebuilds hourStart from a running payload's remainingSeconds", () => {
    const payload = buildStatePayload(
      initialState(T0),
      SETTINGS,
      T0 + 10 * 60 * 1000,
    );
    const shadow = reconstructShadow(payload, T0 + 10 * 60 * 1000);
    expect(shadow.mode).toBe("running");
    expect(shadow.hourStart).toBe(T0);
  });

  it("keeps pausedRemaining verbatim for a paused payload", () => {
    const paused = dispatch(
      initialState(T0),
      toEngineSettings(SETTINGS),
      { type: "pause" },
      T0 + 1000,
    ).state;
    const payload = buildStatePayload(paused, SETTINGS, T0 + 5000);
    const shadow = reconstructShadow(payload, T0 + 5000);
    expect(shadow.mode).toBe("paused");
    expect(shadow.pausedRemaining).toBe(payload.remainingSeconds);
  });
});

describe("applyDraftPatchLocally", () => {
  it("patches only provided fields and preserves the rest", () => {
    const state = {
      draftBullets: ["a"],
      draftTag: "Admin",
      draftFeel: "Steady",
      draftIntent: "yes",
    } as ClientState;
    const patched = applyDraftPatchLocally(state, { bullets: ["a", "b"] });
    expect(patched.draftBullets).toEqual(["a", "b"]);
    expect(patched.draftTag).toBe("Admin");
  });

  it("allows clearing a field to null", () => {
    const state = { draftTag: "Admin" } as ClientState;
    const patched = applyDraftPatchLocally(state, { tag: null });
    expect(patched.draftTag).toBeNull();
  });
});

describe("createTimerClient", () => {
  it("populates state from the initial GET /api/state on start", async () => {
    const server = createFakeServer(initialState(T0), SETTINGS);
    const client = createTimerClient(server.fetchImpl);

    client.start();
    await flush();

    expect(client.getState()?.mode).toBe("running");
    expect(client.getState()?.remainingSeconds).toBe(60 * 60);
    expect(client.getState()?.settings).toEqual(SETTINGS);
    client.stop();
  });

  it("counts remaining seconds down on each 1s tick", async () => {
    const server = createFakeServer(initialState(T0), SETTINGS);
    const client = createTimerClient(server.fetchImpl);

    client.start();
    await flush();
    expect(client.getState()?.remainingSeconds).toBe(60 * 60);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(client.getState()?.remainingSeconds).toBe(60 * 60 - 10);

    client.stop();
  });

  it("flips to chime exactly once when the wall clock crosses the boundary, and reconciles with the server", async () => {
    // 2 seconds left on the session.
    const almostDone = dispatch(
      initialState(T0 - HOUR + 2000),
      toEngineSettings(SETTINGS),
      { type: "draftUpdate", patch: {} },
      T0,
    ).state;
    const server = createFakeServer(almostDone, SETTINGS);
    const client = createTimerClient(server.fetchImpl);

    let chimeCount = 0;
    client.onChime(() => {
      chimeCount += 1;
    });

    client.start();
    await flush();
    expect(client.getState()?.mode).toBe("running");

    // Cross the boundary.
    await vi.advanceTimersByTimeAsync(3000);
    expect(client.getState()?.mode).toBe("chime");
    expect(chimeCount).toBe(1);

    // Further ticks must not re-fire the chime event.
    await vi.advanceTimersByTimeAsync(5000);
    expect(chimeCount).toBe(1);
    expect(client.getState()?.mode).toBe("chime");

    client.stop();
  });

  it("dispatch (e.g. pause) posts to /api/timer and applies the response", async () => {
    const server = createFakeServer(initialState(T0), SETTINGS);
    const client = createTimerClient(server.fetchImpl);

    client.start();
    await flush();

    await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
    await client.pause();

    expect(client.getState()?.mode).toBe("paused");
    expect(client.getState()?.remainingSeconds).toBe(40 * 60);
    expect(server.getServerState().mode).toBe("paused");

    client.stop();
  });

  it("debounces rapid draft updates into a single POST, applying locally at once", async () => {
    const server = createFakeServer(initialState(T0), SETTINGS);
    const client = createTimerClient(server.fetchImpl);

    client.start();
    await flush();
    const callsBeforeDrafts = server.fetchImpl.mock.calls.length;

    client.updateDraft({ bullets: ["a"] });
    // Applied locally immediately, before any network round trip.
    expect(client.getState()?.draftBullets).toEqual(["a"]);

    await vi.advanceTimersByTimeAsync(200);
    client.updateDraft({ bullets: ["a", "b"] });
    await vi.advanceTimersByTimeAsync(200);
    client.updateDraft({ bullets: ["a", "b", "c"] });

    expect(client.getState()?.draftBullets).toEqual(["a", "b", "c"]);
    // No POST yet: still within the debounce window.
    expect(server.fetchImpl.mock.calls.length).toBe(callsBeforeDrafts);

    await vi.advanceTimersByTimeAsync(800);

    const draftCalls = server.fetchImpl.mock.calls.filter(
      (call: [RequestInfo | URL, RequestInit?]) => call[1]?.method === "POST",
    );
    expect(draftCalls).toHaveLength(1);
    expect(client.getState()?.draftBullets).toEqual(["a", "b", "c"]);
    expect(server.getServerState().draftBullets).toEqual(["a", "b", "c"]);

    client.stop();
  });

  it("flushes a pending draft before log", async () => {
    const server = createFakeServer(initialState(T0), SETTINGS);
    const client = createTimerClient(server.fetchImpl);

    client.start();
    await flush();

    // Ring the chime and acknowledge so we're in recap and can log.
    await client.ringNow();
    await client.acknowledge();

    client.updateDraft({ bullets: ["half written"] });
    // No timer advance: the draft POST has not fired on its own yet.

    await client.log({
      bullets: ["finished thought"],
      tag: "Admin",
      feel: "Steady",
      intent: "yes",
    });

    expect(client.getState()?.mode).toBe("running");
    expect(client.getState()?.draftBullets).toEqual([]);

    client.stop();
  });

  it("refetches state from the server when a dispatch POST fails", async () => {
    const server = createFakeServer(initialState(T0), SETTINGS);
    let failNext = false;
    const flaky = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (failNext && url === "/api/timer" && init?.method === "POST") {
          failNext = false;
          return { ok: false, status: 500, json: async () => ({}) } as Response;
        }
        return server.fetchImpl(input, init);
      },
    );

    const client = createTimerClient(flaky);
    client.start();
    await flush();

    failNext = true;
    await client.pause();

    // The failed POST left the server state untouched (still running); the
    // client should have refetched and reflect that, not a stale local guess.
    expect(client.getState()?.mode).toBe("running");
    expect(server.getServerState().mode).toBe("running");

    const getCalls = flaky.mock.calls.filter(([input]) =>
      String(input).startsWith("/api/state"),
    );
    expect(getCalls.length).toBeGreaterThanOrEqual(2);

    client.stop();
  });
});

describe("toClientState hourStart", () => {
  const basePayload: StatePayload = {
    mode: "running",
    remainingSeconds: 1800,
    chimeFrom: null,
    chimeTo: null,
    draftBullets: [],
    draftTag: null,
    draftFeel: null,
    draftIntent: null,
    phraseIdx: 0,
    settings: SETTINGS,
    count: 0,
  };

  it("reconstructs hourStart for a running hour (Dial's Since label)", () => {
    const state = toClientState(basePayload, null, T0);
    // 30 of 60 minutes remain, so the hour started 30 minutes ago.
    expect(state.hourStart).toBe(T0 - 30 * 60 * 1000);
  });

  it("is null when not running", () => {
    const paused = toClientState({ ...basePayload, mode: "paused" }, null, T0);
    expect(paused.hourStart).toBeNull();
  });
});
