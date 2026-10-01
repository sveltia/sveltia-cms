import { fetchBlobNodes } from '$lib/services/backends/git/gitlab/files';
import { getProjectId, repository } from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import {
  getAllStatusLabels,
  getStatusFromLabels,
  getStatusLabel,
} from '$lib/services/workflow/labels';

/**
 * @import {
 * WorkflowPullRequest,
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
export const DRAFT_TITLE_PREFIX = 'Draft: ';

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
 * Get whether the signed-in user can merge the given merge request. A single merge request, like
 * the one returned when it’s created, comes with the answer, while a list doesn’t.
 * @param {Record<string, any>} item Merge request returned by the REST API.
 * @returns {boolean | undefined} Result, or `undefined` if the merge request doesn’t tell.
 * @see https://docs.gitlab.com/api/merge_requests/#get-single-mr
 */
const getCanMerge = (item) =>
  typeof item.user?.can_merge === 'boolean' ? item.user.can_merge : undefined;

/**
 * Convert a merge request returned by the REST API to a workflow pull request.
 * @param {Record<string, any>} item Merge request.
 * @param {WorkflowStatus} status Status of the merge request.
 * @returns {WorkflowPullRequest} Merge request.
 */
export const toMergeRequest = (item, status) => {
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
    canMerge: getCanMerge(item),
  };
};

/**
 * Parse a merge request returned by the REST API.
 * @param {Record<string, any>} item Merge request.
 * @returns {WorkflowPullRequest | undefined} Parsed merge request, or `undefined` if the merge
 * request is not managed by the CMS.
 */
export const parseMergeRequest = (item) => {
  // A merge request from a fork has its source branch in the fork, while the branch is read,
  // merged and deleted on the configured project, where a branch of the same name would be someone
  // else’s. Skip it, like GitHub’s cross-repository pull requests
  if (item.source_project_id !== item.target_project_id) {
    return undefined;
  }

  const status = getStatusFromLabels(item.labels ?? []);

  if (!status) {
    return undefined;
  }

  return toMergeRequest(item, status);
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

const FETCH_MERGE_PERMISSIONS_QUERY = `
  query($fullPath: ID!, $iids: [String!]) {
    project(fullPath: $fullPath) {
      mergeRequests(iids: $iids, first: 100) {
        nodes {
          iid
          userPermissions {
            canMerge
          }
        }
      }
    }
  }
`;

/**
 * Find out whether the signed-in user can merge each of the given merge requests, and set their
 * `canMerge` property in place. A protected branch may let a Developer push to the workflow
 * branches, but not merge into the configured branch. The merge request list doesn’t tell, so the
 * permissions are asked for all at once. A failed request leaves them unknown, as GitLab still
 * refuses a merge the user isn’t allowed to make.
 * @param {WorkflowPullRequest[]} mergeRequests Merge requests to complete.
 * @see https://docs.gitlab.com/api/graphql/reference/#mergerequestpermissions
 */
export const fetchMergePermissions = async (mergeRequests) => {
  /** @type {Map<string, WorkflowPullRequest>} */
  const iidMap = new Map(mergeRequests.map((mr) => [String(mr.number), mr]));
  const iids = [...iidMap.keys()];
  /** @type {string[][]} */
  const chunks = [];

  // The query returns up to 100 merge requests at a time
  for (let index = 0; index < iids.length; index += MAX_ITEMS.mergeRequests) {
    chunks.push(iids.slice(index, index + MAX_ITEMS.mergeRequests));
  }

  await runConcurrently(chunks, async (chunk) => {
    try {
      const result =
        /** @type {{ project?: { mergeRequests?: { nodes: Record<string, any>[] } } }} */ (
          await fetchGraphQL(FETCH_MERGE_PERMISSIONS_QUERY, { iids: chunk })
        );

      result.project?.mergeRequests?.nodes.forEach(({ iid, userPermissions }) => {
        const mergeRequest = iidMap.get(String(iid));

        if (mergeRequest && typeof userPermissions?.canMerge === 'boolean') {
          mergeRequest.canMerge = userPermissions.canMerge;
        }
      });
    } catch {
      // Keep the permissions unknown, as said above
    }
  });
};

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

  await Promise.all([
    fetchMergePermissions(mergeRequests),
    runConcurrently(mergeRequests, async (mergeRequest) => {
      await fetchMergeRequestFileList(mergeRequest);
      await fetchMergeRequestFileContents(mergeRequest);
    }),
  ]);

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
      { method: 'DELETE', responseType: 'text' },
    );
  } catch (/** @type {any} */ ex) {
    // The branch is already gone, which is what was wanted
    if (ex.cause?.status === 404) {
      return;
    }

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
    canMerge: getCanMerge(result),
  };
};

/**
 * Fetch the open merge request from the given branch, if any. This is asked about a branch the CMS
 * doesn’t know a merge request for, so a merge request found is one the load skipped: it has lost
 * its status label, or it sits beyond the number of merge requests fetched.
 * @param {string} branch Branch name.
 * @returns {Promise<Record<string, any> | undefined>} Merge request returned by the REST API, or
 * `undefined` if none is open from the branch.
 * @see https://docs.gitlab.com/api/merge_requests/#list-project-merge-requests
 */
export const fetchOpenMergeRequest = async (branch) => {
  const items = /** @type {Record<string, any>[]} */ (
    await fetchAPI(
      `/projects/${getProjectId()}/merge_requests` +
        `?state=opened&source_branch=${encodeURIComponent(branch)}` +
        `&per_page=${MAX_ITEMS.mergeRequests}`,
    )
  );

  // A merge request from a fork can have a source branch of the same name, but it isn’t this branch
  return items.find(
    ({ source_project_id: sourceId, target_project_id: targetId }) => sourceId === targetId,
  );
};

/**
 * Fetch the merge request as it stands.
 * @param {WorkflowPullRequest} pullRequest Merge request.
 * @returns {Promise<Record<string, any>>} Merge request returned by the REST API.
 * @see https://docs.gitlab.com/api/merge_requests/#get-single-mr
 */
export const fetchMergeRequest = async (pullRequest) =>
  /** @type {Record<string, any>} */ (
    await fetchAPI(`/projects/${getProjectId()}/merge_requests/${pullRequest.number}`)
  );
