import { entryDraft } from '$lib/services/contents/draft';

/**
 * @import {
 * DraftValueStoreKey,
 * EntryDraft,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 */

/**
 * Cache of value map snapshots for the current entry draft, keyed by value store key and locale.
 * This is intentionally a plain `Map`, not a `SvelteMap`: it’s a memo of the store’s current value,
 * and making it reactive would add a spurious dependency to every field editor that reads it.
 * @type {Map<string, FlattenedEntryContent>}
 */
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const snapshotCache = new Map();

// Any assignment to the draft ends up calling `entryDraft.set()` — including a nested one made
// through the `$entryDraft` store in a component, which Svelte compiles to a store mutation — so
// clearing the cache here keeps the snapshots exactly as fresh as a per-component `$derived`.
// A `delete` is the exception: Svelte doesn’t compile it to a store mutation, so a caller dropping
// a key has to do it within an `entryDraft.update()` block, or the snapshot taken by whoever reads
// the store next would still list the deleted key.
entryDraft.subscribe(() => {
  snapshotCache.clear();
});

/**
 * Get a snapshot of the flattened entry content for the given locale, detached from the Proxy in
 * {@link EntryDraft}. The result is cached and shared between callers until the draft is updated
 * next. The editor renders one component per field, and each of them needs the whole content to
 * resolve variable types and list items, so snapshotting it separately in every component is
 * prohibitively expensive for large entries.
 * @param {EntryDraft | null | undefined} draft Entry draft.
 * @param {InternalLocaleCode} locale Locale code.
 * @param {DraftValueStoreKey} [valueStoreKey] Key to read the values from.
 * @returns {FlattenedEntryContent} Flattened entry content. An empty object if unavailable.
 */
export const getValueMapSnapshot = (draft, locale, valueStoreKey = 'currentValues') => {
  if (!draft) {
    return {};
  }

  const cacheKey = `${valueStoreKey}\n${locale}`;
  const cached = snapshotCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  /** @type {FlattenedEntryContent} */
  const snapshot = $state.snapshot(draft[valueStoreKey]?.[locale]) ?? {};

  snapshotCache.set(cacheKey, snapshot);

  return snapshot;
};
