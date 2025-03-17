import { stripSlashes } from '@sveltia/utils/string';
import { get, writable } from 'svelte/store';
import { allAssetFolders } from '$lib/services/assets';
import { siteConfig } from '$lib/services/config';
import { getFileConfig } from '$lib/services/contents/file';
import { getI18nConfig } from '$lib/services/contents/i18n';

/**
 * @type {import('svelte/store').Writable<import('$lib/typedefs/private').NormalizedCollection |
 * undefined>}
 */
export const selectedCollection = writable();

/**
 * @type {Map<string, import('$lib/typedefs/private').NormalizedCollection | undefined>}
 */
const collectionCacheMap = new Map();

/**
 * Get a list of field key paths to be used to find an entry thumbnail.
 * @param {import('$lib/typedefs/public').Collection} rawCollection Raw collection definition.
 * @returns {import('$lib/typedefs/public').FieldKeyPath[]} Key path list.
 */
const getThumbnailFieldNames = (rawCollection) => {
  const { folder, fields, thumbnail } = rawCollection;

  if (!folder) {
    return [];
  }

  if (typeof thumbnail === 'string') {
    return [thumbnail];
  }

  // Support multiple field names
  if (Array.isArray(thumbnail)) {
    return thumbnail;
  }

  // Collect the names of all non-nested Image/File fields for inference
  if (fields?.length) {
    return fields
      .filter(({ widget = 'string' }) => ['image', 'file'].includes(widget))
      .map(({ name }) => name);
  }

  return [];
};

/**
 * Get a collection by name.
 * @param {string} name Collection name.
 * @returns {import('$lib/typedefs/private').NormalizedCollection | undefined} Collection, including
 * some extra, normalized properties.
 */
export const getCollection = (name) => {
  const cache = collectionCacheMap.get(name);

  if (cache) {
    return cache;
  }

  const rawCollection = get(siteConfig)?.collections.find((c) => c.name === name);
  const isEntryCollection = typeof rawCollection?.folder === 'string';
  const isFileCollection = !isEntryCollection && Array.isArray(rawCollection?.files);

  // Ignore invalid collection
  if (!isEntryCollection && !isFileCollection) {
    collectionCacheMap.set(name, undefined);

    return undefined;
  }

  const { folder, files } = rawCollection;

  // Normalize folder/file paths by removing leading/trailing slashes
  if (isEntryCollection) {
    rawCollection.folder = stripSlashes(/** @type {string} */ (folder));
  } else {
    /** @type {import('$lib/typedefs/public').CollectionFile[]} */ (files).forEach((f) => {
      f.file = stripSlashes(f.file);
    });
  }

  const _i18n = getI18nConfig(rawCollection);

  const collectionBase = {
    ...rawCollection,
    _i18n,
    _assetFolder: get(allAssetFolders).find(({ collectionName }) => collectionName === name),
  };

  /** @type {import('$lib/typedefs/private').NormalizedCollection} */
  const collection = isEntryCollection
    ? /** @type {import('$lib/typedefs/private').EntryCollection} */ ({
        ...collectionBase,
        _type: /** @type {import('$lib/typedefs/private').CollectionType} */ ('entry'),
        _file: getFileConfig({ rawCollection, _i18n }),
        _thumbnailFieldNames: getThumbnailFieldNames(rawCollection),
      })
    : /** @type {import('$lib/typedefs/private').FileCollection} */ ({
        ...collectionBase,
        _type: /** @type {import('$lib/typedefs/private').CollectionType} */ ('file'),
        _fileMap: /** @type {import('$lib/typedefs/public').CollectionFile[]} */ (files)?.length
          ? Object.fromEntries(
              files.map((file) => {
                const __i18n = getI18nConfig(rawCollection, file);
                const __file = getFileConfig({ rawCollection, file, _i18n: __i18n });

                return [file.name, { ...file, _file: __file, _i18n: __i18n }];
              }),
            )
          : {},
      });

  collectionCacheMap.set(name, collection);

  return collection;
};
