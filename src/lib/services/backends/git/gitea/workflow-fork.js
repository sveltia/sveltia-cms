import { getWorkflowRepository } from '$lib/services/backends/git/gitea/fork';
import {
  createPullRequest,
  deleteBranch,
  fetchAllPages,
  fetchBranchHead,
  fetchPullRequestFileContents,
  fetchPullRequestFileList,
  fetchPullRequestHeadRef,
  stripWipPrefix,
  updateDraftState,
} from '$lib/services/backends/git/gitea/pull-requests';
import { repository } from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { pruneForkBranches, updateForkStatusWith } from '$lib/services/backends/git/shared/fork';
import { encodePath } from '$lib/services/backends/git/shared/url';
import { user } from '$lib/services/user/account.svelte';
import { getBranchListPrefix } from '$lib/services/workflow/branch';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

/**
 * @import {
 * ForkRequestState,
 * WorkflowFile,
 * WorkflowPullRequest,
 * WorkflowStatus,
 * } from '$lib/types/private';
 */

/**
 * Fetch the Editorial Workflow branches in the contributor’s fork. With Open Authoring the branches
 * are the source of truth: a draft has no pull request yet, so listing pull requests alone would
 * miss it.
 * @returns {Promise<Record<string, any>[]>} Branches whose name starts with the workflow prefix.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoListBranches
 */
export const fetchForkBranchList = async () => {
  const { owner, repo } = getWorkflowRepository();
  const prefix = getBranchListPrefix();
  // The instance can’t filter by prefix, so every branch is listed. A fork holds few besides the
  // workflow ones, so it’s a page or two in practice
  const branches = await fetchAllPages(`/repos/${owner}/${repo}/branches`);

  return branches.filter(({ name }) => name.startsWith(prefix));
};

/**
 * Check whether the given pull request is one the CMS manages for the contributor: opened by them,
 * from the fork the CMS is working in, to the configured branch. The configured repository can have
 * a branch of the same name, whose pull request isn’t the contributor’s; one they aimed at another
 * branch is their own business, and acting on it — reopening or closing it as the entry moves —
 * would be meddling with a review the CMS knows nothing about; and someone else’s pull request from
 * the contributor’s branch would put their title on the entry, which the contributor could neither
 * convert, reopen nor close.
 * @param {Record<string, any>} item Pull request returned by the REST API.
 * @returns {boolean} Result.
 * @see https://github.com/sveltia/sveltia-cms/security/advisories/GHSA-p8qh-54q9-2qjx
 * @see https://github.com/sveltia/sveltia-cms/security/advisories/GHSA-8h97-74c4-g246
 */
export const isForkPullRequest = (item) => {
  const fork = forkedRepository.current;
  const userId = user.account?.id;

  return (
    !!fork &&
    item.head?.repo?.full_name?.toLowerCase() === `${fork.owner}/${fork.repo}`.toLowerCase() &&
    item.base?.ref === repository.branch &&
    userId !== undefined &&
    item.user?.id === userId
  );
};

/**
 * Fetch the pull requests the contributor has opened from their fork on the configured repository,
 * in any state. A branch in the fork doesn’t report them, so they’re looked up from the configured
 * repository instead, narrowed to the contributor’s own and matched by head branch here. The poster
 * filter is checked again on each one rather than trusted to have applied.
 * @returns {Promise<Map<string, Record<string, any>>>} Map of branch name to the most relevant pull
 * request opened from it, where there is one: the open one if any, otherwise the most recently
 * updated.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoListPullRequests
 */
export const fetchForkPullRequestMap = async () => {
  const { owner, repo } = repository;
  const login = /** @type {string} */ (user.account?.login);

  const items = await fetchAllPages(
    `/repos/${owner}/${repo}/pulls?state=all&sort=recentupdate&poster=${encodeURIComponent(login)}`,
  );

  /** @type {Map<string, Record<string, any>>} */
  const map = new Map();

  items.filter(isForkPullRequest).forEach((item) => {
    const branch = item.head.ref;
    const existing = map.get(branch);

    // The list is sorted by the last update, so the first match is the most recent one. An open
    // pull request wins over any other, because it’s the one the entry’s status has to reflect
    if (!existing || (existing.state !== 'open' && item.state === 'open')) {
      map.set(branch, item);
    }
  });

  return map;
};

/**
 * Parse a branch returned by the REST API.
 * @param {Record<string, any>} node Branch.
 * @param {Record<string, any>} [pullRequest] Pull request opened from the branch, from
 * {@link fetchForkPullRequestMap}.
 * @returns {WorkflowPullRequest} Parsed branch. A branch that turns out to hold nothing is dropped
 * later, by {@link fetchForkPullRequests}, once its file list is known.
 */
export const parseForkBranch = (node, pullRequest) => {
  const { name: branch, commit } = node;
  const { id: headSHA, message, timestamp, author } = commit;
  // A merged pull request is finished with. Either the branch is simply left over, in which case
  // comparing it with the configured branch turns up nothing and it drops off the board, or the
  // contributor has edited the entry again since the merge, which makes it a fresh draft. Carrying
  // the merged pull request forward would instead try to reopen it when the entry moves to review
  const current = pullRequest?.merged ? undefined : pullRequest;
  const isOpen = current?.state === 'open';
  // A closed pull request is treated the same as none at all: the contributor took the entry back
  // to the drafting stage, and moving it forward again reopens the request
  const inReview = isOpen && !current.draft;

  return {
    number: current?.number,
    nodeId: current ? String(current.id) : undefined,
    // Without a pull request there’s no title to show, so the head commit’s message stands in. It’s
    // the message the pull request would be opened with anyway. The prefix that marks a work in
    // progress is dropped, because it’s written back when the entry returns to the drafting stage —
    // keeping it would leave the pull request a work in progress on the way out of that stage
    title: stripWipPrefix(current?.title ?? message ?? ''),
    url: current?.html_url,
    branch,
    headSHA,
    status: inReview ? 'pending_review' : 'draft',
    createdDate: new Date(current?.created_at ?? timestamp),
    updatedDate: new Date(current?.updated_at ?? timestamp),
    author: author?.name
      ? { name: author.name, email: author.email ?? '', login: author.username }
      : undefined,
    // The files are filled in later: an open pull request reports them, while a branch without one
    // is compared with the configured branch
    files: [],
    // Only a maintainer merges, and a contributor is never one
    canMerge: false,
  };
};

/**
 * Fetch the files a fork branch changes, and populate the {@link WorkflowFile} objects in place. A
 * draft has no pull request to list files from, so the branch is compared with the fork’s copy of
 * the configured branch instead, which it was created from and which is brought up to date with
 * the configured repository on sign-in. The comparison runs in the fork rather than across
 * repositories: Gitea reads the files of each commit from the base repository then, which doesn’t
 * have the commits only the fork holds — a draft’s, for one — and fails with a 500. The comparison
 * reports the files touched by each commit rather than the net change, so the paths are gathered
 * from all of them; a file one of the commits removed since is found to be missing when its
 * content is fetched, and marked as deleted then. Like the content, the files are those of the
 * branch’s head commit as listed, rather than of whatever the branch points at by now.
 * @param {WorkflowPullRequest} pullRequest Branch to complete.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoCompareDiff
 */
export const fetchForkBranchFileList = async (pullRequest) => {
  const { owner, repo } = getWorkflowRepository();
  const base = encodePath(/** @type {string} */ (repository.branch));
  const head = encodePath(pullRequest.headSHA ?? pullRequest.branch);

  const { commits = [] } = /** @type {{ commits?: Record<string, any>[] }} */ (
    await fetchAPI(`/repos/${owner}/${repo}/compare/${base}...${head}`)
  );

  /** @type {Map<string, WorkflowFile>} */
  const files = new Map();

  commits.forEach(({ files: commitFiles = [] }) => {
    commitFiles.forEach((/** @type {any} */ { filename }) => {
      files.set(filename, { path: filename, sha: '', size: 0, deleted: false });
    });
  });

  pullRequest.files = [...files.values()];
};

/**
 * Fetch the unpublished entries of an Open Authoring contributor, which live in their fork.
 * @returns {Promise<WorkflowPullRequest[]>} Branches, with their pull requests and changed files.
 */
export const fetchForkPullRequests = async () => {
  const nodes = await fetchForkBranchList();

  if (!nodes.length) {
    return [];
  }

  const pullRequests = await fetchForkPullRequestMap();
  /** @type {Map<number, string | undefined>} */
  const mergedHeads = new Map();

  // The commit a pull request was merged at is read from its reference, because the head the pull
  // request reports follows the branch
  await runConcurrently(
    /** @type {Record<string, any>[]} */ (
      nodes.map(({ name }) => pullRequests.get(name)).filter((item) => !!item?.merged)
    ),
    async ({ number }) => {
      mergedHeads.set(number, await fetchPullRequestHeadRef(number));
    },
  );

  const pending = await pruneForkBranches(
    nodes,
    (node) => {
      const pullRequest = pullRequests.get(node.name);

      return pullRequest?.merged && mergedHeads.get(pullRequest.number) === node.commit?.id
        ? { leftover: node.name }
        : { pending: parseForkBranch(node, pullRequest) };
    },
    deleteBranch,
  );

  // An open pull request already reports the files it changes, which is cheaper than comparing the
  // branch with the configured branch. A closed pull request is left to the comparison as well:
  // its diff is no longer a reliable account of a branch that has moved on since
  await runConcurrently(pending, async (pullRequest) => {
    if (pullRequest.status === 'pending_review') {
      await fetchPullRequestFileList(pullRequest);
    } else {
      await fetchForkBranchFileList(pullRequest);
    }

    await fetchPullRequestFileContents(pullRequest);
  });

  // A branch that no longer differs from the configured branch holds nothing to publish. That’s
  // what a branch left behind by a squash-merged pull request looks like
  return pending.filter(({ files }) => files.length);
};

/**
 * Reopen a pull request that was closed earlier. The author of a pull request is allowed to do
 * this, so a contributor doesn’t need write access to the configured repository for it.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoEditPullRequest
 */
export const reopenPullRequest = async (pullRequest) => {
  const { owner, repo } = repository;

  await fetchAPI(`/repos/${owner}/${repo}/pulls/${pullRequest.number}`, {
    method: 'PATCH',
    body: { state: 'open' },
  });
};

/**
 * Read the current state of the pull request an Open Authoring entry has, for
 * {@link updateForkStatusWith}.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @returns {Promise<ForkRequestState>} State.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetPullRequest
 */
const fetchForkRequestState = async ({ number }) => {
  const { owner, repo } = repository;

  const item = /** @type {Record<string, any>} */ (
    await fetchAPI(`/repos/${owner}/${repo}/pulls/${number}`)
  );

  return {
    merged: !!item.merged,
    isEntryRequest: isForkPullRequest(item),
    /**
     * Read the head commit the pull request was merged at. It’s read from the pull request’s
     * reference, because the head the pull request reports follows the branch.
     * @returns {Promise<string>} Commit SHA.
     */
    getMergedSHA: async () => (await fetchPullRequestHeadRef(/** @type {number} */ (number))) ?? '',
    state: item.state,
    draft: item.draft,
  };
};

/**
 * Bring a pull request in line with the given status, for {@link updateForkStatusWith}.
 * @param {object} args Arguments.
 * @param {WorkflowPullRequest} args.pullRequest Pull request.
 * @param {WorkflowStatus} args.status New status.
 * @param {string} [args.state] Pull request state, e.g. `open`.
 * @param {boolean} [args.draft] Whether the pull request is a work in progress.
 */
const applyForkStatus = async ({ pullRequest, status, state, draft }) => {
  if (status === 'draft') {
    // Converting the pull request to a work in progress keeps it — and the discussion on it — in
    // place while taking it out of the maintainers’ review queue
    if (state === 'open' && !draft) {
      await updateDraftState(pullRequest, true);
    }
  } else {
    if (state === 'closed') {
      await reopenPullRequest(pullRequest);
    }

    if (draft) {
      await updateDraftState(pullRequest, false);
    }
  }
};

/**
 * Move an Open Authoring entry between the drafting and review stages. A contributor can’t label a
 * pull request on a repository they don’t have access to, so the stage is recorded in the pull
 * request itself: a draft is a branch with no pull request, or one that’s still a work in
 * progress, while an entry in review has a pull request waiting for a maintainer.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @param {WorkflowStatus} status New status.
 * @returns {Promise<WorkflowPullRequest>} Updated pull request, or a new one if the known one is
 * no longer the entry’s.
 * @throws {Error} When the entry is being marked ready to publish, which a contributor can’t do, or
 * has been published since the board was loaded: see {@link updateForkStatusWith}.
 */
export const updateForkStatus = async (pullRequest, status) =>
  updateForkStatusWith({
    pullRequest,
    status,
    requestKey: 'number',
    createRequest: createPullRequest,
    fetchRequest: fetchForkRequestState,
    applyStatus: applyForkStatus,
    fetchBranchHead,
    deleteBranch,
  });
