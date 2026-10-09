import { getAssetKind } from '$lib/services/assets/kinds';
import { allAssets } from '$lib/services/assets/state';
import { gitConfigFiles } from '$lib/services/backends/git/shared/config';
import { reconcileAssets, reconcileEntries } from '$lib/services/backends/git/shared/reconcile';
import { mergeEntries, planEntryReparse } from '$lib/services/backends/git/shared/reparse';
import { allEntries, dataLoaded, entryParseErrors } from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';

/**
 * @import {
 * Asset,
 * BaseAssetListItem,
 * BaseConfigListItem,
 * BaseEntryListItem,
 * BaseFileList,
 * BaseFileListItem,
 * Entry,
 * RepositoryContentsMap,
 * } from '$lib/types/private';
 * @import { RepositoryMetadataMap } from '$lib/services/backends/git/shared/fetch';
 */

/**
 * Complete file info with the size, text content and commit metadata fetched for the file.
 * @param {object} args Arguments.
 * @param {BaseFileListItem} args.fileInfo File info.
 * @param {RepositoryContentsMap} args.fetchedFileMap Map of fetched file metadata and content.
 * @returns {BaseFileListItem} Completed file info.
 */
export const parseFileInfo = ({ fileInfo, fetchedFileMap }) => {
  // The file list only has what the backend lists, plus what was restored from the cache. The
  // rest comes from `fetchFileContents`: some backends only provide the `size` there, and it’s
  // where the `text` of an uncached file comes from, as well as its `meta` unless the metadata is
  // fetched in a separate pass, which fills it in later with `applyFileMetadata`
  const { meta, size, text } = fetchedFileMap[fileInfo.path] ?? {};

  return {
    ...fileInfo,
    size: fileInfo.size ?? size,
    text: fileInfo.text ?? text,
    meta: fileInfo.meta ?? meta,
  };
};

/**
 * Parse a single asset file to create a complete, serialized asset.
 * @param {BaseAssetListItem} fileInfo Asset file info.
 * @returns {Asset} Parsed asset.
 */
export const parseAssetFileInfo = (fileInfo) => {
  const { name, meta = {}, ...rest } = fileInfo;
  const kind = getAssetKind(name);

  return { ...rest, ...meta, name, kind };
};

/**
 * List the paths of the files an entry or asset is made of.
 * @param {Entry | Asset} item Entry or asset.
 * @returns {string[]} Paths.
 */
const getFilePaths = (item) =>
  'locales' in item ? Object.values(item.locales).map(({ path }) => path) : [item.path];

/**
 * Update the stores with the latest entries, assets, config files, and errors. On a fetch made
 * after the initial load, the entries and assets already in the stores are carried over wherever
 * their files haven’t changed, so the rest of the app doesn’t lose track of them.
 * @param {object} args Arguments.
 * @param {Entry[]} args.entries List of entry files.
 * @param {Asset[]} args.assets List of asset files.
 * @param {BaseConfigListItem[]} args.configFiles List of Git config files.
 * @param {Error[]} [args.errors] List of errors encountered while parsing entries.
 * @param {Set<string>} [args.changedPaths] Paths of the files whose content differs from what was
 * fetched last time. Every file counts as changed if omitted.
 */
export const updateStores = ({ entries, assets, configFiles, errors = [], changedPaths }) => {
  const changed = changedPaths ?? new Set([...entries, ...assets].flatMap(getFilePaths));

  allEntries.current = reconcileEntries({
    entries,
    previous: allEntries.current,
    changedPaths: changed,
  });
  allAssets.current = reconcileAssets({
    assets,
    previous: allAssets.current,
    changedPaths: changed,
  });
  gitConfigFiles.current = configFiles;
  entryParseErrors.current = errors;
  dataLoaded.current = true;
};

/**
 * Fill in the commit metadata that was left out of the first fetch, once it has arrived. The
 * stores are only replaced if something actually changed, and an entry or asset that already has
 * its metadata — one saved while the metadata was on its way — is left alone, as its commit is
 * newer than the one looked up.
 * @param {object} args Arguments.
 * @param {RepositoryContentsMap} args.fetchedFileMap Map of fetched file data, updated in place so
 * the metadata is cached along with the text.
 * @param {RepositoryMetadataMap} args.metadataMap Commit metadata of the fetched files.
 */
export const applyFileMetadata = ({ fetchedFileMap, metadataMap }) => {
  Object.entries(metadataMap).forEach(([path, meta]) => {
    if (fetchedFileMap[path]) {
      fetchedFileMap[path].meta = meta;
    }
  });

  let entriesChanged = false;
  let assetsChanged = false;

  const entries = allEntries.current.map((entry) => {
    if (entry.commitDate) {
      return entry;
    }

    // An entry takes its metadata from whichever of its files is known, as when it was parsed
    const meta = Object.values(entry.locales)
      .map(({ path }) => metadataMap[path])
      .find(Boolean);

    if (!meta) {
      return entry;
    }

    entriesChanged = true;

    return { ...entry, ...meta };
  });

  const assets = allAssets.current.map((asset) => {
    const meta = asset.commitDate ? undefined : metadataMap[asset.path];

    if (!meta) {
      return asset;
    }

    assetsChanged = true;

    return { ...asset, ...meta };
  });

  if (entriesChanged) {
    allEntries.current = entries;
  }

  if (assetsChanged) {
    allAssets.current = assets;
  }
};

/**
 * Parse the entry files into entries. On a fetch made after the initial load, only the files that
 * have changed are parsed, and the entries already in the store are kept for the rest.
 * @param {object} args Arguments.
 * @param {BaseEntryListItem[]} args.entryFiles Entry files, completed with their text.
 * @param {Set<string>} [args.changedPaths] Paths of the files whose content differs from what was
 * fetched last time. Every file is parsed if omitted.
 * @returns {Promise<{ entries: Entry[], errors: Error[] }>} Parsed entries, and errors encountered
 * while parsing them.
 */
const parseEntryFiles = async ({ entryFiles, changedPaths }) => {
  const previous = allEntries.current;

  if (!changedPaths || !previous.length) {
    return prepareEntries(entryFiles);
  }

  const { reusedEntries, dirtyFiles } = planEntryReparse({ entryFiles, previous, changedPaths });
  const { entries: parsedEntries, errors } = await prepareEntries(dirtyFiles);

  return { entries: mergeEntries({ entryFiles, reusedEntries, parsedEntries }), errors };
};

/**
 * Parse the entry, asset and config files in the file list.
 * @param {object} args Arguments.
 * @param {BaseFileList} args.fileList Repository’s file list.
 * @param {RepositoryContentsMap} args.fetchedFileMap Map of fetched file metadata and content.
 * @param {Set<string>} [args.changedPaths] Paths of the files whose content differs from what was
 * fetched last time, given to parse only those entry files again. Every file is parsed if omitted.
 * @returns {Promise<{ entries: Entry[], errors: Error[], assets: Asset[], configFiles:
 * BaseConfigListItem[] }>} Parsed entries, errors encountered while parsing them, assets and config
 * files.
 */
export const parseFiles = async ({
  fileList: { entryFiles, assetFiles, configFiles },
  fetchedFileMap,
  changedPaths,
}) => {
  const { entries, errors } = await parseEntryFiles({
    entryFiles: entryFiles.map(
      (fileInfo) => /** @type {BaseEntryListItem} */ (parseFileInfo({ fileInfo, fetchedFileMap })),
    ),
    changedPaths,
  });

  const assets = assetFiles.map((fileInfo) =>
    parseAssetFileInfo(
      /** @type {BaseAssetListItem} */ (parseFileInfo({ fileInfo, fetchedFileMap })),
    ),
  );

  const configFileItems = configFiles.map(
    (fileInfo) => /** @type {BaseConfigListItem} */ (parseFileInfo({ fileInfo, fetchedFileMap })),
  );

  return { entries, errors, assets, configFiles: configFileItems };
};
