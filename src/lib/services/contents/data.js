import { get } from 'svelte/store';
import { backend } from '$lib/services/backends';
import { allEntries, selectedCollection } from '$lib/services/contents';

/**
 * Delete entries by slugs.
 *
 * @param {string[]} slugs List of entry slugs.
 */
export const deleteEntries = async (slugs) => {
  const _allEntries = get(allEntries);

  const items = slugs
    .map((slug) => {
      const entry = _allEntries.find((e) => e.slug === slug);

      return entry ? Object.values(entry.locales).map(({ path }) => ({ slug, path })) : undefined;
    })
    .flat(1)
    // Remove duplicate paths for single file i18n
    .filter((item, index, arr) => item && arr.findIndex((i) => i.path === item.path) === index);

  await get(backend).deleteFiles(items, { collection: get(selectedCollection).name });
  allEntries.set(_allEntries.filter((file) => !slugs.includes(file.slug)));
};
