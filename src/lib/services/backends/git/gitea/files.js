/* eslint-disable no-await-in-loop */

import { decodeBase64, getPathInfo } from '@sveltia/utils/file';
import { fetchLastCommit } from '$lib/services/backends/git/gitea/commits';
import { checkInstanceVersion, instance } from '$lib/services/backends/git/gitea/instance';
import {
  repository,
  checkRepositoryAccess,
  fetchDefaultBranchName,
} from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
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
 * @typedef {{ content: string | null, encoding: 'base64' | null } | null} PartialContentsListItem
 */

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
 * @param {PartialContentsListItem[]} results Results from the API.
 * @returns {Promise<RepositoryContentsMap>} Parsed file contents map.
 */
export const parseFileContents = async (fetchingFiles, results) => {
  const entries = await Promise.all(
    fetchingFiles
      .map(async ({ path, sha, size }, index) => {
        const fileData = results[index];

        const data = {
          sha,
          size: size ?? 0,
          text:
            fileData?.content && fileData.encoding === 'base64'
              ? await decodeBase64(fileData.content)
              : '',
          // Omit commit author/data because it’s costly to fetch commit data for each file
          meta: {},
        };

        return [path, data];
      })
      .filter((file) => !!file),
  );

  return Object.fromEntries(entries);
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

  // Forgejo uses `sha` as the identifier for files, while Gitea uses `path`
  const idField = isForgejo ? 'sha' : 'path';

  const allIds = fetchingFiles
    .filter(({ type }) => type !== 'asset')
    .map(({ [idField]: id }) => id);

  if (!allIds.length) {
    return {};
  }

  /** @type {PartialContentsListItem[]} */
  const results = [];
  const remainingIds = [...allIds];

  dataLoadedProgress.set(0);

  // Check how many files we can fetch at once (default is 30)
  const { default_paging_num: perPage = 30 } = /** @type {{ default_paging_num: number }} */ (
    await fetchAPI('/settings/api')
  );

  // Use the new bulk API endpoint to fetch multiple files at once
  for (;;) {
    const slicedIds = remainingIds.splice(0, perPage);

    const result = /** @type {PartialContentsListItem[]} */ (
      await (isForgejo
        ? fetchAPI(`${requestPath}?shas=${slicedIds.join(',')}`)
        : fetchAPI(requestPath, { method: 'POST', body: { files: slicedIds } }))
    );

    results.push(...result);
    dataLoadedProgress.set(
      Math.ceil(((allIds.length - remainingIds.length) / allIds.length) * 100),
    );

    if (!remainingIds.length) {
      break;
    }
  }

  dataLoadedProgress.set(undefined);

  return parseFileContents(fetchingFiles, results);
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
  const { owner, repo, branch = '' } = repository;
  const { path } = asset;

  return /** @type {Promise<Blob>} */ (
    fetchAPI(`/repos/${owner}/${repo}/media/${branch}/${path}`, {
      responseType: 'blob',
    })
  );
};
