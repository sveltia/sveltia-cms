import { getPathInfo } from '@sveltia/utils/file';
import { get } from 'svelte/store';
import {
  allAssets,
  focusedAsset,
  getAssetBlob,
  getAssetFoldersByPath,
  getAssetPublicURL,
  globalAssetFolder,
  overlaidAsset,
} from '$lib/services/assets';
import { assetUpdatesToast } from '$lib/services/assets/data';
import { backend } from '$lib/services/backends';
import { siteConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';
import { getEntriesByAssetURL } from '$lib/services/contents/collection/entries';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getIndexFile, isCollectionIndexFile } from '$lib/services/contents/collection/index-file';
import { createSavingEntryData } from '$lib/services/contents/draft/save';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import { getAssociatedCollections } from '$lib/services/contents/entry';

/**
 * @import {
 * Asset,
 * Entry,
 * EntryDraft,
 * FileChange,
 * InternalCollectionFile,
 * InternalSiteConfig,
 * MovingAsset,
 * } from '$lib/types/private';
 */

/**
 * Update the asset and entry stores after moving or renaming assets.
 * @param {object} args Arguments.
 * @param {'move' | 'rename'} args.action The action performed, either 'move' or 'rename'.
 * @param {MovingAsset[]} args.movedAssets The assets that have been moved or renamed.
 * @param {Asset[]} args.savedAssets The assets that have been saved.
 * @param {Entry[]} args.savedEntries The entries that have been saved.
 */
const updateStores = ({ action, movedAssets, savedAssets, savedEntries }) => {
  const savedAssetsPaths = movedAssets.map((a) => a.asset.path); // old paths
  const savedEntryIds = savedEntries.map((e) => e.id);

  allAssets.update((assets) => [
    ...assets.filter((a) => !savedAssetsPaths.includes(a.path)),
    ...savedAssets,
  ]);

  allEntries.update((entries) => [
    ...entries.filter((e) => !savedEntryIds.includes(e.id)),
    ...savedEntries,
  ]);

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
  const _siteConfig = /** @type {InternalSiteConfig} */ (get(siteConfig));
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
        data: new File([asset.file ?? (await getAssetBlob(asset))], newName),
      });

      const assetURL = getAssetPublicURL(asset) ?? asset.blobURL;
      const usedEntries = assetURL ? await getEntriesByAssetURL(assetURL) : [];

      if (!assetURL || !usedEntries.length) {
        return;
      }

      const { publicPath } =
        getAssetFoldersByPath(asset.path).find(
          ({ collectionName }) => collectionName !== undefined,
        ) ?? _globalAssetFolder;

      const updatedEntries = await getEntriesByAssetURL(assetURL, {
        entries: structuredClone(usedEntries),
        newURL: newPath.replace(asset.folder.internalPath ?? '', publicPath ?? ''),
      });

      await Promise.all(
        updatedEntries.map(async (entry) => {
          const { locales } = entry;

          const currentLocales = Object.fromEntries(
            Object.entries(locales).map(([locale]) => [locale, true]),
          );

          const currentSlugs = Object.fromEntries(
            Object.entries(locales).map(([locale, { slug }]) => [locale, slug]),
          );

          const currentValues = Object.fromEntries(
            Object.entries(locales).map(([locale, { content }]) => [locale, content]),
          );

          const draftProps = {
            isNew: false,
            originalEntry: entry,
            originalLocales: currentLocales,
            currentLocales,
            originalSlugs: currentSlugs,
            currentSlugs,
            originalValues: currentValues,
            currentValues,
            files: {},
            validities: {},
            expanderStates: {},
          };

          await Promise.all(
            getAssociatedCollections(entry).map(async (collection) => {
              const { name: collectionName, editor } = collection;
              const isIndexFile = isCollectionIndexFile(collection, entry);
              const indexFile = isIndexFile ? getIndexFile(collection) : undefined;

              const canPreview =
                indexFile?.editor?.preview ??
                editor?.preview ??
                _siteConfig?.editor?.preview ??
                true;

              /**
               * Add saving entry data to the stack.
               * @param {InternalCollectionFile} [collectionFile] Collection file. File/singleton
               * collection only.
               */
              const addSavingEntryData = async (collectionFile) => {
                const { fields: regularFields = [] } = collectionFile ?? collection;
                const fields = indexFile?.fields ?? regularFields;

                /** @type {EntryDraft} */
                const draft = {
                  ...draftProps,
                  createdAt: Date.now(),
                  isIndexFile,
                  canPreview,
                  collection,
                  collectionName,
                  collectionFile,
                  fileName: collectionFile?.name,
                  fields,
                };

                const { savingEntry, changes: savingEntryChanges } = await createSavingEntryData({
                  draft,
                  slugs: getSlugs({ draft }),
                });

                savingEntries.push(savingEntry);
                changes.push(...savingEntryChanges);
              };

              const collectionFiles = getCollectionFilesByEntry(collection, entry);

              if (collectionFiles.length) {
                await Promise.all(collectionFiles.map(addSavingEntryData));
              } else {
                await addSavingEntryData();
              }
            }),
          );
        }),
      );
    }),
  );

  const results = await get(backend)?.commitChanges(changes, { commitType: 'uploadMedia' });

  updateStores({
    action,
    movedAssets: [...movingAssets],
    savedAssets: savingAssets.map((asset, index) => {
      const result = results?.[index];
      const blobURL = result instanceof File ? URL.createObjectURL(result) : undefined;

      return { ...asset, blobURL };
    }),
    savedEntries: [...savingEntries],
  });
};
