import { _ } from '@sveltia/i18n';
import { encodeBase64 } from '@sveltia/utils/file';

import { getWorkflowRepository } from '$lib/services/backends/git/github/fork';
import { fetchAliasedBatch } from '$lib/services/backends/git/github/graphql';
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
 * Maximum size of the Base64-encoded file contents sent in a single commit mutation (16 MB).
 * GitHub’s GraphQL API aborts a much larger request, which the browser only reports as a network
 * error, so the changes are split into several commits beyond this size.
 * @see https://github.com/sveltia/sveltia-cms/issues/1012
 */
export const MAX_COMMIT_PAYLOAD_SIZE = 16 * 1024 * 1024;

/**
 * A file addition in a commit mutation, along with the change it comes from.
 * @typedef {object} FileAddition
 * @property {number} index Index of the addition in the changeset, which is used to alias the file
 * in the query for its new SHA.
 * @property {string} path File path.
 * @property {string} contents Base64-encoded file contents.
 * @property {FileChange['data']} data Original file data.
 */

/**
 * Split file additions into groups, each of which is committed in a single mutation. Assets come
 * first and text files like entries last, so an entry never lands in the repository before the
 * files it refers to. The deletions go into the last commit, so a file that is deleted and added
 * again at the same path, which GitHub resolves within a single commit, goes into the last group
 * as well, however large it is; otherwise the deletion would remove it again.
 * @param {FileAddition[]} additions File additions.
 * @param {Set<string>} [deletedPaths] Paths of the files to be deleted.
 * @returns {FileAddition[][]} Groups of file additions. There is always at least one group, which
 * can be empty, so a changeset with only deletions is still committed.
 */
export const splitAdditions = (additions, deletedPaths = new Set()) => {
  /** @type {FileAddition[][]} */
  const groups = [[]];
  let size = 0;

  additions
    .filter(({ path }) => !deletedPaths.has(path))
    .toSorted((a, b) => Number(typeof a.data === 'string') - Number(typeof b.data === 'string'))
    .forEach((addition) => {
      const { length } = addition.contents;

      // A single file over the limit goes on its own
      if (size && size + length > MAX_COMMIT_PAYLOAD_SIZE) {
        groups.push([]);
        size = 0;
      }

      /** @type {FileAddition[]} */ (groups.at(-1)).push(addition);
      size += length;
    });

  /** @type {FileAddition[]} */ (groups.at(-1)).push(
    ...additions.filter(({ path }) => deletedPaths.has(path)),
  );

  return groups;
};

/**
 * Commit the given additions and deletions on top of the given head.
 * @param {object} args Arguments.
 * @param {string} args.owner Repository owner.
 * @param {string} args.repo Repository name.
 * @param {string} args.branch Branch name.
 * @param {string} args.expectedHeadOid Commit the new commit has to go on top of.
 * @param {FileAddition[]} args.additions File additions.
 * @param {{ path: string }[]} args.deletions File deletions.
 * @param {string} args.message Commit message.
 * @param {boolean} args.onWorkflowBranch Whether the commit goes to an Editorial Workflow branch.
 * @returns {Promise<Record<string, any>>} Commit, including the new file SHAs aliased as
 * `file_{index}`.
 */
const createCommit = async ({
  owner,
  repo,
  branch,
  expectedHeadOid,
  additions,
  deletions,
  message,
  onWorkflowBranch,
}) => {
  // Part of the query to fetch new file SHAs; skip files over 10 MB to avoid a GitHub GraphQL
  // limitation where large blob OIDs cannot be resolved
  // @see https://github.com/sveltia/sveltia-cms/issues/692
  const fileShaQuery = additions
    .map(({ index, path, data }) => {
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
    expectedHeadOid,
    fileChanges: {
      additions: additions.map(({ path, contents }) => ({ path, contents })),
      deletions,
    },
    message: { headline: message },
  };

  try {
    const {
      createCommitOnBranch: { commit },
    } = /** @type {{ createCommitOnBranch: { commit: Record<string, any> }}} */ (
      await fetchGraphQL(query, { input })
    );

    return commit;
  } catch (ex) {
    // Tell a commit refused over a moved head from any other failure, so the user is told what
    // happened and to try again, which picks up the other change first. GitHub says so in the
    // error message, but the head is looked up rather than the wording relied upon. A failed lookup
    // leaves the original error to be reported
    const head = onWorkflowBranch ? undefined : await fetchLastCommit().catch(() => undefined);

    if (head && head.hash !== expectedHeadOid) {
      throw new Error('The branch has moved since the site data was loaded.', {
        cause: new Error(_('save_conflict.branch_moved')),
      });
    }

    throw ex;
  }
};

/**
 * Save entries or assets remotely. The changes normally go into a single commit, but a large
 * changeset, typically an entry with many new images, is split into several commits made one after
 * another, with the entry files in the last one.
 * @param {FileChange[]} changes File changes to be saved.
 * @param {CommitOptions} options Commit options.
 * @returns {Promise<CommitResults>} Commit results, including the commit SHA and updated file SHAs.
 * The commit is the last one made when the changes have been split.
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
  const branch = /** @type {string} */ (options.branch ?? repository.branch);

  /** @type {FileAddition[]} */
  const additions = await Promise.all(
    changes
      .filter(({ action }) => ['create', 'update', 'move'].includes(action))
      .map(async ({ path, data }, index) => ({
        index,
        path,
        contents: await encodeBase64(data ?? ''),
        data,
      })),
  );

  const deletions = changes
    .filter(({ action }) => ['move', 'delete'].includes(action))
    .map(({ previousPath, path }) => ({ path: previousPath ?? path }));

  const groups = splitAdditions(additions, new Set(deletions.map(({ path }) => path)));
  const message = createCommitMessage(changes, options);
  let expectedHeadOid = await getExpectedHeadOid(options);
  /** @type {Record<string, any>} */
  let commit = {};
  /** @type {Record<string, any>} */
  const fileShas = {};

  // Commit the groups one by one, each on top of the previous one. The deletions go into the last
  // commit along with the entries, so a file isn’t removed before the entry stops referring to it
  // eslint-disable-next-line no-restricted-syntax
  for (const [groupIndex, group] of groups.entries()) {
    try {
      // eslint-disable-next-line no-await-in-loop
      commit = await createCommit({
        owner,
        repo,
        branch,
        expectedHeadOid,
        additions: group,
        deletions: groupIndex === groups.length - 1 ? deletions : [],
        message,
        onWorkflowBranch: !!options.branch,
      });
    } catch (ex) {
      // Some of the assets have landed on the configured branch, but the entry hasn’t. Take the
      // last commit made as the known head, so the check before the retry doesn’t load those
      // assets, which would then be saved again under different names. The retry saves them under
      // the same paths instead, with the same content, along with the entry. A workflow branch
      // isn’t tracked this way; it’s reset from scratch when no pull request comes out of it
      if (groupIndex > 0 && !options.branch) {
        repositoryHead.current = expectedHeadOid;
      }

      throw ex;
    }

    Object.assign(fileShas, commit);
    expectedHeadOid = commit.oid;
  }

  return {
    sha: commit.oid,
    date: new Date(commit.committedDate),
    files: Object.fromEntries(
      additions.map(({ index, path, data }) => [
        path,
        {
          sha: fileShas[`file_${index}`]?.oid,
          // Preserve the original file for large uploads so the UI can create a blob URL
          ...(data instanceof Blob && data.size > MAX_GRAPHQL_BLOB_SIZE ? { file: data } : {}),
        },
      ]),
    ),
  };
};

/**
 * Number of file paths whose history is requested per GraphQL query. Each one asks for up to 100
 * commits, so a long list is split to keep a query within the API’s cost limits.
 */
const FILE_COMMITS_CHUNK_SIZE = 50;

/**
 * Fetch commit history for the given file paths.
 * @param {string[]} paths File paths to fetch commit history for.
 * @returns {Promise<FileCommit[]>} Deduplicated and sorted list of commits.
 * @see https://docs.github.com/en/graphql/reference/objects#commit
 */
export const fetchFileCommits = async (paths) => {
  const results = await fetchAliasedBatch({
    items: paths,
    alias: 'history',
    useBranch: true,
    /**
     * Build the field selection for the history of a file.
     * @param {string} path File path.
     * @returns {string} Field selection.
     */
    getFragment: (path) => `
      ref(qualifiedName: $branch) {
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
    chunkSize: FILE_COMMITS_CHUNK_SIZE,
  });

  return dedupeFileCommits(
    results.flatMap((result) =>
      (result?.target?.history?.nodes ?? []).map((/** @type {any} */ node) => ({
        sha: node.oid,
        authorName: node.author.name,
        authorEmail: node.author.email,
        authorAvatarURL: node.author.avatarUrl,
        authorLogin: node.author.user?.login,
        date: new Date(node.committedDate),
      })),
    ),
  );
};
