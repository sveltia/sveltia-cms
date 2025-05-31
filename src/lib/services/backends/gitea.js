/* eslint-disable no-await-in-loop */

import { decodeBase64, encodeBase64 } from '@sveltia/utils/file';
import { stripSlashes } from '@sveltia/utils/string';
import { _ } from 'svelte-i18n';
import { get } from 'svelte/store';
import {
  handleClientSideAuthPopup,
  initClientSideAuth,
  refreshAccessToken,
} from '$lib/services/backends/shared/auth';
import { createCommitMessage } from '$lib/services/backends/shared/commits';
import { fetchAndParseFiles } from '$lib/services/backends/shared/data';
import { siteConfig } from '$lib/services/config';
import { dataLoadedProgress } from '$lib/services/contents';
import { user } from '$lib/services/user';
import { prefs } from '$lib/services/user/prefs';
import { sendRequest } from '$lib/services/utils/networking';

/**
 * @import {
 * Asset,
 * BackendService,
 * BaseAssetListItem,
 * BaseEntryListItem,
 * BaseFileListItem,
 * CommitChangesOptions,
 * FileChange,
 * InternalSiteConfig,
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

const backendName = 'gitea';
const label = 'Gitea';
const apiRootDefault = 'https://gitea.com/api/v1';
/**
 * Minimum supported Gitea version. We require at least 1.24 to use the new `file-contents` API
 * endpoint.
 * @see https://github.com/go-gitea/gitea/pull/34139
 */
const minSupportedVersion = 1.24;
/** @type {any} */
let repositoryResponseCache = null;

/**
 * @type {{ origin: string, rest: string, isSelfHosted: boolean }}
 */
const apiConfig = {
  origin: '',
  rest: '',
  isSelfHosted: false,
};

/**
 * @type {RepositoryInfo}
 */
const repository = new Proxy(/** @type {any} */ ({}), {
  /**
   * Define the getter.
   * @param {Record<string, any>} obj Object itself.
   * @param {string} key Property name.
   * @returns {any} Property value.
   */
  get: (obj, key) => {
    if (key in obj) {
      return obj[key];
    }

    const { baseURL, branch } = obj;

    if (key === 'treeBaseURL') {
      return branch ? `${baseURL}/src/branch/${branch}` : baseURL;
    }

    if (key === 'blobBaseURL') {
      return branch ? `${baseURL}/src/branch/${branch}` : '';
    }

    return undefined;
  },
});

/**
 * Get the OAuth authentication properties for Gitea.
 * @returns {{ clientId: string, authURL: string, tokenURL: string }} Authentication properties.
 */
const getAuthProps = () => {
  const {
    base_url: baseURL = 'https://gitea.com',
    auth_endpoint: authPath = 'login/oauth/authorize',
    app_id: clientId = '',
  } = /** @type {InternalSiteConfig} */ (get(siteConfig)).backend;

  const authURL = `${stripSlashes(baseURL)}/${stripSlashes(authPath)}`;
  const tokenURL = authURL.replace('/authorize', '/access_token');

  return { clientId, authURL, tokenURL };
};

/**
 * Send a request to Gitea REST API.
 * @param {string} path Endpoint.
 * @param {{ method?: string, headers?: any, body?: any }} [init] Request options.
 * @param {object} [options] Other options.
 * @param {string} [options.token] OAuth access token. If not provided, it will be taken from the
 * `user` store.
 * @param {string} [options.refreshToken] OAuth refresh token. If not provided, it will be taken
 * from the `user` store.
 * @param {'json' | 'text' | 'blob' | 'raw'} [options.responseType] Response type. The default is
 *`json`, while `raw` returns a `Response` object as is.
 * @returns {Promise<object | string | Blob | Response>} Response data or `Response` itself,
 * depending on the `responseType` option.
 * @throws {Error} When there was an error in the API request, e.g. OAuth App access restrictions.
 * @see https://docs.gitea.com/api/1.24/
 */
const fetchAPI = async (
  path,
  init = {},
  { token = undefined, refreshToken = undefined, responseType = 'json' } = {},
) => {
  const { rest: apiRoot } = apiConfig;
  const _user = get(user);

  token ??= _user?.token;
  refreshToken ??= _user?.refreshToken;

  init.headers = new Headers(init.headers);
  init.headers.set('Authorization', `token ${token}`);

  return sendRequest(`${apiRoot}${path}`, init, {
    responseType,
    refreshAccessToken: refreshToken
      ? () => refreshAccessToken({ ...getAuthProps(), refreshToken })
      : undefined,
  });
};

/**
 * Get the configured repository's basic information.
 * @returns {RepositoryInfo} Repository info.
 */
const getRepositoryInfo = () => {
  const { repo: projectPath, branch } = /** @type {InternalSiteConfig} */ (get(siteConfig)).backend;
  const { origin, isSelfHosted } = apiConfig;
  const [owner, repo] = /** @type {string} */ (projectPath).split('/');

  return Object.assign(repository, {
    service: backendName,
    label,
    owner,
    repo,
    branch,
    baseURL: `${origin}/${owner}/${repo}`,
    databaseName: `${backendName}:${owner}/${repo}`,
    isSelfHosted,
  });
};

/**
 * Initialize the Gitea backend.
 */
const init = () => {
  const { name, api_root: restApiRoot = apiRootDefault } = get(siteConfig)?.backend ?? {};

  if (name === backendName) {
    // Developers may misconfigure custom API roots, so we use the origin to redefine them
    const restApiOrigin = new URL(restApiRoot).origin;
    const isSelfHosted = restApiRoot !== apiRootDefault;

    Object.assign(apiConfig, {
      origin: restApiOrigin,
      rest: `${restApiOrigin}/api/v1`,
      isSelfHosted,
    });
  }

  const repositoryInfo = getRepositoryInfo();

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('repositoryInfo', repositoryInfo);
  }
};

/**
 * Retrieve the repository configuration and sign in with Gitea REST API.
 * @param {SignInOptions} options Options.
 * @returns {Promise<User | void>} User info, or nothing when finishing PKCE auth flow in a popup or
 * the sign-in flow cannot be started.
 * @throws {Error} When there was an authentication error.
 * @see https://docs.gitea.com/api/1.24/#tag/user/operation/userGetCurrent
 */
const signIn = async ({ token, refreshToken, auto = false }) => {
  if (!token) {
    const { origin } = window.location;
    const { clientId, authURL, tokenURL } = getAuthProps();
    const scope = 'read:repository,write:repository,read:user';
    const inPopup = window.opener?.origin === origin && window.name === 'auth';

    if (inPopup) {
      // We are in the auth popup window; let's get the OAuth flow done
      await handleClientSideAuthPopup({ backendName, clientId, tokenURL });
    }

    if (inPopup || auto) {
      return undefined;
    }

    ({ token, refreshToken } = await initClientSideAuth({ backendName, clientId, authURL, scope }));
  }

  const {
    id,
    full_name: name,
    login,
    email,
    avatar_url: avatarURL,
    html_url: profileURL,
  } = /** @type {any} */ (await fetchAPI('/user', {}, { token, refreshToken }));

  const _user = get(user);

  // Update the tokens because these may have been renewed in `refreshAccessToken` while fetching
  // the user info
  if (_user?.token && _user.token !== token) {
    token = _user.token;
    refreshToken = _user.refreshToken;
  }

  return {
    backendName,
    token,
    refreshToken,
    id,
    name,
    login,
    email,
    avatarURL,
    profileURL,
  };
};

/**
 * Sign out from Gitea. Nothing to do here.
 * @returns {Promise<void>}
 */
const signOut = async () => undefined;

/**
 * Check if the Gitea version is supported.
 * @throws {Error} When the Gitea version is unsupported. Also when we detect Forgejo, which is a
 * hard fork of Gitea that we do not support yet.
 * @see https://docs.gitea.com/api/1.24/#tag/miscellaneous/operation/getVersion
 * @see https://github.com/sveltia/sveltia-cms/issues/381
 */
const checkGiteaVersion = async () => {
  const { version } = /** @type {{ version: string }} */ (await fetchAPI('/version'));

  // Check if it’s Forgejo. The `version` will look like `11.0.1-46-17b3302+gitea-1.22.0`
  if (version.includes('+gitea-')) {
    throw new Error('Unsupported Forgejo version', {
      cause: new Error(get(_)('backend_unsupported_forgejo')),
    });
  }

  // Otherwise it’s Gitea, so we can just compare the version number
  if (Number.parseFloat(version) < minSupportedVersion) {
    throw new Error('Unsupported Gitea version', {
      cause: new Error(
        get(_)('backend_unsupported_version', {
          values: { name: label, version: minSupportedVersion },
        }),
      ),
    });
  }
};

/**
 * Check if the user has access to the current repository.
 * @throws {Error} If the user is not a collaborator of the repository.
 * @see https://docs.gitea.com/api/1.24/#tag/repository/operation/repoGet
 */
const checkRepositoryAccess = async () => {
  const { owner, repo } = repository;

  try {
    // Cache the repository response to avoid multiple API calls
    repositoryResponseCache = /** @type {any} */ (await fetchAPI(`/repos/${owner}/${repo}`));

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
 * Fetch the repository's default branch name, which is typically `master` or `main`.
 * @returns {Promise<string>} Branch name.
 * @throws {Error} When the repository could not be found, or when the repository is empty.
 * @see https://docs.gitea.com/api/1.24/#tag/repository/operation/repoGet
 */
const fetchDefaultBranchName = async () => {
  const { owner, repo } = repository;

  try {
    const { default_branch: defaultBranch } =
      repositoryResponseCache ?? /** @type {any} */ (await fetchAPI(`/repos/${owner}/${repo}`));

    if (!defaultBranch) {
      throw new Error('Failed to retrieve the default branch name.', {
        cause: new Error(get(_)('repository_empty', { values: { repo } })),
      });
    }

    return defaultBranch;
  } catch (error) {
    throw new Error('Failed to retrieve the default branch name.', {
      cause: new Error(get(_)('repository_not_found', { values: { repo } })),
    });
  }
};

/**
 * Fetch the last commit on the repository.
 * @returns {Promise<{ hash: string, message: string }>} Commit's SHA-1 hash and message.
 * @throws {Error} When the branch could not be found.
 * @see https://docs.gitea.com/api/1.24/#tag/repository/operation/repoGetSingleCommit
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
 * Fetch the repository's complete file list, and return it in the canonical format.
 * @param {string} [lastHash] The last commit’s SHA-1 hash.
 * @returns {Promise<BaseFileListItem[]>} File list.
 * @see https://docs.gitea.com/api/1.24/#tag/repository/operation/GetTree
 */
const fetchFileList = async (lastHash) => {
  const { owner, repo, branch } = repository;
  /** @type {PartialGitEntry[]} */
  const gitEntries = [];
  let page = 1;

  for (;;) {
    // 1000 items per page
    const result = /** @type {{ tree: PartialGitEntry[], truncated: boolean }} */ (
      await fetchAPI(
        `/repos/${owner}/${repo}/git/trees/${lastHash ?? branch}?recursive=1&page=${page}`,
      )
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
    .map(({ path, sha, size }) => ({ path, sha, size }));
};

/**
 * Fetch the metadata of entry/asset files as well as text file contents.
 * @param {(BaseEntryListItem | BaseAssetListItem)[]} fetchingFiles Base entry/asset list items.
 * @returns {Promise<RepositoryContentsMap>} Fetched contents map.
 * @see https://github.com/go-gitea/gitea/pull/34139
 */
const fetchFileContents = async (fetchingFiles) => {
  const { owner, repo, branch } = repository;
  const allPaths = fetchingFiles.filter(({ type }) => type === 'entry').map(({ path }) => path);
  /** @type {PartialContentsListItem[]} */
  const results = [];
  const paths = [...allPaths];

  dataLoadedProgress.set(0);

  // Check how many files we can fetch at once (default is 30)
  const { default_paging_num: perPage = 30 } = /** @type {any} */ (await fetchAPI('/settings/api'));

  // Use the new bulk API endpoint to fetch multiple files at once
  for (;;) {
    const result = /** @type {PartialContentsListItem[]} */ (
      await fetchAPI(`/repos/${owner}/${repo}/file-contents?ref=${branch}`, {
        method: 'POST',
        body: {
          files: paths.splice(0, perPage),
        },
      })
    );

    results.push(...result);
    dataLoadedProgress.set(Math.ceil(((allPaths.length - paths.length) / allPaths.length) * 100));

    if (!paths.length) {
      break;
    }
  }

  dataLoadedProgress.set(undefined);

  return Object.fromEntries(
    await Promise.all(
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
    ),
  );
};

/**
 * Fetch file list from the backend service, download/parse all the entry files, then cache them in
 * the {@link allEntries} and {@link allAssets} stores.
 */
const fetchFiles = async () => {
  await checkGiteaVersion();
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
 * @see https://docs.gitea.com/api/1.24/#tag/repository/operation/repoGetRawFile
 */
const fetchBlob = async (asset) => {
  const { owner, repo, branch = '' } = repository;
  const { path } = asset;

  return /** @type {Promise<Blob>} */ (
    fetchAPI(
      `/repos/${owner}/${repo}/media/${encodeURIComponent(path)}?ref=${branch}`,
      {},
      { responseType: 'blob' },
    )
  );
};

/**
 * Save entries or assets remotely.
 * @param {FileChange[]} changes File changes to be saved.
 * @param {CommitChangesOptions} options Commit options.
 * @returns {Promise<string>} Commit URL.
 * @see https://docs.gitea.com/api/1.24/#tag/repository/operation/repoChangeFiles
 */
const commitChanges = async (changes, options) => {
  const { owner, repo, branch } = repository;
  const commitMessage = createCommitMessage(changes, options);
  const { name, email } = /** @type {any} */ (get(user));
  const date = new Date().toJSON();

  const result = /** @type {{ commit: { html_url: string } }} */ (
    await fetchAPI(`/repos/${owner}/${repo}/contents`, {
      method: 'POST',
      body: {
        branch,
        author: { name, email },
        committer: { name, email },
        dates: { author: date, committer: date },
        message: commitMessage,
        files: await Promise.all(
          changes.map(async ({ action, path, previousPath, data = '', base64 }) => ({
            operation: action === 'move' ? 'update' : action,
            path,
            content: base64 ?? (await encodeBase64(data)),
            from_path: previousPath,
          })),
        ),
      },
    })
  );

  return result.commit.html_url;
};

/**
 * @type {BackendService}
 */
export default {
  isGit: true,
  name: backendName,
  label,
  repository,
  getRepositoryInfo,
  init,
  signIn,
  signOut,
  fetchFiles,
  fetchBlob,
  commitChanges,
};
