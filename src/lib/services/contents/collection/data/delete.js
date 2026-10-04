import { unique } from '@sveltia/utils/array';

import { allAssets } from '$lib/services/assets/state';
import { saveChanges } from '$lib/services/backends/save';
import { allEntries } from '$lib/services/contents';
import { selectedCollection } from '$lib/services/contents/collection';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { buildRenumberChanges } from '$lib/services/contents/collection/entries/reorder';
import { getArrayItemTarget } from '$lib/services/contents/draft/save/changes';
import { getPreviousSha, resolveCacheDB } from '$lib/services/contents/draft/save/file-changes';
import {
  buildCascadeDeleteChanges,
  EMPTY_CASCADE_DELETE_PLAN,
  planCascadeDelete,
} from '$lib/services/contents/entry/relations/cascade/delete';

/**
 * @import { Asset, Entry, FileChange, InternalEntryCollection } from '$lib/types/private';
 */

/**
 * Update the stores after deleting entries.
 * @param {object} args Arguments.
 * @param {string[]} args.ids List of entry IDs.
 * @param {string[]} args.assetPaths List of associated asset paths.
 */
export const updateStores = ({ ids, assetPaths }) => {
  const _allEntries = allEntries.current;
  const idSet = new Set(ids);

  allEntries.current = _allEntries.filter((file) => !idSet.has(file.id));

  contentUpdatesToast.current = {
    ...UPDATE_TOAST_DEFAULT_STATE,
    deleted: true,
    count: ids.length,
  };

  if (assetPaths.length) {
    const assetPathSet = new Set(assetPaths);

    allAssets.current = allAssets.current.filter((asset) => !assetPathSet.has(asset.path));
  }
};

/**
 * Delete entries by slugs. The entries referencing them through Relation fields are rewritten in
 * the same commit so that no reference is left dangling.
 * @param {Entry[]} entries List of entries to be deleted.
 * @param {Asset[]} [assets] List of associated assets to be deleted.
 * @throws {Error} When removing the references would leave another entry invalid. The dialogs
 * report this before the deletion is confirmed, so this is only a safeguard.
 */
export const deleteEntries = async (entries, assets = []) => {
  const collection = /** @type {InternalEntryCollection | undefined} */ (
    selectedCollection.current
  );

  const { targets, blockers } = collection
    ? planCascadeDelete({ collection, entries })
    : EMPTY_CASCADE_DELETE_PLAN;

  if (blockers.length) {
    throw new Error('Cannot delete entries that other entries require', { cause: blockers });
  }

  const cacheDB = resolveCacheDB();
  const changes = /** @type {FileChange[]} */ ([]);
  const action = 'delete';

  const ids = await Promise.all(
    entries.map(async (entry) => {
      const { id, locales, slug } = entry;
      // Remove duplicate paths for single file i18n
      const paths = /** @type {string[]} */ (unique(Object.values(locales).map((l) => l.path)));

      await Promise.all(
        paths.map(async (path) => {
          const previousSha = await getPreviousSha({ cacheDB, previousPath: path });

          // An entry stored in a file with the other entries is removed from the array instead
          changes.push({ action, slug, path, previousSha, ...getArrayItemTarget(entry) });
        }),
      );

      return id;
    }),
  );

  const assetPaths = assets.map(({ path, sha }) => {
    changes.push({ action, path, previousSha: sha });

    return path;
  });

  // When the collection has manual reordering enabled, bundle the renumber updates of the remaining
  // entries into the same commit so that delete + renumber is one atomic operation. The same
  // file-cache handle is reused to avoid opening a second IndexedDB connection. An entry that both
  // referenced a deleted entry and moves up in the order is written once, by the renumber, with
  // the reference already removed
  const { changes: renumberChanges, savingEntries: renumberSavingEntries } =
    await buildRenumberChanges(collection, {
      excludeIds: new Set(ids),
      updatedEntries: new Map(targets.map(({ entry }) => [entry.id, entry])),
      cacheDB,
    });

  const renumberedIds = new Set(renumberSavingEntries.map(({ id }) => id));

  const { changes: cascadeChanges, savingEntries: cascadeSavingEntries } =
    await buildCascadeDeleteChanges({
      targets: targets.filter(({ entry }) => !renumberedIds.has(entry.id)),
      cacheDB,
    });

  changes.push(...renumberChanges, ...cascadeChanges);

  await saveChanges({
    changes,
    savingEntries: [...renumberSavingEntries, ...cascadeSavingEntries],
    options: {
      commitType: 'delete',
      collection: selectedCollection.current,
    },
  });

  updateStores({ ids, assetPaths });
};
