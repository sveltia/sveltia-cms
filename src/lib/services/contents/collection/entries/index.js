/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */

import { getMediaFieldSource } from '$lib/services/assets/info';
import { cmsConfig } from '$lib/services/config';
import { allEntries, allEntryFolders } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import {
  getIndexFile,
  getIndexFileName,
  isCollectionIndexFile,
} from '$lib/services/contents/collection/entries/index-file';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getAssociatedCollections } from '$lib/services/contents/entry';
import { getField, getPropertyValue } from '$lib/services/contents/entry/fields';
import { MEDIA_FIELD_TYPES } from '$lib/services/contents/fields';
import { getRegex } from '$lib/services/utils/regex';
import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import {
 * AssetReference,
 * Entry,
 * EntryFolderInfo,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalCollectionFile,
 * } from '$lib/types/private';
 * @import { Field, FieldKeyPath } from '$lib/types/public';
 */

/**
 * Regular expression to match `![alt](src "title")`.
 */
export const MARKDOWN_IMAGE_REGEX = /!\[.*?\]\((.+?)(?:\s+".*?")?\)/g;

/**
 * Currently selected entries.
 * @type {{ current: Entry[] }}
 */
export const selectedEntries = createRawState([]);

/**
 * Set of selected entry IDs, for O(1) membership checks in list items.
 */
export const selectedEntryIdSet = createDerivedState(
  () => new Set(selectedEntries.current.map((entry) => entry.id)),
);

/**
 * @typedef {object} EntryFilterCondition
 * @property {FieldKeyPath} field Field key path to look at.
 * @property {RegExp} [pattern] Compiled `pattern` option, if any. It takes precedence over
 * {@link EntryFilterCondition.values}.
 * @property {any[]} values Normalized `value` option.
 */

/**
 * Cache for {@link getFilterCondition}, so the `pattern` regex is compiled once per collection
 * rather than once per entry. Keyed by the collection object, which is replaced whenever the
 * configuration is loaded again, so the stale conditions can be garbage collected.
 * @type {WeakMap<InternalCollection, EntryFilterCondition | undefined>}
 */
const filterConditionCache = new WeakMap();

/**
 * Get the normalized `filter` option of the given collection.
 * @param {InternalCollection} collection Collection.
 * @returns {EntryFilterCondition | undefined} Condition, or `undefined` if the collection is not an
 * entry collection or defines no usable filter.
 */
const getFilterCondition = (collection) => {
  if (!filterConditionCache.has(collection)) {
    const { filter } = collection._type === 'entry' ? collection : {};
    const field = filter?.field;

    filterConditionCache.set(
      collection,
      field === undefined
        ? undefined
        : {
            field,
            pattern: getRegex(filter?.pattern),
            values:
              filter?.value === undefined
                ? []
                : Array.isArray(filter.value)
                  ? filter.value
                  : [filter.value],
          },
    );
  }

  return filterConditionCache.get(collection);
};

/**
 * Check if the given entry passes the given collection’s `filter` option. An entry that doesn’t is
 * excluded from the collection’s entry list and can’t be opened in the content editor, so it must
 * not be offered anywhere else either, such as in the search results.
 *
 * This doesn’t check that the entry belongs to the collection in the first place. Use
 * {@link getListedCollections} to get the collections an entry is actually listed in.
 * @param {InternalCollection} collection Collection.
 * @param {Entry} entry Entry.
 * @returns {boolean} Result.
 * @see https://decapcms.org/docs/collection-folder/#filtered-folder-collections
 * @see https://sveltiacms.app/en/docs/collections/entries/listings#filtering-entries
 */
export const matchesCollectionFilter = (collection, entry) => {
  const condition = getFilterCondition(collection);

  // The `filter` option is defined against the collection’s regular fields, while Hugo’s special
  // index file has its own `index_file.fields` schema. The index file is identified by its path,
  // not by its content, so the filter must not apply to it
  if (!condition || isCollectionIndexFile(collection, entry)) {
    return true;
  }

  const { field, pattern, values } = condition;

  const value = getPropertyValue({
    entry,
    locale: collection._i18n.defaultLocale,
    collectionName: collection.name,
    key: field,
  });

  // A multi-value field, such as a List field or a Relation field with `multiple: true`, yields an
  // array of its items, and the entry passes when any of them does. An entry without a value only
  // passes when `null` is one of the filter values, which is how it’s stored in YAML
  // @see https://github.com/sveltia/sveltia-cms/issues/997
  const items = Array.isArray(value) ? value : [value ?? null];

  if (pattern) {
    return items.some((item) => pattern.test(item));
  }

  return items.some((item) => values.includes(item));
};

/**
 * Get a list of collections the given entry is listed in, which are the collections the entry
 * belongs to, minus any whose `filter` option the entry doesn’t pass.
 * @param {Entry} entry Entry.
 * @returns {InternalCollection[]} Collections.
 */
export const getListedCollections = (entry) =>
  getAssociatedCollections(entry).filter((collection) =>
    matchesCollectionFilter(collection, entry),
  );

/**
 * Cache for {@link getEntriesByCollection}, keyed by collection name and invalidated whenever
 * `allEntries` or `allEntryFolders` is replaced.
 * @type {{
 * entrySource: Entry[] | undefined,
 * folderSource: EntryFolderInfo[] | undefined,
 * buckets: Map<string, Entry[]> | undefined,
 * map: Map<string, Entry[]>,
 * }}
 */
const entriesByCollectionCache = {
  entrySource: undefined,
  folderSource: undefined,
  buckets: undefined,
  map: new Map(),
};

/**
 * Sort every entry into the collections it belongs to, in one pass over `allEntries`. The sidebar
 * asks for the entries of every collection whenever the entry list changes, so looking each one up
 * with its own scan would cost a pass per collection. The collections of an entry are cached with
 * the entry object, which survives a save or a refresh unless the entry itself has changed, so this
 * is mostly lookups.
 * @returns {Map<string, Entry[]>} Entries by collection name, in the order of `allEntries`.
 */
const getCollectionBuckets = () => {
  if (!entriesByCollectionCache.buckets) {
    /** @type {Map<string, Entry[]>} */
    const buckets = new Map();

    allEntries.current.forEach((entry) => {
      // A collection can match an entry through more than one of its folders
      new Set(getAssociatedCollections(entry).map(({ name }) => name)).forEach((name) => {
        const bucket = buckets.get(name);

        if (bucket) {
          bucket.push(entry);
        } else {
          buckets.set(name, [entry]);
        }
      });
    });

    entriesByCollectionCache.buckets = buckets;
  }

  return entriesByCollectionCache.buckets;
};

/**
 * Get the entries belonging to the given collection. This is the uncached implementation of
 * {@link getEntriesByCollection}.
 * @param {string} collectionName Collection name.
 * @returns {Entry[]} Entries.
 */
const queryEntriesByCollection = (collectionName) => {
  const collection = getCollection(collectionName);

  if (!collection) {
    return [];
  }

  return (getCollectionBuckets().get(collectionName) ?? []).filter((entry) =>
    matchesCollectionFilter(collection, entry),
  );
};

/**
 * Reset {@link entriesByCollectionCache}. Used in tests, where the stores are mocked and therefore
 * don’t change identity between cases.
 */
export const _resetEntriesByCollectionCache = () => {
  entriesByCollectionCache.entrySource = undefined;
  entriesByCollectionCache.folderSource = undefined;
  entriesByCollectionCache.buckets = undefined;
  entriesByCollectionCache.map = new Map();
};

/**
 * Get entries by the given collection name, while applying a filer if needed.
 *
 * The result is memoized until the entry stores are replaced. Scanning every entry once per call
 * adds up quickly — the sidebar asks for a count per collection, and a Relation field resolves its
 * referenced collection once per entry being sorted, filtered or listed. Just as importantly, the
 * returned array keeps a stable reference, which is what lets the Relation field’s option cache hit
 * at all; it keys on the identity of the entry list the options were built from.
 *
 * The returned array is shared between callers, so treat it as read-only.
 * @param {string} collectionName Collection name.
 * @returns {Entry[]} Entries.
 * @see https://decapcms.org/docs/collection-folder/#filtered-folder-collections
 * @see https://sveltiacms.app/en/docs/collections/entries/listings#filtering-entries
 */
export const getEntriesByCollection = (collectionName) => {
  const entrySource = allEntries.current;
  const folderSource = allEntryFolders.current;

  if (
    entrySource !== entriesByCollectionCache.entrySource ||
    folderSource !== entriesByCollectionCache.folderSource
  ) {
    entriesByCollectionCache.entrySource = entrySource;
    entriesByCollectionCache.folderSource = folderSource;
    entriesByCollectionCache.buckets = undefined;
    entriesByCollectionCache.map = new Map();
  }

  const cache = entriesByCollectionCache.map.get(collectionName);

  if (cache) {
    return cache;
  }

  const entries = queryEntriesByCollection(collectionName);

  entriesByCollectionCache.map.set(collectionName, entries);

  return entries;
};

/**
 * Check if the field contains the asset.
 * @param {object} args Arguments.
 * @param {string} args.assetURL Asset’s public or blob URL.
 * @param {string} [args.newURL] New URL to replace the found URL.
 * @param {string} args.collectionName Collection name.
 * @param {Entry} args.entry Entry.
 * @param {FlattenedEntryContent} args.content Value map for the collection. This will be modified
 * if the URL is replaced.
 * @param {FieldKeyPath} args.keyPath Key path of the value in the collection.
 * @param {string} args.value Value of the field.
 * @param {boolean} args.isIndexFile Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file. File collection only.
 * @returns {boolean} Result.
 */
export const hasAsset = ({
  assetURL,
  newURL,
  collectionName,
  entry,
  content,
  keyPath,
  value,
  isIndexFile,
  collectionFile,
}) => {
  const fileName = collectionFile?.name;
  const field = getField({ collectionName, fileName, valueMap: content, keyPath, isIndexFile });

  if (!field) {
    return false;
  }

  const isBlobURL = assetURL.startsWith('blob:');
  const { widget: fieldType = 'string' } = field;

  /**
   * Check whether the given field value points to the asset.
   * @param {string} src Field value or image source found in it.
   * @returns {boolean} Result.
   */
  const isMatch = (src) => {
    if (!isBlobURL) {
      return src === assetURL;
    }

    // Resolve the value to its asset without loading it. The asset’s blob URL is created once and
    // kept on the asset object, so only the asset being looked up can hold the given one — and
    // there’s no need to download every other asset the entries reference just to compare URLs
    const { url, asset } =
      getMediaFieldSource({ entry, collectionName, fileName, value: src }) ?? {};

    return (url ?? asset?.blobURL) === assetURL;
  };

  if (MEDIA_FIELD_TYPES.includes(fieldType)) {
    const match = isMatch(value);

    if (match && newURL) {
      content[keyPath] = newURL;
    }

    return match;
  }

  // Search images in markdown body
  if (['richtext', 'markdown'].includes(fieldType)) {
    const matches = [...value.matchAll(MARKDOWN_IMAGE_REGEX)];

    if (matches.length) {
      return matches
        .map(([, src]) => {
          const match = isMatch(src);

          if (match && newURL) {
            content[keyPath] = content[keyPath].replace(src, newURL);
          }

          return match;
        })
        .some(Boolean);
    }
  }

  return false;
};

/**
 * Walk the given entries looking for the given asset, calling back for each field holding it.
 * @param {string} url Asset’s public or blob URL.
 * @param {object} options Options.
 * @param {Entry[]} options.entries Entries to be searched.
 * @param {string} [options.newURL] New URL to replace the found URL with, in place.
 * @param {boolean} [options.every] Whether to report every field holding the asset. Otherwise the
 * search of an entry stops at the first field, unless the URL is being replaced.
 * @param {(reference: AssetReference) => void} [options.onMatch] Called for each field found.
 * @returns {boolean[]} Whether each entry holds the asset, in the order given.
 */
const findAssetReferences = (url, { entries, newURL = '', every = false, onMatch }) => {
  const baseURL = cmsConfig.current?._baseURL;
  const assetURL = baseURL && !url.startsWith('blob:') ? url.replace(baseURL, '') : url;
  const isBlobURL = assetURL.startsWith('blob:');
  const exhaustive = !!newURL || every;

  return entries.map((entry) => {
    const { locales } = entry;
    /** @type {InternalCollection[] | undefined} */
    let collections;
    let found = false;

    for (const [locale, { content }] of Object.entries(locales)) {
      for (const [keyPath, value] of Object.entries(content)) {
        if (typeof value !== 'string' || !value) continue;
        // Pre-filter: skip values that can’t possibly contain the asset URL, avoiding the
        // expensive getField() call for the vast majority of fields.
        if (!isBlobURL && !value.includes(assetURL)) continue;

        // Resolved only once a value passes the pre-filter, as most entries have none that does
        collections ??= getAssociatedCollections(entry);

        for (const collection of collections) {
          const isIndexFile = isCollectionIndexFile(collection, entry);

          const hasAssetArgs = {
            assetURL,
            newURL,
            collectionName: collection.name,
            entry,
            content,
            keyPath,
            value,
            isIndexFile,
          };

          const collectionFiles = getCollectionFilesByEntry(collection, entry);
          /** @type {(InternalCollectionFile | undefined)[]} */
          const files = collectionFiles.length ? collectionFiles : [undefined];

          const matches = files.map((collectionFile) =>
            hasAsset({ ...hasAssetArgs, collectionFile }),
          );

          matches.forEach((matched, index) => {
            if (!matched || !onMatch) {
              return;
            }

            const collectionFile = files[index];

            onMatch({
              entry,
              collection,
              collectionFile,
              locale,
              keyPath,
              // The field is known to be configured, as `hasAsset()` bails out otherwise
              fieldConfig: /** @type {Field} */ (
                getField({
                  collectionName: collection.name,
                  fileName: collectionFile?.name,
                  valueMap: content,
                  keyPath,
                  isIndexFile,
                })
              ),
            });
          });

          if (matches.includes(true)) {
            found = true;
            if (!exhaustive) break;
          }
        }

        if (found && !exhaustive) break;
      }

      if (found && !exhaustive) break;
    }

    return found;
  });
};

/**
 * Find entries by an asset URL, and replace the URL if needed.
 * @param {string} url Asset’s public or blob URL.
 * @param {object} [options] Options.
 * @param {Entry[]} [options.entries] Entries to be searched.
 * @param {string} [options.newURL] New URL to replace the found URL.
 * @returns {Promise<Entry[]>} Found (and replaced) entries.
 */
export const getEntriesByAssetURL = async (
  url,
  { entries = allEntries.current, newURL = '' } = {},
) => {
  const results = findAssetReferences(url, { entries, newURL });

  return entries.filter((_entry, index) => results[index]);
};

/**
 * Find every field holding the given asset in the given entries.
 * @param {string} url Asset’s public or blob URL.
 * @param {object} [options] Options.
 * @param {Entry[]} [options.entries] Entries to be searched.
 * @returns {Promise<AssetReference[]>} References, in the order found. An entry that belongs to
 * more than one collection is reported once per collection the field resolves in.
 */
export const getAssetReferences = async (url, { entries = allEntries.current } = {}) => {
  /** @type {AssetReference[]} */
  const references = [];

  /**
   * Record a field found.
   * @param {AssetReference} reference Reference.
   */
  const onMatch = (reference) => {
    references.push(reference);
  };

  findAssetReferences(url, { entries, every: true, onMatch });

  return references;
};

/**
 * Count the entries in the collection, leaving out Hugo’s special index file. The index file stands
 * for the collection’s own page rather than for one of the entries in it, so it’s not part of the
 * count shown next to the collection in the sidebar. It’s still listed in the entry list, where it
 * has an icon and a label of its own that tell it from the entries.
 *
 * The entries are passed in rather than looked up, because the caller merges the pending changes
 * into them, so an entry that only exists in a pull request is counted as well. The collection is
 * looked up so that the index file can be told by the entry’s path in this collection, as another
 * collection’s index file can be listed here — see {@link isCollectionIndexFile}.
 * @param {string} collectionName Collection name.
 * @param {Entry[]} entries Entries in the collection.
 * @returns {number} Count.
 * @see https://github.com/sveltia/sveltia-cms/issues/1005
 */
export const countCollectionEntries = (collectionName, entries) => {
  const collection = getCollection(collectionName);

  // A collection without an index file has nothing to leave out, which is the common case, so skip
  // the pass over the entries rather than testing each one
  if (!collection || getIndexFileName(collection) === undefined) {
    return entries.length;
  }

  return entries.filter((entry) => !isCollectionIndexFile(collection, entry)).length;
};

/**
 * Check if index file creation is allowed in the collection. The listed entries can include another
 * collection’s index file, when that collection’s folder sits below this one’s, so each entry is
 * tested by its path rather than by the slug the owning collection computed for it.
 * @param {InternalCollection} collection Collection.
 * @returns {boolean} Result. It returns `false` if the index file already exists.
 * @see https://github.com/sveltia/sveltia-cms/issues/1005
 */
export const canCreateIndexFile = (collection) => {
  if (!getIndexFile(collection)) {
    return false;
  }

  return !getEntriesByCollection(collection.name).some((entry) =>
    isCollectionIndexFile(collection, entry),
  );
};
