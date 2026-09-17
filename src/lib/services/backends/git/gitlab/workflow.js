import { sleep } from '@sveltia/utils/misc';

import { commitChanges } from '$lib/services/backends/git/gitlab/commits';
import { fetchBlobNodes } from '$lib/services/backends/git/gitlab/files';
import { repository } from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { isSquashMergeEnabled } from '$lib/services/backends/git/shared/workflow';
import {
  getAllStatusLabels,
  getStatusFromLabels,
  getStatusLabel,
} from '$lib/services/workflow/labels';

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
 * Maximum numbers of items to retrieve from the REST API: open merge requests, and changed files
 * per merge request. Editorial Workflow is not meant to hold a huge backlog, so a single page is
 * enough in practice.
 */
const MAX_ITEMS = { mergeRequests: 100, files: 100 };

/**
 * Regular expression matching the draft indicators GitLab accepts at the beginning of a merge
 * request title. GitLab has no dedicated API field to toggle the draft state; the read-only `draft`
 * property is derived from the title instead.
 * @see https://docs.gitlab.com/user/project/merge_requests/drafts/
 */
const DRAFT_TITLE_REGEX =
  /^\s*(?:\[draft\]|\(draft\)|draft:|draft\s|\[wip\]|\(wip\)|wip:|wip\s)\s*/i;

/**
 * Prefix added to a merge request title to mark it as a draft.
 */
const DRAFT_TITLE_PREFIX = 'Draft: ';
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
 * Get the URL-encoded project identifier used in the REST API paths, e.g. the `group/project` path
 * with the slash percent-encoded.
 * @returns {string} Project ID.
 */
export const getProjectId = () => {
  const { owner, repo } = repository;

  return encodeURIComponent(`${owner}/${repo}`);
};

/**
 * Remove any draft indicator from the given merge request title.
 * @param {string} title Raw title.
 * @returns {string} Title without a draft prefix.
 */
export const stripDraftPrefix = (title) => {
  let result = title;

  // Repeat, because GitLab tolerates combinations such as `Draft: WIP: Title`
  while (DRAFT_TITLE_REGEX.test(result)) {
    result = result.replace(DRAFT_TITLE_REGEX, '');
  }

  return result;
};

/**
 * Parse a merge request returned by the REST API.
 * @param {Record<string, any>} item Merge request.
 * @returns {WorkflowPullRequest | undefined} Parsed merge request, or `undefined` if the merge
 * request is not managed by the CMS.
 */
export const parseMergeRequest = (item) => {
  const status = getStatusFromLabels(item.labels ?? []);

  if (!status) {
    return undefined;
  }

  const { name, username, id } = item.author ?? {};

  return {
    number: item.iid,
    nodeId: String(item.id),
    title: stripDraftPrefix(item.title),
    url: item.web_url,
    branch: item.source_branch,
    headSHA: item.sha,
    status,
    createdDate: new Date(item.created_at),
    updatedDate: new Date(item.updated_at),
    author: username ? { name: name ?? username, email: '', id, login: username } : undefined,
    files: [],
  };
};

/**
 * Fetch the list of files changed in the given merge request.
 * @param {WorkflowPullRequest} mergeRequest Merge request to complete.
 * @see https://docs.gitlab.com/api/merge_requests/#list-merge-request-diffs
 */
export const fetchMergeRequestFileList = async (mergeRequest) => {
  const diffs = /** @type {Record<string, any>[]} */ (
    await fetchAPI(
      `/projects/${getProjectId()}/merge_requests/${mergeRequest.number}` +
        `/diffs?per_page=${MAX_ITEMS.files}`,
    )
  );

  mergeRequest.files = diffs.map((diff) => ({
    path: diff.deleted_file ? diff.old_path : diff.new_path,
    sha: '',
    size: 0,
    deleted: !!diff.deleted_file,
    previousPath: diff.renamed_file ? diff.old_path : undefined,
  }));
};

const FETCH_BLOBS_QUERY = `
  query($fullPath: ID!, $branch: String!, $paths: [String!]!) {
    project(fullPath: $fullPath) {
      repository {
        blobs(ref: $branch, paths: $paths) {
          nodes {
            path
            oid
            size
            rawTextBlob
          }
        }
      }
    }
  }
`;

/**
 * Fetch the content of the files changed in the given merge request, and populate the
 * {@link WorkflowFile} objects in place. Binary files, such as images, have no `rawTextBlob`, so
 * only their blob metadata is stored.
 * @param {WorkflowPullRequest} mergeRequest Merge request to complete.
 * @see https://docs.gitlab.com/api/graphql/reference/#repositoryblob
 */
export const fetchMergeRequestFileContents = async (mergeRequest) => {
  const files = mergeRequest.files.filter(({ deleted }) => !deleted);

  if (!files.length) {
    return;
  }

  // The blobs are fetched in batches, which are split further if the total size of a batch exceeds
  // the API’s limit. An asset committed to a workflow branch is easily large enough to hit it on
  // its own. @see https://docs.gitlab.com/api/graphql/#data-limits
  const nodes = await fetchBlobNodes(
    files.map(({ path }) => path),
    FETCH_BLOBS_QUERY,
    { branch: mergeRequest.branch },
  );

  /** @type {Map<string, Record<string, any>>} */
  const blobMap = new Map(nodes.map((/** @type {any} */ node) => [node.path, node]));

  files.forEach((file) => {
    const blob = blobMap.get(file.path);

    if (blob) {
      Object.assign(file, {
        sha: blob.oid,
        size: Number(blob.size) || 0,
        text: blob.rawTextBlob ?? undefined,
      });
    } else {
      // The file may have been removed from the branch in the meantime
      file.deleted = true;
    }
  });
};

/**
 * Fetch all the open merge requests managed by the CMS, along with the changed files.
 * @returns {Promise<WorkflowPullRequest[]>} Merge requests.
 * @see https://docs.gitlab.com/api/merge_requests/#list-project-merge-requests
 */
export const fetchPullRequests = async () => {
  /** @type {Map<number, WorkflowPullRequest>} */
  const found = new Map();

  // The status labels are matched by the API rather than by {@link parseMergeRequest}, so the item
  // cap applies to the CMS’s own merge requests instead of the project’s most recently updated
  // ones, which could otherwise push the unpublished entries out of the result. Unlike GitHub’s,
  // GitLab’s label filter matches a merge request carrying all of the given labels, so each label
  // needs its own request and the results are merged here
  await runConcurrently(getAllStatusLabels(), async (label) => {
    const items = /** @type {Record<string, any>[]} */ (
      await fetchAPI(
        `/projects/${getProjectId()}/merge_requests` +
          `?state=opened&order_by=updated_at&per_page=${MAX_ITEMS.mergeRequests}` +
          `&labels=${encodeURIComponent(label)}`,
      )
    );

    items.forEach((item) => {
      const mergeRequest = parseMergeRequest(item);

      // A merge request can carry status labels with more than one prefix, so it can show up in
      // several of these requests
      if (mergeRequest) {
        found.set(item.iid, mergeRequest);
      }
    });
  });

  const mergeRequests = [...found.values()].sort(
    (a, b) => b.updatedDate.getTime() - a.updatedDate.getTime(),
  );

  await runConcurrently(mergeRequests, async (mergeRequest) => {
    await fetchMergeRequestFileList(mergeRequest);
    await fetchMergeRequestFileContents(mergeRequest);
  });

  return mergeRequests;
};

/**
 * Delete the given branch. Failures are ignored, as the branch may already have been deleted when
 * the merge request was merged.
 * @param {string} branch Branch name.
 * @see https://docs.gitlab.com/api/branches/#delete-repository-branch
 */
export const deleteBranch = async (branch) => {
  try {
    await fetchAPI(
      `/projects/${getProjectId()}/repository/branches/${encodeURIComponent(branch)}`,
      { method: 'DELETE', responseType: 'raw' },
    );
  } catch (/** @type {any} */ ex) {
    // Leaving the branch behind is harmless, but it makes the next merge request for the same entry
    // start from an existing branch, so make the failure visible rather than swallowing it
    // eslint-disable-next-line no-console
    console.warn(`Failed to delete the ${branch} branch.`, ex);
  }
};

/**
 * Create a new merge request for the given workflow branch. The merge request is created as a
 * draft, because a newly saved entry always starts with the `draft` status.
 * @param {object} args Arguments.
 * @param {string} args.branch Workflow branch name.
 * @param {string} args.title Merge request title.
 * @param {WorkflowStatus} args.status Status to open the merge request with.
 * @returns {Promise<WorkflowPullRequest>} Created merge request.
 * @see https://docs.gitlab.com/api/merge_requests/#create-merge-request
 */
export const createPullRequest = async ({ branch, title, status }) => {
  const isDraft = status === 'draft';

  const result = /** @type {Record<string, any>} */ (
    await fetchAPI(`/projects/${getProjectId()}/merge_requests`, {
      method: 'POST',
      body: {
        title: isDraft ? `${DRAFT_TITLE_PREFIX}${title}` : title,
        source_branch: branch,
        target_branch: repository.branch,
        labels: getStatusLabel(status),
        description: 'Automatically generated by Sveltia CMS',
        remove_source_branch: true,
      },
    })
  );

  return {
    number: result.iid,
    nodeId: String(result.id),
    title,
    url: result.web_url,
    branch,
    headSHA: result.sha,
    status,
    createdDate: new Date(result.created_at),
    updatedDate: new Date(result.updated_at),
    files: [],
  };
};

/**
 * Check whether the given branch has an open merge request. This is asked about a branch the CMS
 * doesn’t know a merge request for, so a positive answer means the merge request is one the load
 * skipped: it has lost its status label, or it sits beyond the number of merge requests fetched.
 * @param {string} branch Branch name.
 * @returns {Promise<boolean>} `true` if a merge request is open from the branch.
 * @see https://docs.gitlab.com/api/merge_requests/#list-project-merge-requests
 */
const hasOpenMergeRequest = async (branch) => {
  const items = /** @type {Record<string, any>[]} */ (
    await fetchAPI(
      `/projects/${getProjectId()}/merge_requests` +
        `?state=opened&source_branch=${encodeURIComponent(branch)}&per_page=1`,
    )
  );

  return !!items.length;
};

/**
 * Commit the given changes on a workflow branch that no merge request is known for. The branch is
 * usually created along with the commit, but it can already exist: it’s left over from an earlier
 * merge request for the same entry, which the CMS knows nothing about — one merged without deleting
 * the branch, or one that was closed on GitLab rather than discarded here, which leaves the branch
 * behind. Starting the new merge request from the branch as it stands would carry that earlier
 * work into it — a merged one adds nothing, but a closed one brings back what was thrown away — so
 * the branch is deleted and created afresh from the configured branch. That only holds when no
 * merge request is open from it: one the load skipped is someone’s work in progress, and it’s
 * committed onto rather than wiped.
 * @param {FileChange[]} changes Changes to be committed.
 * @param {CommitOptions} options Commit options, with the workflow branch.
 * @returns {Promise<CommitResults>} Commit results.
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

  if (await hasOpenMergeRequest(branch)) {
    return commitChanges(changes, options);
  }

  await deleteBranch(branch);

  return commitChanges(changes, { ...options, startBranch });
};

/**
 * Commit the given changes on the workflow branch, creating the branch and the merge request if
 * they don’t exist yet.
 * @param {WorkflowSaveOptions} args Arguments.
 * @returns {Promise<{ commit: CommitResults, pullRequest: WorkflowPullRequest }>} Commit results
 * and the new or updated merge request.
 */
export const savePullRequest = async ({ changes, options, branch, title, status, pullRequest }) => {
  // The commit itself creates the workflow branch on the first save, so it doesn’t need a request
  // of its own
  const commit = pullRequest
    ? await commitChanges(changes, { ...options, branch })
    : await commitToNewBranch(changes, { ...options, branch });

  return {
    commit,
    pullRequest: pullRequest ?? (await createPullRequest({ branch, title, status })),
  };
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
 * Fetch the merge request as it stands.
 * @param {WorkflowPullRequest} pullRequest Merge request.
 * @returns {Promise<Record<string, any>>} Merge request returned by the REST API.
 * @see https://docs.gitlab.com/api/merge_requests/#get-single-mr
 */
const fetchMergeRequest = async (pullRequest) =>
  /** @type {Record<string, any>} */ (
    await fetchAPI(`/projects/${getProjectId()}/merge_requests/${pullRequest.number}`)
  );

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
