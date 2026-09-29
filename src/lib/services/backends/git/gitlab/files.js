/* eslint-disable no-await-in-loop */

import { getPathInfo } from '@sveltia/utils/file';

import { fetchLastCommit } from '$lib/services/backends/git/gitlab/commits';
import {
  checkBranchAccess,
  checkRepositoryAccess,
  fetchDefaultBranchName,
  getProjectId,
  repository,
} from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { fetchAndParseFiles } from '$lib/services/backends/git/shared/fetch';
import { startSimulatedProgress } from '$lib/services/backends/git/shared/progress';

/**
 * @import {
 * Asset,
 * BaseFileListItem,
 * BaseFileListItemProps,
 * RepositoryContentsMap,
 * } from '$lib/types/private';
 */

/**
 * @typedef {object} FetchFileListResponse
 * @property {object} project Project information.
 * @property {object} project.repository Repository information.
 * @property {object} project.repository.tree Tree information.
 * @property {object} project.repository.tree.blobs Blobs information.
 * @property {{ type: string, path: string, sha: string }[]} project.repository.tree.blobs.nodes
 * List of file blobs.
 * @property {object} project.repository.tree.blobs.pageInfo Pagination information.
 * @property {string} project.repository.tree.blobs.pageInfo.endCursor Cursor for the next page.
 * @property {boolean} project.repository.tree.blobs.pageInfo.hasNextPage Whether there are more
 * pages to fetch.
 */

/**
 * A blob node as returned by the GraphQL API. Which of these fields is populated depends on the
 * query, as the callers of {@link fetchBlobNodes} select different ones.
 * @typedef {object} BlobItem
 * @property {string} [path] Path of the file.
 * @property {string} [oid] Blob’s object ID, which is a SHA-1 hash.
 * @property {string} [size] Size of the blob in bytes.
 * @property {string} [rawTextBlob] Raw text content of the blob.
 */

/**
 * @typedef {object} FetchBlobsResponse
 * @property {object} project Project information.
 * @property {object} project.repository Repository information.
 * @property {object} project.repository.blobs Blobs information.
 * @property {BlobItem[]} project.repository.blobs.nodes List of file blobs with their sizes and raw
 * text contents.
 */

const FETCH_FILE_LIST_QUERY = `
  query($fullPath: ID!, $branch: String!, $cursor: String!) {
    project(fullPath: $fullPath) {
      repository {
        tree(ref: $branch, recursive: true) {
          blobs(after: $cursor) {
            nodes {
              type
              path
              sha
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      }
    }
  }
`;

/**
 * Fetch the repository’s complete file list, and return it in the canonical format.
 * @returns {Promise<BaseFileListItemProps[]>} File list.
 * @see https://docs.gitlab.com/api/graphql/reference/index.html#repositorytree
 * @see https://stackoverflow.com/questions/18952935/how-to-get-subfolders-and-files-using-gitlab-api
 */
export const fetchFileList = async () => {
  /** @type {{ type: string, path: string, sha: string }[]} */
  const blobs = [];
  let cursor = '';

  // Since GitLab has a limit of 100 records per query, use pagination to fetch all the files
  for (;;) {
    const result = /** @type {FetchFileListResponse} */ (
      await fetchGraphQL(FETCH_FILE_LIST_QUERY, { cursor })
    );

    const {
      nodes,
      pageInfo: { endCursor, hasNextPage },
    } = result.project.repository.tree.blobs;

    blobs.push(...nodes);
    cursor = endCursor;

    if (!hasNextPage) {
      break;
    }
  }

  // The `size` is not available from the GitLab API in bulk
  return blobs
    .filter(({ type }) => type === 'blob')
    .map(({ path, sha }) => ({ path, sha, size: 0, name: getPathInfo(path).basename }));
};

/**
 * Number of blob batches requested at the same time on GitLab.com. Each batch is a heavy query, so
 * this is kept well below the general limit on requests in flight.
 */
export const BLOB_CONCURRENCY = 4;

/**
 * Number of blob batches requested at the same time on a self-hosted instance, which typically runs
 * on less powerful hardware and is more likely to time out under load.
 */
export const SELF_HOSTED_BLOB_CONCURRENCY = 2;

const FETCH_BLOBS_QUERY = `
  query($fullPath: ID!, $branch: String!, $paths: [String!]!) {
    project(fullPath: $fullPath) {
      repository {
        blobs(ref: $branch, paths: $paths) {
          nodes {
            path
            rawTextBlob
          }
        }
      }
    }
  }
`;

/**
 * Fetch a single batch of blobs, halving the batch and trying again whenever the request fails.
 * GitLab refuses a request whose blobs add up to more than 20 MB, and the sizes aren’t known in
 * advance, so an oversized batch can only be discovered by attempting it. A single blob of any size
 * is always accepted, which guarantees the split terminates; an error that survives all the way
 * down to one path isn’t about the size, so it’s thrown as is. Because a failing half is awaited
 * before the other one is requested, such an error surfaces after a handful of extra requests
 * rather than a retry of every path.
 * @param {string[]} paths List of file paths to fetch.
 * @param {string} query GraphQL query string.
 * @param {Record<string, any>} [variables] Any variable to be applied to the query, other than the
 * paths.
 * @returns {Promise<BlobItem[]>} Fetched blobs, in the same order as the given paths. A path that
 * isn’t on the branch is left out, so select the `path` to match a blob to its file.
 * @throws {Error} When a request for a single path fails.
 * @see https://docs.gitlab.com/api/graphql/#data-limits
 * @see https://gitlab.com/gitlab-org/gitlab/-/merge_requests/212456
 */
export const fetchBlobBatch = async (paths, query, variables = {}) => {
  /** @type {FetchBlobsResponse} */
  let result;

  try {
    result = /** @type {FetchBlobsResponse} */ (await fetchGraphQL(query, { ...variables, paths }));
  } catch (ex) {
    // A request for a single blob is always within the size limit, so this error is about something
    // else, and there’s nothing left to split anyway
    if (paths.length === 1) {
      throw ex;
    }

    const midPoint = Math.ceil(paths.length / 2);
    const firstHalf = await fetchBlobBatch(paths.slice(0, midPoint), query, variables);
    const secondHalf = await fetchBlobBatch(paths.slice(midPoint), query, variables);

    return [...firstHalf, ...secondHalf];
  }

  // Read the response outside the `try` block, so a malformed one is reported as is instead of
  // being mistaken for an oversized batch and retried
  return result.project.repository.blobs.nodes;
};

/**
 * Fetch the blobs for the given file paths. This function retrieves the raw text contents of files
 * in the repository using the GitLab GraphQL API. It handles pagination by fetching a fixed number
 * of paths at a time, ensuring that the complexity score of the query does not exceed the limit.
 * @param {string[]} paths List of file paths to fetch.
 * @param {string} query GraphQL query string.
 * @param {Record<string, any>} [variables] Any variable to be applied to the query, other than the
 * paths.
 * @returns {Promise<BlobItem[]>} Fetched blobs, in the same order as the given paths. A path that
 * isn’t on the branch is left out, so select the `path` to match a blob to its file.
 * @see https://docs.gitlab.com/api/graphql/reference/#repositoryblob
 * @see https://docs.gitlab.com/api/graphql/reference/#tree
 * @see https://forum.gitlab.com/t/graphql-api-read-raw-file/35389
 * @see https://docs.gitlab.com/api/graphql/#limits
 */
export const fetchBlobNodes = async (paths, query, variables = {}) => {
  if (!paths.length) {
    return [];
  }

  const { isSelfHosted = false } = repository;
  const batchSize = isSelfHosted ? 20 : 100;
  const concurrency = isSelfHosted ? SELF_HOSTED_BLOB_CONCURRENCY : BLOB_CONCURRENCY;

  // Fetch all the text contents with the GraphQL API. Pagination would fail if `paths` becomes too
  // long, so we just use a fixed number of paths per request. The complexity score of this query is
  // 15 + (2 * node size) so 100 paths = 215 complexity, giving the following conditions:
  // 1. The max number of records is 100
  // 2. The max query complexity is 250 or 300
  // 3. The total blob size must be under 20 MB (since GitLab 18.4.5)
  // @see https://github.com/sveltia/sveltia-cms/issues/525
  // @see https://gitlab.com/gitlab-org/gitlab/-/issues/576497
  // The batch size is reduced to 20 for self-hosted instances because they typically run on less
  // powerful hardware, which may lead to timeout issues.
  // Only the first two conditions can be satisfied by a fixed count; the size of a blob is unknown
  // until it’s fetched, so {@link fetchBlobBatch} handles the third one by splitting a batch that
  // turns out to be too large.
  const batches = Array.from({ length: Math.ceil(paths.length / batchSize) }, (_, index) => ({
    index,
    paths: paths.slice(index * batchSize, (index + 1) * batchSize),
  }));

  /** @type {BlobItem[][]} */
  const results = Array(batches.length);

  // The batches are independent, so a few of them are requested at once rather than one after
  // another; a large repository needs dozens of them, and each is a full round trip
  await runConcurrently(
    batches,
    async ({ index, paths: batchPaths }) => {
      results[index] = await fetchBlobBatch(batchPaths, query, variables);
    },
    { concurrency },
  );

  // Keep the order of the given paths, although callers match a blob to its file by path
  return results.flat();
};

/**
 * Fetch the blobs for the given file paths, and map them back to those paths.
 * @param {string[]} paths List of file paths to fetch.
 * @param {string} query GraphQL query string, which has to select the `path` of each blob.
 * @returns {Promise<Record<string, BlobItem>>} Fetched blobs mapped by file path. A path missing
 * from the branch has no blob.
 */
export const fetchBlobs = async (paths, query) => {
  const blobs = await fetchBlobNodes(paths, query);

  // Map the blobs back by their own paths rather than by position: GitLab leaves a path that isn’t
  // on the branch out of the response, e.g. a file deleted by a push made during the load, which
  // would otherwise give every later file the content of the one after it
  return Object.fromEntries(blobs.map((blob) => [/** @type {string} */ (blob.path), blob]));
};

/**
 * Parse the file contents from the API response. The GitLab API doesn’t give us file sizes or
 * commit information in bulk, so only the text contents are filled in.
 * @param {object} args Arguments.
 * @param {BaseFileListItem[]} args.fetchingFiles Base file list.
 * @param {Record<string, BlobItem>} args.blobs Raw text blobs.
 * @returns {RepositoryContentsMap} Parsed file contents map.
 */
export const parseFileContents = ({ fetchingFiles, blobs }) =>
  Object.fromEntries(
    fetchingFiles.map(({ path, sha }) => [
      path,
      { sha, size: 0, text: blobs[path]?.rawTextBlob ?? undefined, meta: {} },
    ]),
  );

/**
 * Fetch the metadata of entry/asset files as well as text file contents.
 * @param {BaseFileListItem[]} fetchingFiles Base file list.
 * @returns {Promise<RepositoryContentsMap>} Fetched contents map.
 */
export const fetchFileContents = async (fetchingFiles) => {
  // Show a simulated progress bar because the request waiting time is long
  const stopProgress = startSimulatedProgress(fetchingFiles.length);
  // Fetch blobs for entry/config files only
  const textPaths = fetchingFiles.filter(({ type }) => type !== 'asset').map(({ path }) => path);
  /** @type {Awaited<ReturnType<typeof fetchBlobs>>} */
  let blobs;

  try {
    blobs = await fetchBlobs(textPaths, FETCH_BLOBS_QUERY);
  } finally {
    // Also on failure, so the interval doesn’t keep running behind the error message
    stopProgress();
  }

  return parseFileContents({ fetchingFiles, blobs });
};

/**
 * Fetch file list from the backend service, download/parse all the entry files, then cache them in
 * the {@link allEntries} and {@link allAssets} stores.
 */
export const fetchFiles = async () => {
  await fetchAndParseFiles({
    repository,
    checkAccess: checkRepositoryAccess,
    checkBranchAccess,
    fetchDefaultBranchName,
    fetchLastCommit,
    fetchFileList,
    fetchFileContents,
  });
};

/**
 * Fetch an asset as a Blob via the API. We use the `lfs` query parameter to ensure that GitLab
 * returns the file content even if it’s tracked by Git LFS.
 * @param {Asset} asset Asset to retrieve the file content.
 * @returns {Promise<Blob>} Blob data.
 * @see https://docs.gitlab.com/api/repository_files/#get-raw-file-from-repository
 */
export const fetchBlob = async (asset) => {
  const { branch = '' } = repository;
  const { path, workflow } = asset;
  // An asset attached to an unpublished entry is committed to a workflow branch only, so it has to
  // be read from there; on the configured branch the path is missing or holds the published version
  const ref = workflow?.branch ?? branch;

  return /** @type {Promise<Blob>} */ (
    fetchAPI(
      `/projects/${getProjectId()}/repository/files` +
        `/${encodeURIComponent(path)}/raw?lfs=true&ref=${encodeURIComponent(ref)}`,
      { responseType: 'blob' },
    )
  );
};
