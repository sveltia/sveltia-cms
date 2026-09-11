import { getPathInfo } from '@sveltia/utils/file';
import mime from 'mime';

import { fetchLastCommit } from '$lib/services/backends/git/github/commits';
import {
  getWorkflowRepository,
  initOpenAuthoring,
  isOpenAuthoringConfigured,
} from '$lib/services/backends/git/github/fork';
import {
  checkRepositoryAccess,
  fetchDefaultBranchName,
  repository,
} from '$lib/services/backends/git/github/repository';
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
 * @import { RepositoryMetadataMap } from '$lib/services/backends/git/shared/fetch';
 */

/**
 * Fetch the repository’s complete file list, and return it in the canonical format.
 * @param {string} [lastHash] The last commit’s SHA-1 hash.
 * @returns {Promise<BaseFileListItemProps[]>} File list.
 */
export const fetchFileList = async (lastHash) => {
  const { owner, repo, branch } = repository;

  const result =
    /** @type {{ tree: { type: string, path: string, sha: string, size: number }[] }} */ (
      await fetchAPI(`/repos/${owner}/${repo}/git/trees/${lastHash ?? branch}?recursive=1`)
    );

  return result.tree
    .filter(({ type }) => type === 'blob')
    .map(({ path, sha, size }) => ({ path, sha, size, name: getPathInfo(path).basename }));
};

/**
 * Number of files requested per GraphQL query. The API has no hard limit on aliases, but a bigger
 * query takes longer to answer and is more likely to time out.
 */
const CHUNK_SIZE = 250;

/**
 * Get a query string for fetching the text contents of the given files from the repository.
 * @param {BaseFileListItem[]} chunk Sliced `fetchingFiles`.
 * @param {number} startIndex Start index.
 * @returns {string} Query string.
 */
export const getFileContentsQuery = (chunk, startIndex) => {
  const innerQuery = chunk
    .map(({ type, sha }, i) => {
      // Only a text file has content to read; an asset is just listed for its metadata
      if (type === 'asset') {
        return '';
      }

      return `
        content_${startIndex + i}: object(oid: ${JSON.stringify(sha)}) {
          ... on Blob { text isTruncated }
        }
      `;
    })
    .join('');

  return `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        ${innerQuery}
      }
    }
  `;
};

/**
 * Get a query string for fetching the last commit of each of the given files from the repository.
 * @param {BaseFileListItem[]} chunk Sliced `fetchingFiles`.
 * @param {number} startIndex Start index.
 * @returns {string} Query string.
 */
export const getFileMetadataQuery = (chunk, startIndex) => {
  const innerQuery = chunk
    .map(
      ({ path }, i) => `
        commit_${startIndex + i}: ref(qualifiedName: $branch) {
          target {
            ... on Commit {
              history(first: 1, path: ${JSON.stringify(path)}) {
                nodes {
                  author {
                    name
                    email
                    user {
                      id: databaseId
                      login
                    }
                  }
                  committedDate
                }
              }
            }
          }
        }
      `,
    )
    .join('');

  return `
    query($owner: String!, $repo: String!, $branch: String!) {
      repository(owner: $owner, name: $repo) {
        ${innerQuery}
      }
    }
  `;
};

/**
 * Request a blob from the REST API. The `raw` media type asks for the file content itself, rather
 * than the base64-wrapped JSON the endpoint returns by default.
 * @param {object} args Arguments.
 * @param {string} args.owner Repository owner.
 * @param {string} args.repo Repository name.
 * @param {string} args.sha Blob SHA-1 hash.
 * @param {'text' | 'raw'} args.responseType Whether to read the content as text, or to hand the
 * `Response` back so the caller can decide. Note that `raw` bypasses the shared error handling, so
 * the caller has to check the status itself.
 * @returns {Promise<string | Response>} File content or response, depending on `responseType`.
 * @see https://docs.github.com/en/rest/git/blobs#get-a-blob
 */
const requestBlob = async ({ owner, repo, sha, responseType }) =>
  /** @type {Promise<string | Response>} */ (
    fetchAPI(`/repos/${owner}/${repo}/git/blobs/${sha}`, {
      headers: { Accept: 'application/vnd.github.raw' },
      responseType,
    })
  );

/**
 * Retrieve the text content of a blob with the REST API, which returns it in full. The GraphQL API
 * cuts `Blob.text` off at 512 KB and reports it with `isTruncated`; keeping that shortened text
 * would silently drop the tail of the file the next time the entry is saved.
 * @param {object} args Arguments.
 * @param {string} args.owner Repository owner.
 * @param {string} args.repo Repository name.
 * @param {string} args.sha Blob SHA-1 hash.
 * @returns {Promise<string>} File content.
 * @see https://github.com/sveltia/sveltia-cms/issues/950
 * @see https://github.com/graphql-hive/graphql-inspector/issues/2079
 */
export const fetchBlobText = async ({ owner, repo, sha }) =>
  /** @type {Promise<string>} */ (requestBlob({ owner, repo, sha, responseType: 'text' }));

/**
 * Parse the file contents from the API response.
 * @param {BaseFileListItem[]} fetchingFiles Base file list.
 * @param {Record<string, any>} results Results from the API.
 * @returns {Promise<RepositoryContentsMap>} Parsed file contents map. The commit metadata is left
 * out; it’s fetched separately with {@link fetchFileMetadata}.
 */
export const parseFileContents = async (fetchingFiles, results) => {
  /** @type {{ sha: string, data: { text?: string } }[]} */
  const truncatedFiles = [];

  const entries = fetchingFiles.map(({ path, sha, size }, index) => {
    const { text, isTruncated } = results[`content_${index}`] ?? {};
    const data = { sha, size: /** @type {number} */ (size), text, meta: undefined };

    if (isTruncated) {
      truncatedFiles.push({ sha, data });
    }

    return [path, data];
  });

  // Read any oversized blob again with the REST API, which has no such size cap
  const { owner, repo } = repository;

  await runConcurrently(truncatedFiles, async ({ sha, data }) => {
    data.text = await fetchBlobText({ owner, repo, sha });
  });

  return Object.fromEntries(entries);
};

/**
 * Parse the file metadata from the API response.
 * @param {BaseFileListItem[]} fetchingFiles Base file list.
 * @param {Record<string, any>} results Results from the API.
 * @returns {RepositoryMetadataMap} Parsed file metadata map.
 */
export const parseFileMetadata = (fetchingFiles, results) =>
  Object.fromEntries(
    fetchingFiles.map(({ path }, index) => {
      const {
        author: { name, email, user: _user },
        committedDate,
      } = results[`commit_${index}`].target.history.nodes[0];

      return [
        path,
        {
          commitAuthor: { name, email, id: _user?.id, login: _user?.login },
          commitDate: new Date(committedDate),
        },
      ];
    }),
  );

/**
 * Query the API for the given files, a chunk at a time, and merge the aliased results.
 * @param {BaseFileListItem[]} fetchingFiles Base file list.
 * @param {(chunk: BaseFileListItem[], startIndex: number) => string} getQuery Function to build
 * the query for a chunk.
 * @returns {Promise<Record<string, any>>} Merged results, keyed by alias.
 */
const fetchInChunks = async (fetchingFiles, getQuery) => {
  /** @type {BaseFileListItem[][]} */
  const chunks = [];
  /** @type {Record<string, any>} */
  const results = {};

  for (let i = 0; i < fetchingFiles.length; i += CHUNK_SIZE) {
    chunks.push(fetchingFiles.slice(i, i + CHUNK_SIZE));
  }

  // Split the file list into chunks and repeat requests to avoid API timeout, with a limited number
  // in flight at once to avoid a Too Many Requests error. This replaces a fixed delay between the
  // queries, which cost a large repository half a second per chunk no matter how quickly the API
  // answered
  await runConcurrently(
    chunks.map((chunk, index) => ({ chunk, index })),
    async ({ chunk, index }) => {
      const result = /** @type {{ repository: Record<string, any> }} */ (
        await fetchGraphQL(getQuery(chunk, index * CHUNK_SIZE))
      );

      Object.assign(results, result.repository);
    },
  );

  return results;
};

/**
 * Fetch the text contents of entry/config files. The commit metadata of the files is not included;
 * see {@link fetchFileMetadata}.
 * @param {BaseFileListItem[]} fetchingFiles Base file list.
 * @returns {Promise<RepositoryContentsMap>} Fetched contents map.
 */
export const fetchFileContents = async (fetchingFiles) => {
  // Show a simulated progress bar because the request waiting time is long
  const stopProgress = startSimulatedProgress(fetchingFiles.length);
  /** @type {Record<string, any>} */
  let results;

  try {
    results = await fetchInChunks(fetchingFiles, getFileContentsQuery);
  } finally {
    // Also on failure, so the interval doesn’t keep running behind the error message
    stopProgress();
  }

  return parseFileContents(fetchingFiles, results);
};

/**
 * Fetch the last commit of each entry/asset file. Looking up the history of every path is the slow
 * part of a cold start — far slower than reading the blobs — so it’s done in this second pass,
 * after the contents have been shown.
 * @param {BaseFileListItem[]} fetchingFiles Base file list.
 * @returns {Promise<RepositoryMetadataMap>} Fetched metadata map.
 */
export const fetchFileMetadata = async (fetchingFiles) =>
  parseFileMetadata(fetchingFiles, await fetchInChunks(fetchingFiles, getFileMetadataQuery));

/**
 * Fetch file list from the backend service, download/parse all the entry files, then cache them in
 * the {@link allEntries} and {@link allAssets} stores.
 */
export const fetchFiles = async () => {
  // With Open Authoring, a user without write access is a contributor rather than a stranger, so
  // they’re given a fork to work in instead of being turned away. Setting the fork up may involve
  // the user, so it has to finish before the data is fetched, unlike a plain access check
  const openAuthoring = isOpenAuthoringConfigured();

  if (openAuthoring) {
    await initOpenAuthoring();
  }

  await fetchAndParseFiles({
    repository,
    checkAccess: openAuthoring ? undefined : checkRepositoryAccess,
    fetchDefaultBranchName,
    fetchLastCommit,
    fetchFileList,
    fetchFileContents,
    fetchFileMetadata,
  });
};

/**
 * Fetch an asset as a Blob via the API.
 * @param {Asset} asset Asset to retrieve the file content.
 * @returns {Promise<Blob>} Blob data.
 */
export const fetchBlob = async (asset) => {
  // An asset attached to an unpublished entry is committed to a workflow branch, which lives in the
  // contributor’s fork with Open Authoring, so the blob has to be read from there
  const { owner, repo } = asset.workflow ? getWorkflowRepository() : repository;
  const { sha, path } = asset;

  const response = /** @type {Response} */ (
    await requestBlob({ owner, repo, sha, responseType: 'raw' })
  );

  // Handle SVG and other non-binary files
  if (response.headers.get('Content-Type') !== 'application/octet-stream') {
    return new Blob([await response.text()], { type: mime.getType(path) ?? 'text/plain' });
  }

  return response.blob();
};
