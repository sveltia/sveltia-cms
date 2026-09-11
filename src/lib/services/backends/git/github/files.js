import { getPathInfo } from '@sveltia/utils/file';
import { sleep } from '@sveltia/utils/misc';
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
 * Get a query string for fetching file contents and metadata from the repository.
 * @param {any[]} chunk Sliced `fetchingFileList`.
 * @param {number} startIndex Start index.
 * @returns {string} Query string.
 */
export const getFileContentsQuery = (chunk, startIndex) => {
  const innerQuery = chunk
    .map(({ type, path, sha }, i) => {
      const str = [];
      const index = startIndex + i;

      if (type !== 'asset') {
        str.push(`
          content_${index}: object(oid: ${JSON.stringify(sha)}) {
            ... on Blob { text isTruncated }
          }
        `);
      }

      str.push(`
        commit_${index}: ref(qualifiedName: $branch) {
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
      `);

      return str.join('');
    })
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
 * @returns {Promise<RepositoryContentsMap>} Parsed file contents map.
 */
export const parseFileContents = async (fetchingFiles, results) => {
  /** @type {{ sha: string, data: { text?: string } }[]} */
  const truncatedFiles = [];

  const entries = fetchingFiles.map(({ path, sha, size }, index) => {
    const {
      author: { name, email, user: _user },
      committedDate,
    } = results[`commit_${index}`].target.history.nodes[0];

    const { text, isTruncated } = results[`content_${index}`] ?? {};

    const data = {
      sha,
      size: /** @type {number} */ (size),
      text,
      meta: {
        commitAuthor: {
          name,
          email,
          id: _user?.id,
          login: _user?.login,
        },
        commitDate: new Date(committedDate),
      },
    };

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
 * Fetch the metadata of entry/asset files as well as text file contents.
 * @param {BaseFileListItem[]} fetchingFiles Base file list.
 * @returns {Promise<RepositoryContentsMap>} Fetched contents map.
 */
export const fetchFileContents = async (fetchingFiles) => {
  const fetchingFileList = structuredClone(fetchingFiles);
  /** @type {any[][]} */
  const chunks = [];
  const chunkSize = 250;
  /** @type {Record<string, any>} */
  const results = {};

  dataLoadedProgress.current = 0;

  // Show a fake progressbar because the request waiting time is long
  const dataLoadedProgressInterval = window.setInterval(() => {
    dataLoadedProgress.current = (dataLoadedProgress.current ?? 0) + 1;
  }, fetchingFileList.length / 10);

  for (let i = 0; i < fetchingFileList.length; i += chunkSize) {
    chunks.push(fetchingFileList.slice(i, i + chunkSize));
  }

  // Split the file list into chunks and repeat requests to avoid API timeout
  await Promise.all(
    chunks.map(async (chunk, index) => {
      // Add a short delay to avoid Too Many Requests error
      await sleep(index * 500);

      const result = /** @type {{ repository: Record<string, any> }} */ (
        await fetchGraphQL(getFileContentsQuery(chunk, index * chunkSize))
      );

      Object.assign(results, result.repository);
    }),
  );

  window.clearInterval(dataLoadedProgressInterval);
  dataLoadedProgress.current = undefined;

  return parseFileContents(fetchingFileList, results);
};

/**
 * Fetch file list from the backend service, download/parse all the entry files, then cache them in
 * the {@link allEntries} and {@link allAssets} stores.
 */
export const fetchFiles = async () => {
  // With Open Authoring, a user without write access is a contributor rather than a stranger, so
  // they’re given a fork to work in instead of being turned away
  if (isOpenAuthoringConfigured()) {
    await initOpenAuthoring();
  } else {
    await checkRepositoryAccess();
  }

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
