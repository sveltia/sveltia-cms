import { commitChanges } from '$lib/services/backends/git/github/commits';
import { getWorkflowRepository } from '$lib/services/backends/git/github/fork';
import { fetchAliasedBatch } from '$lib/services/backends/git/github/graphql';
import {
  createPullRequest,
  deleteBranch,
  fetchBranchHead,
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
import {
  checkPublishAllowed,
  createDraftPullRequest,
} from '$lib/services/backends/git/shared/fork';
import { encodePath } from '$lib/services/backends/git/shared/url';
import { isSquashMergeEnabled } from '$lib/services/backends/git/shared/workflow';
import { getAllStatusLabels, getStatusFromLabels } from '$lib/services/workflow/labels';
import { openAuthoring } from '$lib/services/workflow/open-authoring';

/**
 * @import {
 * CommitResults,
 * WorkflowPullRequest,
 * WorkflowSaveOptions,
 * WorkflowChangedFile,
 * WorkflowMergeState,
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
  baseRefName
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

  // A pull request to a branch other than the configured one isn’t the CMS’s either, whatever
  // label it carries: one whose base branch was changed on GitHub after the CMS opened it, or one
  // labelled by hand. Listing it would put a card on the board that moves the label on someone
  // else’s request, and publishes the entry by merging it into that other branch
  if (node.baseRefName !== repository.branch) {
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
          number
          isCrossRepository
        }
      }
    }
  }
`;

/**
 * Fetch the open pull requests from the given branch of the configured repository, whichever
 * branch they go to. A pull request from a fork can have a head branch of the same name, but it
 * isn’t from this branch, so it’s left out.
 * @param {string} branch Branch name.
 * @returns {Promise<Record<string, any>[]>} Pull request nodes, with their `number`.
 */
const fetchOpenPullRequests = async (branch) => {
  const { owner, repo } = repository;

  const { repository: result } = /** @type {{ repository: Record<string, any> }} */ (
    await fetchGraphQL(getFetchOpenPullRequestsQuery(), { owner, repo, branch })
  );

  return /** @type {Record<string, any>[]} */ (result?.pullRequests?.nodes ?? []).filter(
    ({ isCrossRepository }) => !isCrossRepository,
  );
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
 * @returns {Promise<{ headOid?: string }>} Git object ID the branch points at, which is missing if
 * the branch already existed in an Open Authoring fork and was kept as it was, in which case its
 * head is unknown and has to be looked up.
 * @throws {Error} When the branch exists and a pull request is open from it.
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

    // With Open Authoring a draft is a branch without a pull request, so there’s no telling a
    // leftover from a live one; the branch is kept, and it shows up as a draft the next time the
    // fork is listed. The fork is the contributor’s own, so nobody else’s work can be on it
    if (openAuthoring.current) {
      return {};
    }

    // A pull request open from the branch is one the board doesn’t show: it has lost its status
    // label, it sits beyond the number of pull requests fetched, it goes to another branch, or it
    // was never the CMS’s. Committing onto it would take whatever else it holds along with the
    // entry, unseen, so the save is refused instead, and the branch is left alone
    const [openPullRequest] = await fetchOpenPullRequests(branch);

    if (openPullRequest) {
      throw createLocalizedError(
        'The workflow branch is in use by another pull request.',
        'workflow.branch_in_use',
        { number: `#${openPullRequest.number}` },
      );
    }

    // The branch is left over from an earlier pull request for the same entry, which the CMS knows
    // nothing about: one the maintainer merged without deleting the branch, or one that was closed
    // on GitHub rather than discarded here, which leaves the branch behind. Starting the new pull
    // request from the branch as it stands would carry that earlier work into it — a merged one
    // adds nothing, but a closed one brings back what was thrown away — so the branch is reset to
    // the head of the configured branch, the same as a freshly created one
    await resetBranch(branch, sha);
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
  // A save onto an existing pull request goes on top of the commit the entry was loaded or saved
  // at, which the conflict check has just compared with the branch, rather than whatever the branch
  // points at by the time the commit is made. A commit pushed in between makes GitHub refuse the
  // save, instead of being taken along unseen and vouched for by the head recorded afterwards
  const { headOid } = pullRequest ? { headOid: pullRequest.headSHA } : await createBranch(branch);
  /** @type {CommitResults} */
  let commit;

  try {
    commit = await commitChanges(changes, { ...options, branch, headOid });
  } catch (ex) {
    // The branch can have gone, e.g. with a pull request merged or closed on GitHub, which is
    // worth saying in words rather than with GitHub’s message about a ref it can’t resolve. A
    // lookup that fails says nothing about the branch, so GitHub’s error is passed on then
    const branchGone =
      !!pullRequest &&
      (await fetchBranchHead(branch).then(
        (head) => head === undefined,
        () => false,
      ));

    if (branchGone) {
      throw createLocalizedError('Failed to save the changes.', 'branch_not_found', {
        repo: getWorkflowRepository().repo,
        branch,
      });
    }

    throw ex;
  }

  if (pullRequest) {
    return { commit, pullRequest };
  }

  // A removal has no review stages to move through, so its pull request is opened right away like
  // it is in the regular flow
  if (openAuthoring.current && status === 'draft') {
    return { commit, pullRequest: createDraftPullRequest({ commit, branch, title }) };
  }

  return { commit, pullRequest: await createPullRequest({ branch, title, status }) };
};

/**
 * Maximum number of files the comparison API lists. A comparison that reaches it may have left
 * some out, so it can’t vouch for the whole pull request.
 * @see https://docs.github.com/en/rest/commits/commits#compare-two-commits
 */
const MAX_COMPARE_FILES = 300;

/**
 * Map of the file statuses the REST API reports to {@link WorkflowChangedFile} ones. A copy adds a
 * file, and `changed` is a change of mode, which modifies it.
 * @type {Record<string, WorkflowChangedFile['status']>}
 */
const REST_FILE_STATUSES = {
  added: 'added',
  copied: 'added',
  removed: 'removed',
  renamed: 'renamed',
};

/**
 * Fetch the Git file modes of the given files at the given commit, which tell a regular file from
 * a symbolic link or a submodule. The comparison API leaves the mode out, so the trees holding the
 * files are read instead.
 * @param {object} args Arguments.
 * @param {string} args.headSHA Git object ID of the commit.
 * @param {string[]} args.paths File paths.
 * @returns {Promise<Map<string, string>>} Map of file path to its mode as an octal string.
 * @see https://docs.github.com/en/graphql/reference/objects#treeentry
 */
const fetchFileModes = async ({ headSHA, paths }) => {
  const dirs = [...new Set(paths.map((path) => path.slice(0, Math.max(path.lastIndexOf('/'), 0))))];

  const trees = await fetchAliasedBatch({
    items: dirs,
    alias: 'tree',
    /**
     * Build the field selection for a folder at the commit.
     * @param {string} dir Folder path, or an empty string for the root.
     * @returns {string} Field selection.
     */
    getFragment: (dir) => `
      object(expression: ${JSON.stringify(`${headSHA}:${dir}`)}) {
        ... on Tree {
          entries {
            name
            mode
          }
        }
      }
    `,
    chunkSize: 50,
  });

  /** @type {Map<string, string>} */
  const modes = new Map();

  dirs.forEach((dir, index) => {
    (trees[index]?.entries ?? []).forEach((/** @type {any} */ { name, mode }) => {
      modes.set(dir ? `${dir}/${name}` : name, Number(mode).toString(8));
    });
  });

  return modes;
};

/**
 * Read the pull request afresh right before it’s merged. The files are listed by comparing the
 * configured branch with the very commit the pull request points at, rather than read off the pull
 * request, so they describe exactly what a merge pinned to that commit would bring in, even if the
 * branch moves on meanwhile.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @returns {Promise<WorkflowMergeState>} State.
 * @see https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request
 * @see https://docs.github.com/en/rest/commits/commits#compare-two-commits
 */
export const fetchMergeState = async (pullRequest) => {
  const { owner, repo, branch } = repository;

  const { head, base } = /** @type {Record<string, any>} */ (
    await fetchAPI(`/repos/${owner}/${repo}/pulls/${pullRequest.number}`)
  );

  const headSHA = /** @type {string | undefined} */ (head?.sha);
  const fullName = `${owner}/${repo}`.toLowerCase();

  const onConfiguredBranches =
    base?.ref === branch &&
    base?.repo?.full_name?.toLowerCase() === fullName &&
    head?.repo?.full_name?.toLowerCase() === fullName;

  if (!headSHA || !onConfiguredBranches) {
    return { headSHA, onConfiguredBranches: false, files: [], complete: false };
  }

  const { files = [] } = /** @type {{ files?: Record<string, any>[] }} */ (
    await fetchAPI(
      `/repos/${owner}/${repo}/compare/${encodePath(/** @type {string} */ (branch))}...${headSHA}`,
    )
  );

  const changedFiles = files.map(({ filename, status, previous_filename: previousPath }) => ({
    path: /** @type {string} */ (filename),
    status: REST_FILE_STATUSES[status] ?? 'modified',
    previousPath,
  }));

  const modes = await fetchFileModes({
    headSHA,
    paths: changedFiles.filter(({ status }) => status !== 'removed').map(({ path }) => path),
  });

  return {
    headSHA,
    onConfiguredBranches,
    files: changedFiles.map((file) => ({ ...file, mode: modes.get(file.path) })),
    complete: files.length < MAX_COMPARE_FILES,
  };
};

/**
 * Find which of the given files are the same at the given commit as on the configured branch, by
 * comparing the Git object IDs of their blobs. A file missing from both counts as the same.
 * @param {object} args Arguments.
 * @param {string} args.headSHA Git object ID of the commit.
 * @param {string[]} args.paths File paths.
 * @returns {Promise<string[]>} Paths of the files that are the same.
 * @see https://docs.github.com/en/graphql/reference/objects#repository
 */
export const fetchUnchangedPaths = async ({ headSHA, paths }) => {
  const refs = [/** @type {string} */ (repository.branch), headSHA];

  const blobs = await fetchAliasedBatch({
    items: paths.flatMap((path) => refs.map((ref) => `${ref}:${path}`)),
    alias: 'file',
    /**
     * Build the field selection for a file at a branch or commit.
     * @param {string} expression `ref:path` expression.
     * @returns {string} Field selection.
     */
    getFragment: (expression) => `object(expression: ${JSON.stringify(expression)}) { oid }`,
    chunkSize: 100,
  });

  return paths.filter(
    (_path, index) => (blobs[index * 2]?.oid ?? null) === (blobs[index * 2 + 1]?.oid ?? null),
  );
};

/**
 * Merge the pull request and delete the workflow branch. The merge is pinned to the commit the
 * entry was loaded or saved at, so a commit pushed to the branch since — after the entry has been
 * reviewed — makes GitHub refuse the merge rather than take it along unseen.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @see https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request
 */
export const publish = async (pullRequest) => {
  checkPublishAllowed();

  const { owner, repo } = repository;
  const squash = isSquashMergeEnabled();

  await fetchAPI(`/repos/${owner}/${repo}/pulls/${pullRequest.number}/merge`, {
    method: 'PUT',
    body: {
      merge_method: squash ? 'squash' : 'merge',
      commit_title: pullRequest.title,
      sha: pullRequest.headSHA,
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
  fetchBranchHead,
  fetchMergeState,
  fetchUnchangedPaths,
  publish,
  discard,
};
