import { fetchBlobText } from '$lib/services/backends/git/github/files';
import { getWorkflowRepository } from '$lib/services/backends/git/github/fork';
import { repository } from '$lib/services/backends/git/github/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { getAllStatusLabels, getStatusLabel } from '$lib/services/workflow/labels';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

/**
 * @import { WorkflowFile, WorkflowPullRequest, WorkflowStatus } from '$lib/types/private';
 */

/**
 * Maximum numbers of items to retrieve from the GraphQL API: open pull requests, changed files per
 * pull request, and labels per pull request. Editorial Workflow is not meant to hold a huge
 * backlog, so a single page is enough in practice.
 */
export const MAX_ITEMS = {
  pullRequests: 100,
  files: 100,
  labels: 100,
  // Open Authoring branches in the contributor’s fork
  branches: 100,
  // Pull requests to look at for a single Open Authoring branch. Only the most recent match is
  // used, and each candidate carries a file list of its own, so asking for more than a couple
  // multiplies the size of a query that already has one of these per branch
  branchPullRequests: 2,
};

/**
 * Re-fetch the list of files changed in the given pull request with the REST API, which is the only
 * one that reports the path a renamed file had before. The GraphQL API used by
 * `fetchPullRequests()` has a `RENAMED` change type but no matching previous-path field, so
 * this is called only for a pull request that contains a rename. The response is much larger,
 * because it embeds a `patch` for every file and that can’t be turned off.
 * @param {WorkflowPullRequest} pullRequest Pull request to complete.
 * @see https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files
 */
export const fetchPullRequestFileList = async (pullRequest) => {
  const { owner, repo } = repository;

  const files = /** @type {Record<string, any>[]} */ (
    await fetchAPI(
      `/repos/${owner}/${repo}/pulls/${pullRequest.number}/files?per_page=${MAX_ITEMS.files}`,
    )
  );

  pullRequest.files = files.map(({ filename, status, previous_filename: previousPath }) => ({
    path: filename,
    sha: '',
    size: 0,
    deleted: status === 'removed',
    previousPath,
  }));
};

/**
 * Fetch the content of the files changed in the given pull requests, and populate the
 * {@link WorkflowFile} objects in place. Binary files, such as images, are skipped; only their blob
 * metadata is stored.
 * @param {WorkflowPullRequest[]} pullRequests Pull requests to complete.
 */
export const fetchPullRequestFiles = async (pullRequests) => {
  /** @type {{ pullRequest: WorkflowPullRequest, file: WorkflowFile }[]} */
  const targets = [];

  pullRequests.forEach((pullRequest) => {
    pullRequest.files.forEach((file) => {
      if (!file.deleted) {
        targets.push({ pullRequest, file });
      }
    });
  });

  if (!targets.length) {
    return;
  }

  const innerQuery = targets
    .map(
      ({ pullRequest, file }, index) => `
        file_${index}: object(expression: ${JSON.stringify(`${pullRequest.branch}:${file.path}`)}) {
          ... on Blob {
            oid
            byteSize
            isBinary
            isTruncated
            text
          }
        }
      `,
    )
    .join('');

  // A workflow branch lives in the contributor’s fork with Open Authoring, so that’s where the
  // blobs have to be read from
  const workflowRepository = getWorkflowRepository();

  const { repository: result } = /** @type {{ repository: Record<string, any> }} */ (
    await fetchGraphQL(
      `
        query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            ${innerQuery}
          }
        }
      `,
      workflowRepository,
    )
  );

  /** @type {WorkflowFile[]} */
  const truncatedFiles = [];

  targets.forEach(({ file }, index) => {
    const blob = result?.[`file_${index}`];

    if (blob) {
      Object.assign(file, {
        sha: blob.oid,
        size: blob.byteSize,
        text: blob.isBinary ? undefined : (blob.text ?? undefined),
      });

      if (!blob.isBinary && blob.isTruncated) {
        truncatedFiles.push(file);
      }
    } else {
      // The file may have been removed from the branch in the meantime
      file.deleted = true;
    }
  });

  // The GraphQL API cuts `Blob.text` off at 512 KB, so read any oversized blob again with the REST
  // API, which returns it in full. @see https://github.com/sveltia/sveltia-cms/issues/950
  await runConcurrently(truncatedFiles, async (file) => {
    file.text = await fetchBlobText({ ...workflowRepository, sha: file.sha });
  });
};

/**
 * Delete the given branch. Failures are ignored, as the branch may already have been deleted by the
 * repository’s automatic head branch deletion setting.
 * @param {string} branch Branch name.
 * @see https://docs.github.com/en/rest/git/refs#delete-a-reference
 */
export const deleteBranch = async (branch) => {
  const { owner, repo } = getWorkflowRepository();

  try {
    await fetchAPI(`/repos/${owner}/${repo}/git/refs/heads/${encodeURI(branch)}`, {
      method: 'DELETE',
      responseType: 'raw',
    });
  } catch (/** @type {any} */ ex) {
    // Leaving the branch behind is harmless, but it makes the next pull request for the same entry
    // start from an existing branch, so make the failure visible rather than swallowing it
    // eslint-disable-next-line no-console
    console.warn(`Failed to delete the ${branch} branch.`, ex);
  }
};

/**
 * Replace the CMS-managed status label on a pull request while preserving any other label.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @param {WorkflowStatus} status New status.
 * @see https://docs.github.com/en/rest/issues/issues#update-an-issue
 */
export const updateLabels = async (pullRequest, status) => {
  const { owner, repo } = repository;
  const cmsLabels = getAllStatusLabels();

  const { labels = [] } = /** @type {{ labels?: { name: string }[] }} */ (
    await fetchAPI(`/repos/${owner}/${repo}/issues/${pullRequest.number}`)
  );

  const newLabels = [
    ...labels.map(({ name }) => name).filter((name) => !cmsLabels.includes(name)),
    getStatusLabel(status),
  ];

  await fetchAPI(`/repos/${owner}/${repo}/issues/${pullRequest.number}`, {
    method: 'PATCH',
    body: { labels: newLabels },
  });
};

/**
 * Convert a pull request to a draft, or mark it ready for review. The REST API cannot toggle the
 * draft state, so the GraphQL API is used here.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @param {boolean} isDraft Whether the pull request should be a draft.
 * @see https://docs.github.com/en/graphql/reference/mutations#convertpullrequesttodraft
 * @see https://docs.github.com/en/graphql/reference/mutations#markpullrequestreadyforreview
 */
export const updateDraftState = async (pullRequest, isDraft) => {
  const mutation = isDraft ? 'convertPullRequestToDraft' : 'markPullRequestReadyForReview';

  await fetchGraphQL(
    `
      mutation($input: ${isDraft ? 'ConvertPullRequestToDraftInput' : 'MarkPullRequestReadyForReviewInput'}!) {
        ${mutation}(input: $input) {
          pullRequest {
            isDraft
          }
        }
      }
    `,
    { input: { pullRequestId: pullRequest.nodeId } },
  );
};

/**
 * Create a new pull request for the given workflow branch. The pull request is created as a draft,
 * because a newly saved entry always starts with the `draft` status.
 * @param {object} args Arguments.
 * @param {string} args.branch Workflow branch name.
 * @param {string} args.title Pull request title.
 * @param {WorkflowStatus} args.status Status to open the pull request with.
 * @returns {Promise<WorkflowPullRequest>} Created pull request.
 * @see https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request
 * @see https://docs.github.com/en/rest/issues/labels#add-labels-to-an-issue
 */
export const createPullRequest = async ({ branch, title, status }) => {
  const { owner, repo, branch: baseBranch } = repository;
  const fork = forkedRepository.current;
  const isDraft = status === 'draft';

  const result = /** @type {Record<string, any>} */ (
    await fetchAPI(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: {
        title,
        // A cross-repository pull request identifies its head branch by the fork’s owner
        head: fork ? `${fork.owner}:${branch}` : branch,
        base: baseBranch,
        draft: isDraft,
        body: 'Automatically generated by Sveltia CMS',
      },
    })
  );

  /** @type {WorkflowPullRequest} */
  const pullRequest = {
    number: result.number,
    nodeId: result.node_id,
    title: result.title,
    url: result.html_url,
    branch,
    headSHA: result.head?.sha,
    status,
    createdDate: new Date(result.created_at),
    updatedDate: new Date(result.updated_at),
    files: [],
  };

  // Labelling an issue requires write access to the repository, which an Open Authoring contributor
  // doesn’t have. Their status is read from the pull request itself instead
  if (!fork) {
    // A brand-new pull request has no label to preserve, so add the status label outright rather
    // than reading the current list first like {@link updateLabels} has to
    await fetchAPI(`/repos/${owner}/${repo}/issues/${result.number}/labels`, {
      method: 'POST',
      body: { labels: [getStatusLabel(status)] },
    });
  }

  return pullRequest;
};

/**
 * Reopen a pull request that was closed earlier.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @see https://docs.github.com/en/rest/pulls/pulls#update-a-pull-request
 */
export const reopenPullRequest = async (pullRequest) => {
  const { owner, repo } = repository;

  await fetchAPI(`/repos/${owner}/${repo}/pulls/${pullRequest.number}`, {
    method: 'PATCH',
    body: { state: 'open' },
  });
};
