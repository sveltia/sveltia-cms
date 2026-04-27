import { isObject } from '@sveltia/utils/object';
import { IndexedDB } from '@sveltia/utils/storage';
import { get } from 'svelte/store';

import { backend } from '$lib/services/backends';
import { saveChanges } from '$lib/services/backends/save';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getPreviousSha } from '$lib/services/contents/draft/save/changes';
import { serializeContent } from '$lib/services/contents/draft/save/serialize';
import { formatEntryFile } from '$lib/services/contents/file/format';

/**
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
 * Build a synthetic draft object suitable for {@link serializeContent}. The draft shape is
 * identical for every entry in a given collection during reorder, so callers should build it once
 * per batch and pass it down to avoid per-entry allocations.
 * @param {InternalEntryCollection} collection Entry collection.
 * @returns {any} Synthetic draft.
 */
const createSyntheticDraft = (collection) => ({
  collection,
  collectionName: collection.name,
  collectionFile: undefined,
  fields: collection.fields,
  isIndexFile: false,
});

/**
 * Build the file content for a single-file entry, taking i18n single-file structures into account.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Entry collection.
 * @param {Entry} args.entry Entry whose locales have already been updated with the new order.
 * @param {any} args.draft Synthetic draft shared across the batch.
 * @returns {Record<string, any>} Serializable content object passed to {@link formatEntryFile}.
 */
const buildSingleFileContent = ({ collection, entry, draft }) => {
  const {
    _i18n: { i18nEnabled, defaultLocale, structureMap: { i18nSingleFileDefaultRoot } = {} },
  } = collection;

  if (!i18nEnabled) {
    return serializeContent({
      draft,
      locale: '_default',
      valueMap: entry.locales[defaultLocale].content,
    });
  }

  const localeContents = Object.fromEntries(
    Object.entries(entry.locales)
      .filter(([, le]) => !!le.content)
      .map(([locale, le]) => [locale, serializeContent({ draft, locale, valueMap: le.content })]),
  );

  if (i18nSingleFileDefaultRoot) {
    const { lang: _lang, ...defaultContent } = localeContents[defaultLocale] ?? {};

    const nonDefaultContent = Object.fromEntries(
      Object.entries(localeContents).filter(([locale]) => locale !== defaultLocale),
    );

    return {
      lang: [defaultLocale, ...Object.keys(nonDefaultContent)],
      ...defaultContent,
      ...nonDefaultContent,
    };
  }

  // `i18nSingleFile`: nested locale keys
  return localeContents;
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
 * Build a single {@link FileChange} for an entry that lives in one file (no i18n, single-file i18n,
 * or default-root single-file i18n).
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Entry collection.
 * @param {Entry} args.entry Entry whose locales already have the new order applied.
 * @param {any} args.draft Synthetic draft shared across the batch.
 * @param {IndexedDB | undefined} args.cacheDB File cache database, when available.
 * @returns {Promise<FileChange>} Update change.
 */
const buildSingleFileChange = async ({ collection, entry, draft, cacheDB }) => {
  const {
    _file,
    _i18n: { defaultLocale },
  } = collection;

  const { slug, path } = entry.locales[defaultLocale];

  const [previousSha, data] = await Promise.all([
    getPreviousSha({ cacheDB, previousPath: path }),
    formatEntryFile({ content: buildSingleFileContent({ collection, entry, draft }), _file }),
  ]);

  return /** @type {FileChange} */ ({ action: 'update', slug, path, previousSha, data });
};

/**
 * Build per-locale {@link FileChange} entries for an entry that lives in one file per locale.
 * Locales without content are skipped.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Entry collection.
 * @param {Entry} args.entry Entry whose locales already have the new order applied.
 * @param {any} args.draft Synthetic draft shared across the batch.
 * @param {IndexedDB | undefined} args.cacheDB File cache database, when available.
 * @returns {Promise<FileChange[]>} Update changes.
 */
const buildMultiFileChanges = async ({ collection, entry, draft, cacheDB }) => {
  const {
    _file,
    _i18n: { allLocales },
  } = collection;

  const localeChanges = await Promise.all(
    allLocales.map(async (locale) => {
      const le = entry.locales[locale];

      if (!le?.content) {
        return undefined;
      }

      const [previousSha, data] = await Promise.all([
        getPreviousSha({ cacheDB, previousPath: le.path }),
        formatEntryFile({
          content: serializeContent({ draft, locale, valueMap: le.content }),
          _file,
        }),
      ]);

      return /** @type {FileChange} */ ({
        action: 'update',
        slug: le.slug,
        path: le.path,
        previousSha,
        data,
      });
    }),
  );

  return /** @type {FileChange[]} */ (localeChanges.filter(Boolean));
};

/**
 * Resolve a usable file-cache `IndexedDB` handle: prefer the caller-provided one (so the same
 * handle is shared across composite operations like delete + renumber), otherwise open one.
 * @param {IndexedDB} [provided] Caller-provided handle.
 * @returns {IndexedDB | undefined} Cache handle, or `undefined` if no backend is configured.
 */
const resolveCacheDB = (provided) => {
  if (provided) {
    return provided;
  }

  const databaseName = get(backend)?.repository?.databaseName;

  return databaseName ? new IndexedDB(databaseName, 'file-cache') : undefined;
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
    _i18n: {
      i18nEnabled,
      defaultLocale,
      structureMap: { i18nSingleFile, i18nSingleFileDefaultRoot } = {},
    },
  } = collection;

  const isSingleFile = !i18nEnabled || i18nSingleFile || i18nSingleFileDefaultRoot;
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
  const draft = createSyntheticDraft(collection);

  // Build file changes in parallel
  const perEntryChanges = await Promise.all(
    savingEntries.map((entry) =>
      isSingleFile
        ? buildSingleFileChange({ collection, entry, draft, cacheDB: db }).then((change) => [
            change,
          ])
        : buildMultiFileChanges({ collection, entry, draft, cacheDB: db }),
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
