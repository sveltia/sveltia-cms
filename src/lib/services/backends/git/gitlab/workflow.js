import { sleep } from '@sveltia/utils/misc';

import { commitChanges } from '$lib/services/backends/git/gitlab/commits';
import {
  createPullRequest,
  deleteBranch,
  DRAFT_TITLE_PREFIX,
  fetchMergeRequest,
  fetchOpenMergeRequest,
  fetchPullRequests,
  parseMergeRequest,
  toMergeRequest,
} from '$lib/services/backends/git/gitlab/merge-requests';
import { getProjectId, repository } from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { isSquashMergeEnabled } from '$lib/services/backends/git/shared/workflow';
import { getAllStatusLabels, getStatusLabel } from '$lib/services/workflow/labels';

/**
 * @import {
 * CommitOptions,
 * CommitResults,
 * FileChange,
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
 * Commit the given changes on a workflow branch that no merge request is known for. The branch is
 * usually created along with the commit, but it can already exist: it’s left over from an earlier
 * merge request for the same entry, which the CMS knows nothing about — one merged without deleting
 * the branch, or one that was closed on GitLab rather than discarded here, which leaves the branch
 * behind. Starting the new merge request from the branch as it stands would carry that earlier
 * work into it — a merged one adds nothing, but a closed one brings back what was thrown away — so
 * the branch is deleted and created afresh from the configured branch. That only holds when no
 * merge request is open from it: one the load skipped is someone’s work in progress, and it’s
 * committed onto rather than wiped, and handed back so it’s reused rather than opened again.
 * @param {FileChange[]} changes Changes to be committed.
 * @param {CommitOptions} options Commit options, with the workflow branch.
 * @returns {Promise<{ commit: CommitResults, openMergeRequest?: Record<string, any> }>} Commit
 * results, along with the merge request open from the branch, if the commit went onto it.
 */
const commitToNewBranch = async (changes, options) => {
  const { branch = '' } = options;
  const startBranch = repository.branch;

  try {
    return { commit: await commitChanges(changes, { ...options, startBranch }) };
  } catch (/** @type {any} */ ex) {
    // GitLab rejects `start_branch` outright once the branch exists. Anything else is a real
    // failure
    if (ex.cause?.status !== 400) {
      throw ex;
    }
  }

  const openMergeRequest = await fetchOpenMergeRequest(branch);

  if (openMergeRequest) {
    return { commit: await commitChanges(changes, options), openMergeRequest };
  }

  await deleteBranch(branch);

  return { commit: await commitChanges(changes, { ...options, startBranch }) };
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
  const { commit, openMergeRequest } = await commitToNewBranch(changes, { ...options, branch });

  if (!openMergeRequest) {
    return { commit, pullRequest: await createPullRequest({ branch, title, status }) };
  }

  // The branch already has a merge request the load skipped, and GitLab refuses to open another one
  // from the same branch, so the commit goes into that one. A merge request that still carries its
  // status label keeps its status, like a known one does. One that has lost it is given the status
  // asked for, which also puts it back on the board
  const existing = parseMergeRequest(openMergeRequest);

  return {
    commit,
    pullRequest: existing ?? (await updateStatus(toMergeRequest(openMergeRequest, status), status)),
  };
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
  await fetchAPI(`/projects/${getProjectId()}/merge_requests/${pullRequest.number}`, {
    method: 'PUT',
    body: { state_event: 'close' },
  });

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
  publish,
  discard,
};
