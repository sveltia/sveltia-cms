import { getBase64 } from '@sveltia/utils/file';
import { sleep } from '@sveltia/utils/misc';
import { stripSlashes } from '@sveltia/utils/string';
import mime from 'mime';
import { _ } from 'svelte-i18n';
import { get } from 'svelte/store';
import { initServerSideAuth } from '$lib/services/backends/shared/auth';
import { createCommitMessage } from '$lib/services/backends/shared/commits';
import { fetchAndParseFiles } from '$lib/services/backends/shared/data';
import { siteConfig } from '$lib/services/config';
import { dataLoadedProgress } from '$lib/services/contents';
import { user } from '$lib/services/user';
import { sendRequest } from '$lib/services/utils/networking';

const backendName = 'github';
const label = 'GitHub';
const statusDashboardURL = 'https://www.githubstatus.com/';
const statusCheckURL = 'https://www.githubstatus.com/api/v2/status.json';

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
      return branch ? `${baseURL}/tree/${branch}` : baseURL;
    }

    if (key === 'blobBaseURL') {
      return branch ? `${baseURL}/blob/${branch}` : '';
    }

    return undefined;
  },
});

/**
 * Check the GitHub service status.
 * @returns {Promise<BackendServiceStatus>} Current status.
 * @see https://www.githubstatus.com/api
 */
const checkStatus = async () => {
  try {
    const {
      status: { indicator },
    } = /** @type {{ status: { indicator: string }}} */ (await sendRequest(statusCheckURL));

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
 * @param {string} path - Endpoint.
 * @param {{ method?: string, headers?: any, body?: any }} [init] - Request options.
 * @param {object} [options] - Other options.
 * @param {string} [options.token] - OAuth token.
 * @param {'json' | 'text' | 'blob' | 'raw'} [options.responseType] - Response type. The default is
 *`json`, while `raw` returns a `Response` object as is.
 * @returns {Promise<object | string | Blob | Response>} Response data or `Response` itself,
 * depending on the `responseType` option.
 * @throws {Error} When there was an error in the API request, e.g. OAuth App access restrictions.
 * @see https://docs.github.com/en/rest
 * @see https://docs.github.com/en/graphql
 */
const fetchAPI = async (
  path,
  init = {},
  { token = /** @type {User} */ (get(user)).token, responseType = 'json' } = {},
) => {
  let { api_root: apiRoot } = /** @type {SiteConfig} */ (get(siteConfig)).backend;

  if (apiRoot) {
    // Enterprise Server (self-hosted)
    apiRoot = `${new URL(apiRoot).origin}/api`;

    if (path !== '/graphql') {
      // REST API v3
      apiRoot = `${apiRoot}/v3`;
    }
  } else {
    // Enterprise Cloud or regular GitHub
    apiRoot = 'https://api.github.com';
  }

  init.headers = new Headers(init.headers);
  init.headers.set('Authorization', `token ${token}`);

  return sendRequest(`${apiRoot}${path}`, init, { responseType });
};

/**
 * Send a request to GitHub GraphQL API.
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
    api_root: apiRoot, // GitHub Enterprise only; API server = web server
  } = /** @type {SiteConfig} */ (get(siteConfig)).backend;

  const [owner, repo] = /** @type {string} */ (projectPath).split('/');
  const origin = apiRoot ? new URL(apiRoot).origin : 'https://github.com';

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
 * Initialize the GitHub backend.
 */
const init = () => {
  getRepositoryInfo();
};

/**
 * Retrieve the repository configuration and sign in with GitHub REST API.
 * @param {SignInOptions} options - Options.
 * @returns {Promise<User | void>} User info, or nothing when the sign-in flow cannot be started.
 * @throws {Error} When there was an authentication error.
 * @see https://docs.github.com/en/rest/users/users#get-the-authenticated-user
 */
const signIn = async ({ token: cachedToken, auto = false }) => {
  if (auto && !cachedToken) {
    return void 0;
  }

  const { hostname } = window.location;

  const {
    site_domain: siteDomain = hostname,
    base_url: baseURL = 'https://api.netlify.com',
    auth_endpoint: path = 'auth',
  } = /** @type {SiteConfig} */ (get(siteConfig)).backend;

  const token =
    cachedToken ||
    (await initServerSideAuth({
      backendName,
      siteDomain,
      authURL: `${stripSlashes(baseURL)}/${stripSlashes(path)}`,
      scope: 'repo,user',
    }));

  const {
    id,
    name,
    login,
    email,
    avatar_url: avatarURL,
    html_url: profileURL,
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
 * Sign out from GitHub. Nothing to do here.
 * @returns {Promise<void>}
 */
const signOut = async () => void 0;

/**
 * Check if the user has access to the current repository.
 * @throws {Error} If the user is not a collaborator of the repository.
 * @see https://docs.github.com/en/rest/collaborators/collaborators#check-if-a-user-is-a-repository-collaborator
 */
const checkRepositoryAccess = async () => {
  const { owner, repo } = repository;
  const userName = /** @type {string} */ (get(user)?.login);

  const { ok } = /** @type {Response} */ (
    await fetchAPI(
      `/repos/${owner}/${repo}/collaborators/${encodeURIComponent(userName)}`,
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
 */
const fetchDefaultBranchName = async () => {
  const { owner, repo } = repository;

  const result = /** @type {{ repository: { defaultBranchRef: { name: string } } }} */ (
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

  if (!result.repository.defaultBranchRef) {
    throw new Error('Failed to retrieve the default branch name.', {
      cause: new Error(get(_)('repository_empty', { values: { repo } })),
    });
  }

  return result.repository.defaultBranchRef.name;
};

/**
 * Fetch the last commit on the repository.
 * @returns {Promise<{ hash: string, message: string }>} Commit’s SHA-1 hash and message.
 * @throws {Error} When the branch could not be found.
 */
const fetchLastCommit = async () => {
  const { owner, repo, branch } = repository;

  /**
   * @type {{ repository: { ref: { target: { history: { nodes: [{ oid: string, message: string }] }
   * } } } }}
   */
  const result = /** @type {any} */ (
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
 * @param {string} [lastHash] - The last commit’s SHA-1 hash.
 * @returns {Promise<BaseFileListItem[]>} File list.
 */
const fetchFileList = async (lastHash) => {
  const { owner, repo, branch } = repository;

  const result =
    /** @type {{ tree: { type: string, path: string, sha: string, size: number }[] }} */ (
      await fetchAPI(`/repos/${owner}/${repo}/git/trees/${lastHash ?? branch}?recursive=1`)
    );

  return result.tree
    .filter(({ type }) => type === 'blob')
    .map(({ path, sha, size }) => ({ path, sha, size }));
};

/**
 * Fetch the metadata of entry/asset files as well as text file contents.
 * @param {(BaseEntryListItem | BaseAssetListItem)[]} fetchingFiles - Base entry/asset list items.
 * @returns {Promise<RepositoryContentsMap>} Fetched contents map.
 */
const fetchFileContents = async (fetchingFiles) => {
  const { owner, repo, branch } = repository;
  const fetchingFileList = structuredClone(fetchingFiles);
  /** @type {any[][]} */
  const chunks = [];
  const chunkSize = 250;
  /** @type {any} */
  const results = {};

  /**
   * Get a query string for a new API request.
   * @param {any[]} chunk - Sliced `fetchingFileList`.
   * @param {number} startIndex - Start index.
   * @returns {string} Query string.
   */
  const getQuery = (chunk, startIndex) => {
    const innerQuery = chunk
      .map(({ type, path, sha }, i) => {
        const str = [];
        const index = startIndex + i;

        if (type === 'entry') {
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
        await fetchGraphQL(getQuery(chunk, index * chunkSize))
      );

      Object.assign(results, result.repository);
    }),
  );

  window.clearInterval(dataLoadedProgressInterval);
  dataLoadedProgress.set(undefined);

  return Object.fromEntries(
    fetchingFiles.map(({ path, sha, size }, index) => {
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
 * @see https://docs.github.com/en/rest/git/blobs#get-a-blob
 */
const fetchBlob = async (asset) => {
  const { owner, repo } = repository;
  const { sha, path } = asset;

  const response = /** @type {Response} */ (
    await fetchAPI(
      `/repos/${owner}/${repo}/git/blobs/${sha}`,
      { headers: { Accept: 'application/vnd.github.raw' } },
      { responseType: 'raw' },
    )
  );

  // Handle SVG and other non-binary files
  if (response.headers.get('Content-Type') !== 'application/octet-stream') {
    return new Blob([await response.text()], { type: mime.getType(path) ?? 'text/plain' });
  }

  return response.blob();
};

/**
 * Save entries or assets remotely.
 * @param {FileChange[]} changes - File changes to be saved.
 * @param {CommitChangesOptions} options - Commit options.
 * @returns {Promise<string>} Commit URL.
 * @see https://github.blog/changelog/2021-09-13-a-simpler-api-for-authoring-commits/
 * @see https://docs.github.com/en/graphql/reference/mutations#createcommitonbranch
 */
const commitChanges = async (changes, options) => {
  const { owner, repo, branch } = repository;

  const additions = await Promise.all(
    changes
      .filter(({ action }) => ['create', 'update', 'move'].includes(action))
      .map(async ({ path, data, base64 }) => ({
        path,
        contents: base64 ?? (await getBase64(data ?? '')),
      })),
  );

  const deletions = changes
    .filter(({ action }) => ['move', 'delete'].includes(action))
    .map(({ previousPath, path }) => ({ path: previousPath ?? path }));

  const result = /** @type {{ createCommitOnBranch: { commit: { url: string }} }} */ (
    await fetchGraphQL(
      `
        mutation ($input: CreateCommitOnBranchInput!) {
          createCommitOnBranch(input: $input) {
            commit {
              url
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

  return result.createCommitOnBranch.commit.url;
};

/**
 * Manually trigger a deployment with GitHub Actions by dispatching the `repository_dispatch` event.
 * @returns {Promise<Response>} Response.
 * @see https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event
 */
const triggerDeployment = async () => {
  const { owner, repo } = repository;

  return /** @type {Promise<Response>} */ (
    fetchAPI(
      `/repos/${owner}/${repo}/dispatches`,
      {
        method: 'POST',
        body: { event_type: 'sveltia-cms-publish' },
      },
      { responseType: 'raw' },
    )
  );
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
  triggerDeployment,
};
