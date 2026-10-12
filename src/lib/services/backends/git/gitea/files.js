/* eslint-disable no-await-in-loop */

import { decodeBase64, getPathInfo } from '@sveltia/utils/file';

import { getApiSettings } from '$lib/services/backends/git/gitea/api';
import { fetchLastCommit } from '$lib/services/backends/git/gitea/commits';
import {
  getWorkflowRepository,
  initOpenAuthoring,
  isOpenAuthoringConfigured,
} from '$lib/services/backends/git/gitea/fork';
import { checkInstanceVersion, instance } from '$lib/services/backends/git/gitea/instance';
import {
  checkBranchAccess,
  checkRepositoryAccess,
  fetchDefaultBranchName,
  repository,
} from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { fetchAPIOrUndefined } from '$lib/services/backends/git/shared/api-optional';
import { mapConcurrently, runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { fetchRepositoryFiles } from '$lib/services/backends/git/shared/files';
import { toFileListItems } from '$lib/services/backends/git/shared/tree';
import { getRootDir } from '$lib/services/backends/root-dir';
import { dataLoadedProgress } from '$lib/services/contents';
import { encodePathSegments } from '$lib/services/utils/url';

/**
 * @import {
 * Asset,
 * BaseFileListItem,
 * BaseFileListItemProps,
 * RepositoryContentsMap,
 * } from '$lib/types/private';
 */

/**
 * @typedef {{ type: string, path: string, sha: string, size: number }} PartialGitEntry
 */

/**
 * A page of a recursive tree listing.
 * @typedef {object} TreePage
 * @property {PartialGitEntry[] | null} tree Items on the page.
 * @property {boolean} truncated Whether there are more pages.
 * @property {number} [total_count] Number of items on all the pages.
 */

/**
 * An item in a bulk file contents response. Gitea returns the file path and Forgejo the blob SHA,
 * which is what each of them takes as the identifier in the request as well.
 * @typedef {{
 * path?: string,
 * sha?: string,
 * content?: string | null,
 * encoding?: 'base64' | null,
 * } | null} PartialContentsListItem
 */

/**
 * Maximum size of a single blob whose content an instance returns, which is 10 MiB by default. Used
 * when the instance doesn’t report the limit it actually applies.
 * @see https://docs.gitea.com/administration/config-cheat-sheet
 */
const DEFAULT_MAX_BLOB_SIZE = 10485760;
/**
 * Directories recently looked up at a commit, with their tree SHAs. The check for remote changes
 * looks up the old and new heads at the same time, so more than one is kept.
 * @type {Map<string, string | undefined>}
 */
const dirLookups = new Map();
/**
 * Maximum number of entries in {@link dirLookups}.
 */
const MAX_DIR_LOOKUPS = 4;

/**
 * Forget the directory lookups. Used in tests.
 */
export const _resetDirLookup = () => {
  dirLookups.clear();
};

/**
 * Look the tree SHA of a directory up, without the cache of {@link fetchDirSHA}.
 * @param {string} ref Commit SHA or branch name.
 * @param {string} dirPath Directory path relative to the repository root.
 * @returns {Promise<string | undefined>} Tree SHA, or `undefined` if the directory doesn’t exist.
 */
const lookUpDirSHA = async (ref, dirPath) => {
  const { owner, repo } = repository;
  const { dirname, basename } = getPathInfo(dirPath);
  const parentPath = dirname ? `/${encodePathSegments(dirname)}` : '';

  // Missing when the parent directory doesn’t exist either
  const entries = /** @type {{ type: string, name: string, sha: string }[] | undefined} */ (
    await fetchAPIOrUndefined(
      `/repos/${owner}/${repo}/contents${parentPath}?ref=${encodeURIComponent(ref)}`,
    )
  );

  // A file is returned as a single item rather than a list
  return Array.isArray(entries)
    ? entries.find(({ type, name }) => type === 'dir' && name === basename)?.sha
    : undefined;
};

/**
 * Find the tree SHA of a directory at the given commit, by listing the directory that holds it.
 * Gitea/Forgejo also resolve a `ref:path` expression in place of a tree SHA, but only with the
 * slashes in the path encoded as `%2F`, which a reverse proxy in front of a self-hosted instance
 * may decode, so the documented contents endpoint is used instead.
 * @param {string} ref Commit SHA or branch name.
 * @param {string} dirPath Directory path relative to the repository root.
 * @returns {Promise<string | undefined>} Tree SHA, or `undefined` if the directory doesn’t exist.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetContentsList
 */
export const fetchDirSHA = async (ref, dirPath) => {
  const key = `${repository.owner}/${repository.repo}:${ref}:${dirPath}`;

  // The tree of a directory at a commit never changes, so the lookup the check for remote changes
  // has just made is reused by the file list. A branch name moves, so it’s always looked up
  if (dirLookups.has(key)) {
    return dirLookups.get(key);
  }

  const sha = await lookUpDirSHA(ref, dirPath);

  if (/^[\da-f]{40,64}$/.test(ref)) {
    dirLookups.set(key, sha);

    // Forget the oldest one
    if (dirLookups.size > MAX_DIR_LOOKUPS) {
      dirLookups.delete(/** @type {string} */ (dirLookups.keys().next().value));
    }
  }

  return sha;
};

/**
 * Fetch the repository’s complete file list, and return it in the canonical format. With the
 * `root_dir` backend option, only the files in that directory are listed, which saves listing the
 * whole of a big monorepo; the paths are still relative to the repository root.
 * @param {string} [lastHash] The last commit’s SHA-1 hash.
 * @returns {Promise<BaseFileListItemProps[]>} File list. It’s empty if the root directory doesn’t
 * exist.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/GetTree
 */
export const fetchFileList = async (lastHash) => {
  const { owner, repo, branch } = repository;
  const commitRef = /** @type {string} */ (lastHash ?? branch);
  const rootDir = getRootDir();
  const treeSHA = rootDir ? await fetchDirSHA(commitRef, rootDir) : commitRef;

  if (!treeSHA) {
    return [];
  }

  const treePath = encodePathSegments(treeSHA);
  const requestPath = `/repos/${owner}/${repo}/git/trees/${treePath}?recursive=1`;
  const prefix = rootDir ? `${rootDir}/` : '';

  /**
   * Fetch a page of the tree, 1000 items per page by default.
   * @param {number} page Page number.
   * @returns {Promise<TreePage>} Page.
   */
  const fetchPage = async (page) =>
    /** @type {TreePage} */ (await fetchAPI(`${requestPath}&page=${page}`));

  const firstPage = await fetchPage(1);
  const pages = [firstPage];

  if (firstPage.tree && firstPage.truncated) {
    const {
      tree: { length: pageSize },
      total_count: totalCount,
    } = firstPage;

    if (totalCount && pageSize) {
      // The tree is listed at a commit, so it can’t change between the requests: the number of
      // pages is known from the first one, and the rest are fetched at the same time rather than
      // one after the other
      const pageNumbers = Array.from(
        { length: Math.ceil(totalCount / pageSize) - 1 },
        (_, index) => index + 2,
      );

      pages.push(...(await mapConcurrently(pageNumbers, fetchPage)));
    } else {
      // An instance that doesn’t report the total is paged through until the last page
      for (let page = 2; ; page += 1) {
        const nextPage = await fetchPage(page);

        pages.push(nextPage);

        if (!nextPage.tree || !nextPage.truncated) {
          break;
        }
      }
    }
  }

  /** @type {PartialGitEntry[]} */
  const gitEntries = pages.flatMap(({ tree }) =>
    (tree ?? []).map((entry) => ({ ...entry, path: `${prefix}${entry.path}` })),
  );

  return toFileListItems(gitEntries);
};

/**
 * Parse the file contents from the API response.
 * @param {BaseFileListItem[]} fetchingFiles Base file list.
 * @param {Record<string, PartialContentsListItem>} results Results from the API, keyed with a file
 * path. A file the API didn’t return content for is simply absent.
 * @returns {Promise<RepositoryContentsMap>} Parsed file contents map.
 */
export const parseFileContents = async (fetchingFiles, results) => {
  const entries = await Promise.all(
    fetchingFiles.map(async ({ path, sha, size, type }) => {
      const item = results[path];

      // A text file the API returned nothing for is left without text and metadata, so it’s not
      // cached as fetched: an empty text would stand in for its content until the file changes,
      // and the entry would lose its content the next time it’s saved. It’s requested again on the
      // next load instead. An asset’s content is never requested, so it’s complete as it is
      if (!item && type !== 'asset') {
        return [path, { sha, size: size ?? 0, text: undefined, meta: undefined }];
      }

      const { content, encoding } = item ?? {};

      const data = {
        sha,
        size: size ?? 0,
        text: content && encoding === 'base64' ? await decodeBase64(content) : '',
        // Omit commit author/data because it’s costly to fetch commit data for each file
        meta: {},
      };

      return [path, data];
    }),
  );

  return Object.fromEntries(entries);
};

/**
 * Request the text content of a single file with the raw endpoint.
 * @param {object} args Arguments.
 * @param {string} args.owner Repository owner.
 * @param {string} args.repo Repository name.
 * @param {string} args.path File path.
 * @param {string} args.ref Branch name or commit SHA to read the file at.
 * @returns {Promise<string>} File content.
 */
const requestRawFile = async ({ owner, repo, path, ref }) =>
  /** @type {Promise<string>} */ (
    fetchAPI(
      `/repos/${owner}/${repo}/raw/${encodePathSegments(path)}?ref=${encodeURIComponent(ref)}`,
      {
        responseType: 'text',
      },
    )
  );

/**
 * Fetch the text content of a single file with the raw endpoint, which returns it in full. The bulk
 * endpoints leave the content of an oversized blob empty, and keeping that would wipe the file the
 * next time the entry is saved.
 * @param {string} path File path.
 * @param {string} [ref] Workflow branch to read the file from. Default: the branch configured in
 * the site configuration. A workflow branch lives in the contributor’s fork with Open Authoring,
 * so that’s where a file on one is read from.
 * @returns {Promise<string>} File content.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetRawFile
 * @see https://github.com/go-gitea/gitea/issues/14432
 */
export const fetchRawFile = async (path, ref) => {
  // A workflow branch lives in the contributor’s fork with Open Authoring, so that’s where a file
  // on one is read from
  const { owner, repo } = ref ? getWorkflowRepository() : repository;
  const { branch = '' } = repository;

  return requestRawFile({ owner, repo, path, ref: ref ?? branch });
};

/**
 * Split the given files into batches an instance will return in full. Both Gitea and Forgejo cut a
 * response short rather than reporting an error, so a batch has to stay within the number of items
 * they’re willing to return and, on Gitea, the combined size of the encoded contents.
 * @param {BaseFileListItem[]} files Files to fetch, none of which exceeds the per-blob limit.
 * @param {object} limits Limits reported by the instance.
 * @param {number} limits.maxItems Maximum number of files per batch.
 * @param {number} limits.maxResponseSize Maximum combined size of the encoded contents per batch.
 * @returns {BaseFileListItem[][]} Batches.
 */
export const createBatches = (files, { maxItems, maxResponseSize }) => {
  /** @type {BaseFileListItem[][]} */
  const batches = [];
  /** @type {BaseFileListItem[]} */
  let batch = [];
  let batchSize = 0;

  files.forEach((file) => {
    // An instance measures a response by the size of the Base64-encoded contents it returns, and
    // the encoding inflates a file by four bytes for every three
    const encodedSize = ((file.size ?? 0) * 4) / 3;

    // Close the current batch before the file that would push it over either limit. A batch is
    // never left empty, so a file that exceeds a limit on its own still gets a request of its own
    // instead of looping forever
    if (batch.length && (batch.length === maxItems || batchSize + encodedSize > maxResponseSize)) {
      batches.push(batch);
      batch = [];
      batchSize = 0;
    }

    batch.push(file);
    batchSize += encodedSize;
  });

  if (batch.length) {
    batches.push(batch);
  }

  return batches;
};

/**
 * Fetch the metadata of entry/asset files as well as text file contents. Gitea and Forgejo have
 * different API endpoints for this, so we handle both cases here.
 * @param {BaseFileListItem[]} fetchingFiles Base file list.
 * @param {string} [lastHash] The last commit’s SHA-1 hash, which the file list comes from. Gitea
 * reads the files by path, so they’re read at that commit rather than at the tip of the branch,
 * which may have moved on since, so a text is never cached under the blob SHA of another version
 * of the file. Forgejo reads them by blob SHA, which needs no commit. Default: the branch.
 * @returns {Promise<RepositoryContentsMap>} Fetched contents map.
 * @see https://github.com/go-gitea/gitea/pull/34139
 * @see https://codeberg.org/forgejo/forgejo/pulls/8139
 */
export const fetchFileContents = async (fetchingFiles, lastHash) => {
  const { owner, repo, branch } = repository;
  const { isForgejo } = instance;
  const commitRef = String(lastHash ?? branch);

  const requestPath = isForgejo
    ? `/repos/${owner}/${repo}/git/blobs`
    : `/repos/${owner}/${repo}/file-contents?ref=${encodeURIComponent(commitRef)}`;

  // Forgejo uses `sha` as the identifier for files, while Gitea uses `path`. Each item in the
  // response carries the same field, which is how a result is matched to the file it was requested
  // for; the position of an item can’t be relied on, as an instance may drop some of them
  const idField = isForgejo ? 'sha' : 'path';
  const textFiles = fetchingFiles.filter(({ type }) => type !== 'asset');

  if (!textFiles.length) {
    return {};
  }

  dataLoadedProgress.current = 0;

  // The progress bar is cleared even when a request fails, so it doesn’t stay on screen
  try {
    // Ask the instance for the limits it applies to a response, so a request can be kept within
    // them
    const {
      default_paging_num: pagingNum = 30,
      max_response_items: maxResponseItems = Infinity,
      default_max_blob_size: maxBlobSize,
      default_max_response_size: maxResponseSize = Infinity,
    } = await getApiSettings();

    // A blob this large comes back with no content at all, so it has to be read separately
    const blobSizeLimit = Number(maxBlobSize) || DEFAULT_MAX_BLOB_SIZE;
    const oversizedFiles = textFiles.filter(({ size = 0 }) => size >= blobSizeLimit);

    const batches = createBatches(
      textFiles.filter(({ size = 0 }) => size < blobSizeLimit),
      { maxItems: Math.min(pagingNum, maxResponseItems), maxResponseSize },
    );

    /** @type {Record<string, PartialContentsListItem>} */
    const results = {};
    let fetchedCount = 0;

    /**
     * Update the progress bar to reflect the files fetched so far.
     * @param {number} count Number of files just fetched.
     */
    const advanceProgress = (count) => {
      fetchedCount += count;
      dataLoadedProgress.current = Math.ceil((fetchedCount / textFiles.length) * 100);
    };

    // Use the new bulk API endpoint to fetch multiple files at once. The batches are independent,
    // so several of them are requested in parallel rather than one after another; a large
    // repository needs dozens of them, and each is a full round trip to the instance
    await runConcurrently(batches, async (batch) => {
      const result = /** @type {PartialContentsListItem[]} */ (
        await (isForgejo
          ? fetchAPI(`${requestPath}?shas=${batch.map(({ sha }) => sha).join(',')}`)
          : fetchAPI(requestPath, {
              method: 'POST',
              body: { files: batch.map(({ path }) => path) },
            }))
      );

      const itemMap = new Map(result.filter((item) => !!item).map((item) => [item[idField], item]));

      batch.forEach((file) => {
        const item = itemMap.get(file[idField]);

        if (item) {
          results[file.path] = item;
        }
      });

      advanceProgress(batch.length);
    });

    const fileMap = await parseFileContents(fetchingFiles, results);

    // Read whatever the bulk endpoints won’t return from the raw endpoint, which has no size cap
    await runConcurrently(oversizedFiles, async ({ path }) => {
      // The bulk endpoints weren’t asked for the file, so its metadata is filled in with the text
      // Read at the same commit as the file list, on Forgejo too, as the endpoint goes by path
      const text = await requestRawFile({ owner, repo, path, ref: commitRef });

      Object.assign(fileMap[path], { text, meta: {} });
      advanceProgress(1);
    });

    return fileMap;
  } finally {
    dataLoadedProgress.current = undefined;
  }
};

/**
 * Check that the instance is supported and that the user can read the repository. Neither check is
 * needed until the file contents are requested, so they run alongside the branch and commit
 * requests rather than ahead of them, and alongside each other. An unsupported instance is
 * reported first, though, as it may also be why the repository can’t be read.
 */
const checkAccess = async () => {
  const repositoryAccessPromise = checkRepositoryAccess();

  // The rejection is handled below, once the version has been checked
  repositoryAccessPromise.catch(() => undefined);

  await checkInstanceVersion();
  await repositoryAccessPromise;
};

/**
 * Check the instance version, then set up Open Authoring for the signed-in user. The set-up asks
 * the instance for what only a supported version offers, so the version is checked first here
 * rather than alongside the repository, as {@link checkAccess} does.
 */
const checkVersionAndInitOpenAuthoring = async () => {
  await checkInstanceVersion();
  await initOpenAuthoring();
};

/**
 * Fetch file list from the backend service, download/parse all the entry files, then cache them in
 * the {@link allEntries} and {@link allAssets} stores.
 * @param {object} [options] Options.
 * @param {{ hash: string, message: string }} [options.lastCommit] Last commit on the branch, if the
 * caller has just fetched it, so it isn’t fetched again.
 */
export const fetchFiles = async ({ lastCommit } = {}) => {
  await fetchRepositoryFiles({
    isOpenAuthoringConfigured,
    initOpenAuthoring: checkVersionAndInitOpenAuthoring,
    repository,
    checkAccess,
    checkBranchAccess,
    fetchDefaultBranchName,
    fetchLastCommit,
    lastCommit,
    fetchFileList,
    fetchFileContents,
  });
};

/**
 * Fetch an asset as a Blob via the API.
 * @param {Asset} asset Asset to retrieve the file content.
 * @returns {Promise<Blob>} Blob data.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetRawFileOrLFS
 */
export const fetchBlob = async (asset) => {
  const { path } = asset;
  // An asset attached to an unpublished entry only exists on the workflow branch, so that’s where
  // it has to be read from — in the contributor’s fork with Open Authoring
  const { owner, repo } = asset.workflow ? getWorkflowRepository() : repository;
  const ref = asset.workflow?.branch ?? repository.branch;
  const refAndPath = `${encodePathSegments(String(ref))}/${encodePathSegments(path)}`;

  return /** @type {Promise<Blob>} */ (
    fetchAPI(`/repos/${owner}/${repo}/media/${refAndPath}`, {
      responseType: 'blob',
    })
  );
};
