"use client";

import { useEffect, useRef, useState } from "react";

import { playChime } from "../audio/chime";
import {
  setChimeTitle,
  setChimeFavicon,
  requestNotifyPermission,
  notifyChime as postNotification,
} from "../notify";
import {
  blockEndFor,
  deriveNow,
  dispatch,
  type Action,
  type AwayKind,
  type Settings as EngineSettings,
  type TimerState as EngineTimerState,
} from "../timer/engine";
import type { ApiSettings, StatePayload } from "../api/timer-state";
import { createWalStore, type WalStore, type FrozenBatch } from "./wal";
import { createFlusher, type Flusher } from "./flusher";

const TICK_MS = 1000;
const LOAD_RETRY_MS = 3000;

export interface ClientState {
  mode: StatePayload["mode"];
  remainingSeconds: number;
  /** Start of the running block (ms); null unless running. */
  hourStart: number | null;
  /** When the running block ends (the next wall-clock :00); null unless running. */
  blockEnd: number | null;
  chimeFrom: number | null;
  chimeTo: number | null;
  draftBullets: string[];
  draftTag: string | null;
  draftFeel: string | null;
  draftIntent: string | null;
  phraseIdx: number;
  settings: ApiSettings;
  hoursToday: number | undefined;
  /** Bumps whenever a flush lands that inserted entries — the vine and grid
   *  refetch on this instead of on mode transitions (which are now local and
   *  happen BEFORE the server insert). */
  entriesVersion: number;
  awayElapsedSeconds: number | null;
  awayKind: AwayKind | null;
  awaySince: number | null;
  awayLabel: string | null;
}

export interface DraftPatch {
  bullets?: string[];
  tag?: string | null;
  feel?: string | null;
  intent?: string | null;
}

export interface LogPayload {
  bullets: string[];
  tag: string | null;
  feel: string | null;
  intent: string | null;
}

export function todayBoundsFor(now: number): {
  todayStart: number;
  todayEnd: number;
} {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const todayStart = start.getTime();
  return { todayStart, todayEnd: todayStart + 24 * 60 * 60 * 1000 };
}

/** The payload now carries every raw engine field, so the client's engine
 *  state is a straight copy — no inversion, no reconstruction. */
export function payloadToEngineState(payload: StatePayload): EngineTimerState {
  return {
    mode: payload.mode,
    hourStart: payload.hourStart,
    chimeFrom: payload.chimeFrom,
    chimeTo: payload.chimeTo,
    awayKind: payload.awayKind ?? null,
    awaySince: payload.awaySince ?? null,
    awayLabel: payload.awayLabel ?? null,
    draftBullets: payload.draftBullets,
    draftTag: payload.draftTag,
    draftFeel: payload.draftFeel,
    draftIntent: payload.draftIntent,
    phraseIdx: payload.phraseIdx,
  };
}

type TimerAction = Action;

export interface TimerClient {
  getState(): ClientState | null;
  isLoading(): boolean;
  subscribe(listener: (state: ClientState) => void): () => void;
  onChime(listener: () => void): () => void;
  start(): void;
  stop(): void;
  resume(): Promise<void>;
  ringNow(): Promise<void>;
  acknowledge(): Promise<void>;
  log(payload: LogPayload): Promise<void>;
  skip(): Promise<void>;
  awayStart(kind: AwayKind, label?: string): Promise<void>;
  awayReturn(): Promise<void>;
  updateDraft(patch: DraftPatch): void;
  updateSettings(patch: Partial<ApiSettings>): Promise<void>;
}

type FetchLike = typeof fetch;

/**
 * The optimistic client. The LOCAL engine state is the source of truth:
 * every action dispatches through the pure engine immediately (instant UI),
 * is appended to a per-user write-ahead log in localStorage, and a
 * background flusher batches the log to POST /api/timer/sync every few
 * seconds. On each ack the client REBASES: adopt the server's authoritative
 * state, then replay the still-unflushed WAL records on top — keystrokes
 * typed while a flush was in flight can never be clobbered by the response.
 */
export function createTimerClient(fetchImpl: FetchLike = fetch): TimerClient {
  let local: EngineTimerState | null = null;
  let settings: ApiSettings | null = null;
  let wal: WalStore | null = null;
  let flusher: Flusher | null = null;
  let hoursToday: number | undefined;
  let entriesVersion = 0;

  let current: ClientState | null = null;
  let loading = true;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let loadRetryId: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let loadGeneration = 0;
  let hasRequestedNotifyPermission = false;
  let releaseFlushLock: (() => void) | null = null;

  const stateListeners = new Set<(state: ClientState) => void>();
  const chimeListeners = new Set<() => void>();

  function engineSettings(): EngineSettings {
    return { pauseAfterLog: settings?.pauseAfterLog ?? false };
  }

  function notifyState(): void {
    if (current === null) return;
    for (const listener of stateListeners) listener(current);
  }

  function notifyChime(): void {
    if (current !== null) {
      playChime({
        soundOn: current.settings.soundOn,
        chimeVolume: current.settings.chimeVolume,
      });
      setChimeTitle(true);
      setChimeFavicon(true);
      if (current.chimeFrom !== null && current.chimeTo !== null) {
        postNotification(current.chimeFrom, current.chimeTo);
      }
    }
    for (const listener of chimeListeners) listener();
  }

  /** Projects the local engine state (derived at `now`) into a ClientState. */
  function project(now: number): ClientState {
    const derived = deriveNow(local!, now);
    const s = derived.state;
    const isAway = s.mode === "away";
    return {
      mode: s.mode,
      remainingSeconds: derived.remainingSeconds,
      hourStart: s.mode === "running" ? s.hourStart : null,
      blockEnd: s.mode === "running" ? blockEndFor(s.hourStart) : null,
      chimeFrom: s.chimeFrom,
      chimeTo: s.chimeTo,
      draftBullets: s.draftBullets,
      draftTag: s.draftTag,
      draftFeel: s.draftFeel,
      draftIntent: s.draftIntent,
      phraseIdx: s.phraseIdx,
      settings: settings!,
      hoursToday,
      entriesVersion,
      awayElapsedSeconds:
        isAway && s.awaySince !== null
          ? Math.floor((now - s.awaySince) / 1000)
          : null,
      awayKind: isAway ? s.awayKind : null,
      awaySince: isAway ? s.awaySince : null,
      awayLabel: isAway ? s.awayLabel : null,
    };
  }

  /** Re-projects and notifies, firing chime side-effects on transitions. */
  function publish(now: number): void {
    if (local === null || settings === null) return;
    const prevMode = current?.mode ?? null;
    current = project(now);
    loading = false;
    notifyState();

    if (prevMode !== null && prevMode !== "chime" && current.mode === "chime") {
      notifyChime();
    }
    if (prevMode === "chime" && current.mode !== "chime") {
      setChimeTitle(false);
      setChimeFavicon(false);
    }
  }

  function dispatchLocal(action: TimerAction): void {
    if (local === null || wal === null || flusher === null) return;

    if (!hasRequestedNotifyPermission) {
      hasRequestedNotifyPermission = true;
      void requestNotifyPermission();
    }

    const at = Date.now();
    local = deriveNow(local, at).state;
    const result = dispatch(local, engineSettings(), action, at);
    local = result.state;

    if (result.entriesToInsert.length > 0 && hoursToday !== undefined) {
      const { todayStart, todayEnd } = todayBoundsFor(at);
      hoursToday += result.entriesToInsert.filter(
        (e) => e.from >= todayStart && e.from < todayEnd,
      ).length;
    }

    wal.append({ id: crypto.randomUUID(), at, action });
    publish(at);

    // Entry-producing actions flush immediately — the vine wants them; all
    // the rest ride the normal cadence.
    if (action.type === "log" || action.type === "awayReturn") {
      flusher.flushNow();
    } else {
      flusher.notifyAppend();
    }
  }

  function batchProducesEntries(batch: FrozenBatch): boolean {
    return batch.records.some(
      (r) => r.action.type === "log" || r.action.type === "awayReturn",
    );
  }

  /** Adopt an authoritative server payload, then replay whatever the server
   *  has not seen yet on top of it. */
  function rebase(payload: StatePayload, flushed?: FrozenBatch): void {
    if (wal === null) return;
    settings = payload.settings;
    let s = payloadToEngineState(payload);
    for (const rec of wal.unflushed()) {
      s = deriveNow(s, rec.at).state;
      // Entries the replay would produce are discarded locally — the server
      // is the only entry writer; the vine refetches on entriesVersion.
      s = dispatch(s, engineSettings(), rec.action, rec.at).state;
    }
    local = s;
    if (payload.count !== undefined) hoursToday = payload.count;
    if (flushed !== undefined && batchProducesEntries(flushed)) {
      entriesVersion += 1;
    }
    publish(Date.now());
  }

  async function fetchState(): Promise<StatePayload> {
    const now = Date.now();
    const { todayStart, todayEnd } = todayBoundsFor(now);
    const res = await fetchImpl(
      `/api/state?todayStart=${todayStart}&todayEnd=${todayEnd}`,
    );
    if (!res.ok) throw new Error(`GET /api/state failed: ${res.status}`);
    return (await res.json()) as StatePayload;
  }

  /** Poisoned-batch fallback: fetch fresh server truth and rebase on it. */
  async function resyncFromServer(): Promise<void> {
    try {
      const payload = await fetchState();
      // The poisoned batch may have half-mattered (e.g. day cap): make the
      // dependent views refetch regardless.
      entriesVersion += 1;
      rebase(payload);
    } catch {
      // swallow — the flusher keeps running; a later flush rebases anyway
    }
  }

  function buildFlusher(walStore: WalStore): Flusher {
    return createFlusher({
      wal: walStore,
      fetchImpl,
      todayBounds: () => todayBoundsFor(Date.now()),
      onServerState: (payload, flushed) => rebase(payload, flushed),
      onPoisonedBatch: () => void resyncFromServer(),
    });
  }

  /** Only one tab flushes at a time. Web Locks resolves leadership cleanly:
   *  followers wait; when the leader tab closes, the next acquires the lock
   *  and starts its flusher. Falls back to always-flush where the API is
   *  missing (jsdom, old browsers) — the server's batchId dedupe still
   *  bounds the damage of a double-flusher to duplicate reads.
   *  Known limit, accepted for a personal app: two tabs APPENDING in the
   *  same instant can lose one tab's record (localStorage has no CAS). */
  function startFlusherWithLeadership(userKey: string): void {
    const f = flusher!;
    const locks = (globalThis.navigator as Navigator & { locks?: LockManager })
      ?.locks;
    if (locks?.request === undefined) {
      f.start();
      return;
    }
    void locks.request(`pomodiary-wal-flush:${userKey}`, () => {
      // A superseded flusher (stop() ran, or a newer load created a fresh
      // one) must release the lock immediately, not start and hold it —
      // otherwise the CURRENT flusher queues behind it forever and nothing
      // ever syncs.
      if (stopped || flusher !== f) return Promise.resolve();
      f.start();
      return new Promise<void>((resolve) => {
        releaseFlushLock = resolve;
      });
    });
  }

  async function loadInitialState(generation: number): Promise<void> {
    try {
      const payload = await fetchState();
      // React StrictMode (dev) double-runs the mount effect: start, stop,
      // start. Only the LATEST start's load may proceed — the abandoned
      // first load otherwise builds a second WAL store and flusher, and
      // whichever one wins the flush lock is not the one receiving the
      // user's actions, so nothing ever reaches the server.
      if (stopped || generation !== loadGeneration) return;

      wal = createWalStore(payload.userKey);
      settings = payload.settings;
      hoursToday = payload.count;
      flusher = buildFlusher(wal);

      const inFlight = wal.inFlight();
      if (inFlight === null) {
        // Common path: nothing was mid-flush, so every stored record is
        // definitely unseen by the server — replay locally, no extra
        // roundtrip, and let the flusher send them on its own clock.
        let s = payloadToEngineState(payload);
        for (const rec of wal.unflushed()) {
          s = deriveNow(s, rec.at).state;
          s = dispatch(s, engineSettings(), rec.action, rec.at).state;
        }
        local = s;
      } else {
        // A tab died mid-flush and we cannot know whether the batch landed.
        // Replaying it locally could double-apply (the engine is not replay-
        // idempotent: a re-run [ringNow..log] cycle mints a second entry),
        // so show plain server state and let the flusher retry the batch —
        // the server's lastBatchId dedupe answers authoritatively and the
        // ack's rebase replays the remaining records within ~one RTT.
        local = payloadToEngineState(payload);
      }

      publish(Date.now());
      startFlusherWithLeadership(payload.userKey);
      if (wal.hasWork()) flusher.flushNow();
    } catch {
      if (stopped || generation !== loadGeneration) return;
      loadRetryId = setTimeout(() => {
        loadRetryId = null;
        void loadInitialState(generation);
      }, LOAD_RETRY_MS);
    }
  }

  function tick(now: number): void {
    if (local === null || current === null) return;
    const next = project(now);
    const modeChanged = next.mode !== current.mode;
    // Re-render only when a displayed value can change: the UI shows
    // minute-level granularity, so per-second renders of the whole panel
    // tree were pure idle CPU burn (Chrome flags tabs for less).
    const minuteChanged =
      Math.ceil(next.remainingSeconds / 60) !==
      Math.ceil(current.remainingSeconds / 60);
    const awayMinuteChanged =
      Math.floor((next.awayElapsedSeconds ?? 0) / 60) !==
      Math.floor((current.awayElapsedSeconds ?? 0) / 60);
    if (modeChanged || minuteChanged || awayMinuteChanged) {
      publish(now);
    }
  }

  function updateDraft(patch: DraftPatch): void {
    dispatchLocal({ type: "draftUpdate", patch });
  }

  async function updateSettings(patch: Partial<ApiSettings>): Promise<void> {
    // Settings stay a direct PATCH, deliberately outside the WAL: they are
    // rare, they configure replay itself (pauseAfterLog), and last-write-
    // wins is the behavior a settings toggle wants.
    try {
      const res = await fetchImpl("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`PATCH /api/settings failed: ${res.status}`);
      settings = (await res.json()) as ApiSettings;
      publish(Date.now());
    } catch {
      await resyncFromServer();
    }
  }

  return {
    getState: () => current,
    isLoading: () => loading,

    subscribe(listener) {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },

    onChime(listener) {
      chimeListeners.add(listener);
      return () => chimeListeners.delete(listener);
    },

    start() {
      stopped = false;
      loadGeneration += 1;
      void loadInitialState(loadGeneration);
      if (intervalId === null) {
        intervalId = setInterval(() => tick(Date.now()), TICK_MS);
      }
    },

    stop() {
      stopped = true;
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (loadRetryId !== null) {
        clearTimeout(loadRetryId);
        loadRetryId = null;
      }
      flusher?.stop();
      releaseFlushLock?.();
      releaseFlushLock = null;
    },

    resume: () => {
      dispatchLocal({ type: "resume" });
      return Promise.resolve();
    },
    ringNow: () => {
      dispatchLocal({ type: "ringNow" });
      return Promise.resolve();
    },
    acknowledge: () => {
      dispatchLocal({ type: "acknowledge" });
      return Promise.resolve();
    },
    log: (payload) => {
      dispatchLocal({ type: "log", payload });
      return Promise.resolve();
    },
    skip: () => {
      dispatchLocal({ type: "skip" });
      return Promise.resolve();
    },
    awayStart: (kind, label) => {
      dispatchLocal(
        kind === "custom"
          ? { type: "awayStart", kind, label }
          : { type: "awayStart", kind },
      );
      return Promise.resolve();
    },
    awayReturn: () => {
      dispatchLocal({ type: "awayReturn" });
      return Promise.resolve();
    },

    updateDraft,
    updateSettings,
  };
}

export interface UseTimerOptions {
  onChime?: () => void;
}

export interface UseTimerResult extends Partial<ClientState> {
  loading: boolean;
  resume(): Promise<void>;
  ringNow(): Promise<void>;
  acknowledge(): Promise<void>;
  log(payload: LogPayload): Promise<void>;
  skip(): Promise<void>;
  awayStart(kind: AwayKind, label?: string): Promise<void>;
  awayReturn(): Promise<void>;
  updateDraft(patch: DraftPatch): void;
  updateSettings(patch: Partial<ApiSettings>): Promise<void>;
}

export function useTimer(options: UseTimerOptions = {}): UseTimerResult {
  const [client] = useState<TimerClient>(() => createTimerClient());
  const [state, setState] = useState<ClientState | null>(() =>
    client.getState(),
  );

  const onChimeRef = useRef(options.onChime);
  useEffect(() => {
    onChimeRef.current = options.onChime;
  }, [options.onChime]);

  useEffect(() => {
    const unsubState = client.subscribe(setState);
    const unsubChime = client.onChime(() => onChimeRef.current?.());
    client.start();
    return () => {
      unsubState();
      unsubChime();
      client.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...(state ?? {}),
    loading: state === null,
    resume: client.resume,
    ringNow: client.ringNow,
    acknowledge: client.acknowledge,
    log: client.log,
    skip: client.skip,
    awayStart: client.awayStart,
    awayReturn: client.awayReturn,
    updateDraft: client.updateDraft,
    updateSettings: client.updateSettings,
  };
}
