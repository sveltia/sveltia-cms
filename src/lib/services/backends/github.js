import { encodeBase64, getPathInfo } from '@sveltia/utils/file';
import { sleep } from '@sveltia/utils/misc';
import { stripSlashes } from '@sveltia/utils/string';
import mime from 'mime';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import {
  API_CONFIG_INFO_PLACEHOLDER,
  REPOSITORY_INFO_PLACEHOLDER,
} from '$lib/services/backends/shared';
import { fetchAPIWithAuth } from '$lib/services/backends/shared/api';
import { initServerSideAuth } from '$lib/services/backends/shared/auth';
import { createCommitMessage } from '$lib/services/backends/shared/commits';
import { fetchAndParseFiles } from '$lib/services/backends/shared/fetch';
import { siteConfig } from '$lib/services/config';
import { dataLoadedProgress } from '$lib/services/contents';
import { user } from '$lib/services/user';
import { prefs } from '$lib/services/user/prefs';
import { sendRequest } from '$lib/services/utils/networking';

/**
 * @import {
 * ApiEndpointConfig,
 * Asset,
 * AuthTokens,
 * BackendService,
 * BackendServiceStatus,
 * BaseFileListItem,
 * BaseFileListItemProps,
 * CommitOptions,
 * CommitResults,
 * FetchApiOptions,
 * FileChange,
 * RepositoryContentsMap,
 * RepositoryInfo,
 * SignInOptions,
 * User,
 * } from '$lib/types/private';
 */

/**
 * @typedef {object} UserProfileResponse
 * @property {number} id User ID.
 * @property {string} name User’s full name.
 * @property {string} login User’s login name.
 * @property {string} email User’s email address.
 * @property {string} avatar_url URL to the user’s avatar image.
 * @property {string} html_url URL to the user’s profile page.
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

const backendName = 'github';
const label = 'GitHub';
const STATUS_DASHBOARD_URL = 'https://www.githubstatus.com/';
const STATUS_CHECK_URL = 'https://www.githubstatus.com/api/v2/status.json';
const DEFAULT_API_ROOT = 'https://api.github.com';
const DEFAULT_AUTH_ROOT = 'https://api.netlify.com';
const DEFAULT_AUTH_PATH = 'auth';
const DEFAULT_ORIGIN = 'https://github.com';
/** @type {RepositoryInfo} */
const repository = { ...REPOSITORY_INFO_PLACEHOLDER };
/** @type {ApiEndpointConfig} */
const apiConfig = { ...API_CONFIG_INFO_PLACEHOLDER };

/**
 * Check the GitHub service status.
 * @returns {Promise<BackendServiceStatus>} Current status.
 * @see https://www.githubstatus.com/api
 */
const checkStatus = async () => {
  try {
    const {
      status: { indicator },
    } = /** @type {{ status: { indicator: string }}} */ (await sendRequest(STATUS_CHECK_URL));

    if (indicator === 'none') {
      return 'none';
    }

    if (indicator === 'minor') {
      return 'minor';
    }

    if (indicator === 'major' || indicator === 'critical') {
      return 'major';
    }
  } catch {
    //
  }

  return 'unknown';
};

/**
 * Send a request to GitHub REST/GraphQL API.
 * @param {string} path Endpoint.
 * @param {FetchApiOptions} [options] Fetch options.
 * @returns {Promise<object | string | Blob | Response>} Response data or `Response` itself,
 * depending on the `responseType` option.
 * @throws {Error} When there was an error in the API request, e.g. OAuth App access restrictions.
 * @see https://docs.github.com/en/rest
 */
const fetchAPI = async (path, options = {}) => fetchAPIWithAuth(path, options, apiConfig);

/**
 * Send a request to GitHub GraphQL API.
 * @param {string} query Query string.
 * @param {object} [variables] Any variable to be applied.
 * @returns {Promise<object>} Response data.
 * @see https://docs.github.com/en/graphql
 */
const fetchGraphQL = async (query, variables = {}) =>
  /** @type {Promise<object>} */ (fetchAPI('/graphql', { body: { query, variables } }));

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

  if (backend?.name !== backendName) {
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
  const baseURL = `${origin}/${owner}/${repo}`;

  Object.assign(
    repository,
    /** @type {RepositoryInfo} */ ({
      service: backendName,
      label,
      owner,
      repo,
      branch,
      baseURL,
      databaseName: `${backendName}:${owner}/${repo}`,
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

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('repositoryInfo', repository);
  }

  return repository;
};

/**
 * Retrieve the authenticated user’s profile information from GitHub REST API.
 * @param {AuthTokens} tokens Authentication tokens.
 * @returns {Promise<User>} User information.
 * @see https://docs.github.com/en/rest/users/users#get-the-authenticated-user
 */
const getUserProfile = async ({ token }) => {
  const {
    id,
    name,
    login,
    email,
    avatar_url: avatarURL,
    html_url: profileURL,
  } = /** @type {UserProfileResponse} */ (await fetchAPI('/user', { token }));

  return { backendName, id, name, login, email, avatarURL, profileURL, token };
};

/**
 * Retrieve the repository configuration and sign in with GitHub REST API.
 * @param {SignInOptions} options Options.
 * @returns {Promise<User | void>} User info, or nothing when the sign-in flow cannot be started.
 * @throws {Error} When there was an authentication error.
 * @todo Add `refreshToken` support.
 */
const signIn = async ({ token, auto = false }) => {
  if (auto && !token) {
    return undefined;
  }

  if (!token) {
    const { site_domain: siteDomain } = get(siteConfig)?.backend ?? {};
    const { authURL } = apiConfig;

    ({ token } = await initServerSideAuth({
      backendName,
      siteDomain,
      authURL,
      scope: 'repo,user',
    }));
  }

  return getUserProfile({ token });
};

/**
 * Sign out from GitHub. Nothing to do here.
 * @returns {Promise<void>}
 */
const signOut = async () => undefined;

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

/**
 * Fetch the repository’s default branch name, which is typically `master` or `main`.
 * @returns {Promise<string>} Branch name.
 * @throws {Error} When the repository could not be found, or when the repository is empty.
 */
const fetchDefaultBranchName = async () => {
  const { owner, repo, baseURL = '' } = repository;

  const result = /** @type {{ repository: { defaultBranchRef?: { name: string } } }} */ (
    await fetchGraphQL(`
      query {
        repository(owner: "${owner}", name: "${repo}") {
          defaultBranchRef {
            name
          }
        }
      }
    `)
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

  return branch;
};

/**
 * Fetch the last commit on the repository.
 * @returns {Promise<{ hash: string, message: string }>} Commit’s SHA-1 hash and message.
 * @throws {Error} When the branch could not be found.
 */
const fetchLastCommit = async () => {
  const { owner, repo, branch } = repository;

  const result = /** @type {LastCommitResponse} */ (
    await fetchGraphQL(`
      query {
        repository(owner: "${owner}", name: "${repo}") {
          ref(qualifiedName: "${branch}") {
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
    `)
  );

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
  const { owner, repo, branch } = repository;

  const innerQuery = chunk
    .map(({ type, path, sha }, i) => {
      const str = [];
      const index = startIndex + i;

      if (type !== 'asset') {
        str.push(`
          content_${index}: object(oid: "${sha}") {
            ... on Blob { text }
          }
        `);
      }

      str.push(`
        commit_${index}: ref(qualifiedName: "${branch}") {
          target {
            ... on Commit {
              history(first: 1, path: "${path}") {
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
    query {
      repository(owner: "${owner}", name: "${repo}") {
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
    .map(({ path }, index) => `file_${index}: file(path: "${path}") { oid }`)
    .join(' ');

  const {
    createCommitOnBranch: { commit },
  } = /** @type {{ createCommitOnBranch: { commit: Record<string, any> }}} */ (
    await fetchGraphQL(
      `
        mutation ($input: CreateCommitOnBranchInput!) {
          createCommitOnBranch(input: $input) {
            commit {
              oid
              committedDate
              ${fileShaQuery}
            }
          }
        }
      `,
      {
        input: {
          branch: {
            repositoryNameWithOwner: `${owner}/${repo}`,
            branchName: branch,
          },
          expectedHeadOid: (await fetchLastCommit()).hash,
          fileChanges: { additions, deletions },
          message: { headline: createCommitMessage(changes, options) },
        },
      },
    )
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
  name: backendName,
  label,
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
