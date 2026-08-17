import { _ } from '@sveltia/i18n';
import { get } from 'svelte/store';

import { commitChanges } from '$lib/services/backends/git/github/commits';
import { repository } from '$lib/services/backends/git/github/repository';
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
 * WorkflowFile,
 * WorkflowPullRequest,
 * WorkflowSaveOptions,
 * WorkflowStatus,
 * } from '$lib/types/private';
 */

/**
 * Maximum numbers of items to retrieve from the GraphQL API: open pull requests, changed files per
 * pull request, and labels per pull request. Editorial Workflow is not meant to hold a huge
 * backlog, so a single page is enough in practice.
 */
const MAX_ITEMS = { pullRequests: 100, files: 100, labels: 100 };

/**
 * Build the query to fetch the open pull requests along with their labels and changed file paths.
 * The status labels are matched by the API rather than by {@link parsePullRequest}, so the item cap
 * applies to the CMS’s own pull requests instead of the repository’s most recently updated ones,
 * which could otherwise push the unpublished entries out of the result. The filter matches a pull
 * request carrying any of the labels, not all of them.
 * @returns {string} GraphQL query.
 * @see https://docs.github.com/en/graphql/reference/objects#pullrequest
 */
const getFetchPullRequestsQuery = () => `
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(
        states: OPEN
        labels: ${JSON.stringify(getAllStatusLabels())}
        first: ${MAX_ITEMS.pullRequests}
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        nodes {
          id
          number
          title
          url
          isDraft
          createdAt
          updatedAt
          headRefName
          author {
            login
            avatarUrl
            ... on User {
              name
              email
              databaseId
            }
          }
          labels(first: ${MAX_ITEMS.labels}) {
            nodes {
              name
            }
          }
          files(first: ${MAX_ITEMS.files}) {
            nodes {
              path
              changeType
            }
          }
        }
      }
    }
  }
`;

/**
 * Parse a pull request node returned by the GraphQL API.
 * @param {Record<string, any>} node Pull request node.
 * @returns {WorkflowPullRequest | undefined} Parsed pull request, or `undefined` if the pull
 * request is not managed by the CMS.
 */
export const parsePullRequest = (node) => {
  const status = getStatusFromLabels(node.labels.nodes.map((/** @type {any} */ l) => l.name));

  if (!status) {
    return undefined;
  }

  const { login, name, email, databaseId } = node.author ?? {};

  return {
    number: node.number,
    nodeId: node.id,
    title: node.title,
    url: node.url,
    branch: node.headRefName,
    status,
    createdDate: new Date(node.createdAt),
    updatedDate: new Date(node.updatedAt),
    author: login ? { name: name ?? login, email: email ?? '', id: databaseId, login } : undefined,
    files: (node.files?.nodes ?? []).map((/** @type {any} */ { path, changeType }) => ({
      path,
      sha: '',
      size: 0,
      deleted: changeType === 'DELETED',
      // The previous path of a renamed file isn’t available here; it’s filled in by
      // {@link fetchPullRequestFileList}
      renamed: changeType === 'RENAMED',
    })),
  };
};

/**
 * Re-fetch the list of files changed in the given pull request with the REST API, which is the only
 * one that reports the path a renamed file had before. The GraphQL API used by
 * {@link fetchPullRequests} has a `RENAMED` change type but no matching previous-path field, so
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
            text
          }
        }
      `,
    )
    .join('');

  const { repository: result } = /** @type {{ repository: Record<string, any> }} */ (
    await fetchGraphQL(`
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          ${innerQuery}
        }
      }
    `)
  );

  targets.forEach(({ file }, index) => {
    const blob = result?.[`file_${index}`];

    if (blob) {
      Object.assign(file, {
        sha: blob.oid,
        size: blob.byteSize,
        text: blob.isBinary ? undefined : (blob.text ?? undefined),
      });
    } else {
      // The file may have been removed from the branch in the meantime
      file.deleted = true;
    }
  });
};

/**
 * Fetch all the open pull requests managed by the CMS, along with the changed files.
 * @returns {Promise<WorkflowPullRequest[]>} Pull requests.
 */
export const fetchPullRequests = async () => {
  const { repository: result } = /** @type {{ repository: Record<string, any> }} */ (
    await fetchGraphQL(getFetchPullRequestsQuery())
  );

  const pullRequests = /** @type {WorkflowPullRequest[]} */ (
    (result?.pullRequests?.nodes ?? []).map(parsePullRequest).filter(Boolean)
  );

  // Only a pull request with a renamed file needs the heavier REST request, which is the sole
  // source of the path the file had before
  await runConcurrently(
    pullRequests.filter(({ files }) => files.some(({ renamed }) => renamed)),
    fetchPullRequestFileList,
  );

  await fetchPullRequestFiles(pullRequests);

  return pullRequests;
};

/**
 * Query to fetch what the `createRef` mutation needs: the repository’s node ID and the head of the
 * configured branch.
 */
const FETCH_BRANCH_BASE_QUERY = `
  query($owner: String!, $repo: String!, $branch: String!) {
    repository(owner: $owner, name: $repo) {
      id
      ref(qualifiedName: $branch) {
        target {
          oid
        }
      }
    }
  }
`;

const CREATE_REF_MUTATION = `
  mutation($input: CreateRefInput!) {
    createRef(input: $input) {
      ref {
        name
      }
    }
  }
`;

/**
 * Create a new branch pointing at the head of the configured branch. If the branch already exists,
 * which happens when an earlier pull request for the same entry left it behind, the error is
 * ignored. The GraphQL API is used rather than the REST one, because a failed mutation still
 * responds with HTTP 200, so the expected “already exists” case doesn’t show up in the browser
 * console as a failed request.
 * @param {string} branch Branch name.
 * @returns {Promise<string | undefined>} Git object ID the new branch points at, or `undefined` if
 * the branch already existed, in which case its head is unknown and has to be looked up.
 * @see https://docs.github.com/en/graphql/reference/mutations#createref
 */
export const createBranch = async (branch) => {
  const { repo } = repository;

  const { repository: base } = /** @type {{ repository: Record<string, any> }} */ (
    await fetchGraphQL(FETCH_BRANCH_BASE_QUERY)
  );

  if (!base) {
    throw new Error('Failed to create the branch.', {
      cause: new Error(_('repository_not_found', { values: { repo } })),
    });
  }

  if (!base.ref) {
    throw new Error('Failed to create the branch.', {
      cause: new Error(_('branch_not_found', { values: { repo, branch: repository.branch } })),
    });
  }

  const sha = base.ref.target.oid;

  const { errors } = /** @type {{ errors?: { message: string }[] }} */ (
    await fetchAPI('', {
      method: 'POST',
      isGraphQL: true,
      body: {
        query: CREATE_REF_MUTATION.replace(/\n\s*/g, ' '),
        variables: {
          input: { repositoryId: base.id, name: `refs/heads/${branch}`, oid: sha },
        },
      },
    })
  );

  if (errors?.length) {
    // “A ref named ... already exists in the repository.” Anything else is a real failure
    if (!errors.some(({ message }) => message.includes('already exists'))) {
      throw new Error('Failed to create the branch.', { cause: new Error(errors[0].message) });
    }

    return undefined;
  }

  return sha;
};

/**
 * Delete the given branch. Failures are ignored, as the branch may already have been deleted by the
 * repository’s automatic head branch deletion setting.
 * @param {string} branch Branch name.
 * @see https://docs.github.com/en/rest/git/refs#delete-a-reference
 */
export const deleteBranch = async (branch) => {
  const { owner, repo } = repository;

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
 * @returns {Promise<WorkflowPullRequest>} Created pull request.
 * @see https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request
 * @see https://docs.github.com/en/rest/issues/labels#add-labels-to-an-issue
 */
export const createPullRequest = async ({ branch, title }) => {
  const { owner, repo, branch: baseBranch } = repository;

  const result = /** @type {Record<string, any>} */ (
    await fetchAPI(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: {
        title,
        head: branch,
        base: baseBranch,
        draft: true,
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
    status: 'draft',
    createdDate: new Date(result.created_at),
    updatedDate: new Date(result.updated_at),
    files: [],
  };

  // A brand-new pull request has no label to preserve, so add the status label outright rather
  // than reading the current list first like {@link updateLabels} has to
  await fetchAPI(`/repos/${owner}/${repo}/issues/${result.number}/labels`, {
    method: 'POST',
    body: { labels: [getStatusLabel('draft')] },
  });

  return pullRequest;
};

/**
 * Commit the given changes on the workflow branch, creating the branch and the pull request if they
 * don’t exist yet.
 * @param {WorkflowSaveOptions} args Arguments.
 * @returns {Promise<{ commit: CommitResults, pullRequest: WorkflowPullRequest }>} Commit results
 * and the new or updated pull request.
 */
export const savePullRequest = async ({ changes, options, branch, title, pullRequest }) => {
  const headOid = pullRequest ? undefined : await createBranch(branch);
  const commit = await commitChanges(changes, { ...options, branch, headOid });

  return {
    commit,
    pullRequest: pullRequest ?? (await createPullRequest({ branch, title })),
  };
};

/**
 * Update the pull request’s status label and draft state. A pull request in the `draft` status is
 * kept as a GitHub draft pull request, so it cannot be merged accidentally.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @param {WorkflowStatus} status New status.
 * @returns {Promise<WorkflowPullRequest>} Updated pull request.
 */
export const updateStatus = async (pullRequest, status) => {
  const isDraft = status === 'draft';

  await updateLabels(pullRequest, status);

  // Only the transitions into and out of the `draft` status change the draft state, so moving
  // between the review and ready stages needs no mutation at all
  if (isDraft !== (pullRequest.status === 'draft')) {
    await updateDraftState(pullRequest, isDraft);
  }

  return { ...pullRequest, status, updatedDate: new Date() };
};

/**
 * Merge the pull request and delete the workflow branch.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @see https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request
 */
export const publish = async (pullRequest) => {
  const { owner, repo } = repository;
  const { backend } = get(cmsConfig) ?? {};
  const squash = backend && 'squash_merges' in backend ? !!backend.squash_merges : false;

  await fetchAPI(`/repos/${owner}/${repo}/pulls/${pullRequest.number}/merge`, {
    method: 'PUT',
    body: {
      merge_method: squash ? 'squash' : 'merge',
      commit_title: pullRequest.title,
    },
  });

  await deleteBranch(pullRequest.branch);
};

/**
 * Close the pull request without merging it, and delete the workflow branch.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @see https://docs.github.com/en/rest/pulls/pulls#update-a-pull-request
 */
export const discard = async (pullRequest) => {
  const { owner, repo } = repository;

  await fetchAPI(`/repos/${owner}/${repo}/pulls/${pullRequest.number}`, {
    method: 'PATCH',
    body: { state: 'closed' },
  });

  await deleteBranch(pullRequest.branch);
};

/**
 * GitHub’s Editorial Workflow implementation.
 * @type {import('$lib/types/private').WorkflowBackendService}
 */
export default {
  fetchPullRequests,
  savePullRequest,
  updateStatus,
  publish,
  discard,
};
