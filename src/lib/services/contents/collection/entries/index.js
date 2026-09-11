/* eslint-disable no-continue */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */

import { getMediaFieldURL } from '$lib/services/assets/info';
import { cmsConfig } from '$lib/services/config';
import { allEntries, allEntryFolders } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import {
  getIndexFile,
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
 * Entry,
 * EntryFolderInfo,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalCollectionFile,
 * } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
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
 * @see https://sveltiacms.app/en/docs/collections/entries#filtering-entries
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

  const value =
    getPropertyValue({
      entry,
      locale: collection._i18n.defaultLocale,
      collectionName: collection.name,
      key: field,
    }) ?? null;

  if (pattern) {
    return pattern.test(value);
  }

  return values.includes(value);
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
 * Scan `allEntries` for the entries belonging to the given collection. This is the uncached
 * implementation of {@link getEntriesByCollection}.
 * @param {string} collectionName Collection name.
 * @returns {Entry[]} Entries.
 */
const queryEntriesByCollection = (collectionName) => {
  const collection = getCollection(collectionName);

  if (!collection) {
    return [];
  }

  // Pre-compute membership check to avoid calling getAssociatedCollections() per entry, which
  // internally does allEntryFolders.current.filter().sort() for each entry.
  let isMember;

  if (collection._type === 'entry') {
    const fullPathRegEx = collection._file?.fullPathRegEx;

    isMember = fullPathRegEx
      ? (/** @type {Entry} */ entry) =>
          fullPathRegEx.test(Object.values(entry.locales)[0]?.path ?? '')
      : (/** @type {Entry} */ entry) =>
          getAssociatedCollections(entry).some(({ name }) => name === collectionName);
  } else {
    const validPaths = new Set(
      allEntryFolders.current
        .filter(({ collectionName: name }) => name === collectionName)
        .flatMap(({ filePathMap }) => (filePathMap ? Object.values(filePathMap) : [])),
    );

    // eslint-disable-next-line jsdoc/require-jsdoc
    isMember = (/** @type {Entry} */ entry) => {
      const entryPath = Object.values(entry.locales)[0]?.path;

      return !!entryPath && validPaths.has(entryPath);
    };
  }

  return allEntries.current.filter(
    (entry) => isMember(entry) && matchesCollectionFilter(collection, entry),
  );
};

/**
 * Cache for {@link getEntriesByCollection}, keyed by collection name and invalidated whenever
 * `allEntries` or `allEntryFolders` is replaced.
 * @type {{
 * entrySource: Entry[] | undefined,
 * folderSource: EntryFolderInfo[] | undefined,
 * map: Map<string, Entry[]>,
 * }}
 */
const entriesByCollectionCache = {
  entrySource: undefined,
  folderSource: undefined,
  map: new Map(),
};

/**
 * Reset {@link entriesByCollectionCache}. Used in tests, where the stores are mocked and therefore
 * don’t change identity between cases.
 */
export const _resetEntriesByCollectionCache = () => {
  entriesByCollectionCache.entrySource = undefined;
  entriesByCollectionCache.folderSource = undefined;
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
 * @see https://sveltiacms.app/en/docs/collections/entries#filtering-entries
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
 * @returns {Promise<boolean>} Result.
 */
export const hasAsset = async ({
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
  const getURLArgs = { entry, collectionName, fileName };
  const { widget: fieldType = 'string' } = field;

  if (MEDIA_FIELD_TYPES.includes(fieldType)) {
    const match = isBlobURL
      ? (await getMediaFieldURL({ ...getURLArgs, value })) === assetURL
      : value === assetURL;

    if (match && newURL) {
      content[keyPath] = newURL;
    }

    return match;
  }

  // Search images in markdown body
  if (['richtext', 'markdown'].includes(fieldType)) {
    const matches = [...value.matchAll(MARKDOWN_IMAGE_REGEX)];

    if (matches.length) {
      return (
        await Promise.all(
          matches.map(async ([, src]) => {
            const match =
              (isBlobURL ? await getMediaFieldURL({ ...getURLArgs, value: src }) : src) ===
              assetURL;

            if (match && newURL) {
              content[keyPath] = content[keyPath].replace(src, newURL);
            }

            return match;
          }),
        )
      ).some(Boolean);
    }
  }

  return false;
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
  const baseURL = cmsConfig.current?._baseURL;
  const assetURL = baseURL && !url.startsWith('blob:') ? url.replace(baseURL, '') : url;
  const isBlobURL = assetURL.startsWith('blob:');
  const isReplacing = !!newURL;

  const results = await Promise.all(
    entries.map(async (entry) => {
      const { locales } = entry;
      const collections = getAssociatedCollections(entry);
      let found = false;

      for (const { content } of Object.values(locales)) {
        for (const [keyPath, value] of Object.entries(content)) {
          if (typeof value !== 'string' || !value) continue;
          // Pre-filter: skip values that can’t possibly contain the asset URL, avoiding the
          // expensive getField() call for the vast majority of fields.
          if (!isBlobURL && !value.includes(assetURL)) continue;

          for (const collection of collections) {
            const hasAssetArgs = {
              assetURL,
              newURL,
              collectionName: collection.name,
              entry,
              content,
              keyPath,
              value,
              isIndexFile: isCollectionIndexFile(collection, entry),
            };

            const collectionFiles = getCollectionFilesByEntry(collection, entry);
            let matched;

            if (collectionFiles.length) {
              matched = (
                await Promise.all(
                  collectionFiles.map((collectionFile) =>
                    hasAsset({ ...hasAssetArgs, collectionFile }),
                  ),
                )
              ).includes(true);
            } else {
              matched = await hasAsset({ ...hasAssetArgs });
            }

            if (matched) {
              found = true;
              if (!isReplacing) break;
            }
          }

          if (found && !isReplacing) break;
        }

        if (found && !isReplacing) break;
      }

      return found;
    }),
  );

  return entries.filter((_entry, index) => results[index]);
};

/**
 * Check if index file creation is allowed in the collection.
 * @param {InternalCollection} collection Collection.
 * @returns {boolean} Result. It returns `false` if the index file already exists.
 */
export const canCreateIndexFile = (collection) => {
  const indexFile = getIndexFile(collection);

  if (!indexFile) {
    return false;
  }

  return !getEntriesByCollection(collection.name).some(({ slug }) => slug === indexFile.name);
};
