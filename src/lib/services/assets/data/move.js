import { getPathInfo } from '@sveltia/utils/file';
import { get } from 'svelte/store';

import { allAssets, focusedAsset, overlaidAsset } from '$lib/services/assets';
import { assetUpdatesToast } from '$lib/services/assets/data';
import { getAssetFoldersByPath, globalAssetFolder } from '$lib/services/assets/folders';
import { getAssetBlob, getAssetPublicURL } from '$lib/services/assets/info';
import { saveChanges } from '$lib/services/backends/save';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';
import { getEntriesByAssetURL } from '$lib/services/contents/collection/entries';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getIndexFile, isCollectionIndexFile } from '$lib/services/contents/collection/index-file';
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
 * InternalSiteConfig,
 * MovingAsset,
 * } from '$lib/types/private';
 * @import { CollectionIndexFile } from '$lib/types/public';
 */

/**
 * Get base properties for the entry draft.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry to get base properties for.
 * @returns {Partial<EntryDraft>} Base properties for the entry draft.
 */
export const getDraftBaseProps = ({ entry }) => {
  const { locales } = entry;

  const originalLocales = Object.fromEntries(
    Object.entries(locales).map(([locale]) => [locale, true]),
  );

  const originalSlugs = Object.fromEntries(
    Object.entries(locales).map(([locale, { slug }]) => [locale, slug]),
  );

  const originalValues = Object.fromEntries(
    Object.entries(locales).map(([locale, { content }]) => [locale, content]),
  );

  return {
    createdAt: Date.now(),
    isNew: false,
    originalEntry: entry,
    originalLocales,
    currentLocales: structuredClone(originalLocales),
    originalSlugs,
    currentSlugs: structuredClone(originalSlugs),
    originalValues,
    currentValues: structuredClone(originalValues),
    files: {},
    validities: {},
    expanderStates: {},
  };
};

/**
 * Add saving entry data to the stack.
 * @param {object} args Arguments.
 * @param {Record<string, any>} args.draftProps Entry draft properties.
 * @param {CollectionIndexFile} [args.indexFile] Index file of the collection.
 * @param {Entry[]} args.savingEntries Entries to be saved. This will be modified.
 * @param {FileChange[]} args.changes File changes to be saved. This will be modified.
 */
export const addSavingEntryData = async ({ draftProps, indexFile, savingEntries, changes }) => {
  const { collection, collectionFile } = draftProps;
  const { fields: regularFields = [] } = collectionFile ?? collection;

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
      const draftProps = {
        ...draftBaseProps,
        collection,
        collectionName,
        isIndexFile,
        canPreview: true,
      };

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
 * Collect changes for the given asset and update the entries that use it.
 * @param {object} args Arguments.
 * @param {AssetFolderInfo} args._globalAssetFolder Global asset folder.
 * @param {string} args.newPath New path for the asset.
 * @param {Asset} args.asset Asset to collect changes for.
 * @param {Entry[]} args.savingEntries Entries to be saved. This will be modified.
 * @param {FileChange[]} args.changes File changes to be saved. This will be modified.
 */
export const collectEntryChangesFromAsset = async ({
  _globalAssetFolder,
  newPath,
  asset,
  savingEntries,
  changes,
}) => {
  const assetURL = getAssetPublicURL(asset) ?? asset.blobURL;
  const usedEntries = assetURL ? await getEntriesByAssetURL(assetURL) : [];

  if (!assetURL || !usedEntries.length) {
    return;
  }

  const { publicPath } =
    getAssetFoldersByPath(asset.path).find(({ collectionName }) => collectionName !== undefined) ??
    _globalAssetFolder;

  const updatingEntries = await getEntriesByAssetURL(assetURL, {
    entries: structuredClone(usedEntries),
    newURL: newPath.replace(asset.folder.internalPath ?? '', publicPath ?? ''),
  });

  if (!updatingEntries.length) {
    return;
  }

  await Promise.all(
    updatingEntries.map(async (entry) => collectEntryChanges({ entry, savingEntries, changes })),
  );
};

/**
 * Update the asset and entry stores after moving or renaming assets.
 * @param {object} args Arguments.
 * @param {'move' | 'rename'} args.action The action performed, either 'move' or 'rename'.
 * @param {MovingAsset[]} args.movedAssets The assets that have been moved or renamed.
 */
export const updateStores = ({ action, movedAssets }) => {
  const _allAssets = get(allAssets);
  const focusedAssetPath = get(focusedAsset)?.path;
  const _focusedAsset = movedAssets.find((a) => a.asset.path === focusedAssetPath);
  const overlaidAssetPath = get(overlaidAsset)?.path;
  const _overlaidAsset = movedAssets.find((a) => a.asset.path === overlaidAssetPath);

  // Replace the existing asset
  if (_focusedAsset) {
    focusedAsset.set(_allAssets.find((a) => a.path === _focusedAsset.path));
  }

  // Replace the existing asset
  if (_overlaidAsset) {
    overlaidAsset.set(_allAssets.find((a) => a.path === _overlaidAsset.path));
  }

  assetUpdatesToast.set({
    ...UPDATE_TOAST_DEFAULT_STATE,
    moved: action === 'move',
    renamed: action === 'rename',
    count: movedAssets.length,
  });
};

/**
 * Move or rename assets while updating links in the entries.
 * @param {'move' | 'rename'} action Action type.
 * @param {MovingAsset[]} movingAssets Assets to be moved/renamed.
 */
export const moveAssets = async (action, movingAssets) => {
  const _globalAssetFolder = get(globalAssetFolder);
  /** @type {FileChange[]} */
  const changes = [];
  /** @type {Entry[]} */
  const savingEntries = [];
  /** @type {Asset[]} */
  const savingAssets = [];

  await Promise.all(
    movingAssets.map(async ({ asset, path }) => {
      const newPath = path;
      const newName = getPathInfo(newPath).basename;

      savingAssets.push({ ...asset, path: newPath, name: newName });

      changes.push({
        action: 'move',
        path: newPath,
        previousPath: asset.path,
        previousSha: asset.sha,
        data: new File([asset.file ?? (await getAssetBlob(asset))], newName),
      });

      await collectEntryChangesFromAsset({
        _globalAssetFolder,
        newPath,
        asset,
        savingEntries,
        changes,
      });
    }),
  );

  await saveChanges({
    changes,
    savingEntries,
    savingAssets,
    options: { commitType: 'uploadMedia' },
  });

  updateStores({ action, movedAssets: movingAssets });
};
