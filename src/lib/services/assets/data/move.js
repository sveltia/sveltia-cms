import { getPathInfo } from '@sveltia/utils/file';

import { focusedAsset, getAssetByInternalPath, overlaidAsset } from '$lib/services/assets';
import { assetUpdatesToast } from '$lib/services/assets/data';
import { getAssetFoldersByPath, globalAssetFolder } from '$lib/services/assets/folders';
import { getAssetBlob, getAssetPublicURL } from '$lib/services/assets/info';
import { saveChanges } from '$lib/services/backends/save';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';
import { getEntriesByAssets } from '$lib/services/contents/collection/entries';
import {
  getIndexFile,
  isCollectionIndexFile,
} from '$lib/services/contents/collection/entries/index-file';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { createSavingEntryData } from '$lib/services/contents/draft/save/changes';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import { getAssociatedCollections } from '$lib/services/contents/entry';

/**
 * @import {
 * Asset,
 * AssetFolderInfo,
 * Entry,
 * EntryDraft,
 * FileChange,
 * InternalEntryCollection,
 * MovingAsset,
 * } from '$lib/types/private';
 * @import { CollectionIndexFile } from '$lib/types/public';
 * @import { AssetReferenceTarget } from '$lib/services/contents/collection/entries';
 */

/**
 * Get base properties for the entry draft.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry to get base properties for.
 * @returns {Partial<EntryDraft>} Base properties for the entry draft.
 */
export const getDraftBaseProps = ({ entry }) => {
  const { locales } = entry;
  const localeEntries = Object.entries(locales);
  const originalLocales = Object.fromEntries(localeEntries.map(([locale]) => [locale, true]));

  const originalSlugs = Object.fromEntries(
    localeEntries.map(([locale, { slug }]) => [locale, slug]),
  );

  const originalValues = Object.fromEntries(
    localeEntries.map(([locale, { content }]) => [locale, content]),
  );

  return {
    createdAt: Date.now(),
    isNew: false,
    canPreview: true,
    originalEntry: entry,
    originalLocales,
    currentLocales: structuredClone(originalLocales),
    originalSlugs,
    currentSlugs: structuredClone(originalSlugs),
    originalValues,
    currentValues: structuredClone(originalValues),
    files: {},
    validities: {},
    validationMessages: {},
    expanderStates: {},
  };
};

/**
 * Add saving entry data to the stack.
 * @param {object} args Arguments.
 * @param {Partial<EntryDraft>} args.draftProps Entry draft properties.
 * @param {CollectionIndexFile} [args.indexFile] Index file of the collection.
 * @param {Entry[]} args.savingEntries Entries to be saved. This will be modified.
 * @param {FileChange[]} args.changes File changes to be saved. This will be modified.
 */
export const addSavingEntryData = async ({ draftProps, indexFile, savingEntries, changes }) => {
  const { collection, collectionFile } = draftProps;

  const { fields: regularFields = [] } =
    collectionFile ?? /** @type {InternalEntryCollection} */ (collection);

  const draft = /** @type {EntryDraft} */ ({
    ...draftProps,
    fields: indexFile?.fields ?? regularFields,
  });

  const { savingEntry, changes: _changes } = await createSavingEntryData({
    draft,
    slugs: getSlugs({ draft }),
  });

  savingEntries.push(savingEntry);
  changes.push(..._changes);
};

/**
 * Collect changes for the given entry.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry to collect changes for.
 * @param {Entry[]} args.savingEntries Entries to be saved. This will be modified.
 * @param {FileChange[]} args.changes File changes to be saved. This will be modified.
 */
export const collectEntryChanges = async ({ entry, savingEntries, changes }) => {
  const draftBaseProps = getDraftBaseProps({ entry });

  await Promise.all(
    getAssociatedCollections(entry).map(async (collection) => {
      const collectionName = collection.name;
      const isIndexFile = isCollectionIndexFile(collection, entry);
      const indexFile = isIndexFile ? getIndexFile(collection) : undefined;
      const collectionFiles = getCollectionFilesByEntry(collection, entry);
      const addDataProps = { indexFile, savingEntries, changes };
      /** @type {Partial<EntryDraft>} */
      const draftProps = { ...draftBaseProps, collection, collectionName, isIndexFile };

      if (collectionFiles.length) {
        await Promise.all(
          collectionFiles.map((collectionFile) =>
            addSavingEntryData({
              ...addDataProps,
              draftProps: { ...draftProps, collectionFile, fileName: collectionFile.name },
            }),
          ),
        );
      } else {
        await addSavingEntryData({ ...addDataProps, draftProps });
      }
    }),
  );
};

/**
 * Get the new URL of a moved asset that has no public path, as in an entry-relative folder, by
 * swapping the folder’s internal path for its public path.
 * @param {object} args Arguments.
 * @param {AssetFolderInfo} args._globalAssetFolder Global asset folder.
 * @param {string} args.newPath New path for the asset.
 * @param {Asset} args.asset Asset being moved.
 * @returns {string} URL.
 */
const getFallbackURL = ({ _globalAssetFolder, newPath, asset }) => {
  const { publicPath } =
    getAssetFoldersByPath(asset.path).find(({ collectionName }) => collectionName !== undefined) ??
    _globalAssetFolder;

  return newPath.replace(asset.folder.internalPath ?? '', publicPath ?? '');
};

/**
 * Get a function that rewrites a reference to a renamed asset that has no public path, as in an
 * entry-relative folder. Such a reference is relative to the entry holding it, so only its file
 * name is swapped, leaving the rest — `./`, `../` or a subfolder — as the entry has it. A file name
 * encoded in the reference, as with the `encode_file_path` option, is replaced in the same form.
 * @param {string} oldName Current file name.
 * @param {string} newName New file name.
 * @returns {(src: string) => string | undefined} Function returning the new reference, or
 * `undefined` if the reference doesn’t end with the file name.
 */
const getRenamedReference = (oldName, newName) => (src) => {
  const [from, to] =
    [
      [oldName, newName],
      [encodeURI(oldName), encodeURI(newName)],
    ].find(([name]) => src === name || src.endsWith(`/${name}`)) ?? [];

  return from === undefined ? undefined : `${src.slice(0, -from.length)}${to}`;
};

/**
 * Rewrite the references to the given assets in the entries that use them, so these point at the
 * assets’ new paths. The entries are searched once for all the assets, however many there are.
 * @param {object} args Arguments.
 * @param {AssetFolderInfo} args._globalAssetFolder Global asset folder.
 * @param {MovingAsset[]} args.movingAssets Assets being moved, with their new paths.
 * @param {Map<string, Entry>} args.updatingEntryMap Copies of the entries being rewritten, keyed by
 * entry ID. An entry using several of the moved assets is copied once and has every reference
 * replaced in that copy, so it’s saved once with all of them; a copy per asset would each hold a
 * single replacement and overwrite the others. The caller collects the changes from the copies.
 */
export const collectEntryChangesFromAssets = async ({
  _globalAssetFolder,
  movingAssets,
  updatingEntryMap,
}) => {
  /** @type {AssetReferenceTarget[]} */
  const targets = movingAssets.map(({ asset }) => {
    // An asset without a public URL, as in an entry-relative folder, is matched by the asset its
    // references resolve to, which works whether or not the asset has been loaded
    const url = getAssetPublicURL(asset);

    return url ? { url } : { asset };
  });

  if (!targets.length) {
    return;
  }

  // Find the entries first, without replacing anything, so the originals are left alone until the
  // change is saved
  const usedEntries = await getEntriesByAssets(targets);
  /** @type {AssetReferenceTarget[]} */
  const replacingTargets = [];
  /** @type {Set<Entry>} */
  const updatingEntries = new Set();

  movingAssets.forEach(({ asset, path: newPath }, index) => {
    if (!usedEntries[index].length) {
      return;
    }

    // The new URL is worked out the same way as the current one, so that the public folder, the
    // `encode_file_path` option and template tags are all dealt with alike. A move stays within the
    // asset’s folder, so the folder still applies
    const newName = newPath.slice(newPath.lastIndexOf('/') + 1);

    const newURL =
      getAssetPublicURL(
        { ...asset, path: newPath, name: newName },
        { pathOnly: true, allowSpecial: true },
      ) ??
      // A rename can be applied to a reference relative to the entry holding it
      (asset.folder.entryRelative &&
      newPath.slice(0, -newName.length) === asset.path.slice(0, -asset.name.length)
        ? getRenamedReference(asset.name, newName)
        : getFallbackURL({ _globalAssetFolder, newPath, asset }));

    replacingTargets.push({ ...targets[index], newURL });
    usedEntries[index].forEach((entry) => updatingEntries.add(entry));
  });

  if (!replacingTargets.length) {
    return;
  }

  const entries = [...updatingEntries].map((entry) => {
    let copy = updatingEntryMap.get(entry.id);

    if (!copy) {
      copy = structuredClone(entry);
      updatingEntryMap.set(entry.id, copy);
    }

    return copy;
  });

  // The references are replaced in place, in one pass over the copies
  await getEntriesByAssets(replacingTargets, { entries });
};

/**
 * Update the asset and entry stores after moving or renaming assets.
 * @param {object} args Arguments.
 * @param {'move' | 'rename'} args.action The action performed, either 'move' or 'rename'.
 * @param {MovingAsset[]} args.movedAssets The assets that have been moved or renamed.
 * @param {boolean} [args.notify] Whether to show a toast reporting the move. Default: `true`.
 */
export const updateStores = ({ action, movedAssets, notify = true }) => {
  const focusedAssetPath = focusedAsset.current?.path;
  const _focusedAsset = movedAssets.find((a) => a.asset.path === focusedAssetPath);
  const overlaidAssetPath = overlaidAsset.current?.path;
  const _overlaidAsset = movedAssets.find((a) => a.asset.path === overlaidAssetPath);

  // Replace the existing asset
  if (_focusedAsset) {
    focusedAsset.current = getAssetByInternalPath(_focusedAsset.path);
  }

  // Replace the existing asset
  if (_overlaidAsset) {
    overlaidAsset.current = getAssetByInternalPath(_overlaidAsset.path);
  }

  if (notify) {
    assetUpdatesToast.current = {
      ...UPDATE_TOAST_DEFAULT_STATE,
      moved: action === 'move',
      renamed: action === 'rename',
      count: movedAssets.length,
    };
  }
};

/**
 * Move or rename assets while updating links in the entries.
 * @param {'move' | 'rename'} action Action type.
 * @param {MovingAsset[]} movingAssets Assets to be moved/renamed.
 * @param {object} [options] Options.
 * @param {FileChange[]} [options.extraChanges] Changes to files other than the assets, committed
 * along with the move, e.g. the `.gitkeep` of a folder being renamed.
 * @param {boolean} [options.notify] Whether to show a toast reporting the move. Default: `true`.
 * A caller that reports the result in its own words, like a folder rename, turns it off.
 */
export const moveAssets = async (
  action,
  movingAssets,
  { extraChanges = [], notify = true } = {},
) => {
  const _globalAssetFolder = globalAssetFolder.current;
  /** @type {FileChange[]} */
  const changes = [];
  /** @type {Entry[]} */
  const savingEntries = [];
  /** @type {Asset[]} */
  const savingAssets = [];
  /** @type {Map<string, Entry>} */
  const updatingEntryMap = new Map();

  await Promise.all(
    movingAssets.map(async ({ asset, path }) => {
      const newPath = path;
      const newName = getPathInfo(newPath).basename;
      const blob = asset.file ?? (await getAssetBlob(asset));

      savingAssets.push({ ...asset, path: newPath, name: newName });

      changes.push({
        action: 'move',
        path: newPath,
        previousPath: asset.path,
        previousSha: asset.sha,
        // Read the bytes up front. A blob backed by the file system points at the file about to be
        // moved away, and reading it afterwards — to write the copy or to hash it — fails because
        // there’s nothing at that path anymore
        data: new File([await blob.arrayBuffer()], newName, { type: blob.type }),
      });
    }),
  );

  await collectEntryChangesFromAssets({ _globalAssetFolder, movingAssets, updatingEntryMap });

  await Promise.all(
    [...updatingEntryMap.values()].map((entry) =>
      collectEntryChanges({ entry, savingEntries, changes }),
    ),
  );

  await saveChanges({
    changes: [...changes, ...extraChanges],
    savingEntries,
    savingAssets,
    options: { commitType: 'uploadMedia' },
  });

  updateStores({ action, movedAssets: movingAssets, notify });
};
