import { getPathInfo } from '@sveltia/utils/file';
import { IndexedDB } from '@sveltia/utils/storage';

import { allAssets } from '$lib/services/assets';
import { getAssetKind } from '$lib/services/assets/kinds';
import { hasSkipCIMarker } from '$lib/services/backends/git/shared/commits';
import { gitConfigFiles } from '$lib/services/backends/git/shared/config';
import { reconcileAssets, reconcileEntries } from '$lib/services/backends/git/shared/reconcile';
import { createFileList, describeFileList } from '$lib/services/backends/process';
import { cmsConfigVersion } from '$lib/services/config';
import { allEntries, dataLoaded, entryParseErrors } from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';
import { setLastCommitPublishHint } from '$lib/services/deployments/publish';
import { createDebugLogger } from '$lib/services/utils/logging';
import { createRawState } from '$lib/services/utils/state.svelte';

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
 * @import { DebugLogger } from '$lib/services/utils/logging';
 */

/**
 * @typedef {Record<string, RepositoryFileMetadata>} RepositoryMetadataMap Commit metadata of
 * entry/asset files, keyed with a file path.
 */

/**
 * @typedef {(lastHash: string) => Promise<BaseFileListItemProps[]>} FetchFileListFunction
 */

/**
 * Head commit of the configured branch that the loaded site data reflects: the commit the files
 * were fetched at, or the user’s own latest commit. Comparing it with the branch’s current head
 * tells whether someone else has pushed since. Empty until the site data has been loaded, and for a
 * backend that doesn’t track commits.
 */
export const repositoryHead = createRawState('');

/**
 * Get the file list from the meta database or fetch it if not cached.
 * @param {object} args Arguments.
 * @param {IndexedDB} args.metaDB The meta database instance.
 * @param {[string, any][]} args.metaEntries Entries read from the meta database.
 * @param {string} args.lastCommitHash The latest commit hash.
 * @param {[string, any][]} args.cachedFileEntries Cached file entries.
 * @param {FetchFileListFunction} args.fetchFileList Function to fetch the repository’s complete
 * file list.
 * @param {DebugLogger} args.log Function to trace the loading in the console.
 * @returns {Promise<BaseFileList>} The file list.
 */
export const getFileList = async ({
  metaDB,
  metaEntries,
  lastCommitHash,
  cachedFileEntries,
  fetchFileList,
  log,
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
    const fileList = createFileList(
      cachedFileEntries.map(([path, data]) => ({
        path,
        name: getPathInfo(path).basename,
        ...data,
      })),
    );

    log(`Restored the file list from the cache: ${describeFileList(fileList)}`);

    return fileList;
  }

  // Get a complete file list first, and filter what’s managed in CMS
  const fileList = createFileList(await fetchFileList(lastCommitHash));

  log(`Fetched the file list: ${describeFileList(fileList)}`);

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
  // Some backends only provide the `size` or `text` in the 2nd request (`fetchFileContents`), so
  // we need to set them here if they are not already defined
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
  const { service, owner, repo, databaseName, branch: branchName } = repository;
  const log = createDebugLogger('Loading site data');

  log(`Started: ${service} ${owner}/${repo}`);

  const metaDB = new IndexedDB(/** @type {string} */ (databaseName), 'meta');
  const cacheDB = new IndexedDB(/** @type {string} */ (databaseName), 'file-cache');

  // The access was verified when the data was first loaded; a later call only brings it up to date
  const accessPromise =
    checkAccess && !repositoryHead.current ? deferRejection(checkAccess()) : undefined;

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

    log(`Fetched the default branch name: ${branch}`);
  }

  // This has to be done after the branch is determined. Again, only the request is started here,
  // and the access check is settled first
  const lastCommitPromise = deferRejection(fetchLastCommit());

  await accessPromise;

  const { hash: lastCommitHash, message } = await lastCommitPromise;

  log(`Fetched the last commit on ${branch}: ${lastCommitHash}`);

  const { metaEntries, cachedFileEntries } = await databaseEntriesPromise;

  log(`Read the file cache: ${cachedFileEntries.length} files`);

  const fileList = await getFileList({
    metaDB,
    metaEntries,
    lastCommitHash,
    cachedFileEntries,
    fetchFileList,
    log,
  });

  // What the message says is only what the author asked for. It’s the answer until the CI/CD
  // provider is asked about the commit, which `isLastCommitPublished` prefers once it has one
  setLastCommitPublishHint(!hasSkipCIMarker(message));

  // Skip fetching files if no files found
  if (!fileList.count) {
    updateStores({ entries: [], assets: [], configFiles: [] });
    repositoryHead.current = lastCommitHash;
    log('The site data is ready: no files to load');

    return;
  }

  const { entryFiles, assetFiles, configFiles, allFiles } = fileList;
  /** @type {RepositoryContentsMap} */
  const cachedFiles = Object.fromEntries(cachedFileEntries);

  restoreCachedFileData({ allFiles, cachedFiles });

  // What differs from the last fetch, which the cache stands for; the user’s own commits keep it up
  // to date, so their files don’t count. Everything is new on a first load into an empty cache
  const changedPaths = new Set(
    allFiles.filter(({ path, sha }) => cachedFiles[path]?.sha !== sha).map(({ path }) => path),
  );

  // A file is fetched again until its metadata is cached along with its text
  const fetchingFiles = allFiles.filter(({ meta }) => !meta);

  // With a separate metadata pass, the text may already be in the cache from a run that was
  // interrupted before its metadata pass finished, in which case only the metadata is missing. An
  // asset never has any text to read
  const contentFiles = fetchFileMetadata
    ? fetchingFiles.filter(({ type, text }) => type !== 'asset' && text === undefined)
    : fetchingFiles;

  // What’s known about each file being fetched, to be completed below and then cached
  /** @type {RepositoryContentsMap} */
  const fetchedFileMap = Object.fromEntries(
    fetchingFiles.map(({ path, sha, size, text }) => [path, { sha, size, text, meta: undefined }]),
  );

  log(
    `Restored ${allFiles.length - fetchingFiles.length} files from the cache; ` +
      `fetching ${fetchingFiles.length} files`,
  );

  if (contentFiles.length) {
    Object.assign(fetchedFileMap, await fetchFileContents(contentFiles));

    // Only the text files are downloaded; an asset in the list is just there for its metadata
    log(
      `Fetched the contents of ${contentFiles.filter(({ type }) => type !== 'asset').length} files`,
    );
  }

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

  log(`Parsed ${entries.length} entries (${errors.length} errors)`);
  updateStores({ entries, assets, configFiles: configFileItems, errors, changedPaths });
  // Recorded once the stores reflect the commit, so a check made in the meantime still sees the
  // previous head and knows the data isn’t there yet
  repositoryHead.current = lastCommitHash;
  log('The site data is ready');

  // Whether the cache written below is complete, or missing the metadata of the fetched files
  let metadataFetched = true;

  if (fetchFileMetadata && fetchingFiles.length) {
    // Cache the text right away, so that a reload before the slower metadata pass has finished
    // only costs that pass next time, not the contents again
    await updateCache({ cacheDB, allFiles, cachedFiles, fetchingFiles, fetchedFileMap });
    log(`Cached the contents of ${fetchingFiles.length} files`);

    try {
      applyFileMetadata({
        fetchedFileMap,
        metadataMap: await fetchFileMetadata(fetchingFiles),
      });
      log(`Fetched the commit metadata of ${fetchingFiles.length} files`);
    } catch (/** @type {any} */ ex) {
      // The contents are already usable without it, and the metadata is fetched again next time
      // eslint-disable-next-line no-console
      console.error('Failed to fetch the commit metadata.', ex);
      metadataFetched = false;
    }
  }

  // Cached with the metadata, which is what marks a file as fetched
  await updateCache({ cacheDB, allFiles, cachedFiles, fetchingFiles, fetchedFileMap });

  log(
    metadataFetched
      ? `Cached ${fetchingFiles.length} files with their metadata`
      : `Cached ${fetchingFiles.length} files without their metadata; they are fetched again ` +
          'next time',
  );
};
