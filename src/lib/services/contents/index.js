import { flatten } from 'flat';
import { get, writable } from 'svelte/store';
import { allAssetFolders, getMediaFieldURL } from '$lib/services/assets';
import { siteConfig } from '$lib/services/config';
import { getFieldConfig, getPropertyValue } from '$lib/services/contents/entry';
import { getI18nConfig } from '$lib/services/contents/i18n';

/**
 * @type {import('svelte/store').Writable<boolean>}
 */
export const dataLoaded = writable(false);

/**
 * @type {import('svelte/store').Writable<CollectionEntryFolder[]>}
 */
export const allEntryFolders = writable([]);

/**
 * @type {import('svelte/store').Writable<Entry[]>}
 */
export const allEntries = writable([]);

/**
 * @type {import('svelte/store').Writable<Collection | undefined>}
 */
export const selectedCollection = writable();

/**
 * @type {import('svelte/store').Writable<Entry[]>}
 */
export const selectedEntries = writable([]);

/**
 * Get a collection by name.
 * @param {string} name - Collection name.
 * @returns {Collection | undefined} Collection, including some extra, normalized properties.
 */
export const getCollection = (name) => {
  const collection = get(siteConfig).collections.find((c) => c.name === name);

  if (!collection) {
    return undefined;
  }

  return {
    ...collection,
    _fileMap: collection.files?.length
      ? Object.fromEntries(
          collection.files.map((file) => [
            file.name,
            { ...file, _i18n: getI18nConfig(collection, file) },
          ]),
        )
      : undefined,
    _i18n: getI18nConfig(collection),
    _assetFolder: get(allAssetFolders).find(({ collectionName }) => collectionName === name),
  };
};

/**
 * Get a file collection entry.
 * @param {string} collectionName - Collection name.
 * @param {string} fileName - File name.
 * @returns {Entry} File.
 * @see https://decapcms.org/docs/collection-types/#file-collections
 */
export const getFile = (collectionName, fileName) =>
  get(allEntries).find(
    (entry) => entry.collectionName === collectionName && entry.fileName === fileName,
  );

/**
 * Get entries by the given collection name, while applying a filer if needed.
 * @param {string} collectionName - Collection name.
 * @returns {Entry[]} Entries.
 * @see https://decapcms.org/docs/collection-types#filtered-folder-collections
 */
export const getEntriesByCollection = (collectionName) => {
  const collection = getCollection(collectionName);

  if (!collection) {
    return [];
  }

  const {
    filter,
    _i18n: { defaultLocale },
  } = collection;

  return get(allEntries).filter(
    (entry) =>
      entry.collectionName === collectionName &&
      (!filter || getPropertyValue(entry, defaultLocale, filter.field) === filter.value),
  );
};

/**
 * Get a list of entries using the given asset.
 * @param {string} url - Asset URL.
 * @returns {Promise<Entry[]>} Entries.
 */
export const getEntriesByAssetURL = async (url) => {
  const path = url.replace(get(siteConfig).site_url, '');
  const entries = get(allEntries);

  const results = await Promise.all(
    entries.map(async (entry) => {
      const { locales, collectionName, fileName } = entry;

      const _results = await Promise.all(
        Object.values(locales).map(async ({ content }) => {
          const valueMap = flatten(content);

          const __results = await Promise.all(
            Object.entries(valueMap).map(async ([keyPath, value]) => {
              const field = getFieldConfig({ collectionName, fileName, valueMap, keyPath });

              if (!field || !['image', 'file'].includes(field.widget)) {
                return false;
              }

              return (await getMediaFieldURL(value, entry)) === path;
            }),
          );

          return __results.includes(true);
        }),
      );

      return _results.includes(true);
    }),
  );

  return entries.filter((_entry, index) => results[index]);
};
