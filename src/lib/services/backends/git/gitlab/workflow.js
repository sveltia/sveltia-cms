import { sleep } from '@sveltia/utils/misc';

import { commitChanges } from '$lib/services/backends/git/gitlab/commits';
import { fetchBlobNodes } from '$lib/services/backends/git/gitlab/files';
import {
  createPullRequest,
  deleteBranch,
  DRAFT_TITLE_PREFIX,
  fetchBranchHead,
  fetchPullRequests as fetchLabelledPullRequests,
  fetchMergeRequest,
  fetchOpenMergeRequests,
} from '$lib/services/backends/git/gitlab/merge-requests';
import { getProjectId, repository } from '$lib/services/backends/git/gitlab/repository';
import {
  fetchForkPullRequests,
  updateForkStatus,
} from '$lib/services/backends/git/gitlab/workflow-fork';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import {
  checkPublishAllowed,
  createDraftPullRequest,
} from '$lib/services/backends/git/shared/fork';
import { isSquashMergeEnabled } from '$lib/services/backends/git/shared/workflow';
import { getAllStatusLabels, getStatusLabel } from '$lib/services/workflow/labels';
import { openAuthoring } from '$lib/services/workflow/open-authoring';

/**
 * @import {
 * CommitOptions,
 * CommitResults,
 * FileChange,
 * WorkflowChangedFile,
 * WorkflowMergeState,
 * WorkflowPullRequest,
 * WorkflowSaveOptions,
 * WorkflowStatus,
 * } from '$lib/types/private';
 */

/**
 * Merge statuses GitLab reports while its mergeability check is queued or running. The check runs
 * in the background once a merge request is created or pushed to, so one of these is what a merge
 * request opened or updated a moment ago answers with; the real status follows once the check is
 * done. Approval rules are re-synced in the background as well, on a project that has them.
 * @see https://docs.gitlab.com/api/merge_requests/#merge-status
 */
const TRANSIENT_MERGE_STATUSES = ['preparing', 'unchecked', 'checking', 'approvals_syncing'];
/**
 * How many times, and how often, the merge status is read while it’s transient. The check
 * usually takes a second or two.
 */
const MERGE_STATUS_POLL = { attempts: 10, interval: 1000 };
/**
 * Merge statuses under which a merge request set to auto-merge is still expected to merge on its
 * own: the pipeline hasn’t finished, the mergeability check is being redone once it has, or the
 * merge itself is queued. Anything else — `ci_must_pass` once the pipeline has failed, say — means
 * GitLab is done waiting, even though the auto-merge stays armed in case a job is retried by hand.
 * @see https://docs.gitlab.com/user/project/merge_requests/auto_merge/
 */
const AUTO_MERGE_WAIT_STATUSES = [...TRANSIENT_MERGE_STATUSES, 'ci_still_running', 'mergeable'];
/**
 * How often, and for how long at most, a merge request set to auto-merge is read while GitLab
 * waits for its pipeline. A pipeline takes minutes, so the reads are spaced out. The cap is a
 * safety net for a merge that never lands, e.g. one GitLab has queued but not carried out.
 */
const AUTO_MERGE_POLL = { interval: 10000, maxDuration: 60 * 60 * 1000 };

/**
 * Fetch all the unpublished entries the signed-in user has in progress.
 * @returns {Promise<WorkflowPullRequest[]>} Merge requests.
 */
export const fetchPullRequests = async () =>
  openAuthoring.current ? fetchForkPullRequests() : fetchLabelledPullRequests();

/**
 * Commit the given changes on a workflow branch that no merge request is known for. The branch is
 * usually created along with the commit, but it can already exist: it’s left over from an earlier
 * merge request for the same entry, which the CMS knows nothing about — one merged without deleting
 * the branch, or one that was closed on GitLab rather than discarded here, which leaves the branch
 * behind. Starting the new merge request from the branch as it stands would carry that earlier
 * work into it — a merged one adds nothing, but a closed one brings back what was thrown away — so
 * the branch is deleted and created afresh from the configured branch. With Open Authoring a draft
 * is a branch without a merge request, so there’s no telling a leftover from a live one; the branch
 * is kept, and it shows up as a draft the next time the fork is listed. The fork is the
 * contributor’s own, so nobody else’s work can be on it.
 * @param {FileChange[]} changes Changes to be committed.
 * @param {CommitOptions} options Commit options, with the workflow branch.
 * @returns {Promise<CommitResults>} Commit results.
 * @throws {Error} When the branch exists and a merge request is open from it.
 */
const commitToNewBranch = async (changes, options) => {
  const { branch = '' } = options;
  const startBranch = repository.branch;

  try {
    return await commitChanges(changes, { ...options, startBranch });
  } catch (/** @type {any} */ ex) {
    // GitLab rejects `start_branch` outright once the branch exists. Anything else is a real
    // failure
    if (ex.cause?.status !== 400) {
      throw ex;
    }
  }

  if (openAuthoring.current) {
    return commitChanges(changes, options);
  }

  // A merge request open from the branch is one the board doesn’t show: it has lost its status
  // label, it sits beyond the number of merge requests fetched, it goes to another branch, or it
  // was never the CMS’s. Committing onto it would take whatever else it holds along with the entry,
  // unseen, and deleting the branch would close it, so the save is refused instead
  const [openMergeRequest] = await fetchOpenMergeRequests(branch);

  if (openMergeRequest) {
    throw createLocalizedError(
      'The workflow branch is in use by another merge request.',
      'workflow.branch_in_use',
      { number: `!${openMergeRequest.iid}` },
    );
  }

  await deleteBranch(branch);

  return commitChanges(changes, { ...options, startBranch });
};

/**
 * Update the merge request’s status label and draft state. A merge request in the `draft` status is
 * kept as a GitLab draft, so it cannot be merged accidentally. GitLab stores the draft state in the
 * title, so the title is rewritten along with the labels in a single request.
 * @param {WorkflowPullRequest} pullRequest Merge request.
 * @param {WorkflowStatus} status New status.
 * @returns {Promise<WorkflowPullRequest>} Updated merge request.
 * @see https://docs.gitlab.com/api/merge_requests/#edit-merge-request
 */
export const updateStatus = async (pullRequest, status) => {
  if (openAuthoring.current) {
    return updateForkStatus(pullRequest, status);
  }

  const newLabel = getStatusLabel(status);
  const isDraft = status === 'draft';
  const title = isDraft ? `${DRAFT_TITLE_PREFIX}${pullRequest.title}` : pullRequest.title;

  await fetchAPI(`/projects/${getProjectId()}/merge_requests/${pullRequest.number}`, {
    method: 'PUT',
    body: {
      title,
      // Use `add_labels`/`remove_labels` instead of `labels`, so any label added outside the CMS is
      // preserved. The new label must not be in the removal list, or GitLab would drop it.
      add_labels: newLabel,
      remove_labels: getAllStatusLabels()
        .filter((label) => label !== newLabel)
        .join(','),
    },
  });

  return { ...pullRequest, status, updatedDate: new Date() };
};

/**
 * Commit the given changes on the workflow branch, creating the branch and the merge request if
 * they don’t exist yet.
 * @param {WorkflowSaveOptions} args Arguments.
 * @returns {Promise<{ commit: CommitResults, pullRequest: WorkflowPullRequest }>} Commit results
 * and the new or updated merge request.
 */
export const savePullRequest = async ({ changes, options, branch, title, status, pullRequest }) => {
  if (pullRequest) {
    return { commit: await commitChanges(changes, { ...options, branch }), pullRequest };
  }

  // The commit itself creates the workflow branch on the first save, so it doesn’t need a request
  // of its own
  const commit = await commitToNewBranch(changes, { ...options, branch });

  // A removal has no review stages to move through, so its merge request is opened right away like
  // it is in the regular flow
  if (openAuthoring.current && status === 'draft') {
    return { commit, pullRequest: createDraftPullRequest({ commit, branch, title }) };
  }

  return { commit, pullRequest: await createPullRequest({ branch, title, status }) };
};

/**
 * Fetch the merge request’s detailed merge status, which names the single check that stands in the
 * way of an immediate merge, e.g. `ci_still_running`. A transient status is polled until it settles
 * or the attempts run out, in which case the transient status is returned as is.
 * @param {WorkflowPullRequest} pullRequest Merge request.
 * @param {number} [attemptsLeft] Remaining reads, including this one.
 * @returns {Promise<string | undefined>} Detailed merge status.
 * @see https://docs.gitlab.com/api/merge_requests/#merge-status
 */
const fetchMergeStatus = async (pullRequest, attemptsLeft = MERGE_STATUS_POLL.attempts) => {
  const { detailed_merge_status: status } = await fetchMergeRequest(pullRequest);

  if (!TRANSIENT_MERGE_STATUSES.includes(status) || attemptsLeft <= 1) {
    return status;
  }

  await sleep(MERGE_STATUS_POLL.interval);

  return fetchMergeStatus(pullRequest, attemptsLeft - 1);
};

/**
 * Cancel the auto-merge on the given merge request. Failures are ignored: this is called once the
 * publish is being reported as failed, and a merge request that has just been merged or closed
 * has no auto-merge left to cancel.
 * @param {WorkflowPullRequest} pullRequest Merge request.
 * @see https://docs.gitlab.com/api/merge_requests/#cancel-merge-when-pipeline-succeeds
 */
const cancelAutoMerge = async (pullRequest) => {
  try {
    await fetchAPI(
      `/projects/${getProjectId()}/merge_requests/${pullRequest.number}` +
        '/cancel_merge_when_pipeline_succeeds',
      { method: 'POST' },
    );
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to cancel the auto-merge on merge request !${pullRequest.number}.`, ex);
  }
};

/**
 * Wait for GitLab to merge a merge request that has been set to auto-merge. The merge request is
 * read every so often until it’s merged, in which case this resolves, or until it’s clear that the
 * merge won’t happen on its own: the pipeline has failed, a new commit has cancelled the
 * auto-merge, the merge request has been closed, or the wait has run out. Those are reported as
 * errors, so the entry stays on the Editorial Workflow board rather than being taken for
 * published. GitLab keeps the auto-merge armed after a failed pipeline, in case a job is retried by
 * hand, but a merge made that way would happen behind the CMS’s back once it has reported a
 * failure, so the auto-merge is cancelled along with the report: publishing again is what merges
 * the entry from then on.
 * @param {WorkflowPullRequest} pullRequest Merge request.
 * @param {number} [deadline] Time to give up at, as a Unix timestamp in milliseconds.
 * @returns {Promise<void>}
 * @throws {Error} When the merge request won’t be merged, or wasn’t within the time allowed.
 * @see https://github.com/sveltia/sveltia-cms/issues/992
 */
const waitForAutoMerge = async (
  pullRequest,
  deadline = Date.now() + AUTO_MERGE_POLL.maxDuration,
) => {
  if (Date.now() >= deadline) {
    await cancelAutoMerge(pullRequest);

    throw new Error(`Timed out waiting for merge request !${pullRequest.number} to be merged`);
  }

  await sleep(AUTO_MERGE_POLL.interval);

  const mergeRequest = await fetchMergeRequest(pullRequest).catch((ex) => {
    const status = ex.cause?.status;

    // A network error or a server error says nothing about the merge, which GitLab carries out on
    // its own, so keep waiting rather than reporting a failure that hasn’t happened. A client
    // error won’t go away by itself — the session has ended, or the merge request is gone — so
    // there’s no point in asking again, except when the limit on requests has been hit
    if (typeof status === 'number' && status >= 400 && status < 500 && status !== 429) {
      throw ex;
    }

    // eslint-disable-next-line no-console
    console.warn(`Failed to read merge request !${pullRequest.number}, still waiting.`, ex);

    return undefined;
  });

  if (mergeRequest) {
    const {
      state,
      merge_when_pipeline_succeeds: autoMerge,
      detailed_merge_status: status,
    } = mergeRequest;

    if (state === 'merged') {
      return;
    }

    // `locked` is the merge in progress
    const waiting =
      state === 'locked' ||
      (state === 'opened' && !!autoMerge && AUTO_MERGE_WAIT_STATUSES.includes(status));

    if (!waiting) {
      if (state === 'opened' && autoMerge) {
        await cancelAutoMerge(pullRequest);
      }

      throw new Error(
        `Merge request !${pullRequest.number} was not merged: ${state}, ${status}, ` +
          `auto-merge ${autoMerge ? 'on' : 'off'}`,
      );
    }
  }

  await waitForAutoMerge(pullRequest, deadline);
};

/**
 * Number of files past which GitLab cuts a comparison short by default, without saying so.
 * @see https://docs.gitlab.com/administration/diff_limits/
 */
const MAX_COMPARE_FILES = 1000;

/**
 * Get how the given diff changes its file.
 * @param {Record<string, any>} diff Diff returned by the REST API.
 * @returns {WorkflowChangedFile['status']} Status.
 */
const getDiffStatus = (diff) => {
  if (diff.new_file) {
    return 'added';
  }

  if (diff.deleted_file) {
    return 'removed';
  }

  return diff.renamed_file ? 'renamed' : 'modified';
};

/**
 * Read the merge request afresh right before it’s merged. The files are listed by comparing the
 * configured branch with the very commit the merge request points at, rather than read off the
 * merge request, so they describe exactly what a merge pinned to that commit would bring in, even
 * if the branch moves on meanwhile. The comparison can stop short of the whole list on a large
 * change, which the merge request’s own count of changes tells.
 * @param {WorkflowPullRequest} pullRequest Merge request.
 * @returns {Promise<WorkflowMergeState>} State.
 * @see https://docs.gitlab.com/api/merge_requests/#get-single-mr
 * @see https://docs.gitlab.com/api/repositories/#compare-branches-tags-or-commits
 */
export const fetchMergeState = async (pullRequest) => {
  const {
    sha: headSHA,
    target_branch: targetBranch,
    source_project_id: sourceId,
    target_project_id: targetId,
    changes_count: changesCount,
  } = await fetchMergeRequest(pullRequest);

  const onConfiguredBranches = targetBranch === repository.branch && sourceId === targetId;

  if (!headSHA || !onConfiguredBranches) {
    return { headSHA, onConfiguredBranches: false, files: [], complete: false };
  }

  const { diffs = [] } = /** @type {{ diffs?: Record<string, any>[] }} */ (
    await fetchAPI(
      `/projects/${getProjectId()}/repository/compare` +
        `?from=${encodeURIComponent(/** @type {string} */ (targetBranch))}` +
        `&to=${encodeURIComponent(headSHA)}&straight=false`,
    )
  );

  // `changes_count` is a string, which reads like `1000+` past GitLab’s limit, and is missing
  // while the merge request’s diff is still being worked out. The comparison is then all there is
  // to go by, and one that reaches GitLab’s default limit on files may have been cut short
  const count = changesCount === null || changesCount === undefined ? undefined : `${changesCount}`;

  const complete =
    count === undefined
      ? diffs.length < MAX_COMPARE_FILES
      : !count.endsWith('+') && diffs.length >= Number(count);

  return {
    headSHA,
    onConfiguredBranches,
    files: diffs.map((diff) => ({
      path: diff.new_path,
      status: getDiffStatus(diff),
      previousPath: diff.renamed_file ? diff.old_path : undefined,
      mode: diff.deleted_file ? undefined : diff.b_mode,
    })),
    complete,
  };
};

/**
 * Query to fetch the Git object IDs of the blobs at the given paths on a branch or commit.
 */
const FETCH_BLOB_IDS_QUERY = `
  query($fullPath: ID!, $branch: String!, $paths: [String!]!) {
    project(fullPath: $fullPath) {
      repository {
        blobs(ref: $branch, paths: $paths) {
          nodes {
            path
            oid
          }
        }
      }
    }
  }
`;

/**
 * Find which of the given files are the same at the given commit as on the configured branch, by
 * comparing the Git object IDs of their blobs. A file missing from both counts as the same.
 * @param {object} args Arguments.
 * @param {string} args.headSHA Git object ID of the commit.
 * @param {string[]} args.paths File paths.
 * @returns {Promise<string[]>} Paths of the files that are the same.
 * @see https://docs.gitlab.com/api/graphql/reference/#repositoryblob
 */
export const fetchUnchangedPaths = async ({ headSHA, paths }) => {
  const [base, head] = await Promise.all(
    [/** @type {string} */ (repository.branch), headSHA].map(async (branch) => {
      const nodes = await fetchBlobNodes(paths, FETCH_BLOB_IDS_QUERY, { branch });

      return new Map(nodes.map((/** @type {any} */ { path, oid }) => [path, oid]));
    }),
  );

  return paths.filter((path) => base.get(path) === head.get(path));
};

/**
 * Merge the merge request and delete the workflow branch. A project or group can require the merge
 * request’s pipeline to succeed before it can be merged; the group-level setting is not exposed by
 * the project API. In that case, GitLab refuses an immediate merge while the pipeline is running,
 * which is likely right after the merge request is opened — always so for a deletion, which can be
 * published as soon as it’s created — so the merge request is set to auto-merge instead, and GitLab
 * merges it once the pipeline has passed. Scheduling the merge is not the same as making it: the
 * pipeline can still fail, so this resolves only once the merge has landed.
 * @param {WorkflowPullRequest} pullRequest Merge request.
 * @see https://docs.gitlab.com/api/merge_requests/#merge-a-merge-request
 * @see https://github.com/sveltia/sveltia-cms/issues/989
 */
export const publish = async (pullRequest) => {
  checkPublishAllowed();

  const squash = isSquashMergeEnabled();
  const path = `/projects/${getProjectId()}/merge_requests/${pullRequest.number}/merge`;

  const body = {
    squash,
    should_remove_source_branch: true,
    // A group or instance can require the source branch’s current HEAD SHA on this call; without
    // it, the merge fails with `SHA must be provided when merging` even though the branch is up
    // to date.
    // @see https://github.com/decaporg/decap-cms/issues/7963
    // @see https://docs.gitlab.com/user/group/manage/#require-a-commit-sha-on-the-merge-requests-api
    ...(pullRequest.headSHA ? { sha: pullRequest.headSHA } : {}),
    ...(squash
      ? { squash_commit_message: pullRequest.title }
      : { merge_commit_message: pullRequest.title }),
  };

  try {
    await fetchAPI(path, { method: 'PUT', body });
  } catch (/** @type {any} */ ex) {
    // GitLab answers 405 Method Not Allowed whenever the merge request can’t be merged right away,
    // whatever the reason, so the detailed status tells a running pipeline from a real blocker,
    // such as a conflict. Auto-merge would take a blocked merge request as well, but it would sit
    // there unmerged while the CMS reports the entry as published, so anything else stays an
    // error
    if (ex.cause?.status !== 405 || (await fetchMergeStatus(pullRequest)) !== 'ci_still_running') {
      throw ex;
    }

    // `merge_when_pipeline_succeeds` is the pre-17.11 name of `auto_merge`, which a self-managed
    // instance may still be on. GitLab reads either, so both are sent
    await fetchAPI(path, {
      method: 'PUT',
      body: { ...body, auto_merge: true, merge_when_pipeline_succeeds: true },
    });

    // The merge request stays open until the pipeline passes, and GitLab removes the branch along
    // with the merge, as requested above. Deleting it here would close the merge request instead
    await waitForAutoMerge(pullRequest);

    return;
  }

  await deleteBranch(pullRequest.branch);
};

/**
 * Close the merge request without merging it, and delete the workflow branch.
 * @param {WorkflowPullRequest} pullRequest Merge request.
 * @see https://docs.gitlab.com/api/merge_requests/#edit-merge-request
 */
export const discard = async (pullRequest) => {
  // An Open Authoring draft has no merge request yet, so deleting the branch is all there is to do
  if (pullRequest.number !== undefined) {
    await fetchAPI(`/projects/${getProjectId()}/merge_requests/${pullRequest.number}`, {
      method: 'PUT',
      body: { state_event: 'close' },
    });
  }

  await deleteBranch(pullRequest.branch);
};

/**
 * GitLab’s Editorial Workflow implementation.
 * @type {import('$lib/types/private').WorkflowBackendService}
 */
export default {
  fetchPullRequests,
  savePullRequest,
  updateStatus,
  fetchBranchHead,
  fetchMergeState,
  fetchUnchangedPaths,
  publish,
  discard,
};
