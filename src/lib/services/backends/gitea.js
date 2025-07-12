/* eslint-disable no-await-in-loop */

import { decodeBase64, encodeBase64, getPathInfo } from '@sveltia/utils/file';
import { stripSlashes } from '@sveltia/utils/string';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import {
  API_CONFIG_INFO_PLACEHOLDER,
  REPOSITORY_INFO_PLACEHOLDER,
} from '$lib/services/backends/shared';
import { fetchAPIWithAuth } from '$lib/services/backends/shared/api';
import { handleClientSideAuthPopup, initClientSideAuth } from '$lib/services/backends/shared/auth';
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
 * AuthTokens,
 * BackendService,
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
 * @typedef {{ type: string, path: string, sha: string, size: number }} PartialGitEntry
 */

/**
 * @typedef {{ content: string | null, encoding: 'base64' | null } | null} PartialContentsListItem
 */

/**
 * @typedef {object} CommitResponse
 * @property {object} commit Commit information, including the commit SHA and creation date.
 * @property {string} commit.sha Commit SHA.
 * @property {string} commit.created Commit creation date in ISO format.
 * @property {{ path: string, sha: string }[]} files List of saved files, each with its path and
 * SHA.
 */

const backendName = 'gitea';
const label = 'Gitea / Forgejo';
const DEFAULT_API_ROOT = 'https://gitea.com/api/v1';
const DEFAULT_AUTH_ROOT = 'https://gitea.com';
const DEFAULT_AUTH_PATH = 'login/oauth/authorize';
/** @type {RepositoryInfo} */
const repository = { ...REPOSITORY_INFO_PLACEHOLDER };
/** @type {ApiEndpointConfig} */
const apiConfig = { ...API_CONFIG_INFO_PLACEHOLDER };
/**
 * Minimum supported Gitea version. We require at least 1.24 to use the new `file-contents` API
 * endpoint.
 * @see https://github.com/go-gitea/gitea/pull/34139
 */
const MIN_GITEA_VERSION = 1.24;
/**
 * Minimum supported Forgejo version. We require at least 12.0 to use the new `git/blobs` API
 * endpoint.
 * @see https://codeberg.org/forgejo/forgejo/pulls/8139
 */
const MIN_FORGEJO_VERSION = 12;
/**
 * Flag to indicate if the backend is Forgejo. This is used to determine which API endpoints to use,
 * as Gitea and Forgejo have different endpoints for fetching file contents.
 * @type {boolean}
 */
let isForgejo = false;
/** @type {Record<string, any> | null} */
let repositoryResponseCache = null;
/**
 * Send a request to Gitea/Forgejo REST API.
 * @param {string} path Endpoint.
 * @param {FetchApiOptions} [options] Fetch options.
 * @returns {Promise<object | string | Blob | Response>} Response data or `Response` itself,
 * depending on the `responseType` option.
 * @throws {Error} When there was an error in the API request, e.g. OAuth App access restrictions.
 * @see https://docs.gitea.com/api/next/
 */
const fetchAPI = async (path, options = {}) => fetchAPIWithAuth(path, options, apiConfig);

/**
 * Generate base URLs for accessing the repository’s resources.
 * @param {string} baseURL The name of the repository.
 * @param {string} [branch] The branch name. Could be `undefined` if the branch is not specified in
 * the site configuration.
 * @returns {{ treeBaseURL: string, blobBaseURL: string }} An object containing the tree base URL
 * for browsing files, and the blob base URL for accessing file contents.
 */
const getBaseURLs = (baseURL, branch) => ({
  treeBaseURL: branch ? `${baseURL}/src/branch/${branch}` : baseURL,
  blobBaseURL: branch ? `${baseURL}/src/branch/${branch}` : '',
});

/**
 * Initialize the Gitea/Forgejo backend.
 * @returns {RepositoryInfo | undefined} Repository info, or nothing when the configured backend is
 * not Gitea/Forgejo.
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
    app_id: clientId = '',
    api_root: restApiRoot = DEFAULT_API_ROOT,
  } = backend;

  const authURL = `${stripSlashes(authRoot)}/${stripSlashes(authPath)}`;
  // Developers may misconfigure custom API roots, so we use the origin to redefine them
  const restApiOrigin = new URL(restApiRoot).origin;
  const [owner, repo] = /** @type {string} */ (projectPath).split('/');
  const baseURL = `${restApiOrigin}/${owner}/${repo}`;

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
      isSelfHosted: restApiRoot !== DEFAULT_API_ROOT,
    }),
    getBaseURLs(baseURL, branch),
  );

  Object.assign(
    apiConfig,
    /** @type {ApiEndpointConfig} */ ({
      clientId,
      authURL,
      tokenURL: authURL.replace('/authorize', '/access_token'),
      origin: restApiOrigin,
      restBaseURL: `${restApiOrigin}/api/v1`,
    }),
  );

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('repositoryInfo', repository);
  }

  return repository;
};

/**
 * Retrieve the authenticated user’s profile information.
 * @param {AuthTokens} tokens Authentication tokens.
 * @returns {Promise<User>} User information.
 * @see https://docs.gitea.com/api/next/#tag/user/operation/userGetCurrent
 */
const getUserProfile = async ({ token, refreshToken }) => {
  const {
    id,
    full_name: name,
    login,
    email,
    avatar_url: avatarURL,
    html_url: profileURL,
  } = /** @type {any} */ (await fetchAPI('/user', { token, refreshToken }));

  const _user = get(user);

  // Update the tokens because these may have been renewed in `refreshAccessToken` while fetching
  // the user info
  if (_user?.token && _user.token !== token) {
    token = _user.token;
    refreshToken = _user.refreshToken;
  }

  return { backendName, id, name, login, email, avatarURL, profileURL, token, refreshToken };
};

/**
 * Retrieve the repository configuration and sign in with the Gitea/Forgejo REST API.
 * @param {SignInOptions} options Options.
 * @returns {Promise<User | void>} User info, or nothing when finishing PKCE auth flow in a popup or
 * the sign-in flow cannot be started.
 * @throws {Error} When there was an authentication error.
 */
const signIn = async ({ token, refreshToken, auto = false }) => {
  if (!token) {
    const { origin } = window.location;
    const { clientId, authURL, tokenURL } = apiConfig;
    const scope = 'read:repository,write:repository,read:user';
    const inPopup = window.opener?.origin === origin && window.name === 'auth';

    if (inPopup) {
      // We are in the auth popup window; let’s get the OAuth flow done
      await handleClientSideAuthPopup({ backendName, clientId, tokenURL });
    }

    if (inPopup || auto) {
      return undefined;
    }

    ({ token, refreshToken } = await initClientSideAuth({ backendName, clientId, authURL, scope }));
  }

  return getUserProfile({ token, refreshToken });
};

/**
 * Sign out from the backend. Nothing to do here.
 * @returns {Promise<void>}
 */
const signOut = async () => undefined;

/**
 * Check if the version of the user’s Gitea/Forgejo instance is supported. The API endpoint requires
 * authentication, meaning the user must be signed in before calling this function.
 * @throws {Error} When the detected version is unsupported.
 * @see https://docs.gitea.com/api/next/#tag/miscellaneous/operation/getVersion
 */
const checkInstanceVersion = async () => {
  const { version } = /** @type {{ version: string }} */ (await fetchAPI('/version'));

  // Check if the instance is Forgejo by looking for the `+gitea-` fork indicator in the version
  // string. Forgejo versions look like `11.0.1-87-5e379c9+gitea-1.22.0`.
  isForgejo = version.includes('+gitea-');

  const name = isForgejo ? 'Forgejo' : 'Gitea';
  const minVersion = isForgejo ? MIN_FORGEJO_VERSION : MIN_GITEA_VERSION;

  Object.assign(repository, { label: name });

  if (Number.parseFloat(version) < minVersion) {
    throw new Error(`Unsupported ${name} version`, {
      cause: new Error(
        get(_)('backend_unsupported_version', {
          values: { name, version: minVersion },
        }),
      ),
    });
  }
};

/**
 * Get the repository information.
 * @returns {Promise<Record<string, any>>} Repository information.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGet
 */
const getRepositoryInfo = async () => {
  const { owner, repo } = repository;

  return /** @type {Promise<Record<string, any>>} */ (fetchAPI(`/repos/${owner}/${repo}`));
};

/**
 * Check if the user has access to the current repository.
 * @throws {Error} If the user is not a collaborator of the repository.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGet
 */
const checkRepositoryAccess = async () => {
  const { repo } = repository;

  try {
    // Cache the repository response to avoid multiple API calls
    repositoryResponseCache ??= await getRepositoryInfo();

    const { permissions } = repositoryResponseCache;

    if (!permissions?.pull) {
      throw new Error('Not a collaborator of the repository', {
        cause: new Error(get(_)('repository_no_access', { values: { repo } })),
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Not a collaborator')) {
      throw error;
    }

    throw new Error('Failed to check repository access', {
      cause: new Error(get(_)('repository_not_found', { values: { repo } })),
    });
  }
};

/**
 * Fetch the repository’s default branch name, which is typically `master` or `main`.
 * @returns {Promise<string>} Branch name.
 * @throws {Error} When the repository could not be found, or when the repository is empty.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGet
 */
const fetchDefaultBranchName = async () => {
  const { repo, baseURL = '' } = repository;

  try {
    // Cache the repository response to avoid multiple API calls
    repositoryResponseCache ??= await getRepositoryInfo();

    const { default_branch: branch } = repositoryResponseCache;

    if (!branch) {
      throw new Error('Failed to retrieve the default branch name.', {
        cause: new Error(get(_)('repository_empty', { values: { repo } })),
      });
    }

    Object.assign(repository, { branch }, getBaseURLs(baseURL, branch));

    return branch;
  } catch (error) {
    throw new Error('Failed to retrieve the default branch name.', {
      cause: new Error(get(_)('repository_not_found', { values: { repo } })),
    });
  }
};

/**
 * Fetch the last commit on the repository.
 * @returns {Promise<{ hash: string, message: string }>} Commit’s SHA-1 hash and message.
 * @throws {Error} When the branch could not be found.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetSingleCommit
 */
const fetchLastCommit = async () => {
  const { owner, repo, branch } = repository;

  try {
    const {
      commit: { id: hash, message },
    } = /** @type {any} */ (await fetchAPI(`/repos/${owner}/${repo}/branches/${branch}`));

    return { hash, message };
  } catch (error) {
    throw new Error('Failed to retrieve the last commit hash.', {
      cause: new Error(get(_)('branch_not_found', { values: { repo, branch } })),
    });
  }
};

/**
 * Fetch the repository’s complete file list, and return it in the canonical format.
 * @param {string} [lastHash] The last commit’s SHA-1 hash.
 * @returns {Promise<BaseFileListItemProps[]>} File list.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/GetTree
 */
const fetchFileList = async (lastHash) => {
  const { owner, repo, branch } = repository;
  const requestPath = `/repos/${owner}/${repo}/git/trees/${lastHash ?? branch}?recursive=1`;
  /** @type {PartialGitEntry[]} */
  const gitEntries = [];
  let page = 1;

  for (;;) {
    // 1000 items per page
    const result = /** @type {{ tree: PartialGitEntry[], truncated: boolean }} */ (
      await fetchAPI(`${requestPath}&page=${page}`)
    );

    gitEntries.push(...result.tree);

    if (result.truncated) {
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
const parseFileContents = async (fetchingFiles, results) => {
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
const fetchFileContents = async (fetchingFiles) => {
  const { owner, repo, branch } = repository;

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
  const { default_paging_num: perPage = 30 } = /** @type {any} */ (await fetchAPI('/settings/api'));

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
const fetchFiles = async () => {
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
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetRawFile
 */
const fetchBlob = async (asset) => {
  const { owner, repo, branch = '' } = repository;
  const { path } = asset;

  return /** @type {Promise<Blob>} */ (
    fetchAPI(`/repos/${owner}/${repo}/media/${encodeURIComponent(path)}?ref=${branch}`, {
      responseType: 'blob',
    })
  );
};

/**
 * Save entries or assets remotely.
 * @param {FileChange[]} changes File changes to be saved.
 * @param {CommitOptions} options Commit options.
 * @returns {Promise<CommitResults>} Commit results, including the commit SHA and updated file SHAs.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoChangeFiles
 */
const commitChanges = async (changes, options) => {
  const { owner, repo, branch } = repository;
  const commitMessage = createCommitMessage(changes, options);
  const { name, email } = /** @type {any} */ (get(user));
  const date = new Date().toJSON();

  const files = await Promise.all(
    changes.map(async ({ action, path, previousPath, previousSha, data = '' }) => ({
      operation: action === 'move' ? 'update' : action,
      path,
      content: await encodeBase64(data),
      from_path: previousPath,
      sha: previousSha,
    })),
  );

  const { commit, files: savedFiles } = /** @type {CommitResponse} */ (
    await fetchAPI(`/repos/${owner}/${repo}/contents`, {
      method: 'POST',
      body: {
        branch,
        author: { name, email },
        committer: { name, email },
        dates: { author: date, committer: date },
        message: commitMessage,
        files,
      },
    })
  );

  return {
    sha: commit.sha,
    date: new Date(commit.created),
    files: Object.fromEntries(savedFiles.map(({ path, sha }) => [path, { sha }])),
  };
};

/**
 * @type {BackendService}
 */
export default {
  isGit: true,
  name: backendName,
  label,
  repository,
  init,
  signIn,
  signOut,
  fetchFiles,
  fetchBlob,
  commitChanges,
};
