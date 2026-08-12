import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Action } from "../timer/engine";
import {
  MAX_SYNC_ACTIONS,
  createWalStore,
  walKey,
  type WalRecord,
} from "./wal";

/** Minimal in-memory Storage — keeps these tests independent of jsdom. */
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

let nextId = 0;

function record(action: Action, at = 1_700_000_000_000 + nextId): WalRecord {
  nextId += 1;
  return { id: `id-${nextId}`, at, action };
}

function skipRecord(): WalRecord {
  return record({ type: "skip" });
}

function draftRecord(patch: {
  bullets?: string[];
  tag?: string | null;
  feel?: string | null;
  intent?: string | null;
}): WalRecord {
  return record({ type: "draftUpdate", patch });
}

describe("walKey", () => {
  it("builds the versioned per-user key", () => {
    expect(walKey("user-1")).toBe("pomodiary:wal:v1:user-1");
  });
});

describe("createWalStore", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    nextId = 0;
    storage = new MemoryStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isolates users by key", () => {
    const a = createWalStore("alice", storage);
    const b = createWalStore("bob", storage);

    a.append(skipRecord());

    expect(a.hasWork()).toBe(true);
    expect(b.hasWork()).toBe(false);
    expect(storage.getItem(walKey("alice"))).not.toBeNull();
    expect(storage.getItem(walKey("bob"))).toBeNull();
  });

  it("round-trips records through storage: a new store sees prior records", () => {
    const first = createWalStore("u", storage);
    const rec = skipRecord();
    first.append(rec);

    const second = createWalStore("u", storage);
    expect(second.unflushed()).toEqual([rec]);
    expect(second.hasWork()).toBe(true);
  });

  it("persists inFlight across a reload with the same batchId", () => {
    const first = createWalStore("u", storage);
    first.append(skipRecord());
    const batch = first.freezeBatch();
    expect(batch).not.toBeNull();

    const second = createWalStore("u", storage);
    const revived = second.inFlight();
    expect(revived).not.toBeNull();
    expect(revived!.batchId).toBe(batch!.batchId);
    expect(revived!.records).toEqual(batch!.records);
  });

  it("resets cleanly with a warning on corrupt JSON", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    storage.setItem(walKey("u"), "{definitely not json");

    const store = createWalStore("u", storage);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(store.hasWork()).toBe(false);
    expect(store.unflushed()).toEqual([]);

    // The fresh file is usable and persists over the corrupt blob.
    const rec = skipRecord();
    store.append(rec);
    expect(createWalStore("u", storage).unflushed()).toEqual([rec]);
  });

  it("resets cleanly with a warning on a wrong persisted version", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    storage.setItem(
      walKey("u"),
      JSON.stringify({ v: 2, inFlight: null, records: [skipRecord()] }),
    );

    const store = createWalStore("u", storage);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(store.hasWork()).toBe(false);
  });

  it("tail-merges consecutive draftUpdates, keeping the newest id/at", () => {
    const store = createWalStore("u", storage);
    store.append(draftRecord({ tag: "Deep work", bullets: ["a"] }));
    const newest = draftRecord({ bullets: ["a", "b"], feel: "good" });
    store.append(newest);

    const records = store.unflushed();
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe(newest.id);
    expect(records[0].at).toBe(newest.at);
    expect(records[0].action).toEqual({
      type: "draftUpdate",
      patch: { tag: "Deep work", bullets: ["a", "b"], feel: "good" },
    });
  });

  it("does not tail-merge a draftUpdate across a non-draft action", () => {
    const store = createWalStore("u", storage);
    store.append(draftRecord({ tag: "A" }));
    store.append(skipRecord());
    store.append(draftRecord({ tag: "B" }));

    expect(store.unflushed()).toHaveLength(3);
  });

  it("freezeBatch consolidates and moves records into the batch", () => {
    const store = createWalStore("u", storage);
    // Two consecutive draftUpdates followed by a skip: consolidation drops
    // the (already tail-merged) draft entirely.
    store.append(draftRecord({ tag: "A" }));
    store.append(draftRecord({ feel: "ok" }));
    const skip = skipRecord();
    store.append(skip);

    const batch = store.freezeBatch();

    expect(batch).not.toBeNull();
    expect(batch!.records).toEqual([skip]);
    expect(batch!.batchId).toMatch(/[0-9a-f-]{36}/);
    expect(store.inFlight()).toEqual(batch);
    expect(store.unflushed()).toEqual([skip]); // nothing left outside the batch
  });

  it("freezeBatch returns null when there is nothing to send", () => {
    const store = createWalStore("u", storage);
    expect(store.freezeBatch()).toBeNull();
  });

  it("freezeBatch while a batch is in flight returns the SAME batch untouched", () => {
    const store = createWalStore("u", storage);
    store.append(skipRecord());
    const first = store.freezeBatch();

    store.append(skipRecord());
    const second = store.freezeBatch();

    expect(second).toEqual(first);
    expect(second!.records).toHaveLength(1);
    // The new record stayed behind in the queue.
    expect(store.unflushed()).toHaveLength(2);
  });

  it("chunks at MAX_SYNC_ACTIONS and leaves the remainder queued", () => {
    const store = createWalStore("u", storage);
    const total = MAX_SYNC_ACTIONS + 50;
    for (let i = 0; i < total; i++) store.append(skipRecord());

    const batch = store.freezeBatch();

    expect(batch!.records).toHaveLength(MAX_SYNC_ACTIONS);
    expect(store.unflushed()).toHaveLength(total);
    store.ackInFlight();
    expect(store.unflushed()).toHaveLength(50);
  });

  it("unflushed() is inFlight records followed by queued records", () => {
    const store = createWalStore("u", storage);
    const first = skipRecord();
    store.append(first);
    store.freezeBatch();
    const second = skipRecord();
    store.append(second);

    expect(store.unflushed()).toEqual([first, second]);
  });

  it("ackInFlight clears the in-flight batch", () => {
    const store = createWalStore("u", storage);
    store.append(skipRecord());
    store.freezeBatch();

    store.ackInFlight();

    expect(store.inFlight()).toBeNull();
    expect(store.hasWork()).toBe(false);
    // And the cleared state persisted.
    expect(createWalStore("u", storage).hasWork()).toBe(false);
  });

  it("abandonInFlight drops the in-flight batch", () => {
    const store = createWalStore("u", storage);
    store.append(skipRecord());
    store.freezeBatch();
    const queued = skipRecord();
    store.append(queued);

    store.abandonInFlight();

    expect(store.inFlight()).toBeNull();
    expect(store.unflushed()).toEqual([queued]);
  });

  it("clear() wipes everything", () => {
    const store = createWalStore("u", storage);
    store.append(skipRecord());
    store.freezeBatch();
    store.append(skipRecord());

    store.clear();

    expect(store.hasWork()).toBe(false);
    expect(store.inFlight()).toBeNull();
    expect(createWalStore("u", storage).hasWork()).toBe(false);
  });

  it("keeps the in-memory copy authoritative when persistence throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const quotaStorage = new MemoryStorage();
    quotaStorage.setItem = () => {
      throw new Error("QuotaExceededError");
    };

    const store = createWalStore("u", quotaStorage);
    const rec = skipRecord();
    store.append(rec);

    expect(warn).toHaveBeenCalled();
    expect(store.unflushed()).toEqual([rec]);
    const batch = store.freezeBatch();
    expect(batch!.records).toEqual([rec]);
  });
});
