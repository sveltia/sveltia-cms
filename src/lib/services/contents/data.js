import { get } from 'svelte/store';
import { backend } from '$lib/services/backends';
import { allEntries, selectedCollection } from '$lib/services/contents';

/**
 * Delete entries by slugs.
 * @param {string[]} ids List of entry IDs.
 */
export const deleteEntries = async (ids) => {
  const _allEntries = get(allEntries);

  /**
   * @type {FileChange[]}
   */
  const changes = ids
    .map((id) => {
      const { locales, slug } = _allEntries.find((e) => e.id === id) ?? {};

      if (locales) {
        return Object.values(locales).map(
          ({ path }) => /** @type {FileChange} */ ({ action: 'delete', slug, path }),
        );
      }

      return undefined;
    })
    .flat(1)
    // Remove duplicate paths for single file i18n
    .filter((item, index, arr) => item && arr.findIndex((i) => i.path === item.path) === index);

  await get(backend).commitChanges(changes, {
    commitType: 'delete',
    collection: get(selectedCollection).name,
  });

  allEntries.set(_allEntries.filter((file) => !ids.includes(file.id)));
};
