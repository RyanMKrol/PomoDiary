// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StatePayload } from "../api/timer-state";
import { createFlusher, type SyncResponseBody } from "./flusher";
import { createWalStore, type WalRecord, type WalStore } from "./wal";

/** Minimal in-memory Storage so each test gets a fresh, isolated WAL. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const SERVER_STATE = { mode: "running" } as unknown as StatePayload;
const BOUNDS = { todayStart: 1_700_000_000_000, todayEnd: 1_700_086_400_000 };

let nextId = 0;

function skipRecord(): WalRecord {
  nextId += 1;
  return {
    id: `id-${nextId}`,
    at: 1_700_000_000_000 + nextId,
    action: { type: "skip" },
  };
}

function response(
  status: number,
  body: unknown = null,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response;
}

function okBody(applied = true): SyncResponseBody {
  return { applied, state: SERVER_STATE };
}

function sentBody(
  fetchMock: ReturnType<typeof vi.fn>,
  call = 0,
): {
  batchId: string;
  actions: WalRecord[];
  todayStart: number;
  todayEnd: number;
} {
  const init = fetchMock.mock.calls[call][1] as RequestInit;
  return JSON.parse(init.body as string);
}

interface Harness {
  wal: WalStore;
  fetchMock: ReturnType<typeof vi.fn>;
  onServerState: ReturnType<typeof vi.fn>;
  onPoisonedBatch: ReturnType<typeof vi.fn>;
  flusher: ReturnType<typeof createFlusher>;
}

function makeHarness(
  overrides: { intervalMs?: number; maxBackoffMs?: number } = {},
): Harness {
  const wal = createWalStore("u", new MemoryStorage());
  const fetchMock = vi.fn();
  const onServerState = vi.fn();
  const onPoisonedBatch = vi.fn();
  const flusher = createFlusher({
    wal,
    fetchImpl: fetchMock as unknown as typeof fetch,
    todayBounds: () => BOUNDS,
    onServerState,
    onPoisonedBatch,
    ...overrides,
  });
  return { wal, fetchMock, onServerState, onPoisonedBatch, flusher };
}

describe("createFlusher", () => {
  beforeEach(() => {
    nextId = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sends one batch on the 3s cadence and acks on 2xx", async () => {
    const h = makeHarness();
    h.fetchMock.mockResolvedValue(response(200, okBody()));
    const rec = skipRecord();
    h.wal.append(rec);

    h.flusher.start();
    await vi.advanceTimersByTimeAsync(2999);
    expect(h.fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = h.fetchMock.mock.calls[0];
    expect(url).toBe("/api/timer/sync");
    expect(init.method).toBe("POST");
    const body = sentBody(h.fetchMock);
    expect(body.actions).toEqual([rec]);
    expect(body.todayStart).toBe(BOUNDS.todayStart);
    expect(body.todayEnd).toBe(BOUNDS.todayEnd);
    expect(typeof body.batchId).toBe("string");

    expect(h.wal.inFlight()).toBeNull();
    expect(h.wal.hasWork()).toBe(false);
    expect(h.onServerState).toHaveBeenCalledTimes(1);
    const [payload, flushed] = h.onServerState.mock.calls[0];
    expect(payload).toBe(SERVER_STATE);
    expect(flushed.batchId).toBe(body.batchId);
    expect(flushed.records).toEqual([rec]);

    // Nothing left: the chain goes idle instead of polling forever.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    h.flusher.stop();
  });

  it("acks and applies server state on applied:false too", async () => {
    const h = makeHarness();
    h.fetchMock.mockResolvedValue(response(200, okBody(false)));
    h.wal.append(skipRecord());

    h.flusher.start();
    await vi.advanceTimersByTimeAsync(3000);

    expect(h.wal.inFlight()).toBeNull();
    expect(h.onServerState).toHaveBeenCalledTimes(1);
    expect(h.onServerState.mock.calls[0][0]).toBe(SERVER_STATE);
    h.flusher.stop();
  });

  it("stays strictly serial: a slow in-flight request blocks further sends", async () => {
    const h = makeHarness();
    let resolveFirst: (r: Response) => void = () => {};
    h.fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => (resolveFirst = resolve)),
    );
    h.fetchMock.mockResolvedValue(response(200, okBody()));

    const rec1 = skipRecord();
    h.wal.append(rec1);
    h.flusher.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);

    // New work arrives while the first request hangs.
    const rec2 = skipRecord();
    h.wal.append(rec2);
    h.flusher.notifyAppend();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.fetchMock).toHaveBeenCalledTimes(1); // still just the one

    resolveFirst(response(200, okBody()));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.wal.inFlight()).toBeNull(); // first batch acked

    // The completion saw remaining work and scheduled the next attempt.
    await vi.advanceTimersByTimeAsync(3000);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    const second = sentBody(h.fetchMock, 1);
    expect(second.actions).toEqual([rec2]);
    expect(second.batchId).not.toBe(sentBody(h.fetchMock, 0).batchId);
    h.flusher.stop();
  });

  it("retries the IDENTICAL body with exponential backoff on 5xx", async () => {
    const h = makeHarness();
    h.fetchMock.mockResolvedValue(response(500, "boom"));
    h.wal.append(skipRecord());

    h.flusher.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);

    // Retry 1 after intervalMs.
    await vi.advanceTimersByTimeAsync(2999);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);

    // Retry 2 after 2x.
    await vi.advanceTimersByTimeAsync(5999);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.fetchMock).toHaveBeenCalledTimes(3);

    // Retry 3 after 4x.
    await vi.advanceTimersByTimeAsync(11_999);
    expect(h.fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.fetchMock).toHaveBeenCalledTimes(4);

    // Every attempt sent the exact same batch.
    const first = h.fetchMock.mock.calls[0][1].body;
    for (let i = 1; i < 4; i++) {
      expect(h.fetchMock.mock.calls[i][1].body).toBe(first);
    }
    h.flusher.stop();
  });

  it("caps the backoff at maxBackoffMs", async () => {
    const h = makeHarness({ intervalMs: 3000, maxBackoffMs: 4000 });
    h.fetchMock.mockResolvedValue(response(503, "unavailable"));
    h.wal.append(skipRecord());

    h.flusher.start();
    await vi.advanceTimersByTimeAsync(3000); // attempt 1
    await vi.advanceTimersByTimeAsync(3000); // retry after intervalMs
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    // 2x = 6000 would exceed the cap; expect the retry at 4000.
    await vi.advanceTimersByTimeAsync(4000);
    expect(h.fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(4000);
    expect(h.fetchMock).toHaveBeenCalledTimes(4);
    h.flusher.stop();
  });

  it("keeps new appends out of a stuck frozen batch", async () => {
    const h = makeHarness();
    h.fetchMock.mockResolvedValue(response(500, "boom"));
    const rec1 = skipRecord();
    h.wal.append(rec1);

    h.flusher.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(sentBody(h.fetchMock, 0).actions).toEqual([rec1]);

    // Append while the batch is failing; the retry must not absorb it.
    h.wal.append(skipRecord());
    h.flusher.notifyAppend();
    await vi.advanceTimersByTimeAsync(3000);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    expect(h.fetchMock.mock.calls[1][1].body).toBe(
      h.fetchMock.mock.calls[0][1].body,
    );
    h.flusher.stop();
  });

  it("waits Retry-After seconds on 429, keeping the batch frozen", async () => {
    const h = makeHarness();
    h.fetchMock
      .mockResolvedValueOnce(response(429, null, { "Retry-After": "120" }))
      .mockResolvedValue(response(200, okBody()));
    h.wal.append(skipRecord());

    h.flusher.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    const frozen = h.wal.inFlight();
    expect(frozen).not.toBeNull();

    await vi.advanceTimersByTimeAsync(119_999);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(h.fetchMock, 1).batchId).toBe(frozen!.batchId);
    h.flusher.stop();
  });

  it("defaults the 429 wait to 60s without a Retry-After header", async () => {
    const h = makeHarness();
    h.fetchMock.mockResolvedValue(response(429));
    h.wal.append(skipRecord());

    h.flusher.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    h.flusher.stop();
  });

  it("abandons a poisoned batch on 400 and calls onPoisonedBatch", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = makeHarness();
    h.fetchMock.mockResolvedValue(response(400, "bad actions"));
    h.wal.append(skipRecord());

    h.flusher.start();
    await vi.advanceTimersByTimeAsync(3000);

    expect(h.wal.inFlight()).toBeNull();
    expect(h.wal.hasWork()).toBe(false);
    expect(h.onPoisonedBatch).toHaveBeenCalledTimes(1);
    expect(h.onServerState).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    // The poisoned batch is never retried.
    await vi.advanceTimersByTimeAsync(120_000);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    h.flusher.stop();
  });

  it("abandons on 422 the same way", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = makeHarness();
    h.fetchMock.mockResolvedValue(response(422, "unprocessable"));
    h.wal.append(skipRecord());

    h.flusher.start();
    await vi.advanceTimersByTimeAsync(3000);

    expect(h.wal.inFlight()).toBeNull();
    expect(h.onPoisonedBatch).toHaveBeenCalledTimes(1);
    h.flusher.stop();
  });

  it("retries with backoff on a network error", async () => {
    const h = makeHarness();
    h.fetchMock
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(response(200, okBody()));
    h.wal.append(skipRecord());

    h.flusher.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect(h.wal.inFlight()).not.toBeNull(); // still frozen

    await vi.advanceTimersByTimeAsync(3000);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    expect(h.fetchMock.mock.calls[1][1].body).toBe(
      h.fetchMock.mock.calls[0][1].body,
    );
    expect(h.wal.inFlight()).toBeNull();
    h.flusher.stop();
  });

  it("flushNow triggers an immediate attempt", async () => {
    const h = makeHarness();
    h.fetchMock.mockResolvedValue(response(200, okBody()));
    h.wal.append(skipRecord());

    h.flusher.start();
    h.flusher.flushNow();
    await vi.advanceTimersByTimeAsync(0);

    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    h.flusher.stop();
  });

  it("flushNow during an in-flight request queues one follow-up attempt", async () => {
    const h = makeHarness();
    let resolveFirst: (r: Response) => void = () => {};
    h.fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => (resolveFirst = resolve)),
    );
    h.fetchMock.mockResolvedValue(response(200, okBody()));

    h.wal.append(skipRecord());
    h.flusher.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);

    h.wal.append(skipRecord());
    h.flusher.flushNow(); // must not double-send now
    expect(h.fetchMock).toHaveBeenCalledTimes(1);

    resolveFirst(response(200, okBody()));
    await vi.advanceTimersByTimeAsync(0); // follow-up fires at 0ms
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    h.flusher.stop();
  });

  it("notifyAppend schedules within intervalMs and never doubles up", async () => {
    const h = makeHarness();
    h.fetchMock.mockResolvedValue(response(200, okBody()));

    h.flusher.start();
    await vi.advanceTimersByTimeAsync(3000); // initial tick: nothing to do
    expect(h.fetchMock).not.toHaveBeenCalled();

    h.wal.append(skipRecord());
    h.flusher.notifyAppend();
    h.flusher.notifyAppend();
    h.flusher.notifyAppend();
    await vi.advanceTimersByTimeAsync(3000);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    h.flusher.stop();
  });

  it("stop() cancels pending work", async () => {
    const h = makeHarness();
    h.fetchMock.mockResolvedValue(response(200, okBody()));
    h.wal.append(skipRecord());

    h.flusher.start();
    h.flusher.stop();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it("fires a keepalive beacon on pagehide without acking", async () => {
    const h = makeHarness();
    h.fetchMock.mockResolvedValue(response(200, okBody()));
    h.wal.append(skipRecord());

    h.flusher.start();
    window.dispatchEvent(new Event("pagehide"));

    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    const init = h.fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.keepalive).toBe(true);
    // Best-effort only: never acked here — the WAL keeps the batch frozen.
    expect(h.wal.inFlight()).not.toBeNull();
    h.flusher.stop();
  });

  it("fires a keepalive beacon when the tab becomes hidden", async () => {
    const h = makeHarness();
    h.fetchMock.mockResolvedValue(response(200, okBody()));
    h.wal.append(skipRecord());

    h.flusher.start();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect((h.fetchMock.mock.calls[0][1] as RequestInit).keepalive).toBe(true);
    expect(h.wal.inFlight()).not.toBeNull();

    h.flusher.stop();
    // Restore for other tests in this file.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  it("beacon re-sends the already-frozen batch with the same batchId", async () => {
    const h = makeHarness();
    let resolveFirst: (r: Response) => void = () => {};
    h.fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => (resolveFirst = resolve)),
    );
    h.fetchMock.mockResolvedValue(response(200, okBody()));

    h.wal.append(skipRecord());
    h.flusher.start();
    await vi.advanceTimersByTimeAsync(3000); // freeze + send (hangs)
    const frozen = h.wal.inFlight();

    window.dispatchEvent(new Event("pagehide"));
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(h.fetchMock, 1).batchId).toBe(frozen!.batchId);

    resolveFirst(response(200, okBody()));
    await vi.advanceTimersByTimeAsync(0);
    h.flusher.stop();
  });
});
