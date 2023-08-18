import { get } from 'svelte/store';
import { allAssets } from '$lib/services/assets';
import { authorize, user } from '$lib/services/auth';
import { siteConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { createFileList, parseAssetFiles, parseEntryFiles } from '$lib/services/parser';
import { getBase64 } from '$lib/services/utils/files';
import LocalStorage from '$lib/services/utils/local-storage';

const label = 'GitHub';
const repoURL = 'https://github.com/{repo}';

/**
 * Send a request to GitHub REST/GraphQL API.
 * @param {string} path Endpoint.
 * @param {object} [options] Options.
 * @param {string} [options.method] Request method.
 * @param {object} [options.headers] Request headers.
 * @param {string} [options.body] Request body for POST.
 * @param {string} [options.token] OAuth token.
 * @param {('json' | 'text' | 'blob')} [options.responseType] Response type.
 * @returns {Promise<(object | string | Blob)>} Response data.
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
  const { api_root: apiRoot = 'https://api.github.com' } = get(siteConfig).backend;

  const response = await fetch(`${apiRoot}${path}`, {
    method,
    headers: { Authorization: `token ${token}`, ...headers },
    body,
  });

  if (!response.ok) {
    throw new Error('Invalid request');
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
 * @param {string} query Query string.
 * @param {object} [variables] Any variable to be applied.
 * @returns {Promise<object>} Response data.
 */
const fetchGraphQL = async (query, variables = {}) => {
  const { data } = await fetchAPI('/graphql', {
    method: 'POST',
    body: JSON.stringify({ query, variables }),
  });

  return data;
};

/**
 * Sign in with GitHub REST API.
 * @param {string} [savedToken] OAuth token. Can be empty when a token is not saved in the local
 * storage. Then, open the sign-in dialog.
 * @returns {Promise<object>} User info.
 */
const signIn = async (savedToken) => {
  const token = savedToken || (await authorize('github'));

  if (!token) {
    throw new Error('Authentication failed');
  }

  try {
    return { ...(await fetchAPI('/user', { token })), backendName: 'github', token };
  } catch {
    user.set(null);

    try {
      await LocalStorage.delete('sveltia-cms.user');
    } catch {
      //
    }

    throw new Error('Token is not valid');
  }
};

/**
 * Sign out from GitHub. Nothing to do here.
 */
const signOut = async () => {};

/**
 * Fetch file list and all the entry files, then cache them in the {@link allEntries} and
 * {@link allAssets} stores.
 */
const fetchFiles = async () => {
  const { backend: { repo: repoPath = '', branch = 'master' } = {} } = get(siteConfig) || {};

  if (!repoPath.trim()) {
    throw new Error('Backend is not defined');
  }

  const [owner, repo] = repoPath.split('/');
  // Get a complete file list first with the REST API
  const { tree: files } = await fetchAPI(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
  // Then filter what’s managed in CMS
  const { entryFiles, assetFiles } = createFileList(files.filter(({ type }) => type === 'blob'));
  const allFiles = [...entryFiles, ...assetFiles];

  // Skip fetching files if no files found
  if (!allFiles.length) {
    return;
  }

  // Fetch all the text contents with the GraphQL API
  const { repository } = await fetchGraphQL(`query {
    repository(owner: "${owner}", name: "${repo}") {
      ${allFiles
        .map(
          ({ type, path }, index) => `
            ${
              type === 'entry'
                ? `
                  content_${index}: object(expression: "${branch}:${path}") {
                    ... on Blob {
                      text
                    }
                  }
                `
                : ''
            }
            commit_${index}: ref(qualifiedName: "${branch}") {
              target {
                ... on Commit {
                  history(first: 1, path: "${path}") {
                    nodes {
                      author { name email }
                      committedDate
                    }
                  }
                }
              }
            }
          `,
        )
        .join('')}
    }
  }`);

  /**
   * Get the file metadata.
   * @param {number} index Array index to be searched in the GraphQL response.
   * @returns {{ commitAuthor: { name: string, email: string }, commitDate: Date }} Metadata
   * including the commit author and date.
   */
  const getMeta = (index) => {
    const { author, committedDate } = repository[`commit_${index}`].target.history.nodes[0];

    return {
      commitAuthor: author,
      commitDate: new Date(committedDate),
    };
  };

  allEntries.set(
    parseEntryFiles(
      entryFiles.map((/** @type {object} */ entry, index) => ({
        ...entry,
        text: repository[`content_${index}`].text,
        meta: { ...(entry.meta || {}), ...getMeta(index) },
      })),
    ),
  );

  allAssets.set(
    parseAssetFiles(
      assetFiles.map((/** @type {object} */ asset, index) => ({
        ...asset,
        /** Blob URL to be set later via {@link fetchBlob} */
        url: null,
        /** starting with `https://api.github.com`, to be used by {@link fetchBlob} */
        fetchURL: asset.url,
        repoFileURL: `https://github.com/${owner}/${repo}/blob/${branch}/${asset.path}`,
        name: asset.path.split('/').pop(),
        meta: { ...(asset.meta || {}), ...getMeta(entryFiles.length + index) },
      })),
    ),
  );
};

/**
 * Fetch an asset as a Blob via the API.
 * @param {string} url Fetch URL to retrieve the file content.
 * @returns {Promise<Blob>} Blob data.
 * @see https://docs.github.com/en/rest/git/blobs#get-a-blob
 */
const fetchBlob = async (url) =>
  fetchAPI(url.replace('https://api.github.com', ''), {
    headers: { Accept: 'application/vnd.github.raw' },
    responseType: 'blob',
  });

/**
 * Get the latest commit’s SHA-1 hash.
 * @returns {Promise<string>} Hash.
 */
const getLastCommitHash = async () => {
  const { backend: { repo: repoPath = '', branch = 'master' } = {} } = get(siteConfig) || {};
  const [owner, repo] = repoPath.split('/');

  const {
    repository: {
      ref: {
        target: {
          history: {
            nodes: [{ oid }],
          },
        },
      },
    },
  } = await fetchGraphQL(`query {
    repository(owner: "${owner}", name: "${repo}") {
      ref(qualifiedName: "${branch}") {
        target {
          ... on Commit {
            history(first: 1) {
              nodes { oid }
            }
          }
        }
      }
    }
  }`);

  return oid;
};

/**
 * Default commit message templates.
 * @see https://decapcms.org/docs/beta-features/#commit-message-templates
 */
const defaultCommitMessages = {
  create: 'Create {{collection}} “{{slug}}”',
  update: 'Update {{collection}} “{{slug}}”',
  delete: 'Delete {{collection}} “{{slug}}”',
  uploadMedia: 'Upload “{{path}}”',
  deleteMedia: 'Delete “{{path}}”',
  openAuthoring: '{{message}}',
};

/**
 * Create a Git commit message.
 * @param {SavingFile[] | DeletingFile[]} items Entries or files.
 * @param {object} [options] Options.
 * @param {CommitType} [options.commitType] Git commit type.
 * @param {string} [options.collection] Collection name. Required for entries.
 * @returns {string} Formatted message.
 */
const createCommitMessage = (items, { commitType = 'update', collection } = {}) => {
  const { detail: { login = '', name = '' } = {} } = get(user);
  const [firstSlug] = items.map((item) => item.slug).filter(Boolean);
  const [firstPath, ...remainingPaths] = items.map(({ path }) => path);
  const { backend: { commit_messages: customCommitMessages = {} } = {} } = get(siteConfig);
  /**
   * @type {string}
   */
  let message = customCommitMessages[commitType] || defaultCommitMessages[commitType] || '';

  if (['create', 'update', 'delete'].includes(commitType)) {
    message = message
      .replaceAll('{{slug}}', firstSlug)
      .replaceAll('{{collection}}', collection)
      .replaceAll('{{path}}', firstPath)
      .replaceAll('{{author-login}}', login)
      .replaceAll('{{author-name}}', name);
  }

  if (['uploadMedia', 'deleteMedia'].includes(commitType)) {
    message = message
      .replaceAll('{{path}}', firstPath)
      .replaceAll('{{author-login}}', login)
      .replaceAll('{{author-name}}', name);
  }

  if (['openAuthoring'].includes(commitType)) {
    message = message
      .replaceAll('{{message}}', commitType)
      .replaceAll('{{author-login}}', login)
      .replaceAll('{{author-name}}', name);
  }

  if (remainingPaths.length) {
    message += ` +${remainingPaths.length}`;
  }

  return message;
};

/**
 * Author a commit on the repository.
 * @param {string} message Commit message.
 * @param {object} changes File changes.
 * @param {object[]} [changes.additions] Files to add.
 * @param {object[]} [changes.deletions] Files to remove.
 * @returns {Promise<string>} Commit URL.
 * @see https://github.blog/changelog/2021-09-13-a-simpler-api-for-authoring-commits/
 */
const createCommit = async (message, { additions = [], deletions = [] }) => {
  const { backend: { repo: repoPath = '', branch = 'master' } = {} } = get(siteConfig) || {};
  const expectedHeadOid = await getLastCommitHash();

  const {
    createCommitOnBranch: {
      commit: { url: commitURL },
    },
  } = await fetchGraphQL(
    `mutation ($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) { commit { url } }
    }`,
    {
      input: {
        branch: {
          repositoryNameWithOwner: repoPath,
          branchName: branch,
        },
        message: { headline: message },
        fileChanges: { additions, deletions },
        expectedHeadOid,
      },
    },
  );

  return commitURL;
};

/**
 * Save entries or assets remotely.
 * @param {SavingFile[]} items Entries or files.
 * @param {object} [options] Options.
 * @param {CommitType} [options.commitType] Commit type.
 * @param {string} [options.collection] Collection name. Required for entries.
 */
const saveFiles = async (items, { commitType = 'update', collection } = {}) => {
  await createCommit(createCommitMessage(items, { commitType, collection }), {
    additions: await Promise.all(
      items.map(async ({ path, data, base64 }) => ({
        path,
        contents: base64 || (await getBase64(data)),
      })),
    ),
  });
};

/**
 * Delete files at the given paths.
 * @param {DeletingFile[]} items Entries or files.
 * @param {object} [options] Options.
 * @param {CommitType} [options.commitType] Commit type.
 * @param {string} [options.collection] Collection name. Required for entries.
 */
const deleteFiles = async (items, { commitType = 'delete', collection } = {}) => {
  await createCommit(createCommitMessage(items, { commitType, collection }), {
    deletions: items.map(({ path }) => ({ path })),
  });
};

/**
 * @type {BackendService}
 */
export default {
  label,
  repoURL,
  signIn,
  signOut,
  fetchFiles,
  fetchBlob,
  saveFiles,
  deleteFiles,
};
