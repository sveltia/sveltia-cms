import { encodeBase64, getPathInfo } from '@sveltia/utils/file';
import { sleep } from '@sveltia/utils/misc';
import { stripSlashes } from '@sveltia/utils/string';
import mime from 'mime';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { signIn, signOut } from '$lib/services/backends/github/auth';
import { BACKEND_LABEL, BACKEND_NAME } from '$lib/services/backends/github/constants';
import { checkStatus, STATUS_DASHBOARD_URL } from '$lib/services/backends/github/status';
import { REPOSITORY_INFO_PLACEHOLDER } from '$lib/services/backends/shared';
import { apiConfig, fetchAPI, fetchGraphQL, graphqlVars } from '$lib/services/backends/shared/api';
import { createCommitMessage } from '$lib/services/backends/shared/commits';
import { fetchAndParseFiles } from '$lib/services/backends/shared/fetch';
import { siteConfig } from '$lib/services/config';
import { dataLoadedProgress } from '$lib/services/contents';
import { user } from '$lib/services/user';
import { prefs } from '$lib/services/user/prefs';

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
 * @typedef {object} LastCommitResponse
 * @property {object} repository Repository information.
 * @property {object} repository.ref Reference information.
 * @property {object} repository.ref.target Target commit.
 * @property {object} repository.ref.target.history Commit history.
 * @property {{ oid: string, message: string }[]} repository.ref.target.history.nodes Nodes in the
 * commit history, containing the commit SHA-1 hash and message.
 */

const DEFAULT_API_ROOT = 'https://api.github.com';
const DEFAULT_AUTH_ROOT = 'https://api.netlify.com';
const DEFAULT_AUTH_PATH = 'auth';
const DEFAULT_ORIGIN = 'https://github.com';
/** @type {RepositoryInfo} */
const repository = { ...REPOSITORY_INFO_PLACEHOLDER };

/**
 * Generate base URLs for accessing the repository’s resources.
 * @param {string} baseURL The name of the repository.
 * @param {string} [branch] The branch name. Could be `undefined` if the branch is not specified in
 * the site configuration.
 * @returns {{ treeBaseURL: string, blobBaseURL: string }} An object containing the tree base URL
 * for browsing files, and the blob base URL for accessing file contents.
 */
const getBaseURLs = (baseURL, branch) => ({
  treeBaseURL: branch ? `${baseURL}/tree/${branch}` : baseURL,
  blobBaseURL: branch ? `${baseURL}/blob/${branch}` : '',
});

/**
 * Initialize the GitHub backend.
 * @returns {RepositoryInfo | undefined} Repository info, or nothing when the configured backend is
 * not GitHub.
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
    api_root: restApiRoot = DEFAULT_API_ROOT,
    graphql_api_root: graphqlApiRoot = restApiRoot,
  } = backend;

  const authURL = `${stripSlashes(authRoot)}/${stripSlashes(authPath)}`;
  // Developers may misconfigure custom API roots, so we use the origin to redefine them
  const restApiOrigin = new URL(restApiRoot).origin;
  const graphqlApiOrigin = new URL(graphqlApiRoot).origin;
  const isSelfHosted = restApiRoot !== DEFAULT_API_ROOT;
  const origin = isSelfHosted ? restApiOrigin : DEFAULT_ORIGIN;
  const [owner, repo] = /** @type {string} */ (projectPath).split('/');
  const repoPath = `${owner}/${repo}`;
  const baseURL = `${origin}/${repoPath}`;

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
      isSelfHosted,
    }),
    getBaseURLs(baseURL, branch),
  );

  Object.assign(
    apiConfig,
    /** @type {ApiEndpointConfig} */ ({
      clientId: '', // @todo Implement OAuth token renewal
      authURL,
      tokenURL: authURL.replace('/authorize', '/access_token'),
      origin: restApiOrigin,
      restBaseURL: isSelfHosted ? `${restApiOrigin}/api/v3` : restApiOrigin,
      graphqlBaseURL: isSelfHosted ? `${graphqlApiOrigin}/api` : graphqlApiOrigin,
    }),
  );

  Object.assign(graphqlVars, { owner, repo, branch });

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('repositoryInfo', repository);
  }

  return repository;
};

/**
 * Check if the user has access to the current repository.
 * @throws {Error} If the user is not a collaborator of the repository.
 * @see https://docs.github.com/en/rest/collaborators/collaborators#check-if-a-user-is-a-repository-collaborator
 */
const checkRepositoryAccess = async () => {
  const { owner, repo } = repository;
  const userName = /** @type {string} */ (get(user)?.login);

  const { ok } = /** @type {Response} */ (
    await fetchAPI(`/repos/${owner}/${repo}/collaborators/${encodeURIComponent(userName)}`, {
      headers: { Accept: 'application/json' },
      responseType: 'raw',
    })
  );

  if (!ok) {
    throw new Error('Not a collaborator of the repository', {
      cause: new Error(get(_)('repository_no_access', { values: { repo } })),
    });
  }
};

const FETCH_DEFAULT_BRANCH_NAME_QUERY = `
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      defaultBranchRef {
        name
      }
    }
  }
`;

/**
 * Fetch the repository’s default branch name, which is typically `master` or `main`.
 * @returns {Promise<string>} Branch name.
 * @throws {Error} When the repository could not be found, or when the repository is empty.
 */
const fetchDefaultBranchName = async () => {
  const { repo, baseURL = '' } = repository;

  const result = /** @type {{ repository: { defaultBranchRef?: { name: string } } }} */ (
    await fetchGraphQL(FETCH_DEFAULT_BRANCH_NAME_QUERY)
  );

  if (!result.repository) {
    throw new Error('Failed to retrieve the default branch name.', {
      cause: new Error(get(_)('repository_not_found', { values: { repo } })),
    });
  }

  const { name: branch } = result.repository.defaultBranchRef ?? {};

  if (!branch) {
    throw new Error('Failed to retrieve the default branch name.', {
      cause: new Error(get(_)('repository_empty', { values: { repo } })),
    });
  }

  Object.assign(repository, { branch }, getBaseURLs(baseURL, branch));
  Object.assign(graphqlVars, { branch });

  return branch;
};

const FETCH_LAST_COMMIT_QUERY = `
  query($owner: String!, $repo: String!, $branch: String!) {
    repository(owner: $owner, name: $repo) {
      ref(qualifiedName: $branch) {
        target {
          ... on Commit {
            history(first: 1) {
              nodes {
                oid
                message
              }
            }
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
 */
const fetchLastCommit = async () => {
  const { repo, branch } = repository;
  const result = /** @type {LastCommitResponse} */ (await fetchGraphQL(FETCH_LAST_COMMIT_QUERY));

  if (!result.repository) {
    throw new Error('Failed to retrieve the last commit hash.', {
      cause: new Error(get(_)('repository_not_found', { values: { repo } })),
    });
  }

  if (!result.repository.ref) {
    throw new Error('Failed to retrieve the last commit hash.', {
      cause: new Error(get(_)('branch_not_found', { values: { repo, branch } })),
    });
  }

  const { oid: hash, message } = result.repository.ref.target.history.nodes[0];

  return { hash, message };
};

/**
 * Fetch the repository’s complete file list, and return it in the canonical format.
 * @param {string} [lastHash] The last commit’s SHA-1 hash.
 * @returns {Promise<BaseFileListItemProps[]>} File list.
 */
const fetchFileList = async (lastHash) => {
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
const getFileContentsQuery = (chunk, startIndex) => {
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
const parseFileContents = async (fetchingFiles, results) => {
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
const fetchFileContents = async (fetchingFiles) => {
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
 * Fetch an asset as a Blob via the API.
 * @param {Asset} asset Asset to retrieve the file content.
 * @returns {Promise<Blob>} Blob data.
 * @see https://docs.github.com/en/rest/git/blobs#get-a-blob
 */
const fetchBlob = async (asset) => {
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

/**
 * Save entries or assets remotely.
 * @param {FileChange[]} changes File changes to be saved.
 * @param {CommitOptions} options Commit options.
 * @returns {Promise<CommitResults>} Commit results, including the commit SHA and updated file SHAs.
 * @see https://github.blog/changelog/2021-09-13-a-simpler-api-for-authoring-commits/
 * @see https://docs.github.com/en/graphql/reference/mutations#createcommitonbranch
 */
const commitChanges = async (changes, options) => {
  const { owner, repo, branch } = repository;

  const additions = await Promise.all(
    changes
      .filter(({ action }) => ['create', 'update', 'move'].includes(action))
      .map(async ({ path, data }) => ({
        path,
        contents: await encodeBase64(data ?? ''),
      })),
  );

  const deletions = changes
    .filter(({ action }) => ['move', 'delete'].includes(action))
    .map(({ previousPath, path }) => ({ path: previousPath ?? path }));

  // Part of the query to fetch new file SHAs
  const fileShaQuery = additions
    .map(({ path }, index) => `file_${index}: file(path: ${JSON.stringify(path)}) { oid }`)
    .join(' ');

  const query = `
    mutation($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) {
        commit {
          oid
          committedDate
          ${fileShaQuery}
        }
      }
    }
  `;

  const input = {
    branch: {
      repositoryNameWithOwner: `${owner}/${repo}`,
      branchName: branch,
    },
    expectedHeadOid: (await fetchLastCommit()).hash,
    fileChanges: { additions, deletions },
    message: { headline: createCommitMessage(changes, options) },
  };

  const {
    createCommitOnBranch: { commit },
  } = /** @type {{ createCommitOnBranch: { commit: Record<string, any> }}} */ (
    await fetchGraphQL(query, { input })
  );

  return {
    sha: commit.oid,
    date: new Date(commit.committedDate),
    files: Object.fromEntries(
      additions.map(({ path }, index) => [path, { sha: commit[`file_${index}`]?.oid }]),
    ),
  };
};

/**
 * Manually trigger a deployment with GitHub Actions by dispatching the `repository_dispatch` event.
 * @returns {Promise<Response>} Response.
 * @see https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event
 */
const triggerDeployment = async () => {
  const { owner, repo } = repository;

  return /** @type {Promise<Response>} */ (
    fetchAPI(`/repos/${owner}/${repo}/dispatches`, {
      method: 'POST',
      body: { event_type: 'sveltia-cms-publish' },
      responseType: 'raw',
    })
  );
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
  triggerDeployment,
};
