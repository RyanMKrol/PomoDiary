import type { Action } from "../timer/engine";
import { consolidate } from "./consolidate";

export interface WalRecord {
  id: string;
  at: number;
  action: Action;
}

export interface FrozenBatch {
  batchId: string;
  records: WalRecord[];
}

/** Max actions per sync batch; keep in sync with the server-side validation. */
export const MAX_SYNC_ACTIONS = 200;

export function walKey(userKey: string): string {
  return `pomodiary:wal:v1:${userKey}`;
}

/** Persisted JSON shape under walKey(userKey). */
interface WalFile {
  v: 1;
  inFlight: FrozenBatch | null;
  records: WalRecord[];
}

export interface WalStore {
  append(record: WalRecord): void;
  freezeBatch(): FrozenBatch | null;
  inFlight(): FrozenBatch | null;
  ackInFlight(): void;
  abandonInFlight(): void;
  unflushed(): WalRecord[];
  hasWork(): boolean;
  clear(): void;
}

function emptyFile(): WalFile {
  return { v: 1, inFlight: null, records: [] };
}

function isWalFile(value: unknown): value is WalFile {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<WalFile>;
  return (
    candidate.v === 1 &&
    Array.isArray(candidate.records) &&
    (candidate.inFlight === null ||
      (typeof candidate.inFlight === "object" &&
        candidate.inFlight !== undefined &&
        typeof candidate.inFlight.batchId === "string" &&
        Array.isArray(candidate.inFlight.records)))
  );
}

/**
 * A per-user write-ahead log persisted in localStorage. The file is held in
 * memory and written synchronously on every mutation (single-writer
 * assumption; a storage event listener elsewhere handles other tabs), but
 * existing persisted state is loaded on creation — that is the crash-recovery
 * path: a frozen batch persisted with its batchId is re-sent verbatim after a
 * reload and the server dedupes by batchId, giving exactly-once retries.
 */
export function createWalStore(userKey: string, storage?: Storage): WalStore {
  const store = storage ?? window.localStorage;
  const key = walKey(userKey);

  let file: WalFile = load();

  function load(): WalFile {
    let raw: string | null = null;
    try {
      raw = store.getItem(key);
    } catch (err) {
      console.warn("wal: failed to read persisted log; starting fresh", err);
      return emptyFile();
    }
    if (raw === null) return emptyFile();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isWalFile(parsed)) return parsed;
      console.warn("wal: persisted log has unknown shape; starting fresh");
      return emptyFile();
    } catch (err) {
      console.warn("wal: persisted log is unparseable; starting fresh", err);
      return emptyFile();
    }
  }

  function persist(): void {
    try {
      store.setItem(key, JSON.stringify(file));
    } catch (err) {
      // Quota or storage failure: the in-memory copy stays authoritative for
      // this session; durability degrades but the app keeps working.
      console.warn("wal: failed to persist log", err);
    }
  }

  return {
    append(record) {
      const last = file.records[file.records.length - 1];
      if (
        last !== undefined &&
        last.action.type === "draftUpdate" &&
        record.action.type === "draftUpdate"
      ) {
        // Tail-merge: collapse a burst of draft typing into one record.
        file.records[file.records.length - 1] = {
          id: record.id,
          at: record.at,
          action: {
            type: "draftUpdate",
            patch: { ...last.action.patch, ...record.action.patch },
          },
        };
      } else {
        file.records.push(record);
      }
      persist();
    },

    freezeBatch() {
      // Never two batches in flight: an existing frozen batch must be acked
      // or abandoned before the next one is cut.
      if (file.inFlight !== null) return file.inFlight;
      if (file.records.length === 0) return null;

      const consolidated = consolidate(file.records);
      const batch: FrozenBatch = {
        batchId: crypto.randomUUID(),
        records: consolidated.slice(0, MAX_SYNC_ACTIONS),
      };
      file.inFlight = batch;
      file.records = consolidated.slice(MAX_SYNC_ACTIONS);
      persist();
      return batch;
    },

    inFlight() {
      return file.inFlight;
    },

    ackInFlight() {
      file.inFlight = null;
      persist();
    },

    abandonInFlight() {
      // Semantically the batch is poisoned and dropped.
      file.inFlight = null;
      persist();
    },

    unflushed() {
      return [...(file.inFlight?.records ?? []), ...file.records];
    },

    hasWork() {
      return file.inFlight !== null || file.records.length > 0;
    },

    clear() {
      file = emptyFile();
      persist();
    },
  };
}
