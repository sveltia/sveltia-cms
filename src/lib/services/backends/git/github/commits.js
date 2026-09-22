import { _ } from '@sveltia/i18n';
import { encodeBase64 } from '@sveltia/utils/file';

import { getWorkflowRepository } from '$lib/services/backends/git/github/fork';
import { repository } from '$lib/services/backends/git/github/repository';
import { fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { createCommitMessage, dedupeFileCommits } from '$lib/services/backends/git/shared/commits';
import { repositoryHead } from '$lib/services/backends/git/shared/fetch';
import { openAuthoring } from '$lib/services/workflow/open-authoring';

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
 * @param {string} [branchName] Branch to look at. Default: the branch configured in the site
 * configuration. An Editorial Workflow branch can be passed here, in which case the commit is
 * looked up in the repository that holds the workflow branches — the contributor’s fork with Open
 * Authoring, and the configured repository otherwise.
 * @returns {Promise<{ hash: string, message: string }>} Commit’s SHA-1 hash and message.
 * @throws {Error} When the branch could not be found.
 */
export const fetchLastCommit = async (branchName) => {
  const { owner, repo } = branchName ? getWorkflowRepository() : repository;
  const branch = branchName ?? repository.branch;

  const result = /** @type {LastCommitResponse} */ (
    await fetchGraphQL(FETCH_LAST_COMMIT_QUERY, { owner, repo, ...(branchName ? { branch } : {}) })
  );

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
 * Get the head a commit is expected to go on top of. The caller knows it when it has just created
 * the branch. On the configured branch, it’s the commit the loaded site data reflects, which the
 * caller has just brought up to date: GitHub then refuses the commit if someone else has pushed in
 * the meantime, rather than letting it overwrite their change. A workflow branch is only ever
 * written by its own author, so its head is simply looked up.
 * @param {CommitOptions} options Commit options.
 * @returns {Promise<string>} Commit SHA.
 */
const getExpectedHeadOid = async ({ headOid, branch }) => {
  if (headOid) {
    return headOid;
  }

  if (!branch && repositoryHead.current) {
    return repositoryHead.current;
  }

  return (await fetchLastCommit(branch)).hash;
};

/**
 * Save entries or assets remotely.
 * @param {FileChange[]} changes File changes to be saved.
 * @param {CommitOptions} options Commit options.
 * @returns {Promise<CommitResults>} Commit results, including the commit SHA and updated file SHAs.
 * @see https://github.blog/changelog/2021-09-13-a-simpler-api-for-authoring-commits/
 * @see https://docs.github.com/en/graphql/reference/mutations#createcommitonbranch
 */
export const commitChanges = async (changes, options) => {
  // An Open Authoring contributor can’t write to the configured repository at all, so a change that
  // doesn’t go through Editorial Workflow has nowhere to land. Fail here with an explanation rather
  // than letting the API reject the commit with a bare permission error
  if (openAuthoring.current && !options.branch) {
    throw new Error('Cannot commit directly to the configured repository', {
      cause: new Error(_('open_authoring.direct_commit_unsupported')),
    });
  }

  // A workflow branch lives in the contributor’s fork with Open Authoring, while the configured
  // branch is only ever committed to by someone who can write to the configured repository
  const { owner, repo } = options.branch ? getWorkflowRepository() : repository;
  const branch = options.branch ?? repository.branch;

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

  const expectedHeadOid = await getExpectedHeadOid(options);

  const input = {
    branch: {
      repositoryNameWithOwner: `${owner}/${repo}`,
      branchName: branch,
    },
    expectedHeadOid,
    fileChanges: { additions, deletions },
    message: { headline: createCommitMessage(changes, options) },
  };

  /** @type {Record<string, any>} */
  let commit;

  try {
    ({
      createCommitOnBranch: { commit },
    } = /** @type {{ createCommitOnBranch: { commit: Record<string, any> }}} */ (
      await fetchGraphQL(query, { input })
    ));
  } catch (ex) {
    // Tell a commit refused over a moved head from any other failure, so the user is told what
    // happened and to try again, which picks up the other change first. GitHub says so in the
    // error message, but the head is looked up rather than the wording relied upon. A failed lookup
    // leaves the original error to be reported
    const head = options.branch ? undefined : await fetchLastCommit().catch(() => undefined);

    if (head && head.hash !== expectedHeadOid) {
      throw new Error('The branch has moved since the site data was loaded.', {
        cause: new Error(_('save_conflict.branch_moved')),
      });
    }

    throw ex;
  }

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

  return dedupeFileCommits(
    paths.flatMap((_path, i) =>
      (data.repository[`history_${i}`]?.target?.history?.nodes ?? []).map(
        (/** @type {any} */ node) => ({
          sha: node.oid,
          authorName: node.author.name,
          authorEmail: node.author.email,
          authorAvatarURL: node.author.avatarUrl,
          authorLogin: node.author.user?.login,
          date: new Date(node.committedDate),
        }),
      ),
    ),
  );
};
