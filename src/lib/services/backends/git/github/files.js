import mime from 'mime';

import { fetchLastCommit } from '$lib/services/backends/git/github/commits';
import {
  getWorkflowRepository,
  initOpenAuthoring,
  isOpenAuthoringConfigured,
} from '$lib/services/backends/git/github/fork';
import { fetchAliasedBatch } from '$lib/services/backends/git/github/graphql';
import {
  checkBranchAccess,
  checkRepositoryAccess,
  fetchDefaultBranchName,
  repository,
} from '$lib/services/backends/git/github/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { mapConcurrently, runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import { fetchRepositoryFiles } from '$lib/services/backends/git/shared/files';
import { startSimulatedProgress } from '$lib/services/backends/git/shared/progress';
import { toFileListItems } from '$lib/services/backends/git/shared/tree';
import { encodePath } from '$lib/services/backends/git/shared/url';
import { getRootDir } from '$lib/services/backends/root-dir';

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
 * @typedef {{ type: string, path: string, sha: string, size: number }} GitTreeEntry
 */

/**
 * Fetch a Git tree.
 * @param {string} treeRef Commit SHA, branch name or tree SHA.
 * @param {boolean} recursive Whether to list the subtrees as well.
 * @returns {Promise<{ tree: GitTreeEntry[], truncated: boolean }>} Tree, and whether the response
 * was truncated because the tree is too big.
 * @see https://docs.github.com/en/rest/git/trees#get-a-tree
 */
const fetchTree = async (treeRef, recursive) => {
  const { owner, repo } = repository;
  const query = recursive ? '?recursive=1' : '';

  return /** @type {{ tree: GitTreeEntry[], truncated: boolean }} */ (
    await fetchAPI(`/repos/${owner}/${repo}/git/trees/${encodePath(treeRef)}${query}`)
  );
};

/**
 * Fetch the repository’s complete file list, and return it in the canonical format. A tree too big
 * to be listed recursively in one response, as in a huge repository, has its subtrees listed
 * separately instead, as GitHub suggests. With the `root_dir` backend option, only the files in
 * that directory are listed, which saves listing the whole of a big monorepo; the paths are still
 * relative to the repository root.
 * @param {string} [lastHash] The last commit’s SHA-1 hash.
 * @returns {Promise<BaseFileListItemProps[]>} File list.
 * @throws {Error} If a single directory has too many files to list, or if the root directory
 * doesn’t exist.
 */
export const fetchFileList = async (lastHash) => {
  const ref = /** @type {string} */ (lastHash ?? repository.branch);
  const rootDir = getRootDir();
  /** @type {GitTreeEntry[]} */
  const blobs = [];

  /** @type {{ sha: string, prefix: string }[]} */
  let pending = [
    // A tree-ish expression addresses the directory’s tree without looking its SHA up first
    rootDir ? { sha: `${ref}:${rootDir}`, prefix: `${rootDir}/` } : { sha: ref, prefix: '' },
  ];

  // One level at a time, so the requests in flight stay within the concurrency limit
  while (pending.length) {
    // eslint-disable-next-line no-await-in-loop
    const results = await mapConcurrently(pending, async ({ sha, prefix }) => {
      const { tree, truncated } = await fetchTree(sha, true).catch((ex) => {
        if (rootDir && sha === `${ref}:${rootDir}` && ex?.cause?.status === 404) {
          throw createLocalizedError('Failed to list the files.', 'root_dir_not_found', {
            repo: `${repository.owner}/${repository.repo}`,
            dir: rootDir,
          });
        }

        throw ex;
      });

      if (!truncated) {
        return { prefix, entries: tree, subtrees: [] };
      }

      // List this directory alone, and its subdirectories separately
      const { tree: children, truncated: tooBig } = await fetchTree(sha, false);

      if (tooBig) {
        throw new Error(`The directory '${prefix || '/'}' has too many files to list.`);
      }

      return {
        prefix,
        entries: children,
        subtrees: children.filter(({ type }) => type === 'tree'),
      };
    });

    pending = results.flatMap(({ prefix, subtrees }) =>
      subtrees.map(({ path, sha }) => ({ sha, prefix: `${prefix}${path}/` })),
    );

    results.forEach(({ prefix, entries }) => {
      entries.forEach((entry) => {
        if (entry.type === 'blob') {
          blobs.push({ ...entry, path: `${prefix}${entry.path}` });
        }
      });
    });
  }

  return toFileListItems(blobs);
};

const FETCH_DIR_SHA_QUERY = `
  query($owner: String!, $repo: String!, $expression: String!) {
    repository(owner: $owner, name: $repo) {
      object(expression: $expression) {
        oid
      }
    }
  }
`;

/**
 * Find the tree SHA of a directory at the given commit.
 * @param {string} ref Commit SHA or branch name.
 * @param {string} dirPath Directory path relative to the repository root.
 * @returns {Promise<string | undefined>} Tree SHA, or `undefined` if the directory doesn’t exist.
 * @see https://docs.github.com/en/graphql/reference/objects#repository
 */
export const fetchDirSHA = async (ref, dirPath) => {
  const { owner, repo } = repository;

  const result = /** @type {{ repository?: { object?: { oid: string } | null } | null }} */ (
    await fetchGraphQL(FETCH_DIR_SHA_QUERY, { owner, repo, expression: `${ref}:${dirPath}` })
  );

  return result.repository?.object?.oid;
};

/**
 * Number of files requested per GraphQL query. The API has no hard limit on aliases, but a bigger
 * query takes longer to answer and is more likely to time out.
 */
const CHUNK_SIZE = 250;

/**
 * Get the GraphQL field selection for fetching the text content of the given file.
 * @param {BaseFileListItem} file File.
 * @returns {string} Field selection, or an empty string for an asset, which has no content to read
 * and is just listed for its metadata.
 */
export const getFileContentsFragment = ({ type, sha }) =>
  type === 'asset'
    ? ''
    : `object(oid: ${JSON.stringify(sha)}) { ... on Blob { text isTruncated } }`;

/**
 * Get the GraphQL field selection for fetching the last commit of the given file.
 * @param {BaseFileListItem} file File.
 * @returns {string} Field selection.
 */
export const getFileMetadataFragment = ({ path }) => `
  ref(qualifiedName: $branch) {
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
`;

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
 * @param {any[]} results Result for each file from the API, in the same order.
 * @returns {Promise<RepositoryContentsMap>} Parsed file contents map. The commit metadata is left
 * out; it’s fetched separately with {@link fetchFileMetadata}.
 */
export const parseFileContents = async (fetchingFiles, results) => {
  /** @type {{ sha: string, data: { text?: string } }[]} */
  const truncatedFiles = [];

  const entries = fetchingFiles.map(({ path, sha, size }, index) => {
    const { text, isTruncated } = results[index] ?? {};
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
 * @param {any[]} results Result for each file from the API, in the same order.
 * @returns {RepositoryMetadataMap} Parsed file metadata map.
 */
export const parseFileMetadata = (fetchingFiles, results) =>
  Object.fromEntries(
    fetchingFiles.flatMap(({ path }, index) => {
      const commit = results[index]?.target?.history?.nodes?.[0];

      // The file may have been deleted since the tree was fetched, leaving no commit to read. Skip
      // it rather than losing the metadata of every other file; it’s fetched again next time
      if (!commit) {
        return [];
      }

      const { author, committedDate } = commit;
      const user = author?.user;

      return [
        [
          path,
          {
            // The author can be `null` when the commit has no valid author info
            commitAuthor: author
              ? { name: author.name, email: author.email, id: user?.id, login: user?.login }
              : undefined,
            commitDate: new Date(committedDate),
          },
        ],
      ];
    }),
  );

/**
 * Query the API for the given files, a chunk at a time to avoid an API timeout, with a limited
 * number of requests in flight at once to avoid a Too Many Requests error.
 * @param {BaseFileListItem[]} fetchingFiles Base file list.
 * @param {string} alias Alias prefix.
 * @param {(file: BaseFileListItem) => string} getFragment Function to build the field selection
 * for a file.
 * @param {object} [options] Options.
 * @param {boolean} [options.useBranch] Whether the field selection uses the `$branch` variable.
 * @returns {Promise<any[]>} Result for each file, in the same order as `fetchingFiles`.
 */
const fetchInChunks = (fetchingFiles, alias, getFragment, { useBranch = false } = {}) =>
  fetchAliasedBatch({ items: fetchingFiles, alias, getFragment, chunkSize: CHUNK_SIZE, useBranch });

/**
 * Fetch the text contents of entry/config files. The commit metadata of the files is not included;
 * see {@link fetchFileMetadata}.
 * @param {BaseFileListItem[]} fetchingFiles Base file list.
 * @returns {Promise<RepositoryContentsMap>} Fetched contents map.
 */
export const fetchFileContents = async (fetchingFiles) => {
  // Show a simulated progress bar because the request waiting time is long
  const stopProgress = startSimulatedProgress(fetchingFiles.length);
  /** @type {any[]} */
  let results;

  try {
    results = await fetchInChunks(fetchingFiles, 'content', getFileContentsFragment);
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
  parseFileMetadata(
    fetchingFiles,
    await fetchInChunks(fetchingFiles, 'commit', getFileMetadataFragment, { useBranch: true }),
  );

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
    initOpenAuthoring,
    repository,
    checkAccess: checkRepositoryAccess,
    checkBranchAccess,
    fetchDefaultBranchName,
    fetchLastCommit,
    lastCommit,
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

  // A `raw` response skips the shared error handling, so an error body would otherwise be returned
  // as the file content, and moving or renaming the asset would commit it in place of the file
  if (!response.ok) {
    throw new Error('Failed to fetch the blob', { cause: { status: response.status } });
  }

  // Handle SVG and other non-binary files
  if (response.headers.get('Content-Type') !== 'application/octet-stream') {
    return new Blob([await response.text()], { type: mime.getType(path) ?? 'text/plain' });
  }

  return response.blob();
};
