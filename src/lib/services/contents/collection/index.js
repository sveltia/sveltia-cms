import { stripSlashes } from '@sveltia/utils/string';
import { get, writable } from 'svelte/store';
import { allAssetFolders } from '$lib/services/assets';
import { siteConfig } from '$lib/services/config';
import { getFileConfig } from '$lib/services/contents/file';
import { getI18nConfig } from '$lib/services/contents/i18n';

/**
 * @type {import('svelte/store').Writable<Collection | undefined>}
 */
export const selectedCollection = writable();

/**
 * @type {Map<string, Collection | undefined>}
 */
const collectionCacheMap = new Map();

/**
 * Get a collection by name.
 * @param {string} name - Collection name.
 * @returns {Collection | undefined} Collection, including some extra, normalized properties.
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

  const { fields, thumbnail, folder, files } = rawCollection;

  // Normalize folder/file paths by removing leading/trailing slashes
  if (isEntryCollection) {
    rawCollection.folder = stripSlashes(/** @type {string} */ (folder));
  } else {
    /** @type {RawCollectionFile[]} */ (files).forEach((f) => {
      f.file = stripSlashes(f.file);
    });
  }

  const _i18n = getI18nConfig(rawCollection);

  const collectionBase = {
    ...rawCollection,
    _i18n,
    _assetFolder: get(allAssetFolders).find(({ collectionName }) => collectionName === name),
  };

  /** @type {Collection} */
  const collection = isEntryCollection
    ? {
        ...collectionBase,
        _type: /** @type {CollectionType} */ ('entry'),
        _file: getFileConfig({ rawCollection, _i18n }),
        _thumbnailFieldName: rawCollection.folder
          ? (thumbnail ?? fields?.find(({ widget }) => widget === 'image')?.name)
          : undefined,
      }
    : {
        ...collectionBase,
        _type: /** @type {CollectionType} */ ('file'),
        _fileMap: /** @type {RawCollectionFile[]} */ (files)?.length
          ? Object.fromEntries(
              files.map((file) => {
                const __i18n = getI18nConfig(rawCollection, file);
                const __file = getFileConfig({ rawCollection, file, _i18n: __i18n });

                return [file.name, { ...file, _file: __file, _i18n: __i18n }];
              }),
            )
          : {},
      };

  collectionCacheMap.set(name, collection);

  return collection;
};
