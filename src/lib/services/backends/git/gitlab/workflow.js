import { get } from 'svelte/store';

import { commitChanges } from '$lib/services/backends/git/gitlab/commits';
import { repository } from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { cmsConfig } from '$lib/services/config';
import {
  getAllStatusLabels,
  getStatusFromLabels,
  getStatusLabel,
} from '$lib/services/workflow/labels';

/**
 * @import {
 * CommitResults,
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
 * Get the URL-encoded project identifier used in the REST API paths, e.g. the `group/project` path
 * with the slash percent-encoded.
 * @returns {string} Project ID.
 */
const getProjectId = () => {
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

  const { project } = /** @type {Record<string, any>} */ (
    await fetchGraphQL(FETCH_BLOBS_QUERY, {
      branch: mergeRequest.branch,
      paths: files.map(({ path }) => path),
    })
  );

  /** @type {Map<string, Record<string, any>>} */
  const blobMap = new Map(
    (project?.repository?.blobs?.nodes ?? []).map((/** @type {any} */ node) => [node.path, node]),
  );

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
    status,
    createdDate: new Date(result.created_at),
    updatedDate: new Date(result.updated_at),
    files: [],
  };
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
  const startBranch = pullRequest ? undefined : repository.branch;
  const commit = await commitChanges(changes, { ...options, branch, startBranch });

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
 * Merge the merge request and delete the workflow branch.
 * @param {WorkflowPullRequest} pullRequest Merge request.
 * @see https://docs.gitlab.com/api/merge_requests/#merge-a-merge-request
 */
export const publish = async (pullRequest) => {
  const { backend } = get(cmsConfig) ?? {};
  const squash = backend && 'squash_merges' in backend ? !!backend.squash_merges : false;

  await fetchAPI(`/projects/${getProjectId()}/merge_requests/${pullRequest.number}/merge`, {
    method: 'PUT',
    body: {
      squash,
      should_remove_source_branch: true,
      ...(squash
        ? { squash_commit_message: pullRequest.title }
        : { merge_commit_message: pullRequest.title }),
    },
  });

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
