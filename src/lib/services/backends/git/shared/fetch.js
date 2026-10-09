import { IndexedDB } from '@sveltia/utils/storage';

import { hasSkipCIMarker } from '$lib/services/backends/git/shared/commits';
import { deferRejection } from '$lib/services/backends/git/shared/defer';
import {
  cacheFiles,
  completeMetadata,
  getFileList,
  readDatabaseEntries,
  restoreCachedFileData,
  updateCache,
} from '$lib/services/backends/git/shared/file-cache';
import { repositoryHead } from '$lib/services/backends/git/shared/head';
import { parseFiles, updateStores } from '$lib/services/backends/git/shared/parse-files';
import { scopeFileFetchers } from '$lib/services/backends/git/shared/scope';
import { cmsConfigVersion } from '$lib/services/config';
import { setLastCommitPublishHint } from '$lib/services/deployments';
import { createDebugLogger } from '$lib/services/utils/logging';

/**
 * @import {
 * BaseFileList,
 * BaseFileListItem,
 * BaseFileListItemProps,
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
 * Finish loading the site data: update the stores with the parsed files, record the commit they
 * reflect, then update the file cache and record the commit it reflects too.
 * @param {object} args Arguments.
 * @param {Parameters<typeof updateStores>[0]} args.data Parsed entries, assets, config files and
 * errors to update the stores with.
 * @param {string} args.parseKey Key identifying what the entries were parsed for.
 * @param {IndexedDB} args.metaDB The meta database instance.
 * @param {string | undefined} args.lastConfigHash The CMS configuration hash the files were
 * fetched for.
 * @param {string} args.lastCommitHash The commit hash the files were fetched at.
 * @param {() => Promise<void>} args.startCacheUpdate Function to update the file cache, called once
 * the stores have been updated.
 * @param {DebugLogger} args.log Function to trace the loading in the console.
 * @param {string} args.readyMessage Message to log once the site data is ready.
 */
const finishLoad = async ({
  data,
  parseKey,
  metaDB,
  lastConfigHash,
  lastCommitHash,
  startCacheUpdate,
  log,
  readyMessage,
}) => {
  updateStores(data);
  lastParseKey = parseKey;
  // Recorded once the stores reflect the commit, so a check made in the meantime still sees the
  // previous head and knows the data isn’t there yet
  repositoryHead.current = lastCommitHash;
  log(readyMessage);

  await cacheFiles({ metaDB, lastConfigHash, lastCommitHash, cacheUpdate: startCacheUpdate() });
};

/**
 * Fetch file list from a backend service, download/parse all the entry files, then cache them in
 * the `allEntries` and `allAssets` stores.
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
  ...fetchers
}) => {
  const { service, owner, repo, databaseName } = repository;

  // Only the files in the configured root directory are listed, with paths relative to it
  const { fetchFileList, fetchFileContents, fetchFileMetadata } = scopeFileFetchers({
    repository,
    ...fetchers,
  });

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

  const finishArgs = { parseKey, metaDB, lastConfigHash, lastCommitHash, log };

  // Skip fetching files if no files found
  if (!fileList.count) {
    await finishLoad({
      ...finishArgs,
      data: { entries: [], assets: [], configFiles: [] },
      readyMessage: 'The site data is ready: no files to load',
      /**
       * Delete what’s left in the cache from the previous commit.
       * @returns {Promise<void>} Cache update.
       */
      startCacheUpdate: () =>
        updateCache({
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

  await finishLoad({
    ...finishArgs,
    data: { entries, assets, configFiles, errors, changedPaths },
    readyMessage: 'The site data is ready',
    /**
     * Cache the fetched files, along with their commit metadata.
     * @returns {Promise<void>} Cache update.
     */
    startCacheUpdate: () =>
      completeMetadata({
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
