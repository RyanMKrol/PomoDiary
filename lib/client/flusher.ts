import type { StatePayload } from "../api/timer-state";
import type { FrozenBatch, WalStore } from "./wal";

export interface SyncResponseBody {
  applied: boolean;
  state: StatePayload;
}

export interface Flusher {
  start(): void;
  stop(): void;
  /** Schedule an immediate flush attempt (still serial). */
  flushNow(): void;
  /** New work exists; ensure a flush is scheduled within intervalMs. */
  notifyAppend(): void;
}

const SYNC_URL = "/api/timer/sync";
const DEFAULT_INTERVAL_MS = 3000;
const DEFAULT_MAX_BACKOFF_MS = 60_000;
const DEFAULT_RETRY_AFTER_S = 60;

export interface CreateFlusherOptions {
  wal: WalStore;
  fetchImpl?: typeof fetch;
  todayBounds: () => { todayStart: number; todayEnd: number };
  onServerState: (payload: StatePayload, flushed: FrozenBatch) => void;
  onPoisonedBatch: () => void;
  intervalMs?: number;
  maxBackoffMs?: number;
}

/**
 * Background WAL flusher: POSTs consolidated batches to /api/timer/sync on a
 * setTimeout chain (never setInterval, so backoff composes cleanly), strictly
 * one HTTP request in flight at a time, always re-sending the SAME frozen
 * batch (same batchId, same records) until it is acked or poisoned — the
 * server's batchId dedupe turns at-least-once retries into exactly-once.
 */
export function createFlusher(opts: CreateFlusherOptions): Flusher {
  const {
    wal,
    todayBounds,
    onServerState,
    onPoisonedBatch,
    intervalMs = DEFAULT_INTERVAL_MS,
    maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
  } = opts;
  const fetchImpl = opts.fetchImpl ?? fetch;

  let started = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let requestInFlight = false;
  /** flushNow() arrived while a request was in flight: run again right after. */
  let followUp = false;
  /** Delay before the NEXT retry of a failing batch: intervalMs, 2x, 4x… capped. */
  let backoffMs = intervalMs;

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function schedule(delayMs: number): void {
    if (!started) return;
    if (timer !== null) return; // never two pending timers
    timer = setTimeout(() => {
      timer = null;
      void attempt();
    }, delayMs);
  }

  function bodyFor(batch: FrozenBatch): string {
    const { todayStart, todayEnd } = todayBounds();
    return JSON.stringify({
      batchId: batch.batchId,
      actions: batch.records,
      todayStart,
      todayEnd,
    });
  }

  function afterOutcome(): void {
    if (followUp) {
      followUp = false;
      schedule(0);
    } else if (wal.hasWork()) {
      schedule(intervalMs);
    }
  }

  async function attempt(): Promise<void> {
    if (requestInFlight) {
      followUp = true;
      return;
    }
    const batch = wal.inFlight() ?? wal.freezeBatch();
    if (batch === null) return;

    requestInFlight = true;
    try {
      const res = await fetchImpl(SYNC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyFor(batch),
      });

      if (res.ok) {
        // applied:false means the server already had this batchId — its
        // state is still authoritative, so the handling is identical.
        const parsed = (await res.json()) as SyncResponseBody;
        wal.ackInFlight();
        backoffMs = intervalMs;
        requestInFlight = false;
        onServerState(parsed.state, batch);
        afterOutcome();
        return;
      }

      if (res.status === 429) {
        // Keep the batch frozen; the server told us when to come back.
        const header = res.headers.get("Retry-After");
        const seconds = header !== null ? Number(header) : NaN;
        const delayMs =
          (Number.isFinite(seconds) && seconds > 0
            ? seconds
            : DEFAULT_RETRY_AFTER_S) * 1000;
        requestInFlight = false;
        schedule(delayMs);
        return;
      }

      if (res.status === 400 || res.status === 422) {
        // The batch can never succeed: poisoned. Drop it and move on.
        let text = "";
        try {
          text = await res.text();
        } catch {
          // response body unavailable; nothing more to report
        }
        console.error(
          `wal flush: batch ${batch.batchId} rejected (${res.status}): ${text}`,
        );
        wal.abandonInFlight();
        backoffMs = intervalMs;
        requestInFlight = false;
        onPoisonedBatch();
        afterOutcome();
        return;
      }

      // Other non-2xx: transient server trouble — retry the SAME batch.
      requestInFlight = false;
      retryAfterBackoff();
    } catch {
      // Network error / fetch rejection: retry the SAME batch.
      requestInFlight = false;
      retryAfterBackoff();
    }
  }

  function retryAfterBackoff(): void {
    const delayMs = backoffMs;
    backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
    // The retry IS the follow-up attempt; don't let a queued flushNow
    // schedule a second, backoff-defeating timer.
    followUp = false;
    schedule(delayMs);
  }

  /**
   * Best-effort keepalive send when the page is going away. Never awaited and
   * never acked — localStorage is the durability story; if both this beacon
   * and a later retry land, the server's batchId dedupe makes it exact-once.
   */
  function sendBeacon(): void {
    const batch = wal.inFlight() ?? wal.freezeBatch();
    if (batch === null) return;
    try {
      void fetchImpl(SYNC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyFor(batch),
        keepalive: true,
      }).catch(() => {
        // best-effort only; the WAL retry path covers the loss
      });
    } catch {
      // fetchImpl threw synchronously; same story
    }
  }

  function onPageHide(): void {
    sendBeacon();
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === "hidden") sendBeacon();
  }

  return {
    start() {
      if (started) return;
      started = true;
      schedule(intervalMs);
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", onVisibilityChange);
      }
      if (typeof window !== "undefined") {
        window.addEventListener("pagehide", onPageHide);
      }
    },

    stop() {
      started = false;
      followUp = false;
      clearTimer();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("pagehide", onPageHide);
      }
    },

    flushNow() {
      if (requestInFlight) {
        followUp = true;
        return;
      }
      clearTimer();
      schedule(0);
    },

    notifyAppend() {
      if (timer !== null) return; // never a second timer
      if (requestInFlight) return; // the completion handler reschedules
      schedule(intervalMs);
    },
  };
}
