import { unique } from '@sveltia/utils/array';
import { IndexedDB } from '@sveltia/utils/storage';
import { get } from 'svelte/store';

import { allAssets } from '$lib/services/assets';
import { backend } from '$lib/services/backends';
import { saveChanges } from '$lib/services/backends/save';
import { allEntries } from '$lib/services/contents';
import { selectedCollection } from '$lib/services/contents/collection';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { getPreviousSha } from '$lib/services/contents/draft/save/changes';

/**
 * @import { Asset, Entry, FileChange } from '$lib/types/private';
 */

/**
 * Update the stores after deleting entries.
 * @param {object} args Arguments.
 * @param {string[]} args.ids List of entry IDs.
 * @param {string[]} args.assetPaths List of associated asset paths.
 */
export const updateStores = ({ ids, assetPaths }) => {
  const _allEntries = get(allEntries);

  allEntries.set(_allEntries.filter((file) => !ids.includes(file.id)));

  contentUpdatesToast.set({
    ...UPDATE_TOAST_DEFAULT_STATE,
    deleted: true,
    count: ids.length,
  });

  if (assetPaths.length) {
    allAssets.update((assets) => assets.filter((asset) => !assetPaths.includes(asset.path)));
  }
};

/**
 * Delete entries by slugs.
 * @param {Entry[]} entries List of entries to be deleted.
 * @param {Asset[]} [assets] List of associated assets to be deleted.
 */
export const deleteEntries = async (entries, assets = []) => {
  const databaseName = get(backend)?.repository?.databaseName;
  const cacheDB = databaseName ? new IndexedDB(databaseName, 'file-cache') : undefined;
  const changes = /** @type {FileChange[]} */ ([]);
  const action = 'delete';

  const ids = await Promise.all(
    entries.map(async ({ id, locales, slug }) => {
      // Remove duplicate paths for single file i18n
      const paths = /** @type {string[]} */ (unique(Object.values(locales).map((l) => l.path)));

      await Promise.all(
        paths.map(async (path) => {
          const previousSha = await getPreviousSha({ cacheDB, previousPath: path });

          changes.push({ action, slug, path, previousSha });
        }),
      );

      return id;
    }),
  );

  const assetPaths = assets.map(({ path, sha }) => {
    changes.push({ action, path, previousSha: sha });

    return path;
  });

  await saveChanges({
    changes,
    options: {
      commitType: 'delete',
      collection: get(selectedCollection),
    },
  });

  updateStores({ ids, assetPaths });
};
