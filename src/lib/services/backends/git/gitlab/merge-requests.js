import { fetchBlobNodes } from '$lib/services/backends/git/gitlab/files';
import { getWorkflowRepository, projectIds } from '$lib/services/backends/git/gitlab/fork';
import {
  getBranchPath,
  getProjectId,
  repository,
} from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { deleteRemoteBranch } from '$lib/services/backends/git/shared/workflow';
import { splitIntoChunks } from '$lib/services/utils/array';
import {
  getAllStatusLabels,
  getStatusFromLabels,
  getStatusLabel,
} from '$lib/services/workflow/labels';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

/**
 * @import {
 * WorkflowFile,
 * WorkflowPullRequest,
 * WorkflowStatus,
 * } from '$lib/types/private';
 */

/**
 * Maximum numbers of items to retrieve from the REST API: open merge requests, changed files per
 * merge request, Open Authoring branches in the contributor’s fork, and the contributor’s own merge
 * requests those branches are matched against. Editorial Workflow is not meant to hold a huge
 * backlog, so a single page is enough in practice.
 */
export const MAX_ITEMS = {
  mergeRequests: 100,
  files: 100,
  branches: 100,
  authoredMergeRequests: 100,
};

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

  // A merge request to a branch other than the configured one isn’t the CMS’s either, whatever
  // label it carries: one whose target branch was changed on GitLab after the CMS opened it, or one
  // labelled by hand. Listing it would put a card on the board that moves the label on someone
  // else’s request, and publishes the entry by merging it into that other branch
  if (item.target_branch !== repository.branch) {
    return undefined;
  }

  const status = getStatusFromLabels(item.labels ?? []);

  if (!status) {
    return undefined;
  }

  return toMergeRequest(item, status);
};

/**
 * Convert a diff entry returned by the merge request or comparison endpoints into a
 * {@link WorkflowFile}. The content is filled in later by {@link fetchMergeRequestFileContents}.
 * @param {Record<string, any>} diff Diff entry.
 * @returns {WorkflowFile} Parsed file.
 */
export const parseDiff = (diff) => ({
  path: diff.deleted_file ? diff.old_path : diff.new_path,
  sha: '',
  size: 0,
  deleted: !!diff.deleted_file,
  previousPath: diff.renamed_file ? diff.old_path : undefined,
});

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

  mergeRequest.files = diffs.map(parseDiff);
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
const fetchMergePermissions = async (mergeRequests) => {
  /** @type {Map<string, WorkflowPullRequest>} */
  const iidMap = new Map(mergeRequests.map((mr) => [String(mr.number), mr]));
  // The query returns up to 100 merge requests at a time
  const chunks = splitIntoChunks([...iidMap.keys()], MAX_ITEMS.mergeRequests);

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

  // A workflow branch lives in the contributor’s fork with Open Authoring, so that’s where the
  // blobs have to be read from
  const { owner, repo } = getWorkflowRepository();

  // The blobs are fetched in batches, which are split further if the total size of a batch exceeds
  // the API’s limit. An asset committed to a workflow branch is easily large enough to hit it on
  // its own. @see https://docs.gitlab.com/api/graphql/#data-limits
  const nodes = await fetchBlobNodes(
    files.map(({ path }) => path),
    FETCH_BLOBS_QUERY,
    // Read at the head commit rather than the branch, so the content shown is that of the commit a
    // publish is pinned to, even if the branch moves on while the board loads
    { fullPath: `${owner}/${repo}`, branch: mergeRequest.headSHA ?? mergeRequest.branch },
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
 * Fetch the commit the given workflow branch points at. Two editors working on the same entry
 * share its branch, so this is how a save finds out that someone else has committed to it since
 * the draft was opened. The branch is looked up in the project it lives in, which is the
 * contributor’s fork with Open Authoring.
 * @param {string} branch Branch name.
 * @returns {Promise<string | undefined>} Git object ID, or `undefined` if the branch is gone,
 * which is what a merged or closed merge request leaves behind.
 * @see https://docs.gitlab.com/api/branches/#get-single-repository-branch
 */
export const fetchBranchHead = async (branch) => {
  try {
    const { commit } = /** @type {{ commit?: { id?: string } }} */ (
      await fetchAPI(getBranchPath(branch, getWorkflowRepository()))
    );

    return commit?.id;
  } catch (/** @type {any} */ ex) {
    if (ex.cause?.status === 404) {
      return undefined;
    }

    throw ex;
  }
};

/**
 * Delete the given branch. Failures are ignored, as the branch may already have been deleted when
 * the merge request was merged.
 * @param {string} branch Branch name.
 * @see https://docs.gitlab.com/api/branches/#delete-repository-branch
 */
export const deleteBranch = async (branch) => {
  await deleteRemoteBranch({
    branch,
    // A workflow branch lives in the contributor’s fork with Open Authoring
    path: getBranchPath(branch, getWorkflowRepository()),
    goneStatuses: [404],
  });
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
  const fork = forkedRepository.current;

  // A merge request is created on the project the branch lives in, which is the contributor’s fork
  // with Open Authoring, and targets the configured project by ID
  const result = /** @type {Record<string, any>} */ (
    await fetchAPI(`/projects/${getProjectId(fork)}/merge_requests`, {
      method: 'POST',
      body: {
        title: isDraft ? `${DRAFT_TITLE_PREFIX}${title}` : title,
        source_branch: branch,
        target_branch: repository.branch,
        description: 'Automatically generated by Sveltia CMS',
        remove_source_branch: true,
        ...(fork
          ? {
              target_project_id: projectIds.base,
              // Let a maintainer amend the contribution on the branch it came from, which is what
              // GitHub does by default for a pull request from a fork
              allow_collaboration: true,
            }
          : // Labelling a merge request requires write access to the configured project, which an
            // Open Authoring contributor doesn’t have. Their status is read from the merge request
            // itself instead
            { labels: getStatusLabel(status) }),
      },
    })
  );

  // Keep the given title rather than stripping the draft prefix from the returned one, which would
  // also strip a title that happens to start with a draft indicator such as `WIP:`
  return { ...toMergeRequest(result, status), title, branch };
};

/**
 * Fetch the open merge requests from the given branch of the configured project, whichever branch
 * they go to. A merge request from a fork can have a source branch of the same name, but it isn’t
 * from this branch, so it’s left out.
 * @param {string} branch Branch name.
 * @returns {Promise<Record<string, any>[]>} Merge requests returned by the REST API.
 * @see https://docs.gitlab.com/api/merge_requests/#list-project-merge-requests
 */
export const fetchOpenMergeRequests = async (branch) => {
  const items = /** @type {Record<string, any>[]} */ (
    await fetchAPI(
      `/projects/${getProjectId()}/merge_requests` +
        `?state=opened&source_branch=${encodeURIComponent(branch)}` +
        `&per_page=${MAX_ITEMS.mergeRequests}`,
    )
  );

  return items.filter(
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
