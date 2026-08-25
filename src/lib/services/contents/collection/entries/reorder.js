import { isObject } from '@sveltia/utils/object';

import { saveChanges } from '$lib/services/backends/save';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getIndexFile } from '$lib/services/contents/collection/entries/index-file';
import {
  buildEntryUpdateChanges,
  createSyntheticDraft,
  resolveCacheDB,
} from '$lib/services/contents/entry/changes';

/**
 * @import { IndexedDB } from '@sveltia/utils/storage';
 * @import { Entry, FileChange, InternalEntryCollection } from '$lib/types/private';
 */

/**
 * The default field key used to store an entry’s display order when reordering is enabled and no
 * custom key is configured.
 * @type {string}
 */
export const DEFAULT_ORDER_FIELD_KEY = 'order';

/**
 * Get the field key used to persist an entry’s display order for the given collection.
 * @param {any} collection Collection (typically an entry collection). Anything else returns
 * `undefined`.
 * @returns {string | undefined} Field key, or `undefined` if reordering is not enabled.
 */
export const getOrderFieldKey = (collection) => {
  const reorder = collection?.reorder;

  if (!reorder) {
    return undefined;
  }

  if (isObject(reorder) && typeof reorder.key === 'string' && reorder.key) {
    return reorder.key;
  }

  return DEFAULT_ORDER_FIELD_KEY;
};

/**
 * Get the name of the view group that entries should be grouped by while the given collection is in
 * reorder mode, as configured with `reorder: { group: '…' }`. The group is named explicitly rather
 * than reusing whatever grouping the user has active, because the order field is renumbered group
 * by group: an arbitrary grouping would produce a different numbering every time and the values
 * would conflict.
 * @param {any} collection Collection (typically an entry collection). Anything else returns
 * `undefined`.
 * @returns {string | undefined} Group name, or `undefined` if reorder grouping is not configured.
 */
export const getReorderGroupName = (collection) => {
  const reorder = collection?.reorder;

  if (isObject(reorder) && typeof reorder.group === 'string' && reorder.group) {
    return reorder.group;
  }

  return undefined;
};

/**
 * Sort entries by the collection’s `order` field. Entries lacking a valid numeric value are placed
 * at the end while preserving their relative input order.
 * @param {Entry[]} entries Entries to sort.
 * @param {InternalEntryCollection} collection Entry collection.
 * @returns {Entry[]} New, sorted array.
 */
export const sortEntriesByOrderField = (entries, collection) => {
  const orderKey = getOrderFieldKey(collection);

  if (!orderKey) {
    return [...entries];
  }

  const { defaultLocale } = collection._i18n;

  // Pre-compute each entry’s numeric order value once so the comparator — which runs O(N log N)
  // times — only does a cheap numeric comparison rather than re-walking the property chain.
  const keyed = entries.map((entry) => {
    const v = Number(entry.locales[defaultLocale]?.content?.[orderKey]);

    return { entry, v, has: Number.isFinite(v) };
  });

  keyed.sort((a, b) => {
    if (a.has && b.has) return a.v - b.v;
    if (a.has) return -1;
    if (b.has) return 1;
    return 0;
  });

  return keyed.map(({ entry }) => entry);
};

/**
 * Apply a new order value to all locales of an entry that have content. Locales without content are
 * passed through unchanged so that they can still be referenced (e.g. for paths) without adding an
 * `order` field to an empty content object.
 * @param {Entry} entry Source entry.
 * @param {string} orderKey Order field key.
 * @param {number} newOrder New order value.
 * @returns {Entry} Updated entry (the original entry is not mutated).
 */
const withUpdatedOrder = (entry, orderKey, newOrder) => {
  /** @type {Entry['locales']} */
  const updatedLocales = Object.fromEntries(
    Object.entries(entry.locales).map(([locale, le]) => [
      locale,
      le.content ? { ...le, content: { ...le.content, [orderKey]: newOrder } } : { ...le },
    ]),
  );

  return { ...entry, locales: updatedLocales };
};

/**
 * Build the {@link FileChange}s needed to renumber the given entries with new 1-based order values.
 * Entries whose order field already matches the target value are skipped so no empty commits are
 * produced. The returned `savingEntries` are clones with the new order applied.
 * @param {InternalEntryCollection} collection Entry collection.
 * @param {Entry[]} orderedEntries Entries in the desired display order.
 * @param {object} [options] Options.
 * @param {IndexedDB} [options.cacheDB] Pre-opened file-cache database to reuse.
 * @returns {Promise<{ changes: FileChange[], savingEntries: Entry[] }>} Collected changes and the
 * entries to be saved.
 */
const buildReorderChanges = async (collection, orderedEntries, { cacheDB } = {}) => {
  const orderKey = getOrderFieldKey(collection);

  if (!orderKey) {
    return { changes: [], savingEntries: [] };
  }

  const {
    _i18n: { defaultLocale },
  } = collection;

  const db = resolveCacheDB(cacheDB);
  const savingEntries = [];

  // Single pass: skip entries whose order already matches the target value (so unchanged entries
  // don’t trigger a normalize-only commit) and re-tag the rest with the new 1-based order. The
  // existing value is coerced to a number so that a string-typed `order` (e.g. `"5"`) is treated as
  // already-correct when it matches the new numeric order.
  // eslint-disable-next-line no-restricted-syntax
  for (const [index, entry] of orderedEntries.entries()) {
    const newOrder = index + 1;

    if (Number(entry.locales[defaultLocale]?.content?.[orderKey]) !== newOrder) {
      savingEntries.push(withUpdatedOrder(entry, orderKey, newOrder));
    }
  }

  // Build the synthetic draft once for the whole batch — its shape is identical across entries.
  const draft = createSyntheticDraft({ collection });

  // Build file changes in parallel
  const perEntryChanges = await Promise.all(
    savingEntries.map((entry) =>
      buildEntryUpdateChanges({ collection, entry, draft, cacheDB: db }),
    ),
  );

  return { changes: perEntryChanges.flat(), savingEntries };
};

/**
 * Re-save entries in the given collection with updated order values. Entries whose order field
 * value is unchanged are skipped to avoid unnecessary commits. Files are written using the
 * collection’s configured format and i18n structure.
 * @param {InternalEntryCollection} collection Entry collection.
 * @param {Entry[]} orderedEntries Entries in the desired display order. The new order value
 * assigned to each entry is its 1-based index in this list.
 * @param {object} [options] Options.
 * @param {boolean} [options.silent] When `true`, do not update the {@link contentUpdatesToast}
 * store. Useful for follow-up renumbering done as part of another operation (e.g. delete).
 * @returns {Promise<number>} Number of entries actually updated.
 */
export const reorderEntries = async (collection, orderedEntries, { silent = false } = {}) => {
  const { changes, savingEntries } = await buildReorderChanges(collection, orderedEntries);

  if (!changes.length) {
    return 0;
  }

  await saveChanges({
    changes,
    savingEntries,
    options: { commitType: 'update', collection },
  });

  if (!silent) {
    contentUpdatesToast.set({
      ...UPDATE_TOAST_DEFAULT_STATE,
      saved: true,
      count: savingEntries.length,
    });
  }

  return savingEntries.length;
};

/**
 * Compute the renumbered list of remaining entries for the given collection, in the order their
 * `order` field should be persisted. Entries currently lacking a valid numeric order are placed at
 * the end. The collection’s index file (if any) is excluded.
 * @param {InternalEntryCollection} collection Entry collection.
 * @param {object} [options] Options.
 * @param {Set<string>} [options.excludeIds] IDs of entries to omit (e.g. entries about to be
 * deleted). The collection’s current entries are read from {@link getEntriesByCollection}.
 * @returns {Entry[]} Entries in the desired display order, with the index file removed.
 */
const computeRenumberedEntries = (collection, { excludeIds } = {}) => {
  const indexFileName = getIndexFile(collection)?.name;

  // The index file (e.g. Hugo `_index.md`) is always pinned to the top of the list by the sort
  // pipeline regardless of its `order` value, so it should never participate in numbering.
  const remaining = getEntriesByCollection(collection.name).filter(
    (entry) => entry.slug !== indexFileName && !(excludeIds && excludeIds.has(entry.id)),
  );

  return sortEntriesByOrderField(remaining, collection);
};

/**
 * Build the renumber {@link FileChange}s for a collection without saving them. Useful when the
 * caller wants to bundle the renumber into another commit (e.g. delete).
 * @param {InternalEntryCollection | undefined} collection Entry collection.
 * @param {object} [options] Options.
 * @param {Set<string>} [options.excludeIds] IDs of entries to omit (e.g. entries about to be
 * deleted).
 * @param {IndexedDB} [options.cacheDB] Pre-opened file-cache database to reuse.
 * @returns {Promise<{ changes: FileChange[], savingEntries: Entry[] }>} Collected changes and the
 * entries to be saved. Empty when reordering is not enabled or nothing changed.
 */
export const buildRenumberChanges = async (collection, { excludeIds, cacheDB } = {}) => {
  if (!collection || collection._type !== 'entry' || !getOrderFieldKey(collection)) {
    return { changes: [], savingEntries: [] };
  }

  return buildReorderChanges(collection, computeRenumberedEntries(collection, { excludeIds }), {
    cacheDB,
  });
};

/**
 * Renumber the remaining entries in a collection after one or more entries have been deleted, so
 * that the order field stays compact (1, 2, 3, …). Entries currently lacking a valid numeric order
 * are placed at the end. Does nothing if the collection does not have reordering enabled.
 * @param {InternalEntryCollection | undefined} collection Entry collection.
 * @returns {Promise<number>} Number of entries actually updated.
 */
export const renumberCollectionEntries = async (collection) => {
  if (!collection || collection._type !== 'entry' || !getOrderFieldKey(collection)) {
    return 0;
  }

  return reorderEntries(collection, computeRenumberedEntries(collection), { silent: true });
};
