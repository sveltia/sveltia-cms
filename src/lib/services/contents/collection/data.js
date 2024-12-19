import { get, writable } from 'svelte/store';
import { allAssets } from '$lib/services/assets';
import { backend } from '$lib/services/backends';
import { allEntries } from '$lib/services/contents';
import { selectedCollection } from '$lib/services/contents/collection';

/**
 * @type {UpdatesToastState}
 */
export const updatesToastDefaultState = {
  saved: false,
  moved: false,
  renamed: false,
  deleted: false,
  published: false,
  count: 1,
};

/**
 * @type {import('svelte/store').Writable<UpdatesToastState>}
 */
export const contentUpdatesToast = writable({ ...updatesToastDefaultState });

/**
 * Delete entries by slugs.
 * @param {string[]} ids - List of entry IDs.
 * @param {string[]} [assetPaths] - List of associated asset paths.
 */
export const deleteEntries = async (ids, assetPaths = []) => {
  const _allEntries = get(allEntries);

  const changes = /** @type {FileChange[]} */ (
    ids
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
      .filter((item, index, arr) => item && arr.findIndex((i) => i?.path === item.path) === index)
  );

  if (assetPaths.length) {
    changes.push(
      ...assetPaths.map((path) => /** @type {FileChange} */ ({ action: 'delete', path })),
    );
  }

  await get(backend)?.commitChanges(changes, {
    commitType: 'delete',
    collection: get(selectedCollection),
  });

  allEntries.set(_allEntries.filter((file) => !ids.includes(file.id)));

  contentUpdatesToast.set({
    ...updatesToastDefaultState,
    deleted: true,
    count: ids.length,
  });

  if (assetPaths.length) {
    allAssets.update((assets) => assets.filter((asset) => !assetPaths.includes(asset.path)));
  }
};
