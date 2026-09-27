import { commitChanges } from '$lib/services/backends/git/github/commits';
import { getWorkflowRepository } from '$lib/services/backends/git/github/fork';
import {
  createPullRequest,
  deleteBranch,
  fetchPullRequestFileList,
  fetchPullRequestFiles,
  MAX_ITEMS,
  parseFileNodes,
  updateDraftState,
  updateLabels,
} from '$lib/services/backends/git/github/pull-requests';
import { repository } from '$lib/services/backends/git/github/repository';
import {
  fetchForkPullRequests,
  updateForkStatus,
} from '$lib/services/backends/git/github/workflow-fork';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import { encodePath } from '$lib/services/backends/git/shared/url';
import { isSquashMergeEnabled } from '$lib/services/backends/git/shared/workflow';
import { getAllStatusLabels, getStatusFromLabels } from '$lib/services/workflow/labels';
import { openAuthoring } from '$lib/services/workflow/open-authoring';

/**
 * @import {
 * CommitResults,
 * WorkflowPullRequest,
 * WorkflowSaveOptions,
 * WorkflowStatus,
 * } from '$lib/types/private';
 */

/**
 * Get the fields to read from a pull request node, as {@link toPullRequest} expects them.
 * @returns {string} Field selection on the `PullRequest` type.
 */
const getPullRequestFields = () => `
  id
  number
  title
  url
  isDraft
  isCrossRepository
  createdAt
  updatedAt
  headRefName
  headRefOid
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
`;

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
          ${getPullRequestFields()}
        }
      }
    }
  }
`;

/**
 * Convert a pull request node returned by the GraphQL API to a workflow pull request.
 * @param {Record<string, any>} node Pull request node.
 * @param {WorkflowStatus} status Status of the pull request.
 * @returns {WorkflowPullRequest} Pull request.
 */
const toPullRequest = (node, status) => {
  const { login, name, email, databaseId } = node.author ?? {};

  return {
    number: node.number,
    nodeId: node.id,
    title: node.title,
    url: node.url,
    branch: node.headRefName,
    headSHA: node.headRefOid,
    status,
    createdDate: new Date(node.createdAt),
    updatedDate: new Date(node.updatedAt),
    author: login ? { name: name ?? login, email: email ?? '', id: databaseId, login } : undefined,
    files: parseFileNodes(node.files?.nodes ?? []),
  };
};

/**
 * Parse a pull request node returned by the GraphQL API.
 * @param {Record<string, any>} node Pull request node.
 * @returns {WorkflowPullRequest | undefined} Parsed pull request, or `undefined` if the pull
 * request is not managed by the CMS.
 */
export const parsePullRequest = (node) => {
  // A pull request from a fork belongs to an Open Authoring contributor, whose branch lives in a
  // repository this flow can’t read. Labelling one by hand would otherwise put a card on the board
  // with every file reported as deleted, because the branch isn’t on the configured repository
  if (node.isCrossRepository) {
    return undefined;
  }

  const status = getStatusFromLabels(node.labels.nodes.map((/** @type {any} */ l) => l.name));

  if (!status) {
    return undefined;
  }

  return toPullRequest(node, status);
};

/**
 * Fetch all the open pull requests on the configured repository that carry a CMS status label,
 * along with the changed files. This is the regular flow, used by anyone who can write to the
 * repository; see {@link fetchForkPullRequests} for the Open Authoring one.
 * @returns {Promise<WorkflowPullRequest[]>} Pull requests.
 */
const fetchLabelledPullRequests = async () => {
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
 * Fetch all the unpublished entries the signed-in user has in progress.
 * @returns {Promise<WorkflowPullRequest[]>} Pull requests.
 */
export const fetchPullRequests = async () =>
  openAuthoring.current ? fetchForkPullRequests() : fetchLabelledPullRequests();

/**
 * Query to fetch what the `createRef` mutation needs: the node ID of the repository the branch is
 * created in, and the head of the configured branch to start it from. With Open Authoring those are
 * two different repositories — the contributor’s fork and the configured one — because a fork that
 * has drifted would otherwise pass its own commits on to everything branched from it. A fork shares
 * an object store with its parent, so a commit that only exists upstream can still be branched from
 * in the fork.
 */
const FETCH_BRANCH_BASE_QUERY = `
  query(
    $forkOwner: String!
    $forkRepo: String!
    $owner: String!
    $repo: String!
    $branch: String!
  ) {
    fork: repository(owner: $forkOwner, name: $forkRepo) {
      id
    }
    base: repository(owner: $owner, name: $repo) {
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
 * Build the query to fetch the open pull requests from a branch of the given name. Pull requests
 * from forks can use the same branch name, e.g. Open Authoring contributors editing the same entry,
 * so fetch as many as allowed, or theirs could crowd out the one from this repository.
 * @returns {string} GraphQL query.
 */
const getFetchOpenPullRequestsQuery = () => `
  query($owner: String!, $repo: String!, $branch: String!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(headRefName: $branch, states: OPEN, first: ${MAX_ITEMS.pullRequests}) {
        nodes {
          ${getPullRequestFields()}
        }
      }
    }
  }
`;

/**
 * An open pull request found for a branch the CMS doesn’t know a pull request for.
 * @typedef {object} OpenPullRequest
 * @property {WorkflowPullRequest} pullRequest Pull request. Its status is read from the status
 * label, or from the draft state when the label is gone.
 * @property {boolean} labelled Whether the pull request carries a status label.
 */

/**
 * Fetch the open pull request from the given branch, if any. This is asked about a branch the CMS
 * doesn’t know a pull request for, so a pull request found is one the load skipped: it has lost its
 * status label, or it sits beyond the number of pull requests fetched.
 * @param {string} branch Branch name.
 * @returns {Promise<OpenPullRequest | undefined>} Pull request, or `undefined` if none is open from
 * the branch.
 */
const fetchOpenPullRequest = async (branch) => {
  const { owner, repo } = repository;

  const { repository: result } = /** @type {{ repository: Record<string, any> }} */ (
    await fetchGraphQL(getFetchOpenPullRequestsQuery(), { owner, repo, branch })
  );

  // A pull request from a fork can have a head branch of the same name, but it isn’t this branch
  const node = (result?.pullRequests?.nodes ?? []).find(
    (/** @type {Record<string, any>} */ { isCrossRepository }) => !isCrossRepository,
  );

  if (!node) {
    return undefined;
  }

  const labelledStatus = getStatusFromLabels(
    (node.labels?.nodes ?? []).map((/** @type {any} */ l) => l.name),
  );

  return {
    pullRequest: toPullRequest(node, labelledStatus ?? (node.isDraft ? 'draft' : 'pending_review')),
    labelled: !!labelledStatus,
  };
};

/**
 * Point the given branch at the given commit, dropping whatever it held.
 * @param {string} branch Branch name.
 * @param {string} sha Git object ID.
 * @see https://docs.github.com/en/rest/git/refs#update-a-reference
 */
const resetBranch = async (branch, sha) => {
  const { owner, repo } = repository;

  await fetchAPI(`/repos/${owner}/${repo}/git/refs/heads/${encodePath(branch)}`, {
    method: 'PATCH',
    body: { sha, force: true },
  });
};

/**
 * Create a new branch pointing at the head of the configured branch. If the branch already exists,
 * which happens when an earlier pull request for the same entry left it behind, the error is
 * ignored. The GraphQL API is used rather than the REST one, because a failed mutation still
 * responds with HTTP 200, so the expected “already exists” case doesn’t show up in the browser
 * console as a failed request.
 * @param {string} branch Branch name.
 * @returns {Promise<{ headOid?: string, openPullRequest?: OpenPullRequest }>} Git object ID the
 * branch points at, which is missing if the branch already existed and was kept as it was, in which
 * case its head is unknown and has to be looked up. Along with it, the pull request open from the
 * branch, if that’s why the branch was kept.
 * @see https://docs.github.com/en/graphql/reference/mutations#createref
 */
export const createBranch = async (branch) => {
  const { repo } = repository;
  // With Open Authoring the branch is created in the contributor’s fork, but starts from the head
  // of the configured repository rather than the fork’s own copy of it, so a fork that has fallen
  // behind or gained commits of its own doesn’t pass them on to the pull request
  const { owner: forkOwner, repo: forkRepo } = getWorkflowRepository();

  const { fork, base } = /** @type {Record<string, any>} */ (
    await fetchGraphQL(FETCH_BRANCH_BASE_QUERY, { forkOwner, forkRepo })
  );

  if (!fork) {
    throw createLocalizedError('Failed to create the branch.', 'repository_not_found', {
      repo: forkRepo,
    });
  }

  if (!base) {
    throw createLocalizedError('Failed to create the branch.', 'repository_not_found', { repo });
  }

  if (!base.ref) {
    throw createLocalizedError('Failed to create the branch.', 'branch_not_found', {
      repo,
      branch: repository.branch,
    });
  }

  const sha = base.ref.target.oid;

  try {
    await fetchGraphQL(CREATE_REF_MUTATION, {
      input: { repositoryId: fork.id, name: `refs/heads/${branch}`, oid: sha },
    });
  } catch (/** @type {any} */ ex) {
    const message = ex.cause?.message ?? '';

    // “A ref named ... already exists in the repository.” Anything else is a real failure
    if (!message.includes('already exists')) {
      throw new Error('Failed to create the branch.', { cause: new Error(message || ex.message) });
    }

    // The branch is left over from an earlier pull request for the same entry, which the CMS knows
    // nothing about: one the maintainer merged without deleting the branch, or one that was closed
    // on GitHub rather than discarded here, which leaves the branch behind. Starting the new pull
    // request from the branch as it stands would carry that earlier work into it — a merged one
    // adds nothing, but a closed one brings back what was thrown away — so the branch is reset to
    // the head of the configured branch, the same as a freshly created one. That only holds when
    // no pull request is open from it: one the load skipped is someone’s work in progress, and it’s
    // committed onto rather than wiped, the way it was before. With Open Authoring a draft is a
    // branch without a pull request, so there’s no telling a leftover from a live one; the branch
    // is kept, and it shows up as a draft the next time the fork is listed
    if (openAuthoring.current) {
      return {};
    }

    const openPullRequest = await fetchOpenPullRequest(branch);

    if (openPullRequest) {
      return { openPullRequest };
    }

    await resetBranch(branch, sha);

    return { headOid: sha };
  }

  return { headOid: sha };
};

/**
 * Update the pull request’s status label and draft state. A pull request in the `draft` status is
 * kept as a GitHub draft pull request, so it cannot be merged accidentally.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @param {WorkflowStatus} status New status.
 * @returns {Promise<WorkflowPullRequest>} Updated pull request.
 */
export const updateStatus = async (pullRequest, status) => {
  if (openAuthoring.current) {
    return updateForkStatus(pullRequest, status);
  }

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
 * Commit the given changes on the workflow branch, creating the branch and the pull request if they
 * don’t exist yet.
 * @param {WorkflowSaveOptions} args Arguments.
 * @returns {Promise<{ commit: CommitResults, pullRequest: WorkflowPullRequest }>} Commit results
 * and the new or updated pull request.
 */
export const savePullRequest = async ({ changes, options, branch, title, status, pullRequest }) => {
  const { headOid, openPullRequest } = pullRequest ? {} : await createBranch(branch);
  const commit = await commitChanges(changes, { ...options, branch, headOid });

  if (pullRequest) {
    return { commit, pullRequest };
  }

  // The branch already has a pull request the load skipped, and GitHub refuses to open another one
  // from the same branch, so the commit goes into that one. A pull request that still carries its
  // status label keeps its status, like a known one does. One that has lost it is given the status
  // asked for, which also puts it back on the board
  if (openPullRequest) {
    return {
      commit,
      pullRequest: openPullRequest.labelled
        ? openPullRequest.pullRequest
        : await updateStatus(openPullRequest.pullRequest, status),
    };
  }

  // With Open Authoring a draft is nothing but a branch in the contributor’s fork. The pull request
  // is opened when they hand the entry over for review, so maintainers aren’t notified about work
  // that isn’t ready for them. A removal has no review stages to move through, so its pull request
  // is opened right away like it is in the regular flow
  if (openAuthoring.current && status === 'draft') {
    return {
      commit,
      pullRequest: {
        title,
        branch,
        status,
        createdDate: /** @type {Date} */ (commit.date),
        updatedDate: /** @type {Date} */ (commit.date),
        files: [],
      },
    };
  }

  return { commit, pullRequest: await createPullRequest({ branch, title, status }) };
};

/**
 * Merge the pull request and delete the workflow branch.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @see https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request
 */
export const publish = async (pullRequest) => {
  if (openAuthoring.current) {
    throw createLocalizedError(
      'Cannot publish as an Open Authoring contributor',
      'open_authoring.publish_unsupported',
    );
  }

  const { owner, repo } = repository;
  const squash = isSquashMergeEnabled();

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

  // An Open Authoring draft has no pull request yet, so deleting the branch is all there is to do
  if (pullRequest.number !== undefined) {
    await fetchAPI(`/repos/${owner}/${repo}/pulls/${pullRequest.number}`, {
      method: 'PATCH',
      body: { state: 'closed' },
    });
  }

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
