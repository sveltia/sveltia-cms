import { get } from 'svelte/store';
import { allAssets } from '$lib/services/assets';
import { authorize, user } from '$lib/services/auth';
import { siteConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { createFileList, parseAssetFiles, parseEntryFiles } from '$lib/services/parser';
import { getBase64 } from '$lib/services/utils/files';
import LocalStorage from '$lib/services/utils/local-storage';

const label = 'GitHub';
const url = 'https://github.com/{repo}';

/**
 * Send a request to GitHub REST/GraphQL API.
 *
 * @param {string} path Endpoint.
 * @param {object} [options] Request options.
 * @param {string} [options.method] Request method.
 * @param {string} [options.body] Request body for POST.
 * @param {string} [options.token] OAuth token.
 * @returns {Promise<object>} Response data.
 */
const fetchAPI = async (path, { method = 'GET', body = null, token = get(user).token } = {}) => {
  const { api_root: apiRoot = 'https://api.github.com' } = get(siteConfig).backend;

  const response = await fetch(`${apiRoot}${path}`, {
    method,
    headers: { Authorization: `token ${token}` },
    body,
  });

  if (!response.ok) {
    throw new Error('Invalid request');
  }

  return response.json();
};

/**
 * Send a request to GitHub GraphQL API.
 *
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
 *
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
    LocalStorage.delete('sveltia-cms.user');

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
  // Then filter what???s managed in CMS
  const { entryFiles, assetFiles } = createFileList(files.filter(({ type }) => type === 'blob'));

  // Fetch all the text contents with the GraphQL API
  const { repository } = await fetchGraphQL(`query {
    repository(owner: "${owner}", name: "${repo}") {
      ${[...entryFiles, ...assetFiles]
        .map(
          ({ sha, path, slug }) => `
            ${
              slug // entry file
                ? `
                  _${sha}_content: object(expression: "${branch}:${path}") {
                    ... on Blob {
                      text
                    }
                  }
                `
                : ''
            }
            _${sha}_commit: ref(qualifiedName: "${branch}") {
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
   * Get the file metadata for the given hash.
   *
   * @param {string} sha SHA-1 hash.
   * @returns {object} Metadata including the commit date and author.
   */
  const getMeta = (sha) => {
    const { author, committedDate } = repository[`_${sha}_commit`].target.history.nodes[0];

    return {
      commitAuthor: author,
      commitDate: new Date(committedDate),
    };
  };

  allEntries.set(
    parseEntryFiles(
      entryFiles.map((entry) => ({
        ...entry,
        text: repository[`_${entry.sha}_content`].text,
        meta: { ...(entry.meta || {}), ...getMeta(entry.sha) },
      })),
    ),
  );

  allAssets.set(
    parseAssetFiles(
      assetFiles.map((asset) => ({
        ...asset,
        name: asset.path.split('/').pop(),
        meta: { ...(asset.meta || {}), ...getMeta(asset.sha) },
      })),
    ),
  );
};

/**
 * Get the latest commit???s SHA-1 hash.
 *
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
 *
 * @see https://www.netlifycms.org/docs/beta-features/#commit-message-templates
 */
const defaultCommitMessages = {
  create: 'Create {{collection}} ???{{slug}}???',
  update: 'Update {{collection}} ???{{slug}}???',
  delete: 'Delete {{collection}} ???{{slug}}???',
  uploadMedia: 'Upload ???{{path}}???',
  deleteMedia: 'Delete ???{{path}}???',
  openAuthoring: '{{message}}',
};

/**
 * Create a Git commit message.
 *
 * @param {object[]} items Entries or files.
 * @param {object} [options] Options.
 * @param {CommitType} [options.commitType] Git commit type.
 * @param {string} [options.collection] Collection name. Required for entries.
 * @returns {string} Formatted message.
 */
const createCommitMessage = (items, { commitType = 'update', collection } = {}) => {
  const { detail: { login = '', name = '' } = {} } = get(user);
  const [firstSlug] = items.map(({ slug }) => slug).filter(Boolean);
  const [firstPath, ...remainingPaths] = items.map(({ path }) => path);
  const { backend: { commit_messages: customCommitMessages = {} } = {} } = get(siteConfig);
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
 *
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
 *
 * @param {object[]} items Entries or files.
 * @param {object} [options] Options.
 * @param {string} [options.commitType] Commit type.
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
 *
 * @param {object[]} items Entries or files.
 * @param {object} [options] Options.
 * @param {string} [options.commitType] Commit type.
 * @param {string} [options.collection] Collection name. Required for entries.
 */
const deleteFiles = async (items, { commitType = 'delete', collection } = {}) => {
  await createCommit(createCommitMessage(items, { commitType, collection }), {
    deletions: items.map(({ path }) => ({ path })),
  });
};

export default {
  label,
  url,
  signIn,
  signOut,
  fetchFiles,
  saveFiles,
  deleteFiles,
};
