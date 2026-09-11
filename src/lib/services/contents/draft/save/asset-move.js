import { allAssets } from '$lib/services/assets';
import { getAssetFolder } from '$lib/services/assets/folders';
import { getAssetBlob } from '$lib/services/assets/info';
import { getOwnedEntryFolderPath } from '$lib/services/contents/draft/save/assets';

/**
 * @import { Asset, Entry, FileChange, InternalCollection } from '$lib/types/private';
 */

/**
 * Work out which folders the entry has vacated, keyed by the folder it left behind. With a
 * multi-folder i18n structure each locale has a folder of its own, so there can be more than one.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection the entry belongs to.
 * @param {Entry} args.originalEntry Entry as it is stored now.
 * @param {Entry} args.savingEntry Same entry with its new paths.
 * @returns {Map<string, string>} Key is the old folder path, value is the new one.
 */
const getMovedFolders = ({ collection, originalEntry, savingEntry }) => {
  /** @type {Map<string, string>} */
  const movedFolders = new Map();

  Object.entries(savingEntry.locales).forEach(([locale, { path }]) => {
    const previousPath = originalEntry.locales[locale]?.path;

    if (!previousPath) {
      return;
    }

    const oldFolderPath = getOwnedEntryFolderPath(collection, previousPath);
    const newFolderPath = getOwnedEntryFolderPath(collection, path);

    if (oldFolderPath && newFolderPath && oldFolderPath !== newFolderPath) {
      movedFolders.set(oldFolderPath, newFolderPath);
    }
  });

  return movedFolders;
};

/**
 * Build the file changes that take an entry’s relative assets along when the entry itself is filed
 * elsewhere. With a Hugo-style page bundle — a `path` option like `{{slug}}/_index` combined with a
 * relative `media_folder` — the assets are stored in the entry’s own folder, so moving the entry
 * with the path editor or renaming its slug has to move them too, or the entry would be left
 * pointing at files that stayed behind.
 *
 * Everything below the old folder is taken, including the assets of any descendant entry the
 * `subfolders` mode moves along with this one, as well as files in a subfolder of its own.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection the entry belongs to.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {Entry} [args.originalEntry] Entry as it was before the save. `undefined` for a new entry,
 * which has nothing to move.
 * @param {Entry} args.savingEntry Entry being saved.
 * @param {FileChange[]} args.changes Changes collected so far, which are left untouched. An asset
 * the save already writes to the entry’s new folder wins over the one being moved there.
 * @returns {Promise<{ changes: FileChange[], savingAssets: Asset[] }>} Collected changes and the
 * assets to be saved.
 */
export const buildEntryAssetMoveChanges = async ({
  collection,
  fileName,
  originalEntry,
  savingEntry,
  changes,
}) => {
  /** @type {{ changes: FileChange[], savingAssets: Asset[] }} */
  const noChanges = { changes: [], savingAssets: [] };

  // Assets are only bound to an entry when the collection stores them at a relative path
  if (
    !originalEntry ||
    !getAssetFolder({ collectionName: collection.name, fileName })?.entryRelative
  ) {
    return noChanges;
  }

  const movedFolders = getMovedFolders({ collection, originalEntry, savingEntry });

  if (!movedFolders.size) {
    return noChanges;
  }

  const takenPaths = new Set(changes.map(({ path }) => path));
  const assets = allAssets.current;
  /** @type {FileChange[]} */
  const moveChanges = [];
  /** @type {Asset[]} */
  const savingAssets = [];

  await Promise.all(
    [...movedFolders].map(async ([oldFolderPath, newFolderPath]) =>
      Promise.all(
        assets
          .filter(({ path }) => path.startsWith(`${oldFolderPath}/`))
          .map(async (asset) => {
            const path = `${newFolderPath}${asset.path.slice(oldFolderPath.length)}`;

            // The destination is already being written in this save, typically because the user
            // replaced the file while moving the entry. Drop the stale copy rather than overwriting
            // the new one with it
            if (takenPaths.has(path)) {
              moveChanges.push({ action: 'delete', path: asset.path, previousSha: asset.sha });

              return;
            }

            const blob = asset.file ?? (await getAssetBlob(asset));

            moveChanges.push({
              action: 'move',
              path,
              previousPath: asset.path,
              previousSha: asset.sha,
              // Read the bytes up front. A blob backed by the file system points at the file about
              // to be moved away, and reading it afterwards — to write the copy or to hash it —
              // fails because there’s nothing at that path anymore
              data: new File([await blob.arrayBuffer()], asset.name, { type: blob.type }),
            });

            savingAssets.push({ ...asset, path });
          }),
      ),
    ),
  );

  return { changes: moveChanges, savingAssets };
};
