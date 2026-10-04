import { getPathInfo } from '@sveltia/utils/file';
import { IndexedDB } from '@sveltia/utils/storage';

import { getAssetKind } from '$lib/services/assets/kinds';
import { allAssets } from '$lib/services/assets/state';
import { hasSkipCIMarker } from '$lib/services/backends/git/shared/commits';
import { gitConfigFiles } from '$lib/services/backends/git/shared/config';
import { reconcileAssets, reconcileEntries } from '$lib/services/backends/git/shared/reconcile';
import { mergeEntries, planEntryReparse } from '$lib/services/backends/git/shared/reparse';
import { createFileList, describeFileList } from '$lib/services/backends/process';
import { cmsConfigVersion } from '$lib/services/config';
import { allEntries, dataLoaded, entryParseErrors } from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';
import { setLastCommitPublishHint } from '$lib/services/deployments';
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
 * @typedef {(fetchingFiles: BaseFileListItem[]) => Promise<RepositoryContentsMap>
 * } FetchFileContentsFunction
 */

/**
 * @typedef {(fetchingFiles: BaseFileListItem[]) => Promise<RepositoryMetadataMap>
 * } FetchFileMetadataFunction
 */

/**
 * Head commit of the configured branch that the loaded site data reflects: the commit the files
 * were fetched at, or the user’s own latest commit. Comparing it with the branch’s current head
 * tells whether someone else has pushed since. Empty until the site data has been loaded, and for a
 * backend that doesn’t track commits.
 */
export const repositoryHead = createRawState('');

/**
 * What the entries in the store were last parsed for: the repository database name and the CMS
 * configuration hash. A fetch made for the same ones can keep the entries whose files haven’t
 * changed instead of parsing everything again; anything else, such as a configuration change, which
 * can change how every file is parsed, calls for a full parse.
 * @type {string | undefined}
 */
let lastParseKey;
/**
 * Get the key identifying what the entries are parsed for.
 * @param {string | undefined} databaseName Repository database name.
 * @returns {string} Key.
 */
const getParseKey = (databaseName) => `${databaseName}\n${cmsConfigVersion.current}`;

/**
 * Get the file list from the meta database or fetch it if not cached. The commit the list was
 * fetched at isn’t recorded here but with {@link saveFileListMeta}, once the file contents have
 * been cached: until then, the cache still holds the files of the previous commit, which the file
 * list would be restored from.
 * @param {object} args Arguments.
 * @param {[string, any][]} args.metaEntries Entries read from the meta database.
 * @param {string} args.lastCommitHash The latest commit hash.
 * @param {[string, any][]} args.cachedFileEntries Cached file entries.
 * @param {FetchFileListFunction} args.fetchFileList Function to fetch the repository’s complete
 * file list.
 * @param {DebugLogger} args.log Function to trace the loading in the console.
 * @returns {Promise<BaseFileList>} The file list.
 */
export const getFileList = async ({
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

  return fileList;
};

/**
 * Record the commit and CMS configuration the file cache reflects, so that the next fetch for the
 * same ones can restore the file list from the cache. This is only done once the cache has been
 * updated with the files of that commit.
 * @param {object} args Arguments.
 * @param {IndexedDB} args.metaDB The meta database instance.
 * @param {string | undefined} args.lastConfigHash The CMS configuration hash the files were
 * fetched for.
 * @param {string} args.lastCommitHash The commit hash the files were fetched at.
 */
export const saveFileListMeta = async ({ metaDB, lastConfigHash, lastCommitHash }) => {
  await metaDB.saveEntries(
    Object.entries({
      last_config_hash: lastConfigHash,
      last_commit_hash: lastCommitHash,
      git_config_fetched: true,
    }),
  );
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
 * Update the file cache by saving new entries and deleting unused ones. Both are awaited, as the
 * cache is only recorded as reflecting the commit once it’s up to date: a file left in it would
 * come back with the file list restored from it.
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

  await Promise.all([
    // Save new entry caches
    fetchingFiles.length ? cacheDB.saveEntries(Object.entries(fetchedFileMap)) : undefined,
    // Delete old entry caches
    unusedPaths.length ? cacheDB.deleteEntries(unusedPaths) : undefined,
  ]);
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
 * Start reading the meta and file cache databases.
 * @param {object} args Arguments.
 * @param {IndexedDB} args.metaDB The meta database instance.
 * @param {IndexedDB} args.cacheDB The cache database instance.
 * @returns {Promise<{ metaEntries: [string, any][], cachedFileEntries: [string, any][] }>} Entries
 * read from the databases.
 */
const readDatabaseEntries = ({ metaDB, cacheDB }) =>
  // The two stores are opened one after the other: both live in the same database, and on a
  // brand-new one two instances opening it at the same time race to create their stores, which
  // leaves one of them with a connection missing its store
  deferRejection(
    (async () => {
      const cachedFileEntries = await cacheDB.entries();
      const metaEntries = await metaDB.entries();

      return { metaEntries, cachedFileEntries };
    })(),
  );

/**
 * Determine the branch if not configured, and fetch its last commit.
 * @param {object} args Arguments.
 * @param {RepositoryInfo} args.repository Repository info. Its `branch` is set to the default
 * branch if not configured.
 * @param {Promise<void> | undefined} args.accessPromise Access check in progress, if any.
 * @param {() => Promise<string>} args.fetchDefaultBranchName Function to fetch the repository’s
 * default branch name.
 * @param {() => Promise<{ hash: string, message: string }>} args.fetchLastCommit Function to fetch
 * the last commit’s SHA-1 hash and message.
 * @param {{ hash: string, message: string }} [args.lastCommit] Last commit, if the caller has
 * just fetched it. It’s only used once the branch is known.
 * @param {DebugLogger} args.log Function to trace the loading in the console.
 * @returns {Promise<{ hash: string, message: string }>} Last commit’s SHA-1 hash and message.
 */
const resolveHead = async ({
  repository,
  accessPromise,
  fetchDefaultBranchName,
  fetchLastCommit,
  lastCommit,
  log,
}) => {
  let { branch } = repository;

  // A check for remote changes has just fetched the head to compare it, so it isn’t fetched again
  if (branch && lastCommit) {
    await accessPromise;

    return lastCommit;
  }

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

  const fetchedCommit = await lastCommitPromise;

  log(`Fetched the last commit on ${branch}: ${fetchedCommit.hash}`);

  return fetchedCommit;
};

/**
 * Restore the cached files, and fetch the contents of the rest.
 * @param {object} args Arguments.
 * @param {BaseFileList} args.fileList Repository’s file list.
 * @param {[string, any][]} args.cachedFileEntries Cached file entries.
 * @param {FetchFileContentsFunction} args.fetchFileContents Function to fetch the metadata of
 * entry/asset files as well as text file contents.
 * @param {FetchFileMetadataFunction} [args.fetchFileMetadata] Function to fetch the commit metadata
 * of entry/asset files separately.
 * @param {DebugLogger} args.log Function to trace the loading in the console.
 * @returns {Promise<{ cachedFiles: RepositoryContentsMap, changedPaths: Set<string>, fetchingFiles:
 * BaseFileListItem[], fetchedFileMap: RepositoryContentsMap }>} Cached files, paths of the files
 * changed since the last fetch, files being fetched, and what’s known about them.
 */
const loadContents = async ({
  fileList: { allFiles },
  cachedFileEntries,
  fetchFileContents,
  fetchFileMetadata,
  log,
}) => {
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

  return { cachedFiles, changedPaths, fetchingFiles, fetchedFileMap };
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
const parseFiles = async ({
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

/**
 * Cache the fetched files, completing them with their commit metadata first if it’s fetched in a
 * separate pass.
 * @param {object} args Arguments.
 * @param {IndexedDB} args.cacheDB The cache database instance.
 * @param {BaseFileListItem[]} args.allFiles List of all files in the repository.
 * @param {RepositoryContentsMap} args.cachedFiles Cached files object.
 * @param {BaseFileListItem[]} args.fetchingFiles List of files being fetched.
 * @param {RepositoryContentsMap} args.fetchedFileMap Map of newly fetched file data.
 * @param {FetchFileMetadataFunction} [args.fetchFileMetadata] Function to fetch the commit metadata
 * of entry/asset files separately.
 * @param {DebugLogger} args.log Function to trace the loading in the console.
 */
const completeMetadata = async ({
  cacheDB,
  allFiles,
  cachedFiles,
  fetchingFiles,
  fetchedFileMap,
  fetchFileMetadata,
  log,
}) => {
  // Whether the cache written below is complete, or missing the metadata of the fetched files
  let metadataFetched = true;

  if (fetchFileMetadata && fetchingFiles.length) {
    // Cache the text right away, so that a reload before the slower metadata pass has finished
    // only costs that pass next time, not the contents again. A failure here doesn’t stop the
    // metadata from being filled in; the cache is written again below, which reports it
    try {
      await updateCache({ cacheDB, allFiles, cachedFiles, fetchingFiles, fetchedFileMap });
      log(`Cached the contents of ${fetchingFiles.length} files`);
    } catch (/** @type {any} */ ex) {
      // eslint-disable-next-line no-console
      console.error('Failed to cache the contents.', ex);
    }

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

/**
 * Update the file cache, then record the commit it reflects. If the cache can’t be updated, the
 * commit isn’t recorded, so the next fetch gets the file list again instead of restoring it from a
 * cache that may still hold files of an earlier commit, such as ones deleted since. The site data
 * is already usable without the cache, so the failure is only logged.
 * @param {object} args Arguments.
 * @param {IndexedDB} args.metaDB The meta database instance.
 * @param {string | undefined} args.lastConfigHash The CMS configuration hash the files were
 * fetched for.
 * @param {string} args.lastCommitHash The commit hash the files were fetched at.
 * @param {Promise<void>} args.cacheUpdate Update of the file cache in progress.
 */
const cacheFiles = async ({ metaDB, lastConfigHash, lastCommitHash, cacheUpdate }) => {
  try {
    await cacheUpdate;
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error('Failed to update the file cache.', ex);

    return;
  }

  // Only now that the cache holds the files of this commit can the file list be restored from it
  await saveFileListMeta({ metaDB, lastConfigHash, lastCommitHash });
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
 * @param {() => Promise<void>} [args.checkBranchAccess] Function to check whether the user can
 * push to the branch, which is known once the head is resolved. It runs alongside the file list
 * request, and the data is only shown once it’s done, so nothing appears editable that isn’t. It
 * isn’t expected to throw.
 * @param {() => Promise<string>} args.fetchDefaultBranchName Function to fetch the repository’s
 * default branch name.
 * @param {() => Promise<{ hash: string, message: string }>} args.fetchLastCommit Function to fetch
 * the last commit’s SHA-1 hash and message.
 * @param {{ hash: string, message: string }} [args.lastCommit] Last commit, if the caller has
 * just fetched it, so it isn’t fetched again.
 * @param {FetchFileListFunction} args.fetchFileList Function to fetch the repository’s complete
 * file list.
 * @param {FetchFileContentsFunction} args.fetchFileContents Function to fetch the metadata of
 * entry/asset files as well as text file contents. If {@link fetchFileMetadata} is given, this is
 * expected to leave the metadata out.
 * @param {FetchFileMetadataFunction} [args.fetchFileMetadata] Function to fetch the commit metadata
 * of entry/asset files separately. Looking up the last commit of every file is by far the slowest
 * part of a cold start on some services, and nothing in the UI needs it right away, so with this
 * the contents are shown as soon as they arrive and the metadata is filled in afterwards.
 */
export const fetchAndParseFiles = async ({
  repository,
  checkAccess,
  checkBranchAccess,
  fetchDefaultBranchName,
  fetchLastCommit,
  lastCommit,
  fetchFileList,
  fetchFileContents,
  fetchFileMetadata,
}) => {
  const { service, owner, repo, databaseName } = repository;
  const log = createDebugLogger('Loading site data');

  log(`Started: ${service} ${owner}/${repo}`);

  // A fetch made after the initial load, for the same repository and configuration, only parses the
  // entry files that have changed. The key is taken now, as the configuration could change while
  // the files are on their way
  const parseKey = getParseKey(databaseName);
  const incremental = !!repositoryHead.current && lastParseKey === parseKey;
  const metaDB = new IndexedDB(/** @type {string} */ (databaseName), 'meta');
  const cacheDB = new IndexedDB(/** @type {string} */ (databaseName), 'file-cache');
  // The access was verified when the data was first loaded; a later call only brings it up to date
  const initialLoad = !repositoryHead.current;
  const accessPromise = checkAccess && initialLoad ? deferRejection(checkAccess()) : undefined;
  // Start reading the databases right away, but only wait for them once the last commit is known,
  // so the reads — the file cache holds the text of every entry — overlap the network round trips
  // below instead of delaying them
  const databaseEntriesPromise = readDatabaseEntries({ metaDB, cacheDB });

  const { hash: lastCommitHash, message } = await resolveHead({
    repository,
    accessPromise,
    fetchDefaultBranchName,
    fetchLastCommit,
    lastCommit,
    log,
  });

  const branchAccessPromise = checkBranchAccess && initialLoad ? checkBranchAccess() : undefined;
  const { metaEntries, cachedFileEntries } = await databaseEntriesPromise;

  log(`Read the file cache: ${cachedFileEntries.length} files`);

  const lastConfigHash = cmsConfigVersion.current;

  const fileList = await getFileList({
    metaEntries,
    lastCommitHash,
    cachedFileEntries,
    fetchFileList,
    log,
  });

  // What the message says is only what the author asked for. It’s the answer until the CI/CD
  // provider is asked about the commit, which `isLastCommitPublished` prefers once it has one
  setLastCommitPublishHint(!hasSkipCIMarker(message));
  await branchAccessPromise;

  // Skip fetching files if no files found
  if (!fileList.count) {
    updateStores({ entries: [], assets: [], configFiles: [] });
    lastParseKey = parseKey;
    repositoryHead.current = lastCommitHash;
    log('The site data is ready: no files to load');

    await cacheFiles({
      metaDB,
      lastConfigHash,
      lastCommitHash,
      // Only what’s left from the previous commit, to be deleted
      cacheUpdate: updateCache({
        cacheDB,
        allFiles: [],
        cachedFiles: Object.fromEntries(cachedFileEntries),
        fetchingFiles: [],
        fetchedFileMap: {},
      }),
    });

    return;
  }

  const { cachedFiles, changedPaths, fetchingFiles, fetchedFileMap } = await loadContents({
    fileList,
    cachedFileEntries,
    fetchFileContents,
    fetchFileMetadata,
    log,
  });

  const { entries, errors, assets, configFiles } = await parseFiles({
    fileList,
    fetchedFileMap,
    changedPaths: incremental ? changedPaths : undefined,
  });

  log(`Parsed ${entries.length} entries (${errors.length} errors)`);
  updateStores({ entries, assets, configFiles, errors, changedPaths });
  lastParseKey = parseKey;
  // Recorded once the stores reflect the commit, so a check made in the meantime still sees the
  // previous head and knows the data isn’t there yet
  repositoryHead.current = lastCommitHash;
  log('The site data is ready');

  await cacheFiles({
    metaDB,
    lastConfigHash,
    lastCommitHash,
    cacheUpdate: completeMetadata({
      cacheDB,
      allFiles: fileList.allFiles,
      cachedFiles,
      fetchingFiles,
      fetchedFileMap,
      fetchFileMetadata,
      log,
    }),
  });
};
