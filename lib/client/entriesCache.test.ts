import { describe, expect, it, beforeEach } from "vitest";
import type { Entry } from "../db/entries.store";
import {
  entriesCacheKey,
  getCachedEntries,
  setCachedEntries,
  invalidateEntriesCache,
} from "./entriesCache";

function makeEntry(id: string): Entry {
  return {
    id,
    userId: "user-1",
    from: new Date("2024-01-15T10:00:00Z"),
    to: new Date("2024-01-15T11:00:00Z"),
    tag: "Deep work",
    feel: "Charged",
    intent: "yes",
    bullets: ["did a thing"],
    createdAt: new Date("2024-01-15T11:00:00Z"),
  } as Entry;
}

beforeEach(() => {
  // Module-level state persists between tests — start each one empty.
  invalidateEntriesCache();
});

describe("entriesCacheKey", () => {
  it("returns 'all' when no range is given", () => {
    expect(entriesCacheKey()).toBe("all");
  });

  it("returns 'from:to' for a day range", () => {
    expect(entriesCacheKey(1000, 2000)).toBe("1000:2000");
  });

  it("gives distinct keys to distinct ranges", () => {
    expect(entriesCacheKey(1000, 2000)).not.toBe(entriesCacheKey(3000, 4000));
    expect(entriesCacheKey(1000, 2000)).not.toBe(entriesCacheKey());
  });
});

describe("getCachedEntries / setCachedEntries", () => {
  it("misses on an empty cache", () => {
    expect(getCachedEntries("all", 0)).toBeNull();
  });

  it("hits only when the stored version matches", () => {
    const entries = [makeEntry("a")];
    setCachedEntries("all", 3, entries);

    expect(getCachedEntries("all", 3)).toBe(entries);
  });

  it("misses when the caller's version differs (bump = automatic miss)", () => {
    setCachedEntries("all", 3, [makeEntry("a")]);

    expect(getCachedEntries("all", 4)).toBeNull();
    expect(getCachedEntries("all", 2)).toBeNull();
  });

  it("misses on a key that was never set", () => {
    setCachedEntries("all", 0, [makeEntry("a")]);

    expect(getCachedEntries("1000:2000", 0)).toBeNull();
  });

  it("overwrites an existing slot on set", () => {
    const first = [makeEntry("a")];
    const second = [makeEntry("b")];
    setCachedEntries("all", 0, first);
    setCachedEntries("all", 1, second);

    expect(getCachedEntries("all", 0)).toBeNull();
    expect(getCachedEntries("all", 1)).toBe(second);
  });
});

describe("invalidateEntriesCache", () => {
  it("clears every slot", () => {
    setCachedEntries("all", 0, [makeEntry("a")]);
    setCachedEntries("1000:2000", 0, [makeEntry("b")]);

    invalidateEntriesCache();

    expect(getCachedEntries("all", 0)).toBeNull();
    expect(getCachedEntries("1000:2000", 0)).toBeNull();
  });
});

describe("eviction cap", () => {
  it("evicts the oldest inserted slot beyond 40 entries", () => {
    for (let i = 0; i < 41; i++) {
      setCachedEntries(`key-${i}`, 0, [makeEntry(`e-${i}`)]);
    }

    // The first insert fell off; the newest 40 remain.
    expect(getCachedEntries("key-0", 0)).toBeNull();
    expect(getCachedEntries("key-1", 0)).not.toBeNull();
    expect(getCachedEntries("key-40", 0)).not.toBeNull();
  });

  it("counts an overwrite as a fresh insert, not a new slot", () => {
    for (let i = 0; i < 40; i++) {
      setCachedEntries(`key-${i}`, 0, [makeEntry(`e-${i}`)]);
    }
    // Re-set the oldest key: it moves to the back of the insertion order
    // and the cache stays at the cap, so nothing evicts...
    setCachedEntries("key-0", 1, [makeEntry("e-0-v1")]);
    expect(getCachedEntries("key-1", 0)).not.toBeNull();

    // ...and the next brand-new insert evicts key-1 (now the oldest), not
    // the freshly re-set key-0.
    setCachedEntries("key-new", 0, [makeEntry("e-new")]);
    expect(getCachedEntries("key-1", 0)).toBeNull();
    expect(getCachedEntries("key-0", 1)).not.toBeNull();
  });
});
