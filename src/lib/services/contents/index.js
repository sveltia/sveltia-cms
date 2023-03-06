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
 *
 * @param {string} name Collection name.
 * @returns {object} Collection.
 */
export const getCollection = (name) => get(siteConfig).collections.find((c) => c.name === name);

/**
 * Get entries by the given collection name, while applying a filer if needed.
 *
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
