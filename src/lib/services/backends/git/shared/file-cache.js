import { getPathInfo } from '@sveltia/utils/file';
import { IndexedDB } from '@sveltia/utils/storage';

import { deferRejection } from '$lib/services/backends/git/shared/defer';
import { repositoryHead } from '$lib/services/backends/git/shared/head';
import { applyFileMetadata } from '$lib/services/backends/git/shared/parse-files';
import { createFileList, describeFileList } from '$lib/services/backends/process';
import { cmsConfigVersion } from '$lib/services/config';

/**
 * @import {
 * BaseFileList,
 * BaseFileListItem,
 * RepositoryContentsMap,
 * RepositoryInfo,
 * } from '$lib/types/private';
 * @import { DebugLogger } from '$lib/services/utils/logging';
 * @import {
 * FetchFileListFunction,
 * FetchFileMetadataFunction,
 * } from '$lib/services/backends/git/shared/fetch';
 */

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
 * Move the head the site data reflects on to a commit that has left the configured root directory
 * as it was, so nothing has to be fetched. The file cache is moved on as well, so the next load
 * restores the file list from it rather than listing the directory again, but only if it’s still
 * recorded at the previous head: a cache update in flight records its own commit afterwards.
 * @param {RepositoryInfo} repository Repository info.
 * @param {string} from Head the site data reflects.
 * @param {string} to New head.
 */
export const advanceRepositoryHead = async ({ databaseName }, from, to) => {
  repositoryHead.current = to;

  try {
    const metaDB = new IndexedDB(/** @type {string} */ (databaseName), 'meta');

    if ((await metaDB.get('last_commit_hash')) === from) {
      await metaDB.set('last_commit_hash', to);
    }
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error('Failed to update the file cache.', ex);
  }
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
 * Start reading the meta and file cache databases.
 * @param {object} args Arguments.
 * @param {IndexedDB} args.metaDB The meta database instance.
 * @param {IndexedDB} args.cacheDB The cache database instance.
 * @returns {Promise<{ metaEntries: [string, any][], cachedFileEntries: [string, any][] }>} Entries
 * read from the databases.
 */
export const readDatabaseEntries = ({ metaDB, cacheDB }) =>
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
export const completeMetadata = async ({
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
export const cacheFiles = async ({ metaDB, lastConfigHash, lastCommitHash, cacheUpdate }) => {
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
