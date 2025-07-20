/* eslint-disable no-await-in-loop */

import { encodeBase64, getPathInfo } from '@sveltia/utils/file';
import { stripSlashes } from '@sveltia/utils/string';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { signIn, signOut } from '$lib/services/backends/gitlab/auth';
import { BACKEND_LABEL, BACKEND_NAME } from '$lib/services/backends/gitlab/constants';
import {
  repository,
  getBaseURLs,
  checkRepositoryAccess,
  fetchDefaultBranchName,
} from '$lib/services/backends/gitlab/repository';
import { checkStatus, STATUS_DASHBOARD_URL } from '$lib/services/backends/gitlab/status';
import { apiConfig, fetchAPI, fetchGraphQL, graphqlVars } from '$lib/services/backends/shared/api';
import { createCommitMessage } from '$lib/services/backends/shared/commits';
import { fetchAndParseFiles } from '$lib/services/backends/shared/fetch';
import { siteConfig } from '$lib/services/config';
import { dataLoadedProgress } from '$lib/services/contents';
import { prefs } from '$lib/services/user/prefs';
import { getGitHash } from '$lib/services/utils/file';

/**
 * @import {
 * ApiEndpointConfig,
 * Asset,
 * BackendService,
 * BaseFileListItem,
 * BaseFileListItemProps,
 * CommitOptions,
 * CommitResults,
 * FileChange,
 * RepositoryContentsMap,
 * RepositoryInfo,
 * } from '$lib/types/private';
 */

/**
 * @typedef {object} GitLabUserInfo
 * @property {string} [id] GitLab user ID.
 * @property {string} [username] GitLab user username.
 */

/**
 * @typedef {object} GitLabCommit
 * @property {GitLabUserInfo | null} author Commit author’s GitLab user info.
 * @property {string} authorName Commit author’s full name.
 * @property {string} authorEmail Commit author’s email.
 * @property {string} committedDate Committed date.
 */

/**
 * @typedef {object} FetchLastCommitResponse
 * @property {object} project Project information.
 * @property {object} project.repository Repository information.
 * @property {object} project.repository.tree Tree information.
 * @property {object} project.repository.tree.lastCommit Last commit information.
 * @property {string} project.repository.tree.lastCommit.sha Commit SHA-1 hash.
 * @property {string} project.repository.tree.lastCommit.message Commit message.
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
 * @typedef {object} BlobItem
 * @property {string} size Size of the blob in bytes.
 * @property {string} rawTextBlob Raw text content of the blob.
 */

/**
 * @typedef {object} FetchBlobsResponse
 * @property {object} project Project information.
 * @property {object} project.repository Repository information.
 * @property {object} project.repository.blobs Blobs information.
 * @property {BlobItem[]} project.repository.blobs.nodes List of file blobs with their sizes and raw
 * text contents.
 */

/**
 * @typedef {object} FetchCommitsResponse
 * @property {object} project Project information.
 * @property {Record<string, { lastCommit: GitLabCommit }>} project.repository Mapping of file paths
 * to their last commit information.
 */

/**
 * @typedef {object} CommitResponse
 * @property {string} id Commit SHA-1 hash.
 * @property {string} committed_date Commit date in ISO 8601 format.
 */

const DEFAULT_API_ROOT = 'https://gitlab.com/api/v4';
const DEFAULT_AUTH_ROOT = 'https://gitlab.com';
const DEFAULT_AUTH_PATH = 'oauth/authorize';

/**
 * Initialize the GitLab backend.
 * @returns {RepositoryInfo | undefined} Repository info, or nothing when the configured backend is
 * not GitLab.
 */
const init = () => {
  const { backend } = get(siteConfig) ?? {};

  if (backend?.name !== BACKEND_NAME) {
    return undefined;
  }

  const {
    repo: projectPath,
    branch,
    base_url: authRoot = DEFAULT_AUTH_ROOT,
    auth_endpoint: authPath = DEFAULT_AUTH_PATH,
    app_id: clientId = '',
    api_root: restApiRoot = DEFAULT_API_ROOT,
    graphql_api_root: graphqlApiRoot = restApiRoot,
  } = backend;

  const authURL = `${stripSlashes(authRoot)}/${stripSlashes(authPath)}`;
  // Developers may misconfigure custom API roots, so we use the origin to redefine them
  const restApiOrigin = new URL(restApiRoot).origin;
  const graphqlApiOrigin = new URL(graphqlApiRoot).origin;

  /**
   * In GitLab terminology, an owner is called a namespace, and a repository is called a project. A
   * namespace can contain a group and a subgroup concatenated with a `/` so we cannot simply use
   * `split('/')` here. A project name should not contain a `/`.
   * @see https://docs.gitlab.com/user/namespace/
   * @see https://gitlab.com/gitlab-org/gitlab/-/merge_requests/80055
   */
  const { owner, repo } =
    /** @type {string} */ (projectPath).match(/(?<owner>.+)\/(?<repo>[^/]+)$/)?.groups ?? {};

  const repoPath = `${owner}/${repo}`;
  const baseURL = `${restApiOrigin}/${repoPath}`;

  Object.assign(
    repository,
    /** @type {RepositoryInfo} */ ({
      service: BACKEND_NAME,
      label: BACKEND_LABEL,
      owner,
      repo,
      branch,
      baseURL,
      databaseName: `${BACKEND_NAME}:${repoPath}`,
      isSelfHosted: restApiRoot !== DEFAULT_API_ROOT,
    }),
    getBaseURLs(baseURL, branch),
  );

  Object.assign(
    apiConfig,
    /** @type {ApiEndpointConfig} */ ({
      clientId,
      authURL,
      tokenURL: authURL.replace('/authorize', '/token'),
      authScheme: 'Bearer',
      origin: restApiOrigin,
      restBaseURL: `${restApiOrigin}/api/v4`,
      graphqlBaseURL: `${graphqlApiOrigin}/api`,
    }),
  );

  Object.assign(graphqlVars, {
    fullPath: repoPath,
    branch,
  });

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('repositoryInfo', repository);
  }

  return repository;
};

const FETCH_LAST_COMMIT_QUERY = `
  query($fullPath: String!, $branch: String!) {
    project(fullPath: $fullPath) {
      repository {
        tree(ref: $branch) {
          lastCommit {
            sha
            message
          }
        }
      }
    }
  }
`;

/**
 * Fetch the last commit on the repository.
 * @returns {Promise<{ hash: string, message: string }>} Commit’s SHA-1 hash and message.
 * @throws {Error} When the branch could not be found.
 * @see https://docs.gitlab.com/api/graphql/reference/#tree
 */
const fetchLastCommit = async () => {
  const { repo, branch } = repository;

  const result = /** @type {FetchLastCommitResponse} */ (
    await fetchGraphQL(FETCH_LAST_COMMIT_QUERY)
  );

  if (!result.project) {
    throw new Error('Failed to retrieve the last commit hash.', {
      cause: new Error(get(_)('repository_not_found', { values: { repo } })),
    });
  }

  const { lastCommit } = result.project.repository.tree ?? {};

  if (!lastCommit) {
    throw new Error('Failed to retrieve the last commit hash.', {
      cause: new Error(get(_)('branch_not_found', { values: { repo, branch } })),
    });
  }

  const { sha: hash, message } = lastCommit;

  return { hash, message };
};

const FETCH_FILE_LIST_QUERY = `
  query($fullPath: String!, $branch: String!, $cursor: String!) {
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
const fetchFileList = async () => {
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

  // The `size` is not available here; it will be retrieved in `fetchFileContents` below
  return blobs
    .filter(({ type }) => type === 'blob')
    .map(({ path, sha }) => ({ path, sha, size: 0, name: getPathInfo(path).basename }));
};

const FETCH_BLOBS_QUERY = `
  query($fullPath: String!, $branch: String!, $paths: [String!]!) {
    project(fullPath: $fullPath) {
      repository {
        blobs(ref: $branch, paths: $paths) {
          nodes {
            size
            rawTextBlob
          }
        }
      }
    }
  }
`;

/**
 * Fetch the blobs for the given file paths. This function retrieves the raw text contents of files
 * in the repository using the GitLab GraphQL API. It handles pagination by fetching a fixed number
 * of paths at a time, ensuring that the complexity score of the query does not exceed the limit. It
 * also updates the `dataLoadedProgress` store to reflect the progress of data loading.
 * @param {string[]} allPaths List of all file paths to fetch.
 * @returns {Promise<BlobItem[]>} Fetched blobs with their sizes and raw text contents.
 * @see https://docs.gitlab.com/api/graphql/reference/#repositoryblob
 * @see https://docs.gitlab.com/api/graphql/reference/#tree
 * @see https://forum.gitlab.com/t/graphql-api-read-raw-file/35389
 * @see https://docs.gitlab.com/api/graphql/#limits
 */
const fetchBlobs = async (allPaths) => {
  const paths = [...allPaths];
  /** @type {BlobItem[]} */
  const blobs = [];

  dataLoadedProgress.set(0);

  // Fetch all the text contents with the GraphQL API. Pagination would fail if `paths` becomes too
  // long, so we just use a fixed number of paths to iterate. The complexity score of this query is
  // 15 + (2 * node size) so 100 paths = 215 complexity, where the max number of records is 100 and
  // max complexity is 250 or 300
  for (;;) {
    const currentPaths = paths.splice(0, 100);

    const result = /** @type {FetchBlobsResponse} */ (
      await fetchGraphQL(FETCH_BLOBS_QUERY, { paths: currentPaths })
    );

    blobs.push(...result.project.repository.blobs.nodes);
    dataLoadedProgress.set(Math.ceil(((allPaths.length - paths.length) / allPaths.length) * 100));

    if (!paths.length) {
      break;
    }
  }

  dataLoadedProgress.set(undefined);

  return blobs;
};

/**
 * Generate the inner GraphQL query for fetching the last commit information of a file at the
 * specified path.
 * @param {string} path File path.
 * @param {number} index Index of the path in the current batch.
 * @returns {string} GraphQL query string for fetching the last commit information of the file at
 * the specified path.
 */
const getFetchCommitsInnerQuery = (path, index) => `
  tree_${index}: tree(ref: $branch, path: ${JSON.stringify(path)}) {
    lastCommit {
      author {
        id
        username
      }
      authorName
      authorEmail
      committedDate
    }
  }
`;

/**
 * Fetch commit information for each file in the repository. This function retrieves the last commit
 * information for each file path using the GitLab GraphQL API. It handles pagination by fetching a
 * fixed number of paths at a time, ensuring that the complexity score of the query does not exceed
 * the limit. The commit information includes the author’s GitLab user info, name, email, and
 * committed date.
 * @param {string[]} allPaths List of all file paths to fetch.
 * @returns {Promise<GitLabCommit[]>} Fetched commit information for each file.
 */
const fetchCommits = async (allPaths) => {
  const paths = [...allPaths];
  /** @type {GitLabCommit[]} */
  const commits = [];

  // The complexity score of this query is 5 + (18 * node size) so 13 paths = 239 complexity
  for (;;) {
    const currentPaths = paths.splice(0, 13);

    const query = `
      query($fullPath: String!, $branch: String!) {
        project(fullPath: $fullPath) {
          repository {
            ${currentPaths.map(getFetchCommitsInnerQuery).join('')}
          }
        }
      }
    `;

    const result = /** @type {FetchCommitsResponse} */ (await fetchGraphQL(query));

    commits.push(...Object.values(result.project.repository).map(({ lastCommit }) => lastCommit));

    if (!paths.length) {
      break;
    }
  }

  return commits;
};

/**
 * Parse the file contents from the API response.
 * @param {BaseFileListItem[]} fetchingFiles Base file list.
 * @param {BlobItem[]} blobs File sizes and raw text blobs.
 * @param {GitLabCommit[]} commits Commit information for each file.
 * @returns {Promise<RepositoryContentsMap>} Parsed file contents map.
 */
const parseFileContents = async (fetchingFiles, blobs, commits) => {
  const entries = fetchingFiles.map(({ path, sha }, index) => {
    const { size, rawTextBlob } = blobs[index];
    const commit = commits[index];

    const data = {
      sha,
      size: Number(size),
      text: rawTextBlob,
      meta: {},
    };

    if (commit) {
      const { author, authorName, authorEmail, committedDate } = commit;
      const { id, username } = author ?? {};
      const idMatcher = id?.match(/\d+/);

      data.meta = {
        commitAuthor: {
          name: authorName,
          email: authorEmail,
          id: idMatcher ? Number(idMatcher[0]) : undefined,
          login: username,
        },
        committedDate: new Date(committedDate),
      };
    }

    return [path, data];
  });

  return Object.fromEntries(entries);
};

/**
 * Fetch the metadata of entry/asset files as well as text file contents.
 * @param {BaseFileListItem[]} fetchingFiles Base file list.
 * @returns {Promise<RepositoryContentsMap>} Fetched contents map.
 */
const fetchFileContents = async (fetchingFiles) => {
  const allPaths = fetchingFiles.map(({ path }) => path);
  const blobs = await fetchBlobs(allPaths);
  // Fetch commit info only when there aren’t many files, because it’s costly
  const commits = allPaths.length < 100 ? await fetchCommits(allPaths) : [];

  return parseFileContents(fetchingFiles, blobs, commits);
};

/**
 * Fetch file list from the backend service, download/parse all the entry files, then cache them in
 * the {@link allEntries} and {@link allAssets} stores.
 */
const fetchFiles = async () => {
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
 * Fetch an asset as a Blob via the API. We use the `lfs` query parameter to ensure that GitLab
 * returns the file content even if it’s tracked by Git LFS.
 * @param {Asset} asset Asset to retrieve the file content.
 * @returns {Promise<Blob>} Blob data.
 * @see https://docs.gitlab.com/api/repository_files/#get-raw-file-from-repository
 */
const fetchBlob = async (asset) => {
  const { owner, repo, branch = '' } = repository;
  const { path } = asset;

  return /** @type {Promise<Blob>} */ (
    fetchAPI(
      `/projects/${encodeURIComponent(`${owner}/${repo}`)}/repository/files` +
        `/${encodeURIComponent(path)}/raw?lfs=true&ref=${encodeURIComponent(branch)}`,
      { responseType: 'blob' },
    )
  );
};

/**
 * Save entries or assets remotely. Note that the `commitCreate` GraphQL mutation is broken and
 * images cannot be uploaded properly, so we use the REST API instead.
 * @param {FileChange[]} changes File changes to be saved.
 * @param {CommitOptions} options Commit options.
 * @returns {Promise<CommitResults>} Commit results, including the commit SHA and updated file SHAs.
 * @see https://docs.gitlab.com/api/commits.html#create-a-commit-with-multiple-files-and-actions
 * @see https://gitlab.com/gitlab-org/gitlab/-/merge_requests/31102
 * @see https://docs.gitlab.com/api/graphql/reference/#mutationcommitcreate
 * @see https://forum.gitlab.com/t/how-to-commit-a-image-via-gitlab-commit-api/26632/4
 */
const commitChanges = async (changes, options) => {
  const { owner, repo, branch } = repository;

  const actions = await Promise.all(
    changes.map(async ({ action, path, previousPath, data = '' }) => ({
      action,
      content: typeof data === 'string' ? data : await encodeBase64(data),
      encoding: typeof data === 'string' ? 'text' : 'base64',
      file_path: path,
      previous_path: previousPath,
    })),
  );

  const { id: sha, committed_date: committedDate } = /** @type {CommitResponse} */ (
    await fetchAPI(`/projects/${encodeURIComponent(`${owner}/${repo}`)}/repository/commits`, {
      method: 'POST',
      body: {
        branch,
        commit_message: createCommitMessage(changes, options),
        actions,
      },
    })
  );

  // Calculate the SHA-1 hash for each file because the GitLab REST API does not return file SHAs
  const entries = await Promise.all(
    changes.map(async ({ path, data }) =>
      data === undefined ? null : [path, { sha: await getGitHash(data) }],
    ),
  );

  return {
    sha,
    date: new Date(committedDate),
    files: Object.fromEntries(entries.filter((entry) => !!entry)),
  };
};

/**
 * @type {BackendService}
 */
export default {
  isGit: true,
  name: BACKEND_NAME,
  label: BACKEND_LABEL,
  repository,
  statusDashboardURL: STATUS_DASHBOARD_URL,
  checkStatus,
  init,
  signIn,
  signOut,
  fetchFiles,
  fetchBlob,
  commitChanges,
};
