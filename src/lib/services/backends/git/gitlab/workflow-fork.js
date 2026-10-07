import { getWorkflowRepository, projectIds } from '$lib/services/backends/git/gitlab/fork';
import {
  createPullRequest,
  deleteBranch,
  DRAFT_TITLE_PREFIX,
  fetchBranchHead,
  fetchMergeRequest,
  fetchMergeRequestFileContents,
  MAX_ITEMS,
  parseDiff,
  stripDraftPrefix,
  toMergeRequest,
} from '$lib/services/backends/git/gitlab/merge-requests';
import { getProjectId, repository } from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import { checkMergedBranch, checkStatusAllowed } from '$lib/services/backends/git/shared/fork';
import { user } from '$lib/services/user/account.svelte';
import { getBranchPrefix } from '$lib/services/workflow/branch';

/**
 * @import { WorkflowPullRequest, WorkflowStatus } from '$lib/types/private';
 */

/**
 * Fetch the Editorial Workflow branches in the contributor’s fork. With Open Authoring the branches
 * are the source of truth: a draft has no merge request yet, so listing merge requests alone would
 * miss it.
 * @returns {Promise<Record<string, any>[]>} Branches, as returned by the API.
 * @see https://docs.gitlab.com/api/branches/#list-repository-branches
 */
export const fetchForkBranchList = async () => {
  const prefix = getBranchPrefix();

  const branches = /** @type {Record<string, any>[]} */ (
    await fetchAPI(
      `/projects/${getProjectId(getWorkflowRepository())}/repository/branches` +
        `?search=${encodeURIComponent(`^${prefix}`)}&per_page=${MAX_ITEMS.branches}`,
    )
  );

  // The list isn’t paginated, so going over the cap drops an arbitrary set of branches from the
  // board. Rare enough to leave unpaged, too confusing to leave unsaid
  if (branches.length === MAX_ITEMS.branches) {
    // eslint-disable-next-line no-console
    console.warn(
      `Only the first ${MAX_ITEMS.branches} Editorial Workflow branches in the fork are listed. ` +
        'Publish or discard some entries to see the rest.',
    );
  }

  return branches;
};

/**
 * Check whether the given merge request goes from the fork the CMS is working in to the configured
 * branch, which is the only kind GitLab refuses to open a second of from the same branch.
 * @param {Record<string, any>} item Merge request returned by the REST API.
 * @returns {boolean} Result.
 */
const isFromForkToBranch = (item) =>
  item.source_project_id === projectIds.fork && item.target_branch === repository.branch;

/**
 * Check whether the given merge request is one the CMS manages for the contributor: opened by them,
 * from the fork the CMS is working in, to the configured branch. Someone else’s merge request from
 * the contributor’s branch would put their title on the entry, and the contributor could neither
 * convert, reopen nor close it.
 * @param {Record<string, any>} item Merge request returned by the REST API.
 * @returns {boolean} Result.
 */
const isForkMergeRequest = (item) =>
  isFromForkToBranch(item) && user.account?.id !== undefined && item.author?.id === user.account.id;

/**
 * Fetch the merge request each of the given fork branches has on the configured project. A branch
 * in the fork doesn’t report the merge requests opened from it, and a merge request opened from a
 * fork lives on the project it targets, so they’re looked up there. What makes a merge request the
 * contributor’s is its source project, which has to be the fork the CMS is working in: a branch of
 * the same name elsewhere says nothing about where the merge request came from. The author filter
 * spends the single page of results on the user’s own merge requests, and is checked again on each
 * one rather than trusted to have applied.
 * @param {string[]} branches Branch names to look up.
 * @returns {Promise<Map<string, Record<string, any>>>} Map of branch name to the most recent merge
 * request opened from it, where there is one.
 * @see https://docs.gitlab.com/api/merge_requests/#list-project-merge-requests
 */
export const fetchForkBranchMergeRequests = async (branches) => {
  /** @type {Map<string, Record<string, any>>} */
  const map = new Map();

  if (!branches.length) {
    return map;
  }

  const branchSet = new Set(branches);

  const items = /** @type {Record<string, any>[]} */ (
    await fetchAPI(
      `/projects/${getProjectId()}/merge_requests?state=all&order_by=created_at&sort=desc` +
        `&author_id=${user.account?.id}&per_page=${MAX_ITEMS.authoredMergeRequests}`,
    )
  );

  items.forEach((item) => {
    // The merge request has to come from the fork the CMS is working in, not from the configured
    // project and not from some other project of the contributor’s that happens to have a branch of
    // the same name. The source project is checked rather than inferred from the branch name, the
    // way GitHub’s flow checks the head repository’s owner
    // @see https://github.com/sveltia/sveltia-cms/security/advisories/GHSA-p8qh-54q9-2qjx
    //
    // It also has to go to the configured branch. One the contributor aimed elsewhere in the
    // project is their own business, and acting on it — relabelling or closing it as the entry
    // moves — would be meddling with a review the CMS knows nothing about. And it has to be the
    // contributor’s own, like on GitHub
    if (!isForkMergeRequest(item)) {
      return;
    }

    // The list is newest first, so the first match for a branch is the one that counts
    if (branchSet.has(item.source_branch) && !map.has(item.source_branch)) {
      map.set(item.source_branch, item);
    }
  });

  return map;
};

/**
 * Parse a branch returned by {@link fetchForkBranchList}.
 * @param {Record<string, any>} branchInfo Branch.
 * @param {Record<string, any>} [mergeRequest] Merge request opened from the branch, from
 * {@link fetchForkBranchMergeRequests}.
 * @returns {WorkflowPullRequest} Parsed branch. A branch that turns out to hold nothing is dropped
 * later, by {@link fetchForkPullRequests}, once its file list is known.
 */
export const parseForkBranch = (branchInfo, mergeRequest) => {
  const { name: branch, commit } = branchInfo;

  const {
    id: headSHA,
    message,
    committed_date: committedDate,
    author_name: authorName,
    author_email: authorEmail,
  } = commit ?? {};

  // A merged merge request is finished with. Either the branch is simply left over, in which case
  // comparing it with the configured branch turns up nothing and it drops off the board, or the
  // contributor has edited the entry again since the merge, which makes it a fresh draft. Carrying
  // the merged merge request forward would instead try to reopen it when the entry moves to review
  const current = mergeRequest?.state === 'merged' ? undefined : mergeRequest;
  const isOpen = current?.state === 'opened';
  // A closed merge request is treated the same as none at all: the contributor took the entry back
  // to the drafting stage, and moving it forward again reopens the request
  const inReview = isOpen && !current.draft;
  const { name, username, id } = current?.author ?? {};

  // A merge request names its author, while a branch on its own only carries the identity Git
  // recorded with the head commit
  const author = username
    ? { name: name ?? username, email: '', id, login: username }
    : authorName && { name: authorName, email: authorEmail ?? '' };

  return {
    number: current?.iid,
    nodeId: current ? String(current.id) : undefined,
    // Without a merge request there’s no title to show, so the head commit’s message stands in.
    // It’s the message the merge request would be opened with anyway
    title: current ? stripDraftPrefix(current.title) : (message ?? ''),
    url: current?.web_url,
    branch,
    // The branch head, rather than the merge request’s: a save compares it with the branch to find
    // out whether anything has been committed since, and a closed merge request’s head is stale
    headSHA,
    status: inReview ? 'pending_review' : 'draft',
    createdDate: new Date(current?.created_at ?? committedDate),
    updatedDate: new Date(current?.updated_at ?? committedDate),
    author: author || undefined,
    files: [],
    // Only a maintainer merges, and a contributor is never one
    canMerge: false,
  };
};

/**
 * Fetch the files a fork branch changes, and populate the `WorkflowFile` objects in place. A draft
 * has no merge request to list files from, so the branch is compared with the configured branch
 * instead. The comparison also reports the path a renamed file came from, and is used even where a
 * merge request exists: a closed one’s diff is no longer a reliable account of a branch that has
 * moved on since.
 * @param {WorkflowPullRequest} pullRequest Branch to complete.
 * @see https://docs.gitlab.com/api/repositories/#compare-branches-tags-or-commits
 */
export const fetchForkBranchFileList = async (pullRequest) => {
  const { branch: baseBranch = '' } = repository;

  // The comparison runs on the project that holds the branch being compared — the fork — and names
  // the configured project as the one the base branch belongs to
  const { diffs = [] } = /** @type {{ diffs?: Record<string, any>[] }} */ (
    await fetchAPI(
      `/projects/${getProjectId(getWorkflowRepository())}/repository/compare` +
        `?from=${encodeURIComponent(baseBranch)}&to=${encodeURIComponent(pullRequest.branch)}` +
        `&from_project_id=${projectIds.base}`,
    )
  );

  pullRequest.files = diffs.map(parseDiff);
};

/**
 * Fetch the unpublished entries of an Open Authoring contributor, which live in their fork.
 * @returns {Promise<WorkflowPullRequest[]>} Branches, with their merge requests and changed files.
 */
export const fetchForkPullRequests = async () => {
  const branchList = await fetchForkBranchList();
  const mergeRequests = await fetchForkBranchMergeRequests(branchList.map(({ name }) => name));
  /** @type {string[]} */
  const leftover = [];
  /** @type {WorkflowPullRequest[]} */
  const pending = [];

  branchList.forEach((branchInfo) => {
    const mergeRequest = mergeRequests.get(branchInfo.name);

    // A merged merge request whose head the branch still points at has nothing left on it. Tidying
    // it up keeps the fork from collecting a branch per published entry, and saves comparing each
    // one with the configured branch on every load just to find out it holds nothing. A branch the
    // contributor has committed to since the merge has a different head, so it survives and shows
    // up as a fresh draft
    if (mergeRequest?.state === 'merged' && mergeRequest.sha === branchInfo.commit?.id) {
      leftover.push(branchInfo.name);
    } else {
      pending.push(parseForkBranch(branchInfo, mergeRequest));
    }
  });

  // Deleting a branch is best effort: `deleteBranch` logs a failure rather than raising it, and a
  // branch that outlives this is picked up on the next load
  await runConcurrently(leftover, deleteBranch);
  await runConcurrently(pending, fetchForkBranchFileList);

  // A branch that no longer differs from the configured branch holds nothing to publish. That’s
  // what a branch left behind by a squash-merged merge request looks like
  const entries = pending.filter(({ files }) => files.length);

  await runConcurrently(entries, fetchMergeRequestFileContents);

  return entries;
};

/**
 * Work out the changes that move a merge request to the given stage. A contributor can’t label a
 * merge request on a project they don’t have access to, so the stage is recorded in the merge
 * request itself: an entry in review has one waiting for a maintainer, while a draft has one GitLab
 * still considers a draft, or none at all.
 * @param {object} args Arguments.
 * @param {WorkflowStatus} args.status New status.
 * @param {string} args.title Entry title, without a draft prefix.
 * @param {string} [args.state] State the merge request is in, e.g. `opened`.
 * @param {boolean} [args.draft] Whether GitLab considers the merge request a draft.
 * @returns {Record<string, any>} Request body, empty when the merge request already says as much.
 */
const getStatusChange = ({ status, title, state, draft }) => {
  if (status === 'draft') {
    // Marking the merge request as a draft keeps it — and the discussion on it — in place while
    // taking it out of the maintainers’ review queue
    return state === 'opened' && !draft ? { title: `${DRAFT_TITLE_PREFIX}${title}` } : {};
  }

  return {
    ...(state === 'closed' ? { state_event: 'reopen' } : {}),
    ...(draft ? { title } : {}),
  };
};

/**
 * Apply the given changes to a merge request on the configured project, which is where a merge
 * request opened from the fork lives.
 * @param {number} number Merge request `iid`.
 * @param {Record<string, any>} body Changes, from {@link getStatusChange}. Nothing is sent when
 * there are none.
 * @see https://docs.gitlab.com/api/merge_requests/#edit-merge-request
 */
const applyStatusChange = async (number, body) => {
  if (Object.keys(body).length) {
    await fetchAPI(`/projects/${getProjectId()}/merge_requests/${number}`, { method: 'PUT', body });
  }
};

/**
 * HTTP status GitLab answers a merge request it won’t create because the source branch already has
 * one open.
 * @see https://docs.gitlab.com/api/merge_requests/#create-merge-request
 */
const MERGE_REQUEST_EXISTS_STATUS = 409;

/**
 * Fetch the open merge request from the given branch in the contributor’s fork to the configured
 * branch, if any. This is only asked about a branch the CMS found no merge request for, so one
 * found here either sits beyond the page {@link fetchForkBranchMergeRequests} reads — a contributor
 * with a long history in the project can have more merge requests than fit in it — or isn’t the
 * contributor’s own.
 * @param {string} branch Branch name.
 * @returns {Promise<Record<string, any> | undefined>} Merge request returned by the REST API, or
 * `undefined` if none is open from the branch.
 * @see https://docs.gitlab.com/api/merge_requests/#list-project-merge-requests
 */
const fetchOpenForkMergeRequest = async (branch) => {
  const items = /** @type {Record<string, any>[]} */ (
    await fetchAPI(
      `/projects/${getProjectId()}/merge_requests` +
        `?state=opened&source_branch=${encodeURIComponent(branch)}` +
        `&per_page=${MAX_ITEMS.mergeRequests}`,
    )
  );

  // A merge request from some other project of the contributor’s that happens to have a branch of
  // the same name, or one to another branch, isn’t the one GitLab refused to open another of
  // @see https://github.com/sveltia/sveltia-cms/security/advisories/GHSA-p8qh-54q9-2qjx
  return items.find(isFromForkToBranch);
};

/**
 * Open the merge request that hands an Open Authoring draft over for review. GitLab refuses a
 * second merge request from a branch that already has one open to the same branch, which is what
 * happens when the entry’s own merge request sat beyond the page the load read and the entry was
 * taken for a draft. That merge request is the entry’s, so it’s taken over and moved to the stage
 * asked for, rather than reported as a conflict the contributor can do nothing about.
 * @param {object} args Arguments.
 * @param {string} args.branch Workflow branch name.
 * @param {string} args.title Merge request title.
 * @param {WorkflowStatus} args.status Status to open the merge request with.
 * @returns {Promise<WorkflowPullRequest>} New or adopted merge request.
 * @throws {Error} When the merge request could not be created, including when the one standing in
 * the way is someone else’s.
 */
export const createForkMergeRequest = async ({ branch, title, status }) => {
  try {
    return await createPullRequest({ branch, title, status });
  } catch (/** @type {any} */ ex) {
    if (ex.cause?.status !== MERGE_REQUEST_EXISTS_STATUS) {
      throw ex;
    }

    const item = await fetchOpenForkMergeRequest(branch);

    // Nothing the CMS can make sense of stands in the way, so let GitLab’s own refusal stand
    // rather than claiming the entry is in review
    if (!item) {
      throw ex;
    }

    // Someone else opened it from the contributor’s branch, which anyone the fork lets push can
    // do. Taking it over would put their title on the entry and hand their request to the
    // maintainers in the contributor’s name, so the contributor is told what’s in the way instead
    if (!isForkMergeRequest(item)) {
      throw createLocalizedError(
        'The workflow branch is in use by another merge request.',
        'workflow.branch_in_use',
        { number: `!${item.iid}` },
      );
    }

    await applyStatusChange(
      item.iid,
      getStatusChange({ status, title, state: item.state, draft: item.draft }),
    );

    // Keep the entry’s title rather than the one the merge request was opened with, which may have
    // been edited on GitLab
    return { ...toMergeRequest(item, status), title, branch };
  }
};

/**
 * Move an Open Authoring entry between the drafting and review stages, which is recorded in its
 * merge request: see {@link getStatusChange}.
 * @param {WorkflowPullRequest} pullRequest Merge request.
 * @param {WorkflowStatus} status New status.
 * @returns {Promise<WorkflowPullRequest>} Updated merge request, or a new one if the known one is
 * no longer the entry’s.
 * @throws {Error} When the entry is being marked ready to publish, which a contributor can’t do, or
 * has been published since the board was loaded: see {@link checkMergedBranch}.
 */
export const updateForkStatus = async (pullRequest, status) => {
  checkStatusAllowed(status);

  const { number, branch, title } = pullRequest;

  // Nothing has been opened yet, so moving out of the drafting stage is what creates the merge
  // request. Moving within the drafting stage leaves the branch as it is
  if (number === undefined) {
    return status === 'draft'
      ? { ...pullRequest, status, updatedDate: new Date() }
      : createForkMergeRequest({ branch, title, status });
  }

  // The merge request may have been closed or reopened outside the CMS, so read the current state
  // rather than inferring it from the status the entry was last seen with
  const item = await fetchMergeRequest(pullRequest);
  const isEntryRequest = isForkMergeRequest(item);

  // It may have been merged into the configured branch since the board was loaded. With nothing
  // committed to the branch since, the entry is published and has nothing left to review
  if (item.state === 'merged' && isEntryRequest) {
    await checkMergedBranch({ branch, mergedSHA: item.sha, fetchBranchHead, deleteBranch });
  }

  // Otherwise a merged merge request, or one aimed at another branch since the board was loaded,
  // is no longer the entry’s review, which is how the next load would see it too: reopening or
  // taking it out of draft would put a request for that other branch in front of the maintainers,
  // or claim a merged one is in review. So the entry carries on without it, as a fresh draft
  // @see https://github.com/sveltia/sveltia-cms/security/advisories/GHSA-8h97-74c4-g246
  if (item.state === 'merged' || !isEntryRequest) {
    return updateForkStatus(
      { ...pullRequest, number: undefined, nodeId: undefined, url: undefined },
      status,
    );
  }

  const { state, draft } = item;

  await applyStatusChange(number, getStatusChange({ status, title, state, draft }));

  return { ...pullRequest, status, updatedDate: new Date() };
};
