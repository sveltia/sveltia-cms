import { _ } from '@sveltia/i18n';
import { encodeBase64 } from '@sveltia/utils/file';

import { repository } from '$lib/services/backends/git/github/repository';
import { fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { createCommitMessage } from '$lib/services/backends/git/shared/commits';

/**
 * @import { CommitOptions, CommitResults, FileChange, FileCommit } from '$lib/types/private';
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
export const fetchLastCommit = async () => {
  const { repo, branch } = repository;
  const result = /** @type {LastCommitResponse} */ (await fetchGraphQL(FETCH_LAST_COMMIT_QUERY));

  if (!result.repository) {
    throw new Error('Failed to retrieve the last commit hash.', {
      cause: new Error(_('repository_not_found', { values: { repo } })),
    });
  }

  if (!result.repository.ref) {
    throw new Error('Failed to retrieve the last commit hash.', {
      cause: new Error(_('branch_not_found', { values: { repo, branch } })),
    });
  }

  const { oid: hash, message } = result.repository.ref.target.history.nodes[0];

  return { hash, message };
};

/**
 * GitHub’s GraphQL API cannot resolve blob OIDs for files over this size (10 MB).
 * @see https://github.com/sveltia/sveltia-cms/issues/692
 */
const MAX_GRAPHQL_BLOB_SIZE = 10 * 1024 * 1024;

/**
 * Save entries or assets remotely.
 * @param {FileChange[]} changes File changes to be saved.
 * @param {CommitOptions} options Commit options.
 * @returns {Promise<CommitResults>} Commit results, including the commit SHA and updated file SHAs.
 * @see https://github.blog/changelog/2021-09-13-a-simpler-api-for-authoring-commits/
 * @see https://docs.github.com/en/graphql/reference/mutations#createcommitonbranch
 */
export const commitChanges = async (changes, options) => {
  const { owner, repo, branch } = repository;

  const additionChanges = changes.filter(({ action }) =>
    ['create', 'update', 'move'].includes(action),
  );

  const additions = await Promise.all(
    additionChanges.map(async ({ path, data }) => ({
      path,
      contents: await encodeBase64(data ?? ''),
    })),
  );

  const deletions = changes
    .filter(({ action }) => ['move', 'delete'].includes(action))
    .map(({ previousPath, path }) => ({ path: previousPath ?? path }));

  // Part of the query to fetch new file SHAs; skip files over 10 MB to avoid a GitHub GraphQL
  // limitation where large blob OIDs cannot be resolved
  // @see https://github.com/sveltia/sveltia-cms/issues/692
  const fileShaQuery = additions
    .map(({ path }, index) => {
      const { data } = additionChanges[index];
      const size = data instanceof Blob ? data.size : new Blob([data ?? '']).size;

      return size <= MAX_GRAPHQL_BLOB_SIZE
        ? `file_${index}: file(path: ${JSON.stringify(path)}) { oid }`
        : '';
    })
    .filter(Boolean)
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
      additions.map(({ path }, index) => {
        const { data } = additionChanges[index];

        return [
          path,
          {
            sha: commit[`file_${index}`]?.oid,
            // Preserve the original file for large uploads so the UI can create a blob URL
            ...(data instanceof Blob && data.size > MAX_GRAPHQL_BLOB_SIZE ? { file: data } : {}),
          },
        ];
      }),
    ),
  };
};

/**
 * Fetch commit history for the given file paths.
 * @param {string[]} paths File paths to fetch commit history for.
 * @returns {Promise<FileCommit[]>} Deduplicated and sorted list of commits.
 * @see https://docs.github.com/en/graphql/reference/objects#commit
 */
export const fetchFileCommits = async (paths) => {
  const innerQuery = paths
    .map(
      (path, i) => `
        history_${i}: ref(qualifiedName: $branch) {
          target {
            ... on Commit {
              history(first: 100, path: ${JSON.stringify(path)}) {
                nodes {
                  oid
                  author {
                    name
                    email
                    avatarUrl
                    user { login }
                  }
                  committedDate
                }
              }
            }
          }
        }
      `,
    )
    .join('');

  const query = `
    query($owner: String!, $repo: String!, $branch: String!) {
      repository(owner: $owner, name: $repo) {
        ${innerQuery}
      }
    }
  `;

  const data = /** @type {{ repository: Record<string, any> }} */ (await fetchGraphQL(query));
  /** @type {Map<string, FileCommit>} */
  const commitMap = new Map();

  paths.forEach((_path, i) => {
    const nodes = data.repository[`history_${i}`]?.target?.history?.nodes ?? [];

    nodes.forEach((/** @type {any} */ node) => {
      if (!commitMap.has(node.oid)) {
        commitMap.set(node.oid, {
          sha: node.oid,
          authorName: node.author.name,
          authorEmail: node.author.email,
          authorAvatarURL: node.author.avatarUrl,
          authorLogin: node.author.user?.login,
          date: new Date(node.committedDate),
        });
      }
    });
  });

  return [...commitMap.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
};
