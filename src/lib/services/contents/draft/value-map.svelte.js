import { untrack } from 'svelte';

import {
  getSubtreeVersion,
  getValueMapVersion,
} from '$lib/services/contents/draft/create/versioned-map.svelte';

/**
 * @import {
 * DraftValueStoreKey,
 * EntryDraft,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Cache of value map snapshots, keyed by the value map proxy each was taken from, along with the
 * proxy’s version at the time. This is intentionally a plain `WeakMap`, not a `SvelteMap`: it’s a
 * memo, and making it reactive would add a spurious dependency to every field editor that reads it.
 * The entries are garbage-collected along with the drafts.
 * @type {WeakMap<FlattenedEntryContent, { version: number, snapshot: FlattenedEntryContent }>}
 */
const snapshotCache = new WeakMap();

/**
 * Get a snapshot of the flattened entry content for the given locale, detached from the Proxy in
 * {@link EntryDraft}. The result is cached and shared between callers until the values are updated
 * next. The editor renders one component per field, and each of them needs the whole content to
 * resolve variable types and list items, so snapshotting it separately in every component is
 * prohibitively expensive for large entries.
 *
 * Called from a `$derived`, this only depends on the value map’s version rather than on every value
 * in it, so the derived is recomputed once per update and hands back the shared snapshot.
 * @param {EntryDraft | null | undefined} draft Entry draft.
 * @param {InternalLocaleCode} locale Locale code.
 * @param {DraftValueStoreKey} [valueStoreKey] Key to read the values from.
 * @returns {FlattenedEntryContent} Flattened entry content. An empty object if unavailable.
 */
export const getValueMapSnapshot = (draft, locale, valueStoreKey = 'currentValues') => {
  const valueMap = draft?.[valueStoreKey]?.[locale];

  if (!valueMap) {
    return {};
  }

  const version = getValueMapVersion(valueMap);

  // A plain object, e.g. in a draft built for a one-off validation, has no version to memoize on
  if (version === undefined) {
    return $state.snapshot(valueMap);
  }

  const cached = snapshotCache.get(valueMap);

  if (cached?.version === version) {
    return cached.snapshot;
  }

  // The version is the only dependency a reactive caller needs
  const snapshot = untrack(() => $state.snapshot(valueMap));

  snapshotCache.set(valueMap, { version, snapshot });

  return snapshot;
};

/**
 * Get a snapshot of the flattened entry content for every locale of the given draft, with
 * {@link getValueMapSnapshot}. Called from a `$derived`, this only depends on the versions of the
 * value maps, and a locale that hasn’t changed keeps the same snapshot.
 * @param {EntryDraft} draft Entry draft.
 * @returns {Record<InternalLocaleCode, FlattenedEntryContent>} Flattened entry content, keyed by
 * locale.
 */
export const getValueMapSnapshots = (draft) =>
  Object.fromEntries(
    Object.keys(draft.currentValues ?? {}).map((locale) => [
      locale,
      getValueMapSnapshot(draft, locale),
    ]),
  );

/**
 * Get the same snapshot as {@link getValueMapSnapshot}, but, called from a `$derived`, only depend
 * on the given field’s values: the value at its key path and every value below it. A field editor
 * reads the whole map, e.g. to resolve a variable type, but only has to be updated when its own
 * values change, rather than whenever any field in the entry does — which with every field of a
 * long entry rendered makes each keystroke update hundreds of editors.
 * @param {EntryDraft | null | undefined} draft Entry draft.
 * @param {InternalLocaleCode} locale Locale code.
 * @param {FieldKeyPath} keyPath Key path of the field.
 * @param {DraftValueStoreKey} [valueStoreKey] Key to read the values from.
 * @returns {FlattenedEntryContent} Flattened entry content. An empty object if unavailable.
 */
export const getFieldValueMapSnapshot = (
  draft,
  locale,
  keyPath,
  valueStoreKey = 'currentValues',
) => {
  // A plain object, e.g. in a draft built for a one-off validation, has no versions
  if (getSubtreeVersion(draft?.[valueStoreKey]?.[locale], keyPath) === undefined) {
    return getValueMapSnapshot(draft, locale, valueStoreKey);
  }

  return untrack(() => getValueMapSnapshot(draft, locale, valueStoreKey));
};
