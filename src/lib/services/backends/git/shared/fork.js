import { sleep } from '@sveltia/utils/misc';

import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import { cmsConfig } from '$lib/services/config';
import {
  ENTRY_ALREADY_PUBLISHED,
  forkedRepository,
  openAuthoring,
  openAuthoringInitialized,
  requestForkPermission,
} from '$lib/services/workflow/open-authoring';

/**
 * @import {
 * CommitOptions,
 * CommitResults,
 * ForkRequestState,
 * RepositoryInfo,
 * RepositoryPath,
 * WorkflowPullRequest,
 * WorkflowStatus,
 * } from '$lib/types/private';
 * @import { GitBackend } from '$lib/types/public';
 */

/**
 * How long to wait for a newly requested fork to become available. A service copies the repository
 * in the background, and a large one can take a while, so the polling is generous before giving up.
 */
const FORK_POLL = {
  interval: 1000,
  attempts: 30,
};

/**
 * Check whether Open Authoring is turned on for the given backend in the site configuration. It
 * doesn’t mean the signed-in user is actually contributing through a fork: a user who can write to
 * the configured repository keeps working on it directly. Use the `openAuthoring` store for that.
 * @param {GitBackend['name']} name Backend name, e.g. `github`.
 * @returns {boolean} `true` if the given backend is configured, with the `open_authoring` option
 * enabled.
 */
export const isOpenAuthoringConfiguredFor = (name) => {
  const { backend } = cmsConfig.current ?? {};

  return backend?.name === name && 'open_authoring' in backend && backend.open_authoring === true;
};

/**
 * Get the repository that receives the CMS’s commits: the signed-in user’s fork when the current
 * session is an Open Authoring one, and the configured repository otherwise. Content is always read
 * from the configured repository, so this is only for writes and for the branches behind them.
 * @param {RepositoryInfo} repository Configured repository.
 * @returns {RepositoryPath} Repository owner and name.
 */
export const resolveWorkflowRepository = ({ owner, repo }) =>
  forkedRepository.current ?? { owner, repo };

/**
 * Make sure a fork can be created, which takes both the service allowing it and the user agreeing
 * to it. Creating a repository on someone’s account is not something to do behind their back.
 * @param {object} args Arguments.
 * @param {string} args.repoPath Repository path to be forked, e.g. `owner/repo`.
 * @param {boolean} args.allowForking Whether the service allows the repository to be forked.
 * @throws {Error} When forking is turned off, or the user declined it.
 */
export const ensureForkPermission = async ({ repoPath, allowForking }) => {
  // Say so rather than letting the fork request fail with nothing to act on
  if (!allowForking) {
    throw createLocalizedError(
      'The repository does not allow forking',
      'open_authoring.forking_disabled',
      { repo: repoPath },
    );
  }

  if (!(await requestForkPermission(repoPath))) {
    throw createLocalizedError(
      'Permission to fork the repository was declined',
      'open_authoring.fork_declined',
    );
  }
};

/**
 * Wait until a newly requested fork can be committed to. A service creates a fork asynchronously
 * and the request returns before the copy is complete, so committing to it right away could fail.
 * @param {object} args Arguments.
 * @param {string} args.repoPath Fork path, e.g. `owner/repo`, for the error message.
 * @param {() => Promise<'ready' | 'pending' | 'failed'>} args.checkFork Function to report how far
 * the copy has got. `failed` is for a service that says it has given up, which no amount of waiting
 * will change.
 * @param {number} [args.attemptsLeft] Number of attempts remaining, used for the recursive retry.
 * @throws {Error} When the fork hasn’t become available within the allotted time, or the copy
 * failed outright.
 */
export const pollForFork = async ({ repoPath, checkFork, attemptsLeft = FORK_POLL.attempts }) => {
  const status = await checkFork();

  if (status === 'ready') {
    return;
  }

  // Retrying wouldn’t help: the service has given up on the copy, and the contributor has a broken
  // repository on their account that they have to remove before trying again
  if (status === 'failed') {
    throw createLocalizedError('The fork could not be created.', 'open_authoring.fork_failed', {
      repo: repoPath,
    });
  }

  if (attemptsLeft <= 1) {
    throw createLocalizedError(
      'Timed out waiting for the fork to be created.',
      'open_authoring.fork_failed',
      { repo: repoPath },
    );
  }

  await sleep(FORK_POLL.interval);
  await pollForFork({ repoPath, checkFork, attemptsLeft: attemptsLeft - 1 });
};

/**
 * Run a backend’s Open Authoring set-up for the signed-in user. Whether they end up on a fork or,
 * as a maintainer, on the configured repository, the outcome is flagged as known once the set-up
 * has completed, for what depends on it.
 * @param {() => Promise<void>} setUp Backend’s set-up, which records a fork if the user needs one.
 * @throws {Error} When the fork could not be set up.
 * @see https://sveltiacms.app/en/docs/workflows/open
 */
export const runOpenAuthoringSetUp = async (setUp) => {
  forkedRepository.current = undefined;
  openAuthoringInitialized.current = false;

  await setUp();

  openAuthoringInitialized.current = true;
};

/**
 * Make sure the signed-in user can publish an unpublished entry, which an Open Authoring
 * contributor can’t: merging their own pull request is what they lack the access for in the first
 * place.
 * @throws {Error} When the user is a contributor.
 */
export const checkPublishAllowed = () => {
  if (openAuthoring.current) {
    throw createLocalizedError(
      'Cannot publish as an Open Authoring contributor',
      'open_authoring.publish_unsupported',
    );
  }
};

/**
 * Make sure the signed-in user can make the given commit. An Open Authoring contributor can’t write
 * to the configured repository at all, so a change that doesn’t go through Editorial Workflow has
 * nowhere to land. This fails with an explanation rather than letting the API reject the commit
 * with a bare permission error.
 * @param {CommitOptions} options Commit options.
 * @throws {Error} When the user is a contributor and the commit isn’t on a workflow branch.
 */
export const checkDirectCommitAllowed = ({ branch }) => {
  if (openAuthoring.current && !branch) {
    throw createLocalizedError(
      'Cannot commit directly to the configured repository',
      'open_authoring.direct_commit_unsupported',
    );
  }
};

/**
 * Make sure an Open Authoring contributor can move an entry to the given stage. The stage that says
 * an entry is ready to be published is a maintainer’s, so it’s left out of the board and the status
 * menu for a contributor; this catches a request that got through anyway.
 * @param {WorkflowStatus} status New status.
 * @throws {Error} When the entry is being marked ready to publish.
 */
export const checkStatusAllowed = (status) => {
  if (status === 'pending_publish') {
    throw createLocalizedError(
      'Cannot mark an entry ready to publish as an Open Authoring contributor',
      'open_authoring.publish_unsupported',
    );
  }
};

/**
 * Find out whether the request an Open Authoring entry had, which a maintainer has merged since the
 * board was loaded, took everything the entry’s branch holds. It did if the branch still points at
 * the commit the request was merged at: the entry is published, and handing it over for review
 * again would open a request with nothing in it. The leftover branch is then deleted, the way the
 * next load would, and the entry reported as published. A branch that’s gone, which a maintainer
 * can delete with the merge, has nothing left on it either.
 *
 * The branch head is read afresh rather than taken from the entry: a commit made since in another
 * tab, or by a colleague sharing the fork, isn’t on record there, and deleting the branch would
 * lose it.
 * @param {object} args Arguments.
 * @param {string} args.branch Workflow branch name.
 * @param {string} args.mergedSHA Head commit the request was merged at.
 * @param {(branch: string) => Promise<string | undefined>} args.fetchBranchHead Function to read
 * the commit the branch points at, `undefined` if it’s gone.
 * @param {(branch: string) => Promise<void>} args.deleteBranch Function to delete the branch.
 * @throws {Error} An {@link ENTRY_ALREADY_PUBLISHED} error when the branch has nothing left on it.
 * Nothing is thrown when the contributor has committed to the branch since the merge, which makes
 * the entry a fresh draft.
 */
export const checkMergedBranch = async ({ branch, mergedSHA, fetchBranchHead, deleteBranch }) => {
  const head = await fetchBranchHead(branch);

  if (head && head !== mergedSHA) {
    return;
  }

  // Deleting a branch is best effort: `deleteBranch` logs a failure rather than raising it, and a
  // branch that outlives this is picked up on the next load
  if (head) {
    await deleteBranch(branch);
  }

  throw createLocalizedError(ENTRY_ALREADY_PUBLISHED, 'open_authoring.entry_already_published');
};

/**
 * Go through the Editorial Workflow branches in the contributor’s fork, deleting the ones left
 * over from a merged request and parsing the rest. A merged request whose head the branch still
 * points at has nothing left on it. Tidying it up keeps the fork from collecting a branch per
 * published entry, and saves comparing each one with the configured branch on every load just to
 * find out it holds nothing. A branch the contributor has committed to since the merge has a
 * different head, so it survives and shows up as a fresh draft.
 * @template T
 * @param {T[]} items Branches as read by the backend.
 * @param {(item: T, index: number) => { leftover: string } | { pending: WorkflowPullRequest }}
 * classify Function to tell a leftover branch, by its name, from one with an entry on it, parsed.
 * @param {(branch: string) => Promise<void>} deleteBranch Function to delete a branch.
 * @returns {Promise<WorkflowPullRequest[]>} Parsed branches that weren’t left over.
 */
export const pruneForkBranches = async (items, classify, deleteBranch) => {
  /** @type {string[]} */
  const leftover = [];
  /** @type {WorkflowPullRequest[]} */
  const pending = [];

  items.forEach((item, index) => {
    const result = classify(item, index);

    if ('leftover' in result) {
      leftover.push(result.leftover);
    } else {
      pending.push(result.pending);
    }
  });

  // Deleting a branch is best effort: `deleteBranch` logs a failure rather than raising it, and a
  // branch that outlives this is picked up on the next load
  await runConcurrently(leftover, deleteBranch);

  return pending;
};

/**
 * Move an Open Authoring entry between the drafting and review stages. A contributor can’t label a
 * request on a repository they don’t have access to, so the stage is recorded in the request
 * itself: a draft is a branch with no request, or one that’s still a draft, while an entry in
 * review has a request waiting for a maintainer. The steps are the same on every service, which
 * supplies the requests that differ.
 * @param {object} args Arguments.
 * @param {WorkflowPullRequest} args.pullRequest Pull request.
 * @param {WorkflowStatus} args.status New status.
 * @param {'number' | 'nodeId'} args.requestKey Property of the pull request that identifies the
 * request on the service, `undefined` until one is opened.
 * @param {(args: { branch: string, title: string, status: WorkflowStatus }) =>
 * Promise<WorkflowPullRequest>} args.createRequest Function to open the request.
 * @param {(pullRequest: WorkflowPullRequest) => Promise<ForkRequestState | undefined>}
 * args.fetchRequest Function to read the current state of the request. `undefined` means the
 * request couldn’t be found, in which case the entry carries on with what it knows.
 * @param {(args: { pullRequest: WorkflowPullRequest, status: WorkflowStatus, state?: string,
 * draft?: boolean }) => Promise<void>} args.applyStatus Function to bring the request in line with
 * the new status, given the state it’s in.
 * @param {(branch: string) => Promise<string | undefined>} args.fetchBranchHead Function to read
 * the commit a branch points at: see {@link checkMergedBranch}.
 * @param {(branch: string) => Promise<void>} args.deleteBranch Function to delete a branch.
 * @returns {Promise<WorkflowPullRequest>} Updated pull request, or a new one if the known one is no
 * longer the entry’s.
 * @throws {Error} When the entry is being marked ready to publish, which a contributor can’t do, or
 * has been published since the board was loaded: see {@link checkMergedBranch}.
 * @see https://github.com/sveltia/sveltia-cms/security/advisories/GHSA-8h97-74c4-g246
 */
export const updateForkStatusWith = async (args) => {
  const { pullRequest, status, requestKey, createRequest, fetchRequest, applyStatus } = args;
  const { fetchBranchHead, deleteBranch } = args;

  checkStatusAllowed(status);

  const { branch, title } = pullRequest;

  // Nothing has been opened yet, so moving out of the drafting stage is what creates the request.
  // Moving within the drafting stage leaves the branch as it is
  if (pullRequest[requestKey] === undefined) {
    return status === 'draft'
      ? { ...pullRequest, status, updatedDate: new Date() }
      : createRequest({ branch, title, status });
  }

  // The request may have been closed, reopened or merged outside the CMS, so read the current state
  // rather than inferring it from the status the entry was last seen with
  const request = await fetchRequest(pullRequest);

  if (request) {
    const { merged, isEntryRequest, getMergedSHA } = request;

    // It may have been merged into the configured branch since the board was loaded. With nothing
    // committed to the branch since, the entry is published and has nothing left to review
    if (merged && isEntryRequest) {
      await checkMergedBranch({
        branch,
        mergedSHA: await getMergedSHA(),
        fetchBranchHead,
        deleteBranch,
      });
    }

    // Otherwise a merged request, or one aimed at another branch since the board was loaded, is no
    // longer the entry’s review, which is how the next load would see it too: reopening it or
    // taking it out of draft would put a request for that other branch in front of the maintainers,
    // or claim a merged one is in review. So the entry carries on without it, as a fresh draft. A
    // service allows one open request per head and base, so one aimed elsewhere doesn’t stand in
    // the way of a new one to the configured branch
    if (merged || !isEntryRequest) {
      return updateForkStatusWith({
        ...args,
        pullRequest: { ...pullRequest, number: undefined, nodeId: undefined, url: undefined },
      });
    }
  }

  await applyStatus({ pullRequest, status, state: request?.state, draft: request?.draft });

  return { ...pullRequest, status, updatedDate: new Date() };
};

/**
 * Build the pull request object standing in for an Open Authoring draft, which is nothing but a
 * branch in the contributor’s fork. The pull request is opened when they hand the entry over for
 * review, so maintainers aren’t notified about work that isn’t ready for them, and until then the
 * entry is described by the commit that created the branch.
 * @param {object} args Arguments.
 * @param {CommitResults} args.commit Commit just made on the branch.
 * @param {string} args.branch Branch name.
 * @param {string} args.title Title the pull request will be opened with.
 * @returns {WorkflowPullRequest} Pull request.
 */
export const createDraftPullRequest = ({ commit, branch, title }) => ({
  title,
  branch,
  status: /** @type {WorkflowStatus} */ ('draft'),
  createdDate: /** @type {Date} */ (commit.date),
  updatedDate: /** @type {Date} */ (commit.date),
  files: [],
  // Only a maintainer merges, and a contributor is never one
  canMerge: false,
});
