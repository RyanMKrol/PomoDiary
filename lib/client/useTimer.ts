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
  deriveNow,
  type AwayKind,
  type Settings as EngineSettings,
} from "../timer/engine";
import type { ApiSettings, StatePayload } from "../api/timer-state";

const DRAFT_DEBOUNCE_MS = 800;
const TICK_MS = 1000;

export interface ClientState {
  mode: StatePayload["mode"];
  remainingSeconds: number;
  /** Start of the running hour (ms), reconstructed from the payload; null unless running. */
  hourStart: number | null;
  chimeFrom: number | null;
  chimeTo: number | null;
  draftBullets: string[];
  draftTag: string | null;
  draftFeel: string | null;
  draftIntent: string | null;
  phraseIdx: number;
  settings: ApiSettings;
  hoursToday: number | undefined;
  awayElapsedSeconds: number | null;
  awayKind: AwayKind | null;
  awaySince: number | null;
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

/** Minimal shadow of the engine's TimerState, rebuilt from each server payload, used only to drive local ticking via deriveNow. */
interface ShadowState {
  mode: StatePayload["mode"];
  hourStart: number;
  pausedRemaining: number | null;
  chimeFrom: number | null;
  chimeTo: number | null;
  awayKind: AwayKind | null;
  awaySince: number | null;
  draftBullets: string[];
  draftTag: string | null;
  draftFeel: string | null;
  draftIntent: string | null;
  phraseIdx: number;
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

export function reconstructShadow(
  payload: StatePayload,
  now: number,
): ShadowState {
  const sessionMs = payload.settings.sessionMinutes * 60 * 1000;
  const base: ShadowState = {
    mode: payload.mode,
    hourStart: now,
    pausedRemaining: null,
    chimeFrom: payload.chimeFrom,
    chimeTo: payload.chimeTo,
    awayKind: payload.awayKind ?? null,
    awaySince: payload.awaySince ?? null,
    draftBullets: payload.draftBullets,
    draftTag: payload.draftTag,
    draftFeel: payload.draftFeel,
    draftIntent: payload.draftIntent,
    phraseIdx: payload.phraseIdx,
  };

  if (payload.mode === "running") {
    return {
      ...base,
      hourStart: now - sessionMs + payload.remainingSeconds * 1000,
    };
  }

  if (payload.mode === "paused") {
    return { ...base, pausedRemaining: payload.remainingSeconds };
  }

  return base;
}

export function toEngineSettings(settings: ApiSettings): EngineSettings {
  return {
    sessionMinutes: settings.sessionMinutes,
    pauseAfterLog: settings.pauseAfterLog,
  };
}

export function toClientState(
  payload: StatePayload,
  awayEnteredAt: number | null,
  now: number,
  awayKind: AwayKind | null = null,
): ClientState {
  const sessionMs = payload.settings.sessionMinutes * 60 * 1000;
  // The payload's own away fields win: they survive reloads, while the
  // awayEnteredAt/awayKind arguments only exist in this tab's memory.
  const awaySince =
    payload.mode === "away" ? (payload.awaySince ?? awayEnteredAt) : null;
  const resolvedAwayKind =
    payload.mode === "away" ? (payload.awayKind ?? awayKind) : null;
  return {
    mode: payload.mode,
    remainingSeconds: payload.remainingSeconds,
    hourStart:
      payload.mode === "running"
        ? now - sessionMs + payload.remainingSeconds * 1000
        : null,
    chimeFrom: payload.chimeFrom,
    chimeTo: payload.chimeTo,
    draftBullets: payload.draftBullets,
    draftTag: payload.draftTag,
    draftFeel: payload.draftFeel,
    draftIntent: payload.draftIntent,
    phraseIdx: payload.phraseIdx,
    settings: payload.settings,
    hoursToday: payload.count,
    awayElapsedSeconds:
      awaySince !== null ? Math.floor((now - awaySince) / 1000) : null,
    awayKind: resolvedAwayKind,
    awaySince,
  };
}

export function applyDraftPatchLocally(
  state: ClientState,
  patch: DraftPatch,
): ClientState {
  return {
    ...state,
    draftBullets:
      patch.bullets !== undefined ? patch.bullets : state.draftBullets,
    draftTag: patch.tag !== undefined ? patch.tag : state.draftTag,
    draftFeel: patch.feel !== undefined ? patch.feel : state.draftFeel,
    draftIntent: patch.intent !== undefined ? patch.intent : state.draftIntent,
  };
}

type TimerAction =
  | { type: "pause" }
  | { type: "resume" }
  | { type: "restart" }
  | { type: "ringNow" }
  | { type: "acknowledge" }
  | { type: "log"; payload: LogPayload }
  | { type: "skip" }
  | { type: "awayStart"; kind: "sleep" | "work" }
  | { type: "awayReturn" }
  | { type: "draftUpdate"; patch: DraftPatch };

export interface TimerClient {
  getState(): ClientState | null;
  isLoading(): boolean;
  subscribe(listener: (state: ClientState) => void): () => void;
  onChime(listener: () => void): () => void;
  start(): void;
  stop(): void;
  pause(): Promise<void>;
  resume(): Promise<void>;
  restart(): Promise<void>;
  ringNow(): Promise<void>;
  acknowledge(): Promise<void>;
  log(payload: LogPayload): Promise<void>;
  skip(): Promise<void>;
  awayStart(kind: "sleep" | "work"): Promise<void>;
  awayReturn(): Promise<void>;
  updateDraft(patch: DraftPatch): void;
  flushDraft(): Promise<void>;
  updateSettings(patch: Partial<ApiSettings>): Promise<void>;
}

type FetchLike = typeof fetch;

export function createTimerClient(fetchImpl: FetchLike = fetch): TimerClient {
  let current: ClientState | null = null;
  let shadow: ShadowState | null = null;
  let awayEnteredAt: number | null = null;
  let awayKindEntered: AwayKind | null = null;
  let loading = true;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const stateListeners = new Set<(state: ClientState) => void>();
  const chimeListeners = new Set<() => void>();

  let pendingDraftPatch: DraftPatch = {};
  let draftTimer: ReturnType<typeof setTimeout> | null = null;
  let hasRequestedNotifyPermission = false;

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
      // Fire title/favicon/notification alongside the sound
      setChimeTitle(true);
      setChimeFavicon(true);
      if (current.chimeFrom !== null && current.chimeTo !== null) {
        postNotification(current.chimeFrom, current.chimeTo);
      }
    }
    for (const listener of chimeListeners) listener();
  }

  function applyState(payload: StatePayload, now: number): void {
    const prevMode = current?.mode ?? null;

    if (payload.mode === "away") {
      // Prefer the server's record (survives reloads); fall back to this
      // tab's memory of when away mode was entered.
      awayEnteredAt = payload.awaySince ?? awayEnteredAt ?? now;
      if (payload.awayKind !== null) awayKindEntered = payload.awayKind;
    } else {
      awayEnteredAt = null;
      awayKindEntered = null;
    }

    shadow = reconstructShadow(payload, now);
    current = toClientState(payload, awayEnteredAt, now, awayKindEntered);
    loading = false;
    notifyState();

    if (prevMode !== null && prevMode !== "chime" && payload.mode === "chime") {
      notifyChime();
    }

    // Clear title and favicon when chime mode ends
    if (prevMode === "chime" && payload.mode !== "chime") {
      setChimeTitle(false);
      setChimeFavicon(false);
    }
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

  async function refetchState(): Promise<void> {
    const payload = await fetchState();
    applyState(payload, Date.now());
  }

  async function performAction(action: TimerAction): Promise<void> {
    // Request notification permission on first user interaction
    if (!hasRequestedNotifyPermission) {
      hasRequestedNotifyPermission = true;
      void requestNotifyPermission();
    }

    try {
      const res = await fetchImpl("/api/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      if (!res.ok) throw new Error(`POST /api/timer failed: ${res.status}`);
      const payload = (await res.json()) as StatePayload;
      applyState(payload, Date.now());
    } catch {
      await refetchState();
    }
  }

  function tick(now: number): void {
    if (shadow === null || current === null) return;

    const wasMode = shadow.mode;
    const engineSettings = toEngineSettings(current.settings);
    const { state: nextShadow, remainingSeconds } = deriveNow(
      shadow,
      engineSettings,
      now,
    );
    shadow = nextShadow;

    if (wasMode !== "chime" && nextShadow.mode === "chime") {
      current = {
        ...current,
        mode: "chime",
        remainingSeconds: 0,
        chimeFrom: nextShadow.chimeFrom,
        chimeTo: nextShadow.chimeTo,
      };
      notifyState();
      notifyChime();
      void refetchState();
      return;
    }

    if (wasMode === "running") {
      const prevRemaining = current.remainingSeconds;
      current = { ...current, remainingSeconds };
      // Re-render only when a displayed value can change: the UI shows
      // minute-level granularity, so per-second renders of the whole panel
      // tree were pure idle CPU burn (Chrome flags tabs for less).
      if (Math.ceil(remainingSeconds / 60) !== Math.ceil(prevRemaining / 60)) {
        notifyState();
      }
      return;
    }

    if (wasMode === "away" && awayEnteredAt !== null) {
      const prevElapsed = current.awayElapsedSeconds ?? 0;
      const elapsed = Math.floor((now - awayEnteredAt) / 1000);
      current = { ...current, awayElapsedSeconds: elapsed };
      if (Math.floor(elapsed / 60) !== Math.floor(prevElapsed / 60)) {
        notifyState();
      }
    }
  }

  function clearDraftTimer(): void {
    if (draftTimer !== null) {
      clearTimeout(draftTimer);
      draftTimer = null;
    }
  }

  function updateDraft(patch: DraftPatch): void {
    if (current !== null) {
      current = applyDraftPatchLocally(current, patch);
      notifyState();
    }
    pendingDraftPatch = { ...pendingDraftPatch, ...patch };

    clearDraftTimer();
    draftTimer = setTimeout(() => {
      draftTimer = null;
      void flushDraft();
    }, DRAFT_DEBOUNCE_MS);
  }

  async function flushDraft(): Promise<void> {
    clearDraftTimer();
    if (Object.keys(pendingDraftPatch).length === 0) return;
    const patch = pendingDraftPatch;
    pendingDraftPatch = {};
    await performAction({ type: "draftUpdate", patch });
  }

  async function updateSettings(patch: Partial<ApiSettings>): Promise<void> {
    try {
      const res = await fetchImpl("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`PATCH /api/settings failed: ${res.status}`);
      const settings = (await res.json()) as ApiSettings;
      if (current !== null) {
        current = { ...current, settings };
        notifyState();
      }
    } catch {
      await refetchState();
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
      void refetchState();
      if (intervalId === null) {
        intervalId = setInterval(() => tick(Date.now()), TICK_MS);
      }
    },

    stop() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      clearDraftTimer();
    },

    pause: () => performAction({ type: "pause" }),
    resume: () => performAction({ type: "resume" }),
    restart: () => performAction({ type: "restart" }),
    ringNow: () => performAction({ type: "ringNow" }),
    acknowledge: () => performAction({ type: "acknowledge" }),

    async log(payload) {
      await flushDraft();
      await performAction({ type: "log", payload });
    },

    async skip() {
      await flushDraft();
      await performAction({ type: "skip" });
    },

    async awayStart(kind) {
      awayKindEntered = kind;
      await flushDraft();
      await performAction({ type: "awayStart", kind });
    },

    awayReturn: () => performAction({ type: "awayReturn" }),

    updateDraft,
    flushDraft,
    updateSettings,
  };
}

export interface UseTimerOptions {
  onChime?: () => void;
}

export interface UseTimerResult extends Partial<ClientState> {
  loading: boolean;
  pause(): Promise<void>;
  resume(): Promise<void>;
  restart(): Promise<void>;
  ringNow(): Promise<void>;
  acknowledge(): Promise<void>;
  log(payload: LogPayload): Promise<void>;
  skip(): Promise<void>;
  awayStart(kind: "sleep" | "work"): Promise<void>;
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
    pause: client.pause,
    resume: client.resume,
    restart: client.restart,
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
