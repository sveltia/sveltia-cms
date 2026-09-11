import { getPathInfo } from '@sveltia/utils/file';
import { IndexedDB } from '@sveltia/utils/storage';

import { allAssets } from '$lib/services/assets';
import { getAssetKind } from '$lib/services/assets/kinds';
import { hasSkipCIMarker } from '$lib/services/backends/git/shared/commits';
import { gitConfigFiles } from '$lib/services/backends/git/shared/config';
import { createFileList } from '$lib/services/backends/process';
import { cmsConfigVersion } from '$lib/services/config';
import { allEntries, dataLoaded, entryParseErrors } from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';
import { setLastCommitPublishHint } from '$lib/services/deployments/publish';

/**
 * @import {
 * Asset,
 * BaseAssetListItem,
 * BaseConfigListItem,
 * BaseEntryListItem,
 * BaseFileList,
 * BaseFileListItem,
 * BaseFileListItemProps,
 * Entry,
 * RepositoryContentsMap,
 * RepositoryFileMetadata,
 * RepositoryInfo,
 * } from '$lib/types/private';
 */

/**
 * @typedef {Record<string, RepositoryFileMetadata>} RepositoryMetadataMap Commit metadata of
 * entry/asset files, keyed with a file path.
 */

/**
 * @typedef {(lastHash: string) => Promise<BaseFileListItemProps[]>} FetchFileListFunction
 */

/**
 * Get the file list from the meta database or fetch it if not cached.
 * @param {object} args Arguments.
 * @param {IndexedDB} args.metaDB The meta database instance.
 * @param {[string, any][]} args.metaEntries Entries read from the meta database.
 * @param {string} args.lastCommitHash The latest commit hash.
 * @param {[string, any][]} args.cachedFileEntries Cached file entries.
 * @param {FetchFileListFunction} args.fetchFileList Function to fetch the repository’s complete
 * file list.
 * @returns {Promise<BaseFileList>} The file list.
 */
export const getFileList = async ({
  metaDB,
  metaEntries,
  lastCommitHash,
  cachedFileEntries,
  fetchFileList,
}) => {
  const lastConfigHash = cmsConfigVersion.current;

  const {
    last_config_hash: cachedConfigHash,
    last_commit_hash: cachedCommitHash,
    git_config_fetched: gitConfigFetched,
  } = Object.fromEntries(metaEntries);

  // We need to compare the CMS config hash to support cases where multiple CMS instances with
  // different configurations are connected to the same repository, or where the config has been
  // substantially updated. @see https://github.com/sveltia/sveltia-cms/issues/886
  // Skip fetching the file list if the cached hash matches the latest. But don’t skip if the file
  // cache is empty; something probably went wrong the last time the files were fetched.
  if (
    cachedConfigHash &&
    cachedConfigHash === lastConfigHash &&
    cachedCommitHash &&
    cachedCommitHash === lastCommitHash &&
    gitConfigFetched &&
    cachedFileEntries.length
  ) {
    return createFileList(
      cachedFileEntries.map(([path, data]) => ({
        path,
        name: getPathInfo(path).basename,
        ...data,
      })),
    );
  }

  // Get a complete file list first, and filter what’s managed in CMS
  const fileList = createFileList(await fetchFileList(lastCommitHash));

  metaDB.saveEntries(
    Object.entries({
      last_config_hash: lastConfigHash,
      last_commit_hash: lastCommitHash,
      git_config_fetched: true,
    }),
  );

  return fileList;
};

/**
 * Restore cached text and commit info to `allFiles` array.
 * @param {object} args Arguments.
 * @param {BaseFileListItem[]} args.allFiles The list of all files.
 * @param {RepositoryContentsMap} args.cachedFiles Cached files object.
 */
export const restoreCachedFileData = ({ allFiles, cachedFiles }) => {
  allFiles.forEach(({ sha, path }, index) => {
    if (cachedFiles[path]?.sha === sha) {
      Object.assign(allFiles[index], cachedFiles[path]);
    }
  });
};

/**
 * Parse file info and add additional metadata, such as name, size, and text content.
 * @param {object} args Arguments.
 * @param {BaseFileListItem} args.fileInfo File info.
 * @param {RepositoryContentsMap} args.fetchedFileMap Map of fetched file metadata and content.
 * @returns {BaseFileListItem} Parsed file with additional metadata.
 */
export const parseFileInfo = ({ fileInfo, fetchedFileMap }) => {
  // The `size` and `text` are only available in the 2nd request (`fetchFileContents`) for the
  // GitLab backend, so we need to set them here if they are not already defined
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
 * Update the stores with the latest entries, assets, config files, and errors.
 * @param {object} args Arguments.
 * @param {Entry[]} args.entries List of entry files.
 * @param {Asset[]} args.assets List of asset files.
 * @param {BaseConfigListItem[]} args.configFiles List of Git config files.
 * @param {Error[]} [args.errors] List of errors encountered while parsing entries.
 */
export const updateStores = ({ entries, assets, configFiles, errors = [] }) => {
  allEntries.current = entries;
  allAssets.current = assets;
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
 * Update the file cache by saving new entries and deleting unused ones.
 * @param {object} args Arguments.
 * @param {IndexedDB} args.cacheDB The cache database instance.
 * @param {BaseFileListItem[]} args.allFiles List of all files in the repository.
 * @param {RepositoryContentsMap} args.cachedFiles Cached files object.
 * @param {BaseFileListItem[]} args.fetchingFiles List of files being fetched.
 * @param {RepositoryContentsMap} args.fetchedFileMap Map of newly fetched file data.
 */
export const updateCache = async ({
  cacheDB,
  allFiles,
  cachedFiles,
  fetchingFiles,
  fetchedFileMap,
}) => {
  const usedPaths = new Set(allFiles.map(({ path }) => path));
  const unusedPaths = Object.keys(cachedFiles).filter((path) => !usedPaths.has(path));

  // Save new entry caches
  if (fetchingFiles.length) {
    await cacheDB.saveEntries(Object.entries(fetchedFileMap));
  }

  // Delete old entry caches; we don’t need `await` for the deletion to finish, as it’s not critical
  if (unusedPaths.length) {
    cacheDB.deleteEntries(unusedPaths);
  }
};

/**
 * Keep a promise that is awaited later from being reported as an unhandled rejection in the
 * meantime. The rejection is still delivered to whoever awaits the promise.
 * @template T
 * @param {Promise<T>} promise Promise.
 * @returns {Promise<T>} The same promise.
 */
const deferRejection = (promise) => {
  promise.catch(() => {
    // Handled where the promise is awaited
  });

  return promise;
};

/**
 * Fetch file list from a backend service, download/parse all the entry files, then cache them in
 * the {@link allEntries} and {@link allAssets} stores.
 * @param {object} args Arguments.
 * @param {RepositoryInfo} args.repository Repository info.
 * @param {() => Promise<void>} [args.checkAccess] Function to check that the user can read the
 * repository, throwing if not. It only needs the signed-in user, so it runs at the same time as the
 * branch and commit requests below rather than before them, saving a round trip on every start.
 * Its error takes precedence over theirs, as a missing branch is usually a symptom of no access.
 * @param {() => Promise<string>} args.fetchDefaultBranchName Function to fetch the repository’s
 * default branch name.
 * @param {() => Promise<{ hash: string, message: string }>} args.fetchLastCommit Function to fetch
 * the last commit’s SHA-1 hash and message.
 * @param {FetchFileListFunction} args.fetchFileList Function to fetch the repository’s complete
 * file list.
 * @param {(fetchingFiles: BaseFileListItem[]) => Promise<RepositoryContentsMap>
 * } args.fetchFileContents Function to fetch the metadata of entry/asset files as well as text file
 * contents. If {@link fetchFileMetadata} is given, this is expected to leave the metadata out.
 * @param {(fetchingFiles: BaseFileListItem[]) => Promise<RepositoryMetadataMap>
 * } [args.fetchFileMetadata] Function to fetch the commit metadata of entry/asset files separately.
 * Looking up the last commit of every file is by far the slowest part of a cold start on some
 * services, and nothing in the UI needs it right away, so with this the contents are shown as soon
 * as they arrive and the metadata is filled in afterwards.
 */
export const fetchAndParseFiles = async ({
  repository,
  checkAccess,
  fetchDefaultBranchName,
  fetchLastCommit,
  fetchFileList,
  fetchFileContents,
  fetchFileMetadata,
}) => {
  const { databaseName, branch: branchName } = repository;
  const metaDB = new IndexedDB(/** @type {string} */ (databaseName), 'meta');
  const cacheDB = new IndexedDB(/** @type {string} */ (databaseName), 'file-cache');
  const accessPromise = checkAccess ? deferRejection(checkAccess()) : undefined;

  // Start reading the databases right away, but only wait for them once the last commit is known,
  // so the reads — the file cache holds the text of every entry — overlap the network round trips
  // below instead of delaying them. The two stores are opened one after the other, though: both
  // live in the same database, and on a brand-new one two instances opening it at the same time
  // race to create their stores, which leaves one of them with a connection missing its store
  const databaseEntriesPromise = deferRejection(
    (async () => {
      const cachedFileEntries = await cacheDB.entries();
      const metaEntries = await metaDB.entries();

      return { metaEntries, cachedFileEntries };
    })(),
  );

  let branch = branchName;

  if (!branch) {
    // Only the request is started here; the access check is settled first, so that its error is
    // the one reported if both fail, as a repository that can’t be read has no branches to list
    const branchPromise = deferRejection(fetchDefaultBranchName());

    await accessPromise;

    branch = await branchPromise;
    repository.branch = branch;
  }

  // This has to be done after the branch is determined. Again, only the request is started here,
  // and the access check is settled first
  const lastCommitPromise = deferRejection(fetchLastCommit());

  await accessPromise;

  const { hash: lastCommitHash, message } = await lastCommitPromise;
  const { metaEntries, cachedFileEntries } = await databaseEntriesPromise;

  const fileList = await getFileList({
    metaDB,
    metaEntries,
    lastCommitHash,
    cachedFileEntries,
    fetchFileList,
  });

  // What the message says is only what the author asked for. It’s the answer until the CI/CD
  // provider is asked about the commit, which `isLastCommitPublished` prefers once it has one
  setLastCommitPublishHint(!hasSkipCIMarker(message));

  // Skip fetching files if no files found
  if (!fileList.count) {
    updateStores({ entries: [], assets: [], configFiles: [] });

    return;
  }

  const { entryFiles, assetFiles, configFiles, allFiles } = fileList;
  /** @type {RepositoryContentsMap} */
  const cachedFiles = Object.fromEntries(cachedFileEntries);

  restoreCachedFileData({ allFiles, cachedFiles });

  const fetchingFiles = allFiles.filter(({ meta }) => !meta);
  const fetchedFileMap = fetchingFiles.length ? await fetchFileContents(fetchingFiles) : {};

  const { entries, errors } = await prepareEntries(
    entryFiles.map(
      (fileInfo) => /** @type {BaseEntryListItem} */ (parseFileInfo({ fileInfo, fetchedFileMap })),
    ),
  );

  const assets = assetFiles.map((fileInfo) =>
    parseAssetFileInfo(
      /** @type {BaseAssetListItem} */ (parseFileInfo({ fileInfo, fetchedFileMap })),
    ),
  );

  const configFileItems = configFiles.map(
    (fileInfo) => /** @type {BaseConfigListItem} */ (parseFileInfo({ fileInfo, fetchedFileMap })),
  );

  updateStores({ entries, assets, configFiles: configFileItems, errors });

  if (fetchFileMetadata && fetchingFiles.length) {
    try {
      applyFileMetadata({
        fetchedFileMap,
        metadataMap: await fetchFileMetadata(fetchingFiles),
      });
    } catch (/** @type {any} */ ex) {
      // The contents are already usable without it. A file cached without metadata is fetched
      // again next time, so this isn’t permanent either
      // eslint-disable-next-line no-console
      console.error('Failed to fetch the commit metadata.', ex);
    }
  }

  // Cached once the metadata is there, as a file without it is treated as not fetched yet
  await updateCache({ cacheDB, allFiles, cachedFiles, fetchingFiles, fetchedFileMap });
};
