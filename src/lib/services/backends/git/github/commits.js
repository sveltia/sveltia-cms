import { encodeBase64 } from '@sveltia/utils/file';

import { clearSaveProgress, reportCommits } from '$lib/services/backends/commit-progress';
import { getWorkflowRepository } from '$lib/services/backends/git/github/fork';
import { fetchAliasedBatch } from '$lib/services/backends/git/github/graphql';
import { repository } from '$lib/services/backends/git/github/repository';
import { fetchGraphQL } from '$lib/services/backends/git/shared/api';
import {
  assertBranchNotMoved,
  createCommitMessage,
  createLastCommitError,
  dedupeFileCommits,
} from '$lib/services/backends/git/shared/commits';
import { checkDirectCommitAllowed } from '$lib/services/backends/git/shared/fork';
import { repositoryHead } from '$lib/services/backends/git/shared/head';
import { getByteSize } from '$lib/services/utils/file';

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
    throw createLastCommitError('repository_not_found', { repo });
  }

  if (!result.repository.ref) {
    throw createLastCommitError('branch_not_found', { repo, branch });
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
 * the meantime, rather than letting it overwrite their change. On a workflow branch, the caller
 * passes the head the entry was loaded or saved at when there is one, for the same reason;
 * otherwise the head is looked up.
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
 * Size of the Base64-encoded file contents sent in the first commit mutation (2 MB). GitHub closes
 * a request whose body hasn’t arrived within about ten seconds, so the size a commit can take
 * depends on the upload speed, which isn’t known until something has been uploaded. The size of the
 * following commits is worked out from the speed of the previous one.
 * @see https://github.com/sveltia/sveltia-cms/issues/1084
 */
export const INITIAL_COMMIT_PAYLOAD_SIZE = 2 * 1024 * 1024;

/**
 * Minimum size of the Base64-encoded file contents sent in a commit mutation (256 KB), so a slow
 * connection doesn’t end up with a commit per small file.
 */
export const MIN_COMMIT_PAYLOAD_SIZE = 256 * 1024;

/**
 * Time a commit mutation is meant to take (5 seconds), well within the time GitHub waits for a
 * request body.
 */
const TARGET_COMMIT_DURATION = 5000;
/**
 * HTTP statuses GitHub, or a proxy in front of it, answers a request with when it has taken too
 * long or is too large: 408 Request Timeout, 413 Content Too Large, 499 Client Closed Request, 502
 * Bad Gateway and 504 Gateway Timeout.
 */
const UPLOAD_FAILURE_STATUSES = [408, 413, 499, 502, 504];

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
 * Sort file additions in the order they are committed. Assets come first and text files like
 * entries last, so an entry never lands in the repository before the files it refers to. A file
 * that is deleted and added again at the same path, which GitHub resolves within a single commit,
 * is set aside, as it has to go into the last commit along with the deletions, however large it is;
 * otherwise the deletion would remove it again.
 * @param {FileAddition[]} additions File additions.
 * @param {Set<string>} [deletedPaths] Paths of the files to be deleted.
 * @returns {{ queue: FileAddition[], addedAgain: FileAddition[] }} Additions to be
 * committed in order, and those that go into the last commit.
 */
export const sortAdditions = (additions, deletedPaths = new Set()) => ({
  queue: additions
    .filter(({ path }) => !deletedPaths.has(path))
    .toSorted((a, b) => Number(typeof a.data === 'string') - Number(typeof b.data === 'string')),
  addedAgain: additions.filter(({ path }) => deletedPaths.has(path)),
});

/**
 * Take the file additions for the next commit from the start of the queue, as many as fit in the
 * given payload size. A single file over the size is taken on its own.
 * @param {FileAddition[]} queue Additions yet to be committed. Modified in place.
 * @param {number} maxSize Maximum size of the Base64-encoded file contents.
 * @returns {FileAddition[]} Additions taken.
 */
export const takeAdditions = (queue, maxSize) => {
  /** @type {FileAddition[]} */
  const group = [];
  let size = 0;

  while (queue.length && (!group.length || size + queue[0].contents.length <= maxSize)) {
    const addition = /** @type {FileAddition} */ (queue.shift());

    group.push(addition);
    size += addition.contents.length;
  }

  return group;
};

/**
 * Get the payload size of the given additions.
 * @param {FileAddition[]} additions File additions.
 * @returns {number} Total size of their Base64-encoded contents.
 */
export const getPayloadSize = (additions) =>
  additions.reduce((total, { contents }) => total + contents.length, 0);

/**
 * Estimate how many commits are left to make for the given additions at the given commit size. The
 * last commit is always made, even when it only has the entry files or deletions, so there is at
 * least one.
 * @param {FileAddition[]} queue Additions yet to be committed.
 * @param {number} payloadSize Payload size of each commit.
 * @returns {number} Number of commits.
 */
export const estimateRemainingCommits = (queue, payloadSize) =>
  Math.max(1, Math.ceil(getPayloadSize(queue) / payloadSize));

/**
 * Work out the payload size of the next commit from how long the previous one took, so a commit
 * takes about {@link TARGET_COMMIT_DURATION} on the connection.
 * @param {number} size Size of the Base64-encoded file contents sent in the previous commit.
 * @param {number} duration Time the previous commit took, in milliseconds.
 * @returns {number} Payload size, between {@link MIN_COMMIT_PAYLOAD_SIZE} and
 * {@link MAX_COMMIT_PAYLOAD_SIZE}.
 */
export const getNextPayloadSize = (size, duration) =>
  Math.min(
    MAX_COMMIT_PAYLOAD_SIZE,
    Math.max(
      MIN_COMMIT_PAYLOAD_SIZE,
      Math.floor((size / Math.max(duration, 1)) * TARGET_COMMIT_DURATION),
    ),
  );

/**
 * Check if a commit mutation has failed because its request took too long or was too large, which
 * the browser typically reports as a network error, as GitHub’s answer comes without CORS headers.
 * @param {any} ex Error thrown.
 * @returns {boolean} Result.
 */
export const isUploadFailure = (ex) =>
  ex?.message === 'Failed to send the request' ||
  UPLOAD_FAILURE_STATUSES.includes(ex?.cause?.status);

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
    .map(({ index, path, data }) =>
      getByteSize(data ?? '') <= MAX_GRAPHQL_BLOB_SIZE
        ? `file_${index}: file(path: ${JSON.stringify(path)}) { oid }`
        : '',
    )
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
    // GitHub says so in the error message, but the head is looked up rather than the wording
    // relied upon
    if (!onWorkflowBranch) {
      await assertBranchNotMoved(expectedHeadOid, fetchLastCommit);
    }

    throw ex;
  }
};

/**
 * Save entries or assets remotely. The changes normally go into a single commit, but a large
 * changeset, typically an entry with many new images, is split into several commits made one after
 * another, with the entry files in the last one. The size of each commit follows the upload speed
 * measured on the previous one, and a commit that times out is retried with fewer files.
 * @param {FileChange[]} changes File changes to be saved.
 * @param {CommitOptions} options Commit options.
 * @returns {Promise<CommitResults>} Commit results, including the commit SHA and updated file SHAs.
 * The commit is the last one made when the changes have been split.
 * @see https://github.blog/changelog/2021-09-13-a-simpler-api-for-authoring-commits/
 * @see https://docs.github.com/en/graphql/reference/mutations#createcommitonbranch
 */
export const commitChanges = async (changes, options) => {
  checkDirectCommitAllowed(options);

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

  const { queue, addedAgain } = sortAdditions(
    additions,
    new Set(deletions.map(({ path }) => path)),
  );

  const message = createCommitMessage(changes, options);
  let expectedHeadOid = await getExpectedHeadOid(options);
  let payloadSize = INITIAL_COMMIT_PAYLOAD_SIZE;
  // Smallest payload that has timed out, which the following commits stay below, as the speed
  // measured on a slow or uneven connection can suggest a size that has already failed
  let timedOutSize = Infinity;
  let commitCount = 0;
  /** @type {Record<string, any>} */
  let commit = {};
  /** @type {Record<string, any>} */
  const fileShas = {};

  // Commit the additions in groups, each on top of the previous one, sized so that each commit
  // takes a few seconds to upload. The deletions go into the last commit along with the entries,
  // so a file isn’t removed before the entry stops referring to it. There is always at least one
  // commit, which can have no additions, so a changeset with only deletions is still committed
  try {
    do {
      // The files still waiting, at the current commit size, make up the commits yet to be made
      reportCommits(commitCount, commitCount + estimateRemainingCommits(queue, payloadSize));

      const group = takeAdditions(queue, payloadSize);
      const isLast = !queue.length;
      const groupSize = getPayloadSize(group);
      const startTime = performance.now();

      try {
        // eslint-disable-next-line no-await-in-loop
        commit = await createCommit({
          owner,
          repo,
          branch,
          expectedHeadOid,
          additions: isLast ? [...group, ...addedAgain] : group,
          deletions: isLast ? deletions : [],
          message,
          onWorkflowBranch: !!options.branch,
        });
      } catch (ex) {
        // The upload has taken too long on the connection. Put the files back and try again with
        // half of them, provided the branch is still where it was, so the commit hasn’t landed
        if (
          group.length > 1 &&
          isUploadFailure(ex) &&
          // eslint-disable-next-line no-await-in-loop
          (await fetchLastCommit(options.branch).catch(() => undefined))?.hash === expectedHeadOid
        ) {
          queue.unshift(...group);
          timedOutSize = Math.min(timedOutSize, groupSize);
          payloadSize = Math.floor(groupSize / 2);
          // eslint-disable-next-line no-continue
          continue;
        }

        // Some of the assets have landed on the configured branch, but the entry hasn’t. Take the
        // last commit made as the known head, so the check before the retry doesn’t load those
        // assets, which would then be saved again under different names. The retry saves them
        // under the same paths instead, with the same content, along with the entry. A workflow
        // branch isn’t tracked this way; it’s reset from scratch when no pull request comes out of
        // it
        if (commitCount && !options.branch) {
          repositoryHead.current = expectedHeadOid;
        }

        throw ex;
      }

      payloadSize = Math.min(
        getNextPayloadSize(groupSize, performance.now() - startTime),
        timedOutSize - 1,
      );
      commitCount += 1;
      Object.assign(fileShas, commit);
      expectedHeadOid = commit.oid;
    } while (queue.length);
  } finally {
    clearSaveProgress();
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
                messageHeadline
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
        message: node.messageHeadline ?? '',
        // The author can be `null` when the commit has no valid author info
        authorName: node.author?.name ?? '',
        authorEmail: node.author?.email,
        authorAvatarURL: node.author?.avatarUrl,
        authorLogin: node.author?.user?.login,
        date: new Date(node.committedDate),
      })),
    ),
  );
};
