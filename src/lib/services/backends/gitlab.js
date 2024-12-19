/* eslint-disable no-await-in-loop */

import { getBase64 } from '@sveltia/utils/file';
import { stripSlashes } from '@sveltia/utils/string';
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
import { dataLoadedProgress } from '$lib/services/contents';
import { user } from '$lib/services/user';
import { sendRequest } from '$lib/services/utils/networking';

const backendName = 'gitlab';
const label = 'GitLab';
const statusDashboardURL = 'https://status.gitlab.com/';
const statusCheckURL = 'https://status-api.hostedstatus.com/1.0/status/5b36dc6502d06804c08349f7';

/**
 * @type {RepositoryInfo}
 */
const repository = new Proxy(/** @type {any} */ ({}), {
  /**
   * Define the getter.
   * @param {Record<string, any>} obj - Object itself.
   * @param {string} key - Property name.
   * @returns {any} Property value.
   */
  get: (obj, key) => {
    if (key in obj) {
      return obj[key];
    }

    const { baseURL, branch } = obj;

    if (key === 'treeBaseURL') {
      return branch ? `${baseURL}/-/tree/${branch}` : baseURL;
    }

    if (key === 'blobBaseURL') {
      return branch ? `${baseURL}/-/blob/${branch}` : '';
    }

    return undefined;
  },
});

/**
 * Check the GitLab service status.
 * @returns {Promise<BackendServiceStatus>} Current status.
 * @see https://kb.status.io/developers/public-status-api/
 */
const checkStatus = async () => {
  try {
    const {
      result: {
        status_overall: { status_code: status },
      },
    } = /** @type {{ result: { status_overall: { status_code: number } } }} */ (
      await sendRequest(statusCheckURL)
    );

    if (status === 100) {
      return 'none';
    }

    if ([200, 300, 400].includes(status)) {
      return 'minor';
    }

    if ([500, 600].includes(status)) {
      return 'major';
    }
  } catch {
    //
  }

  return 'unknown';
};

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
      body: {
        // Remove line breaks and subsequent space characters; we must be careful as file paths may
        // contain spaces
        query: query.replace(/\n\s*/g, ' '),
        variables,
      },
    })
  );

  return data;
};

/**
 * Get the configured repository’s basic information.
 * @returns {RepositoryInfo} Repository info.
 */
const getRepositoryInfo = () => {
  const {
    repo: projectPath,
    branch,
    api_root: apiRoot, // Self-hosted only
  } = /** @type {SiteConfig} */ (get(siteConfig)).backend;

  /**
   * In GitLab terminology, an owner is called a namespace, and a repository is called a project. A
   * namespace can contain a group and a subgroup concatenated with a `/` so we cannot simply use
   * `split('/')` here. A project name should not contain a `/`.
   * @see https://docs.gitlab.com/ee/user/namespace/
   * @see https://gitlab.com/gitlab-org/gitlab/-/merge_requests/80055
   */
  const { owner, repo } =
    /** @type {string} */ (projectPath).match(/(?<owner>.+)\/(?<repo>[^/]+)$/)?.groups ?? {};

  const origin = apiRoot ? new URL(apiRoot).origin : 'https://gitlab.com';

  return Object.assign(repository, {
    service: backendName,
    label,
    owner,
    repo,
    branch,
    baseURL: `${origin}/${owner}/${repo}`,
    databaseName: `${backendName}:${owner}/${repo}`,
  });
};

/**
 * Initialize the GitLab backend.
 */
const init = () => {
  getRepositoryInfo();
};

/**
 * Retrieve the repository configuration and sign in with GitLab REST API.
 * @param {SignInOptions} options - Options.
 * @returns {Promise<User | void>} User info, or nothing when finishing PKCE auth flow in a popup or
 * the sign-in flow cannot be started.
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

      return void 0;
    }

    if (auto) {
      return void 0;
    }

    token = await initClientSideAuth({ backendName, clientId, authURL, scope });
  } else {
    if (auto) {
      return void 0;
    }

    token = await initServerSideAuth({ backendName, siteDomain, authURL, scope });
  }

  const {
    id,
    name,
    username: login,
    email,
    avatar_url: avatarURL,
    web_url: profileURL,
  } = /** @type {any} */ (await fetchAPI('/user', {}, { token }));

  return {
    backendName,
    token,
    id,
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
const signOut = async () => void 0;

/**
 * Check if the user has access to the current repository.
 * @throws {Error} If the user is not a collaborator of the repository.
 * @see https://docs.gitlab.com/ee/api/members.html#get-a-member-of-a-group-or-project-including-inherited-and-invited-members
 */
const checkRepositoryAccess = async () => {
  const { owner, repo } = repository;
  const userId = /** @type {number} */ (get(user)?.id);

  const { ok } = /** @type {Response} */ (
    await fetchAPI(
      `/projects/${encodeURIComponent(`${owner}/${repo}`)}/members/all/${userId}`,
      { headers: { Accept: 'application/json' } },
      { responseType: 'raw' },
    )
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
 * @see https://docs.gitlab.com/ee/api/graphql/reference/#repository
 */
const fetchDefaultBranchName = async () => {
  const { owner, repo } = repository;

  const result = /** @type {{ project: { repository: { rootRef: string } } }} */ (
    await fetchGraphQL(`
      query {
        project(fullPath: "${owner}/${repo}") {
          repository {
            rootRef
          }
        }
      }
    `)
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
 * Fetch the last commit on the repository.
 * @returns {Promise<{ hash: string, message: string }>} Commit’s SHA-1 hash and message.
 * @throws {Error} When the branch could not be found.
 * @see https://docs.gitlab.com/ee/api/graphql/reference/#tree
 */
const fetchLastCommit = async () => {
  const { owner, repo, branch } = repository;

  /**
   * @type {{ project: { repository: { tree: { lastCommit: { sha: string, message: string }} } } }}
   */
  const result = /** @type {any} */ (
    await fetchGraphQL(`
      query {
        project(fullPath: "${owner}/${repo}") {
          repository {
            tree(ref: "${branch}") {
              lastCommit {
                sha
                message
              }
            }
          }
        }
      }
    `)
  );

  if (!result.project) {
    throw new Error('Failed to retrieve the last commit hash.', {
      cause: new Error(get(_)('repository_not_found', { values: { repo } })),
    });
  }

  const { lastCommit } = result.project.repository?.tree ?? {};

  if (!lastCommit) {
    throw new Error('Failed to retrieve the last commit hash.', {
      cause: new Error(get(_)('branch_not_found', { values: { repo, branch } })),
    });
  }

  const { sha: hash, message } = lastCommit;

  return { hash, message };
};

/**
 * Fetch the repository’s complete file list, and return it in the canonical format.
 * @returns {Promise<BaseFileListItem[]>} File list.
 * @see https://docs.gitlab.com/ee/api/graphql/reference/index.html#repositorytree
 * @see https://stackoverflow.com/questions/18952935/how-to-get-subfolders-and-files-using-gitlab-api
 */
const fetchFileList = async () => {
  const { owner, repo, branch } = repository;
  /** @type {{ type: string, path: string, sha: string }[]} */
  const blobs = [];
  let cursor = '';

  // Since GitLab has a limit of 100 records per query, use pagination to fetch all the files
  for (;;) {
    const result = //
      /**
       * @type {{ project: { repository: { tree: { blobs: {
       * nodes: { type: string, path: string, sha: string }[],
       * pageInfo: { endCursor: string, hasNextPage: boolean }
       * } } } } }}
       */ (
        await fetchGraphQL(`
          query {
            project(fullPath: "${owner}/${repo}") {
              repository {
                tree(ref: "${branch}", recursive: true) {
                  blobs(after: "${cursor}") {
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
        `)
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

  // The `size` is not available here; it will be retrieved in `fetchFileContents` below.
  return blobs.filter(({ type }) => type === 'blob').map(({ path, sha }) => ({ path, sha }));
};

/**
 * Fetch the metadata of entry/asset files as well as text file contents.
 * @param {(BaseEntryListItem | BaseAssetListItem)[]} fetchingFiles - Base entry/asset list items.
 * @returns {Promise<RepositoryContentsMap>} Fetched contents map.
 * @see https://docs.gitlab.com/ee/api/graphql/reference/#repositoryblob
 * @see https://docs.gitlab.com/ee/api/graphql/reference/index.html#tree
 * @see https://forum.gitlab.com/t/graphql-api-read-raw-file/35389
 * @see https://docs.gitlab.com/ee/api/graphql/#limits
 */
const fetchFileContents = async (fetchingFiles) => {
  const { owner, repo, branch } = repository;
  const allPaths = fetchingFiles.map(({ path }) => path);
  /** @type {{ size: string, rawTextBlob: string }[]} */
  const blobs = [];
  let paths = [...allPaths];

  dataLoadedProgress.set(0);

  // Fetch all the text contents with the GraphQL API. Pagination would fail if `paths` becomes too
  // long, so we just use a fixed number of paths to iterate. The complexity score of this query is
  // 15 + (2 * node size) so 100 paths = 215 complexity, where the max number of records is 100 and
  // max complexity is 250 or 300
  for (;;) {
    const result = //
      /**
       * @type {{ project: { repository: { blobs: {
       * nodes: { size: string, rawTextBlob: string }[]
       * } } } }}
       */ (
        await fetchGraphQL(
          `
            query ($paths: [String!]!) {
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
            }
          `,
          { paths: paths.splice(0, 100) },
        )
      );

    blobs.push(...result.project.repository.blobs.nodes);
    dataLoadedProgress.set(Math.ceil(((allPaths.length - paths.length) / allPaths.length) * 100));

    if (!paths.length) {
      break;
    }
  }

  dataLoadedProgress.set(undefined);

  /**
   * @type {{
   * author: { id?: string, username?: string },
   * authorName: string, authorEmail: string, committedDate: string
   * }[]}
   */
  const commits = [];

  // Fetch commit info only when there aren’t many files, because it’s costly
  if (allPaths.length < 100) {
    paths = [...allPaths];

    // The complexity score of this query is 5 + (18 * node size) so 13 paths = 239 complexity
    for (;;) {
      const result = //
        /**
         * @type {{ project: { repository: { [tree_index: string]: { lastCommit: {
         * author: { id?: string, username?: string },
         * authorName: string, authorEmail: string, committedDate: string
         * } } } } } }}
         */ (
          await fetchGraphQL(
            `
              query {
                project(fullPath: "${owner}/${repo}") {
                  repository {
                    ${paths
                      .splice(0, 13)
                      .map(
                        (path, index) => `
                          tree_${index}: tree(ref: "${branch}", path: "${path}") {
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
                        `,
                      )
                      .join('')}
                  }
                }
              }
            `,
          )
        );

      commits.push(...Object.values(result.project.repository).map(({ lastCommit }) => lastCommit));

      if (!paths.length) {
        break;
      }
    }
  }

  return Object.fromEntries(
    fetchingFiles.map(({ path, sha }, index) => {
      const { size, rawTextBlob } = blobs[index];
      const commit = commits[index];

      const data = {
        sha,
        size: Number(size),
        text: rawTextBlob,
        meta: {},
      };

      if (commit) {
        const {
          author: { id, username },
          authorName,
          authorEmail,
          committedDate,
        } = commit;

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
    }),
  );
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
 * @param {Asset} asset - Asset to retrieve the file content.
 * @returns {Promise<Blob>} Blob data.
 * @see https://docs.gitlab.com/ee/api/repository_files.html#get-raw-file-from-repository
 */
const fetchBlob = async (asset) => {
  const { owner, repo, branch = '' } = repository;
  const { path } = asset;

  return /** @type {Promise<Blob>} */ (
    fetchAPI(
      `/projects/${encodeURIComponent(`${owner}/${repo}`)}/repository/files` +
        `/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(branch)}`,
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
 * @see https://docs.gitlab.com/ee/api/commits.html#create-a-commit-with-multiple-files-and-actions
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
          changes.map(async ({ action, path, previousPath, data = '', base64 }) => ({
            action,
            content: base64 ?? (typeof data !== 'string' ? await getBase64(data) : data),
            encoding: base64 || typeof data !== 'string' ? 'base64' : 'text',
            file_path: path,
            previous_path: previousPath,
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
  statusDashboardURL,
  checkStatus,
  getRepositoryInfo,
  init,
  signIn,
  signOut,
  fetchFiles,
  fetchBlob,
  commitChanges,
};
