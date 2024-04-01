import { _ } from 'svelte-i18n';
import { get } from 'svelte/store';
import {
  handleClientSideAuthPopup,
  initClientSideAuth,
  initServerSideAuth,
} from '$lib/services/backends/shared/auth';
import { createCommitMessage } from '$lib/services/backends/shared/commits';
import { fetchAndParseFiles } from '$lib/services/backends/shared/data';
import { siteConfig } from '$lib/services/config';
import { user } from '$lib/services/user';
import { getBase64 } from '$lib/services/utils/files';
import { minifyGraphQLQuery, sendRequest } from '$lib/services/utils/networking';
import { stripSlashes } from '$lib/services/utils/strings';

const backendName = 'gitlab';
const label = 'GitLab';
/** @type {RepositoryInfo} */
const repository = { owner: '', repo: '', branch: '', baseURL: '', branchURL: '' };

/**
 * Send a request to GitLab REST/GraphQL API.
 * @param {string} path - Endpoint.
 * @param {{ method?: string, headers?: any, body?: any }} [init] - Request options.
 * @param {object} [options] - Other options.
 * @param {string} [options.token] - OAuth token.
 * @param {'json' | 'text' | 'blob' | 'raw'} [options.responseType] - Response type. The default is
 *`json`, while `raw` returns a `Response` object as is.
 * @returns {Promise<object | string | Blob | Response>} Response data or `Response` itself,
 * depending on the `responseType` option.
 * @throws {Error} When there was an error in the API request, e.g. OAuth App access restrictions.
 * @see https://docs.gitlab.com/ee/api/rest/
 * @see https://docs.gitlab.com/ee/api/graphql/
 */
const fetchAPI = async (
  path,
  init = {},
  { token = /** @type {string} */ (get(user)?.token), responseType = 'json' } = {},
) => {
  let { api_root: apiRoot } = /** @type {SiteConfig} */ (get(siteConfig)).backend;

  if (apiRoot) {
    // Self-hosted
    apiRoot = `${new URL(apiRoot).origin}/api`;
  } else {
    apiRoot = 'https://gitlab.com/api';
  }

  if (path !== '/graphql') {
    // REST API v4
    apiRoot = `${apiRoot}/v4`;
  }

  init.headers = new Headers(init.headers);
  init.headers.set('Authorization', `Bearer ${token}`);

  return sendRequest(`${apiRoot}${path}`, init, { responseType });
};

/**
 * Send a request to GitLab GraphQL API.
 * @param {string} query - Query string.
 * @param {object} [variables] - Any variable to be applied.
 * @returns {Promise<object>} Response data.
 */
const fetchGraphQL = async (query, variables = {}) => {
  const { data } = /** @type {{ data: object }} */ (
    await fetchAPI('/graphql', {
      method: 'POST',
      body: { query: minifyGraphQLQuery(query), variables },
    })
  );

  return data;
};

/**
 * Initialize the GitLab backend.
 * @throws {Error} When the backend is not configured properly.
 */
const init = () => {
  const {
    repo: projectPath,
    branch,
    api_root: apiRoot, // Self-hosted only
  } = /** @type {SiteConfig} */ (get(siteConfig)).backend;

  const [owner, repo] = /** @type {string} */ (projectPath).split('/');

  if (!repository.owner) {
    const origin = apiRoot ? new URL(apiRoot).origin : 'https://gitlab.com';
    const baseURL = `${origin}/${owner}/${repo}`;
    const branchURL = branch ? `${baseURL}/-/tree/${branch}` : baseURL;

    Object.assign(repository, { owner, repo, branch, baseURL, branchURL });
  }
};

/**
 * Retrieve the repository configuration and sign in with GitLab REST API.
 * @param {SignInOptions} options - Options.
 * @returns {Promise<User | void>} User info, or nothing when finishing PKCE auth flow in a popup.
 * @throws {Error} When there was an authentication error.
 * @see https://docs.gitlab.com/ee/api/users.html#list-current-user
 */
const signIn = async ({ token: cachedToken, auto = false }) => {
  const { origin, hostname } = window.location;

  const {
    site_domain: siteDomain = hostname,
    base_url: baseURL = 'https://gitlab.com',
    auth_endpoint: path = 'oauth/authorize',
    auth_type: authType,
    app_id: clientId = '',
  } = /** @type {SiteConfig} */ (get(siteConfig)).backend;

  const authURL = `${stripSlashes(baseURL)}/${stripSlashes(path)}`;
  const scope = 'api';
  let token = '';

  if (cachedToken) {
    token = cachedToken;
  } else if (authType === 'pkce') {
    if (window.opener?.origin === origin && window.name === 'auth') {
      // We are in the auth popup window; let’s get the OAuth flow done
      await handleClientSideAuthPopup({
        backendName,
        clientId,
        authURL: authURL.replace('/authorize', '/token'),
      });

      return;
    }

    if (auto) {
      return;
    }

    token = await initClientSideAuth({ backendName, clientId, authURL, scope });
  } else {
    if (auto) {
      return;
    }

    token = await initServerSideAuth({ backendName, siteDomain, authURL, scope });
  }

  const {
    name,
    username: login,
    email,
    avatar_url: avatarURL,
    web_url: profileURL,
  } = /** @type {any} */ (await fetchAPI('/user', {}, { token }));

  // eslint-disable-next-line consistent-return
  return {
    backendName,
    token,
    name,
    login,
    email,
    avatarURL,
    profileURL,
  };
};

/**
 * Sign out from GitLab. Nothing to do here.
 * @returns {Promise<void>}
 */
const signOut = async () => undefined;

/**
 * Fetch the repository’s default branch name, which is typically `master` or `main`.
 * @returns {Promise<string>} Branch name.
 * @see https://docs.gitlab.com/ee/api/graphql/reference/#repository
 */
const fetchDefaultBranchName = async () => {
  const { owner, repo } = repository;

  const result = /** @type {{ project: { repository: { rootRef: string } } }} */ (
    await fetchGraphQL(`query {
      project(fullPath: "${owner}/${repo}") {
        repository {
          rootRef
        }
      }
    }`)
  );

  if (!result.project) {
    throw new Error('Failed to retrieve the default branch name.', {
      cause: new Error(get(_)('repository_not_found', { values: { repo } })),
    });
  }

  const { rootRef } = result.project.repository;

  if (!rootRef) {
    throw new Error('Failed to retrieve the default branch name.', {
      cause: new Error(get(_)('repository_empty', { values: { repo } })),
    });
  }

  return rootRef;
};

/**
 * Fetch the latest commit’s SHA-1 hash.
 * @returns {Promise<string>} Hash.
 * @see https://docs.gitlab.com/ee/api/graphql/reference/#tree
 */
const fetchLastCommitHash = async () => {
  const { owner, repo, branch } = repository;

  const result =
    /** @type {{ project: { repository: { tree: { lastCommit: { sha: string }} } } }} */ (
      await fetchGraphQL(`query {
        project(fullPath: "${owner}/${repo}") {
          repository {
            tree(ref: "${branch}") {
              lastCommit {
                sha
              }
            }
          }
        }
      }`)
    );

  const { lastCommit } = result.project.repository.tree;

  if (!lastCommit) {
    throw new Error('Failed to retrieve the last commit hash.', {
      cause: new Error(get(_)('branch_not_found', { values: { repo, branch } })),
    });
  }

  return lastCommit.sha;
};

/**
 * Fetch the repository’s complete file list, and return it in the canonical format.
 * @returns {Promise<BaseFileListItem[]>} File list.
 * @see https://stackoverflow.com/questions/18952935/how-to-get-subfolders-and-files-using-gitlab-api
 */
const fetchFileList = async () => {
  const { owner, repo, branch } = repository;

  const result = /** @type {{ project: { repository: { tree: { blobs: { nodes: any[] }} } } }} */ (
    await fetchGraphQL(`query {
      project(fullPath: "${owner}/${repo}") {
        repository {
          tree(ref: "${branch}", recursive: true) {
            blobs {
              nodes {
                type
                path
                sha
              }
            }
          }
        }
      }
    }`)
  );

  return result.project.repository.tree.blobs.nodes
    .filter(({ type }) => type === 'blob')
    .map(({ path, sha }) => ({ path, sha }));
};

/**
 * Fetch the metadata of entry/asset files as well as text file contents.
 * @param {(BaseEntryListItem | BaseAssetListItem)[]} fetchingFiles - Base entry/asset list items.
 * @returns {Promise<RepositoryContentsMap>} Fetched contents map.
 * @see https://docs.gitlab.com/ee/api/graphql/reference/#repositoryblob
 * @see https://forum.gitlab.com/t/graphql-api-read-raw-file/35389
 * @todo Retrieve commit author and date.
 */
const fetchFileContents = async (fetchingFiles) => {
  const { owner, repo, branch, baseURL } = repository;

  // Fetch all the text contents with the GraphQL API
  const result = /** @type {{ project: { repository: { blobs: { nodes: any[] } } } }} */ (
    await fetchGraphQL(
      `query ($paths: [String!]!) {
        project(fullPath: "${owner}/${repo}") {
          repository {
            blobs(ref: "${branch}", paths: $paths) {
              nodes {
                size
                rawTextBlob
              }
            }
          }
        }
      }`,
      {
        paths: fetchingFiles.map(({ path }) => path),
      },
    )
  );

  return Object.fromEntries(
    fetchingFiles.map(({ path, sha }, index) => {
      const { size, rawTextBlob } = result.project.repository.blobs.nodes[index];

      const data = {
        sha,
        size,
        text: rawTextBlob,
        meta: {
          repoFileURL: `${baseURL}/-/blob/${branch}/${path}`,
        },
      };

      return [path, data];
    }),
  );
};

/**
 * Fetch file list from the backend service, download/parse all the entry files, then cache them in
 * the {@link allEntries} and {@link allAssets} stores.
 */
const fetchFiles = async () => {
  await fetchAndParseFiles({
    backendName,
    repository,
    fetchDefaultBranchName,
    fetchLastCommitHash,
    fetchFileList,
    fetchFileContents,
  });
};

/**
 * Fetch an asset as a Blob via the API.
 * @param {Asset} asset - Asset to retrieve the file content.
 * @returns {Promise<Blob>} Blob data.
 * @see https://docs.gitlab.com/ee/api/repository_files.html#get-raw-file-from-repository
 */
const fetchBlob = async (asset) => {
  const { owner, repo, branch } = repository;
  const { path } = asset;

  return /** @type {Promise<Blob>} */ (
    fetchAPI(
      `/projects/${encodeURIComponent(`${owner}/${repo}`)}/repository/files` +
        `/${encodeURIComponent(path)}/raw?ref=${branch}`,
      {},
      { responseType: 'blob' },
    )
  );
};

/**
 * Save entries or assets remotely. Note that the `commitCreate` GraphQL mutation is broken and
 * images cannot be uploaded properly, so we use the REST API instead.
 * @param {FileChange[]} changes - File changes to be saved.
 * @param {CommitChangesOptions} options - Commit options.
 * @returns {Promise<string>} Commit URL.
 * @see https://gitlab.com/gitlab-org/gitlab/-/merge_requests/31102
 * @see https://docs.gitlab.com/ee/api/graphql/reference/#mutationcommitcreate
 * @see https://forum.gitlab.com/t/how-to-commit-a-image-via-gitlab-commit-api/26632/4
 */
const commitChanges = async (changes, options) => {
  const { owner, repo, branch } = repository;

  const result = /** @type {{ web_url: string }} */ (
    await fetchAPI(`/projects/${encodeURIComponent(`${owner}/${repo}`)}/repository/commits`, {
      method: 'POST',
      body: {
        branch,
        commit_message: createCommitMessage(changes, options),
        actions: await Promise.all(
          changes.map(async ({ action, path, data = '', base64 }) => ({
            action,
            content: base64 ?? (typeof data !== 'string' ? await getBase64(data) : data),
            encoding: base64 || typeof data !== 'string' ? 'base64' : 'text',
            file_path: path,
          })),
        ),
      },
    })
  );

  return result.web_url;
};

/**
 * @type {BackendService}
 */
export default {
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
