/* eslint-disable no-await-in-loop */

import { decodeBase64, getPathInfo } from '@sveltia/utils/file';

import { fetchLastCommit } from '$lib/services/backends/git/gitea/commits';
import { checkInstanceVersion, instance } from '$lib/services/backends/git/gitea/instance';
import {
  checkRepositoryAccess,
  fetchDefaultBranchName,
  repository,
} from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { fetchAndParseFiles } from '$lib/services/backends/git/shared/fetch';
import { dataLoadedProgress } from '$lib/services/contents';

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
 * The limits an instance applies to an API response, which it enforces by silently returning less
 * than what was asked for.
 * @typedef {object} ApiSettings
 * @property {number} [default_paging_num] Default number of items per page.
 * @property {number} [max_response_items] Maximum number of items in a response.
 * @property {number} [default_max_blob_size] Maximum size of a single blob whose content is
 * returned.
 * @property {number} [default_max_response_size] Maximum combined size of the contents in one
 * response. Gitea only; Forgejo has no such limit.
 */

/**
 * Maximum size of a single blob whose content an instance returns, which is 10 MiB by default. Used
 * when the instance doesn’t report the limit it actually applies.
 * @see https://docs.gitea.com/administration/config-cheat-sheet
 */
const DEFAULT_MAX_BLOB_SIZE = 10485760;

/**
 * Fetch the repository’s complete file list, and return it in the canonical format.
 * @param {string} [lastHash] The last commit’s SHA-1 hash.
 * @returns {Promise<BaseFileListItemProps[]>} File list.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/GetTree
 */
export const fetchFileList = async (lastHash) => {
  const { owner, repo, branch } = repository;
  const requestPath = `/repos/${owner}/${repo}/git/trees/${lastHash ?? branch}?recursive=1`;
  /** @type {PartialGitEntry[]} */
  const gitEntries = [];
  let page = 1;

  for (;;) {
    // 1000 items per page
    const { tree, truncated } = /** @type {{ tree: PartialGitEntry[], truncated: boolean }} */ (
      await fetchAPI(`${requestPath}&page=${page}`)
    );

    if (tree) {
      gitEntries.push(...tree);
    }

    if (tree && truncated) {
      page += 1;
    } else {
      break;
    }
  }

  return gitEntries
    .filter(({ type }) => type === 'blob')
    .map(({ path, sha, size }) => ({ path, sha, size, name: getPathInfo(path).basename }));
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
    fetchingFiles.map(async ({ path, sha, size }) => {
      const { content, encoding } = results[path] ?? {};

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
 * Fetch the text content of a single file with the raw endpoint, which returns it in full. The bulk
 * endpoints leave the content of an oversized blob empty, and keeping that would wipe the file the
 * next time the entry is saved.
 * @param {string} path File path.
 * @returns {Promise<string>} File content.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetRawFile
 * @see https://github.com/go-gitea/gitea/issues/14432
 */
export const fetchRawFile = async (path) => {
  const { owner, repo, branch = '' } = repository;

  return /** @type {Promise<string>} */ (
    // Use `encodeURI` instead of `encodeURIComponent` because slashes in the path should not be
    // encoded but spaces and other characters should be.
    fetchAPI(`/repos/${owner}/${repo}/raw/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`, {
      responseType: 'text',
    })
  );
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
 * @returns {Promise<RepositoryContentsMap>} Fetched contents map.
 * @see https://github.com/go-gitea/gitea/pull/34139
 * @see https://codeberg.org/forgejo/forgejo/pulls/8139
 */
export const fetchFileContents = async (fetchingFiles) => {
  const { owner, repo, branch } = repository;
  const { isForgejo } = instance;

  const requestPath = isForgejo
    ? `/repos/${owner}/${repo}/git/blobs`
    : `/repos/${owner}/${repo}/file-contents?ref=${branch}`;

  // Forgejo uses `sha` as the identifier for files, while Gitea uses `path`. Each item in the
  // response carries the same field, which is how a result is matched to the file it was requested
  // for; the position of an item can’t be relied on, as an instance may drop some of them
  const idField = isForgejo ? 'sha' : 'path';
  const textFiles = fetchingFiles.filter(({ type }) => type !== 'asset');

  if (!textFiles.length) {
    return {};
  }

  dataLoadedProgress.set(0);

  // Ask the instance for the limits it applies to a response, so a request can be kept within them
  const {
    default_paging_num: pagingNum = 30,
    max_response_items: maxResponseItems = Infinity,
    default_max_blob_size: maxBlobSize,
    default_max_response_size: maxResponseSize = Infinity,
  } = /** @type {ApiSettings} */ (await fetchAPI('/settings/api'));

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
    dataLoadedProgress.set(Math.ceil((fetchedCount / textFiles.length) * 100));
  };

  // Use the new bulk API endpoint to fetch multiple files at once
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];

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
  }

  const fileMap = await parseFileContents(fetchingFiles, results);

  // Read whatever the bulk endpoints won’t return from the raw endpoint, which has no size cap
  await runConcurrently(oversizedFiles, async ({ path }) => {
    fileMap[path].text = await fetchRawFile(path);
    advanceProgress(1);
  });

  dataLoadedProgress.set(undefined);

  return fileMap;
};

/**
 * Fetch file list from the backend service, download/parse all the entry files, then cache them in
 * the {@link allEntries} and {@link allAssets} stores.
 */
export const fetchFiles = async () => {
  await checkInstanceVersion();
  await checkRepositoryAccess();

  await fetchAndParseFiles({
    repository,
    fetchDefaultBranchName,
    fetchLastCommit,
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
  const { owner, repo, branch } = repository;
  const { path } = asset;

  return /** @type {Promise<Blob>} */ (
    // Use `encodeURI` instead of `encodeURIComponent` because slashes in the path should not be
    // encoded but spaces and other characters should be.
    fetchAPI(`/repos/${owner}/${repo}/media/${branch}/${encodeURI(path)}`, {
      responseType: 'blob',
    })
  );
};
