import { get, writable } from 'svelte/store';
import { siteConfig } from '$lib/services/config';
import { isObject } from '$lib/services/utils/misc';

export const entriesLoaded = writable(false);

export const allContentPaths = writable([]);

/**
 * @type {import('svelte/store').Writable<Entry[]>}
 */
export const allEntries = writable([]);

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
  /** @type {I18nFileStructure} */
  let structure = 'single_file';
  let locales = [];
  let defaultLocale;

  if (collection.i18n === true && isObject(_siteConfig.i18n)) {
    ({
      structure = 'single_file',
      locales = [],
      default_locale: defaultLocale = undefined,
    } = _siteConfig.i18n);
  }

  if (isObject(collection.i18n)) {
    ({
      structure = 'single_file',
      locales = [],
      default_locale: defaultLocale = undefined,
    } = collection.i18n);
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
 * @returns {object} Collection.
 */
export const getCollection = (name) => {
  const collection = get(siteConfig).collections.find((c) => c.name === name);

  return {
    ...collection,
    _i18n: getCollectionI18n(collection),
  };
};

/**
 * Get entries by the given collection name, while applying a filer if needed.
 * @param {string} name Collection name.
 * @returns {Entry[]} Entries.
 * @see https://decapcms.org/docs/collection-types#filtered-folder-collections
 */
export const getEntries = (name) => {
  const collection = getCollection(name);

  if (!collection) {
    return [];
  }

  const { filter, _i18n } = collection;
  const { defaultLocale = 'default' } = _i18n;

  return (get(allEntries) || []).filter(
    (entry) =>
      entry.collectionName === name &&
      (!filter || entry.locales[defaultLocale]?.content[filter.field] === filter.value),
  );
};

/**
 * Get a field that matches the given key path: dot-connected object field name.
 * @param {string} collectionName Collection name.
 * @param {string} fileName File name if the collection is a file collection.
 * @param {string} keyPath Key path, e.g. `author.name`.
 * @param {FlattenedEntryContent} valueMap Object holding current entry values keyed with `keyPath`.
 * @returns {object} Field configuration.
 */
export const getFieldByKeyPath = (collectionName, fileName, keyPath, valueMap) => {
  const collection = getCollection(collectionName);
  const { fields } = fileName ? collection.files.find(({ name }) => name === fileName) : collection;
  const keyPathArray = keyPath.split('.');
  let field;

  keyPathArray.forEach((key, index) => {
    if (index === 0) {
      field = fields.find(({ name }) => name === key);
    } else if (field) {
      const isNumericKey = key.match(/^\d+$/);
      const { field: subField, fields: subFields, types, typeKey = 'type' } = field;

      if (subField) {
        field = subField;
      } else if (subFields && !isNumericKey) {
        field = subFields.find(({ name }) => name === key);
      } else if (types && isNumericKey) {
        field = types.find(
          ({ name }) =>
            name === valueMap[`${keyPathArray.slice(0, index).join('.')}.${key}.${typeKey}`],
        );
      }
    }
  });

  return field;
};
