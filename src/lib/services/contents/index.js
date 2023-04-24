import { get, writable } from 'svelte/store';
import { defaultContentLocale, siteConfig } from '$lib/services/config';

export const entriesLoaded = writable(false);

export const allContentPaths = writable([]);

/**
 * @type {?import('svelte/store').Writable<Entry[]>}
 */
export const allEntries = writable([]);

export const selectedCollection = writable();

/**
 * @type {?import('svelte/store').Writable<Entry[]>}
 */
export const selectedEntries = writable([]);

/**
 * Get a collection by name.
 * @param {string} name Collection name.
 * @returns {object} Collection.
 */
export const getCollection = (name) => get(siteConfig).collections.find((c) => c.name === name);

/**
 * Get entries by the given collection name, while applying a filer if needed.
 * @param {string} name Collection name.
 * @returns {Entry[]} Entries.
 * @see https://www.netlifycms.org/docs/collection-types#filtered-folder-collections
 */
export const getEntries = (name) => {
  const collection = getCollection(name);

  if (!collection) {
    return [];
  }

  const { filter } = collection;
  const defaultLocale = get(defaultContentLocale);

  return (get(allEntries) || []).filter(
    (entry) =>
      entry.collectionName === name &&
      (!filter || entry.locales[defaultLocale]?.content[filter.field] === filter.value),
  );
};

if (import.meta.env.DEV) {
  selectedCollection.subscribe((collection) => {
    // eslint-disable-next-line no-console
    console.info('selectedCollection', collection);
  });
}

/**
 * Get a field that matches the given key path: dot-connected object field name.
 * @param {string} collectionName Collection name.
 * @param {string} [fileName] File name if the collection is a file collection.
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
