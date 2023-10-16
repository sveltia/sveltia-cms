import { flatten } from 'flat';
import { get, writable } from 'svelte/store';
import { getMediaFieldURL } from '$lib/services/assets';
import { siteConfig } from '$lib/services/config';
import { getFieldConfig, getPropertyValue } from '$lib/services/contents/entry';
import { isObject } from '$lib/services/utils/misc';

/**
 * @type {import('svelte/store').Writable<boolean>}
 */
export const dataLoaded = writable(false);

/**
 * @type {import('svelte/store').Writable<PathConfig[]>}
 */
export const allContentPaths = writable([]);

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
 * Get the i18n config for the given collection.
 * @param {Collection} collection Collection.
 * @returns {I18nConfig} Config.
 * @see https://decapcms.org/docs/beta-features/#i18n-support
 */
const getCollectionI18n = (collection) => {
  const _siteConfig = get(siteConfig);
  /**
   * @type {I18nFileStructure}
   */
  let structure = 'single_file';
  /**
   * @type {string[]}
   */
  let locales = [];
  /**
   * @type {string}
   */
  let defaultLocale;

  if (collection?.i18n === true && isObject(_siteConfig?.i18n)) {
    ({
      structure = 'single_file',
      locales = [],
      default_locale: defaultLocale = undefined,
    } = _siteConfig.i18n);
  }

  if (isObject(collection?.i18n)) {
    ({
      structure = 'single_file',
      locales = [],
      default_locale: defaultLocale = undefined,
    } = /** @type {RawI18nConfig} */ (collection.i18n));
  }

  const hasLocales = !!locales.length;

  return {
    structure,
    hasLocales,
    locales: hasLocales ? locales : [],
    // eslint-disable-next-line no-nested-ternary
    defaultLocale: !hasLocales
      ? undefined
      : defaultLocale && locales.includes(defaultLocale)
      ? defaultLocale
      : locales[0],
  };
};

/**
 * Get a collection by name.
 * @param {string} name Collection name.
 * @returns {Collection} Collection.
 */
export const getCollection = (name) => {
  const collection = get(siteConfig).collections.find((c) => c.name === name);

  return {
    ...collection,
    _i18n: getCollectionI18n(collection),
  };
};

/**
 * Get a file collection entry.
 * @param {string} collectionName Collection name.
 * @param {string} fileName File name.
 * @returns {Entry} File.
 * @see https://decapcms.org/docs/collection-types/#file-collections
 */
export const getFile = (collectionName, fileName) =>
  get(allEntries).find(
    (entry) => entry.collectionName === collectionName && entry.fileName === fileName,
  );

/**
 * Get entries by the given collection name, while applying a filer if needed.
 * @param {string} collectionName Collection name.
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
    _i18n: { defaultLocale = 'default' },
  } = collection;

  return get(allEntries).filter(
    (entry) =>
      entry.collectionName === collectionName &&
      (!filter || getPropertyValue(entry, defaultLocale, filter.field) === filter.value),
  );
};

/**
 * Get a list of entries using the given asset.
 * @param {string} url Asset URL.
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
