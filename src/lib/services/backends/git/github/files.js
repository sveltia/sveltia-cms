import { getPathInfo } from '@sveltia/utils/file';
import { sleep } from '@sveltia/utils/misc';
import mime from 'mime';
import { fetchLastCommit } from '$lib/services/backends/git/github/commits';
import {
  repository,
  checkRepositoryAccess,
  fetchDefaultBranchName,
} from '$lib/services/backends/git/github/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
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
            ... on Blob { text }
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
 * Parse the file contents from the API response.
 * @param {BaseFileListItem[]} fetchingFiles Base file list.
 * @param {Record<string, any>} results Results from the API.
 * @returns {Promise<RepositoryContentsMap>} Parsed file contents map.
 */
export const parseFileContents = async (fetchingFiles, results) => {
  const entries = fetchingFiles.map(({ path, sha, size }, index) => {
    const {
      author: { name, email, user: _user },
      committedDate,
    } = results[`commit_${index}`].target.history.nodes[0];

    const data = {
      sha,
      // eslint-disable-next-line object-shorthand
      size: /** @type {number} */ (size),
      text: results[`content_${index}`]?.text,
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

    return [path, data];
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

  dataLoadedProgress.set(0);

  // Show a fake progressbar because the request waiting time is long
  const dataLoadedProgressInterval = window.setInterval(() => {
    dataLoadedProgress.update((progress = 0) => progress + 1);
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
  dataLoadedProgress.set(undefined);

  return parseFileContents(fetchingFileList, results);
};

/**
 * Fetch file list from the backend service, download/parse all the entry files, then cache them in
 * the {@link allEntries} and {@link allAssets} stores.
 */
export const fetchFiles = async () => {
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
 * @see https://docs.github.com/en/rest/git/blobs#get-a-blob
 */
export const fetchBlob = async (asset) => {
  const { owner, repo } = repository;
  const { sha, path } = asset;

  const response = /** @type {Response} */ (
    await fetchAPI(`/repos/${owner}/${repo}/git/blobs/${sha}`, {
      headers: { Accept: 'application/vnd.github.raw' },
      responseType: 'raw',
    })
  );

  // Handle SVG and other non-binary files
  if (response.headers.get('Content-Type') !== 'application/octet-stream') {
    return new Blob([await response.text()], { type: mime.getType(path) ?? 'text/plain' });
  }

  return response.blob();
};
