import type { Entry } from "../db/entries.store";

// Module-level in-memory cache for /api/entries responses, so toggling
// between the vine's day view and the grid view stops refetching from the
// database on every remount. Deliberately NOT localStorage: entries can be
// edited from another device, and a persistent cache would show stale data
// across devices. An in-memory session cache fixes the toggle-spam problem
// without cross-device staleness.
//
// Invalidation model:
// - New entries from background flushes: each slot is stored under the
//   entriesVersion it was fetched at, and only hits when the caller's
//   version matches — a version bump is automatically a miss, no explicit
//   clearing needed. Stale slots simply never hit again and eventually
//   evict.
// - In-place edits (entry PATCH): callers invoke invalidateEntriesCache(),
//   which clears everything, so no view is served the pre-edit copy.
// - Cross-device edits: a fresh page load starts with an empty cache, so
//   they appear on reload.

interface CacheSlot {
  version: number;
  entries: Entry[];
}

// Cap the cache so browsing many historical days can't grow it unbounded.
// A Map iterates in insertion order, so the first key is the oldest insert.
const MAX_SLOTS = 40;

const cache = new Map<string, CacheSlot>();

/** Build the cache key for an entries fetch: "all" for the full history
 *  (no range), or `${from}:${to}` for a day range. */
export function entriesCacheKey(from?: number, to?: number): string {
  if (from === undefined && to === undefined) return "all";
  return `${from}:${to}`;
}

/** Return the cached entries for `key`, but only if they were stored at
 *  exactly this `version` — any version difference is a miss. */
export function getCachedEntries(key: string, version: number): Entry[] | null {
  const slot = cache.get(key);
  if (!slot || slot.version !== version) return null;
  return slot.entries;
}

/** Store a fetch result under `key` at `version`, evicting the oldest
 *  inserted slot when the cache is over its cap. */
export function setCachedEntries(
  key: string,
  version: number,
  entries: Entry[],
): void {
  // Delete-then-set so an overwrite refreshes the key's insertion position.
  cache.delete(key);
  cache.set(key, { version, entries });
  while (cache.size > MAX_SLOTS) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Clear the whole cache — called after any entry PATCH so no view can be
 *  served the pre-edit copy. */
export function invalidateEntriesCache(): void {
  cache.clear();
}
