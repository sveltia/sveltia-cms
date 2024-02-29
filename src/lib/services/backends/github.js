import mime from 'mime';
import { get } from 'svelte/store';
import { allAssets } from '$lib/services/assets';
import { authorize } from '$lib/services/backends/shared/auth';
import { createCommitMessage } from '$lib/services/backends/shared/commits';
import { siteConfig } from '$lib/services/config';
import { allEntries, dataLoaded } from '$lib/services/contents';
import { createFileList, parseAssetFiles, parseEntryFiles } from '$lib/services/parser';
import { user } from '$lib/services/user';
import { getBase64 } from '$lib/services/utils/files';
import IndexedDB from '$lib/services/utils/indexeddb';
import { isObject } from '$lib/services/utils/misc';

const label = 'GitHub';

/**
 * @type {RepositoryInfo}
 */
const repository = new Proxy(/** @type {any} */ ({ owner: '', repo: '', branch: '' }), {
  /**
   * Define the getter.
   * @param {{ [key: string]: string }} obj - Object itself.
   * @param {string} key - Property name.
   * @returns {string} Property value.
   */
  get: (obj, key) => {
    if (key === 'url') {
      const { owner, repo, branch } = obj;
      const baseURL = `https://github.com/${owner}/${repo}`;

      return branch ? `${baseURL}/tree/${branch}` : baseURL;
    }

    return obj[key];
  },
});

/**
 * Send a request to GitHub REST/GraphQL API.
 * @param {string} path - Endpoint.
 * @param {object} [options] - Options.
 * @param {'GET' | 'POST' | 'PUT' | 'DELETE'} [options.method] - Request method.
 * @param {object} [options.headers] - Request headers.
 * @param {string} [options.body] - Request body for POST.
 * @param {string} [options.token] - OAuth token.
 * @param {('json' | 'text' | 'blob' | 'raw')} [options.responseType] - Response type. The default
 * is `json`, while `raw` returns a `Response` object as is.
 * @returns {Promise<(object | string | Blob | Response)>} Response data or `Response` itself,
 * depending on the `responseType` option.
 * @throws {Error} When there was an error in the API request, e.g. OAuth App access restrictions.
 */
const fetchAPI = async (
  path,
  {
    method = 'GET',
    headers = {},
    body = null,
    token = get(user).token,
    responseType = 'json',
  } = {},
) => {
  let { api_root: apiRoot } = get(siteConfig).backend;

  if (apiRoot) {
    // Enterprise Server
    apiRoot = apiRoot.replace(/\/$/, '');

    if (path === '/graphql') {
      // Modify the root URL for GraphQL: the REST API root is `https://HOSTNAME/api/v3` while the
      // GraphQL endpoint is `https://HOSTNAME/api/graphql`, meaning `/v3` should be stripped.
      // https://docs.github.com/en/enterprise-server@3.10/rest/overview/resources-in-the-rest-api
      // https://docs.github.com/en/enterprise-server@3.10/graphql/guides/forming-calls-with-graphql
      apiRoot = apiRoot.replace(/\/v\d+$/, '');
    }
  } else {
    // Enterprise Cloud or regular GitHub
    apiRoot = 'https://api.github.com';
  }

  const response = await fetch(`${apiRoot}${path}`, {
    method,
    headers: { Authorization: `token ${token}`, ...headers },
    body,
  });

  const { ok, status } = response;

  if (!ok) {
    let message;

    try {
      const result = await response.json();

      if (isObject(result)) {
        message =
          result.message ?? // REST
          result.errors?.[0]?.message; // GraphQL
      }
    } catch (/** @type {any} */ ex) {
      // eslint-disable-next-line no-console
      console.error(ex);
    }

    throw new Error('Invalid API request', { cause: { status, message } });
  }

  if (responseType === 'raw') {
    return response;
  }

  if (responseType === 'blob') {
    return response.blob();
  }

  if (responseType === 'text') {
    return response.text();
  }

  return response.json();
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
      body: JSON.stringify({ query, variables }),
    })
  );

  return data;
};

/**
 * Initialize the backend.
 * @throws {Error} When the backend is not configured properly.
 */
const init = () => {
  const { backend: { repo: repoPath = '', branch = '' } = {} } = get(siteConfig) ?? {};
  const [owner, repo] = typeof repoPath === 'string' ? repoPath.split('/') : [];

  if (!owner || !repo) {
    throw new Error('Backend is not defined');
  }

  if (!repository.owner) {
    Object.assign(repository, { owner, repo, branch });
  }
};

/**
 * Retrieve the repository configuration and sign in with GitHub REST API.
 * @param {string} [savedToken] - OAuth token. Can be empty when a token is not saved in the local
 * storage. Then, open the sign-in dialog.
 * @returns {Promise<User>} User info.
 * @throws {Error} When there was an authentication error.
 */
const signIn = async (savedToken) => {
  const token = savedToken || (await authorize('github'));

  if (!token) {
    throw new Error('Authentication failed');
  }

  return {
    .../** @type {object} */ (await fetchAPI('/user', { token })),
    backendName: 'github',
    token,
  };
};

/**
 * Sign out from GitHub. Nothing to do here.
 * @returns {Promise<void>}
 */
const signOut = async () => undefined;

/**
 * Fetch the repository’s default branch name, which is typically `master` or `main`.
 * @returns {Promise<string>} Branch name.
 */
const fetchDefaultBranchName = async () => {
  const { owner, repo } = repository;

  const { repository: result } =
    /** @type {{ repository: { defaultBranchRef: { name: string } } } } */ (
      await fetchGraphQL(`query {
        repository(owner: "${owner}", name: "${repo}") { defaultBranchRef { name } }
      }`)
    );

  return result.defaultBranchRef.name;
};

/**
 * Fetch the latest commit’s SHA-1 hash.
 * @returns {Promise<string>} Hash.
 */
const fetchLastCommitHash = async () => {
  const { owner, repo, branch } = repository;

  const { repository: result } =
    /** @type {{ repository: { ref: { target: { oid: string } } } }} */ (
      await fetchGraphQL(`query {
        repository(owner: "${owner}", name: "${repo}") {
          ref(qualifiedName: "${branch}") { target { oid } }
        }
      }`)
    );

  return result.ref.target.oid;
};

/**
 * Fetch file list and all the entry files, then cache them in the {@link allEntries} and
 * {@link allAssets} stores.
 */
const fetchFiles = async () => {
  const { owner, repo, branch: branchName } = repository;
  const metaDB = new IndexedDB(`github:${owner}/${repo}`, 'meta');
  const cacheDB = new IndexedDB(`github:${owner}/${repo}`, 'file-cache');
  const cachedHash = await metaDB.get('last_commit_hash');
  const cachedFileEntries = await cacheDB.entries();
  let branch = branchName;
  let fileList;

  if (!branch) {
    branch = await fetchDefaultBranchName();
    repository.branch = branch;
  }

  if (cachedHash && cachedHash === (await fetchLastCommitHash())) {
    // Skip fetching file list
    fileList = createFileList(
      cachedFileEntries.map(([path, data]) => ({
        ...data,
        path,
        url: `https://api.github.com/repos/${owner}/${repo}/git/blobs/${data.sha}`,
      })),
    );
  } else {
    // Get a complete file list first with the REST API
    const {
      sha,
      tree,
    } = //
      /**
       * @type {{
       * sha: string,
       * tree: { type: string, path: string, sha: string, size: number }[]
       * }}
       */ (await fetchAPI(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`));

    // Then filter what’s managed in CMS
    fileList = createFileList(tree.filter(({ type }) => type === 'blob'));
    metaDB.set('last_commit_hash', sha);
  }

  // Skip fetching files if no files found
  if (!fileList.count) {
    allEntries.set([]);
    allAssets.set([]);
    dataLoaded.set(true);

    return;
  }

  const { entryFiles, assetFiles, allFiles } = fileList;
  const cachedFiles = Object.fromEntries(cachedFileEntries);

  // Restore cached text and commit info
  allFiles.forEach(({ sha, path }, index) => {
    if (cachedFiles[path]?.sha === sha) {
      Object.assign(allFiles[index], cachedFiles[path]);
    }
  });

  const query = allFiles
    .filter(({ meta }) => !meta)
    .map(({ type, sha, path }, index) => {
      const str = [];

      if (type === 'entry') {
        str.push(`content_${index}: object(oid: "${sha}") {
          ... on Blob { text }
        }`);
      }

      str.push(`commit_${index}: ref(qualifiedName: "${branch}") {
        target {
          ... on Commit {
            history(first: 1, path: "${path}") {
              nodes {
                author { name, email, user { id: databaseId, login } }
                committedDate
              }
            }
          }
        }
      }`);

      return str.join('');
    })
    .join('')
    .replace(/\s{2,}/g, ' ');

  // Fetch all the text contents with the GraphQL API
  const { repository: result } = query
    ? /** @type {{ repository: { [key: string]: any } }} */ (
        await fetchGraphQL(`query { repository(owner: "${owner}", name: "${repo}") { ${query} } }`)
      )
    : { repository: {} };

  /** @type {[string, { sha: string, text: string, meta: object }][]} */
  const downloadedFileList = allFiles
    .filter(({ meta }) => !meta)
    .map(({ sha, size, path }, index) => {
      const {
        author: { name, email, user: _user },
        committedDate,
      } = result[`commit_${index}`].target.history.nodes[0];

      const data = {
        sha,
        size,
        text: result[`content_${index}`]?.text,
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

  const downloadedFileMap = Object.fromEntries(downloadedFileList);

  allEntries.set(
    parseEntryFiles(
      entryFiles.map((file) => ({
        ...file,
        text: file.text ?? downloadedFileMap[file.path].text,
        meta: file.meta ?? downloadedFileMap[file.path].meta,
      })),
    ),
  );

  allAssets.set(
    parseAssetFiles(
      assetFiles.map((file) => ({
        ...file,
        /** Blob URL to be set later via {@link fetchBlob}. */
        url: null,
        /** Starting with `https://api.github.com`, to be used by {@link fetchBlob}. */
        fetchURL: file.url,
        repoFileURL: `https://github.com/${owner}/${repo}/blob/${branch}/${file.path}`,
        name: file.path.split('/').pop(),
        meta: file.meta ?? downloadedFileMap[file.path].meta,
      })),
    ),
  );

  dataLoaded.set(true);

  const usedPaths = allFiles.map(({ path }) => path);
  const unusedPaths = Object.keys(cachedFiles).filter((path) => !usedPaths.includes(path));

  // Save new entry caches
  if (downloadedFileList.length) {
    await cacheDB.saveEntries(downloadedFileList);
  }

  // Delete old entry caches
  if (unusedPaths.length) {
    cacheDB.deleteEntries(unusedPaths);
  }
};

/**
 * Fetch an asset as a Blob via the API.
 * @param {Asset} asset - Asset to retrieve the file content.
 * @returns {Promise<Blob>} Blob data.
 * @see https://docs.github.com/en/rest/git/blobs#get-a-blob
 */
const fetchBlob = async (asset) => {
  const response = /** @type {Response} */ (
    await fetchAPI(asset.fetchURL.replace('https://api.github.com', ''), {
      headers: { Accept: 'application/vnd.github.raw' },
      responseType: 'raw',
    })
  );

  // Handle SVG and other non-binary files
  if (response.headers.get('Content-Type') !== 'application/octet-stream') {
    return new Blob([await response.text()], { type: mime.getType(asset.path) });
  }

  return response.blob();
};

/**
 * Save entries or assets remotely.
 * @param {FileChange[]} changes - File changes to be saved.
 * @param {CommitChangesOptions} options - Commit options.
 * @returns {Promise<string>} Commit URL.
 * @see https://github.blog/changelog/2021-09-13-a-simpler-api-for-authoring-commits/
 */
const commitChanges = async (changes, options) => {
  const { owner, repo, branch } = repository;

  const additions = await Promise.all(
    changes
      .filter(({ action }) => ['create', 'update'].includes(action))
      .map(async ({ path, data, base64 }) => ({
        path,
        contents: base64 ?? (await getBase64(data)),
      })),
  );

  const deletions = changes
    .filter(({ action }) => action === 'delete')
    .map(({ path }) => ({ path }));

  const {
    createCommitOnBranch: {
      commit: { url: commitURL },
    },
  } = /** @type {{ createCommitOnBranch: { commit: { url: string }} }} */ (
    await fetchGraphQL(
      `mutation ($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) { commit { url } }
      }`,
      {
        input: {
          branch: {
            repositoryNameWithOwner: `${owner}/${repo}`,
            branchName: branch,
          },
          message: { headline: createCommitMessage(changes, options) },
          fileChanges: { additions, deletions },
          expectedHeadOid: await fetchLastCommitHash(),
        },
      },
    )
  );

  return commitURL;
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
      body: JSON.stringify({ event_type: 'sveltia-cms-publish' }),
      responseType: 'raw',
    })
  );
};

/**
 * @type {BackendService}
 */
export default {
  label,
  repository,
  init,
  signIn,
  signOut,
  fetchFiles,
  fetchBlob,
  commitChanges,
  triggerDeployment,
};
