import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deriveNow,
  dispatch,
  initialState,
  type TimerState,
} from "../timer/engine";
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
// An exact epoch-hour boundary (1_699_999_200_000 = 472222 * HOUR), so a
// block started at T0 runs a full hour to the next wall-clock :00.
const T0 = 472222 * HOUR;

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
        // Mirror the real handler: roll a naturally-elapsed block into its
        // chime before dispatching (see lib/api/timer.ts).
        const rolled = deriveNow(state, now).state;
        const result = dispatch(
          rolled,
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
  it("copies hourStart straight from a running payload", () => {
    const payload = buildStatePayload(
      initialState(T0),
      SETTINGS,
      T0 + 10 * 60 * 1000,
    );
    const shadow = reconstructShadow(payload);
    expect(shadow.mode).toBe("running");
    expect(shadow.hourStart).toBe(T0);
  });

  it("carries a paused payload's mode and hourStart verbatim", () => {
    // Reach paused mode via the surviving path: chime, then skip with
    // pauseAfterLog on.
    const chimed = dispatch(
      initialState(T0),
      toEngineSettings(SETTINGS),
      { type: "ringNow" },
      T0 + 1000,
    ).state;
    const paused = dispatch(
      chimed,
      { pauseAfterLog: true },
      { type: "skip" },
      T0 + 2000,
    ).state;
    const payload = buildStatePayload(paused, SETTINGS, T0 + 5000);
    expect(payload.remainingSeconds).toBe(0);
    const shadow = reconstructShadow(payload);
    expect(shadow.mode).toBe("paused");
    expect(shadow.hourStart).toBe(T0 + 2000);
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
    expect(client.getState()?.hourStart).toBe(T0);
    expect(client.getState()?.blockEnd).toBe(T0 + HOUR);
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
    // 2 seconds before the block's wall-clock :00 boundary.
    vi.setSystemTime(T0 + HOUR - 2000);
    const server = createFakeServer(initialState(T0), SETTINGS);
    const client = createTimerClient(server.fetchImpl);

    let chimeCount = 0;
    client.onChime(() => {
      chimeCount += 1;
    });

    client.start();
    await flush();
    expect(client.getState()?.mode).toBe("running");
    expect(client.getState()?.remainingSeconds).toBe(2);

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

  it("dispatch (e.g. ringNow) posts to /api/timer and applies the response", async () => {
    const server = createFakeServer(initialState(T0), SETTINGS);
    const client = createTimerClient(server.fetchImpl);

    client.start();
    await flush();

    await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
    await client.ringNow();

    expect(client.getState()?.mode).toBe("chime");
    expect(client.getState()?.chimeFrom).toBe(T0);
    expect(client.getState()?.chimeTo).toBe(T0 + 20 * 60 * 1000);
    expect(server.getServerState().mode).toBe("chime");

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
    await client.ringNow();

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

describe("toClientState hourStart/blockEnd", () => {
  const basePayload: StatePayload = {
    mode: "running",
    remainingSeconds: 1800,
    hourStart: T0 - 30 * 60 * 1000,
    blockEnd: T0 + 30 * 60 * 1000,
    chimeFrom: null,
    chimeTo: null,
    awayKind: null,
    awaySince: null,
    awayLabel: null,
    draftBullets: [],
    draftTag: null,
    draftFeel: null,
    draftIntent: null,
    phraseIdx: 0,
    settings: SETTINGS,
    count: 0,
  };

  it("passes hourStart and blockEnd through for a running hour (Dial's arc + Since label)", () => {
    const state = toClientState(basePayload, null, T0);
    expect(state.hourStart).toBe(T0 - 30 * 60 * 1000);
    expect(state.blockEnd).toBe(T0 + 30 * 60 * 1000);
  });

  it("is null when not running", () => {
    const paused = toClientState({ ...basePayload, mode: "paused" }, null, T0);
    expect(paused.hourStart).toBeNull();
    expect(paused.blockEnd).toBeNull();
  });
});

describe("away state survives a reload", () => {
  it("restores awayKind and awaySince from the server payload in a fresh client", async () => {
    // First session goes to sleep...
    const asleep = dispatch(
      initialState(T0 - 10 * 60 * 1000),
      toEngineSettings(SETTINGS),
      { type: "awayStart", kind: "sleep" },
      T0 - 5 * 60 * 1000,
    ).state;
    const server = createFakeServer(asleep, SETTINGS);

    // ...and this is a brand-new client after a page reload: no in-tab memory.
    const client = createTimerClient(server.fetchImpl);
    client.start();
    await flush();

    const state = client.getState();
    expect(state?.mode).toBe("away");
    expect(state?.awayKind).toBe("sleep");
    expect(state?.awaySince).toBe(T0 - 5 * 60 * 1000);
    expect(state?.awayElapsedSeconds).toBe(5 * 60);

    // And the user can actually leave away mode.
    await client.awayReturn();
    expect(client.getState()?.mode).toBe("running");
    client.stop();
  });

  it("restores a custom away's label from the server payload in a fresh client", async () => {
    // First session starts a custom away...
    const away = dispatch(
      initialState(T0 - 10 * 60 * 1000),
      toEngineSettings(SETTINGS),
      { type: "awayStart", kind: "custom", label: "Travelling" },
      T0 - 5 * 60 * 1000,
    ).state;
    const server = createFakeServer(away, SETTINGS);

    // ...and a brand-new client after a page reload has no in-tab memory.
    const client = createTimerClient(server.fetchImpl);
    client.start();
    await flush();

    const state = client.getState();
    expect(state?.mode).toBe("away");
    expect(state?.awayKind).toBe("custom");
    expect(state?.awayLabel).toBe("Travelling");
    client.stop();
  });
});
