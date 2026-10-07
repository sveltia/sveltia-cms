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
  parseRestFiles,
  reopenPullRequest,
  updateDraftState,
} from '$lib/services/backends/git/github/pull-requests';
import { repository } from '$lib/services/backends/git/github/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { checkMergedBranch, checkStatusAllowed } from '$lib/services/backends/git/shared/fork';
import { encodePath } from '$lib/services/backends/git/shared/url';
import { user } from '$lib/services/user/account.svelte';
import { getBranchPrefix } from '$lib/services/workflow/branch';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

/**
 * @import { WorkflowPullRequest, WorkflowStatus } from '$lib/types/private';
 */

/**
 * Build the query to fetch the Editorial Workflow branches in the contributor’s fork, along with
 * the head commit of each one. With Open Authoring the branches are the source of truth: a draft
 * has no pull request yet, so listing pull requests alone would miss it.
 * @returns {string} GraphQL query.
 * @see https://docs.github.com/en/graphql/reference/objects#ref
 */
const getFetchForkBranchesQuery = () => `
  query($owner: String!, $repo: String!, $prefix: String!) {
    repository(owner: $owner, name: $repo) {
      refs(refPrefix: $prefix, first: ${MAX_ITEMS.branches}) {
        nodes {
          name
          target {
            ... on Commit {
              oid
              message
              committedDate
              author {
                name
                email
                user {
                  login
                  databaseId
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Number of fork branches whose pull requests are looked up per GraphQL query. Each one carries
 * the file lists of its candidate pull requests, so a long list is split to keep a query within the
 * API’s limits.
 */
const BRANCH_PULL_REQUESTS_CHUNK_SIZE = 50;

/**
 * Build the field selection to fetch the pull request the given fork branch has, if any. A ref in
 * the fork doesn’t report the pull requests opened from it against the configured repository, so
 * they’re looked up from that repository instead, matched by head branch name. The base branch is
 * matched as well: a pull request the contributor opened from the same branch to somewhere other
 * than the configured branch isn’t the one the CMS manages, and acting on it would relabel, rename
 * or close a request that isn’t the entry’s. The author is read too, as anyone can open a pull
 * request from a branch of a public fork.
 * @param {string} branch Branch name to look up.
 * @returns {string} Field selection on the `Repository` type.
 * @see https://docs.github.com/en/graphql/reference/objects#repository
 */
const getForkPullRequestsFragment = (branch) => `
  pullRequests(
    headRefName: ${JSON.stringify(branch)}
    baseRefName: ${JSON.stringify(repository.branch)}
    states: [OPEN, CLOSED, MERGED]
    first: ${MAX_ITEMS.branchPullRequests}
    orderBy: { field: CREATED_AT, direction: DESC }
  ) {
    nodes {
      id
      number
      title
      url
      state
      isDraft
      createdAt
      updatedAt
      headRefOid
      headRepositoryOwner {
        login
      }
      author {
        login
      }
      files(first: ${MAX_ITEMS.files}) {
        nodes {
          path
          changeType
        }
      }
    }
  }
`;

/**
 * Check whether the given pull request is one the CMS manages for the contributor: opened by them,
 * from the fork the CMS is working in. The configured repository can have a branch of the same
 * name, whose pull request isn’t the contributor’s. Nor is one someone else opened from the
 * contributor’s branch: it would put their title on the entry, and the contributor can’t convert,
 * reopen or close it, nor open their own while it’s open.
 * @param {Record<string, any>} pr Pull request node.
 * @returns {boolean} Result.
 */
const isForkPullRequest = (pr) => {
  const login = user.account?.login?.toLowerCase();

  return (
    pr.headRepositoryOwner?.login === forkedRepository.current?.owner &&
    !!login &&
    pr.author?.login?.toLowerCase() === login
  );
};

/**
 * Fetch the pull request each of the given fork branches has on the configured repository.
 * @param {string[]} branches Branch names to look up.
 * @returns {Promise<Map<string, Record<string, any>>>} Map of branch name to the most recent pull
 * request opened from it, where there is one.
 */
export const fetchForkBranchPullRequests = async (branches) => {
  /** @type {Map<string, Record<string, any>>} */
  const map = new Map();

  if (!branches.length) {
    return map;
  }

  const results = await fetchAliasedBatch({
    items: branches,
    alias: 'pr',
    getFragment: getForkPullRequestsFragment,
    chunkSize: BRANCH_PULL_REQUESTS_CHUNK_SIZE,
  });

  branches.forEach((branch, index) => {
    const [node] = (results[index]?.nodes ?? []).filter(isForkPullRequest);

    if (node) {
      map.set(branch, node);
    }
  });

  return map;
};

/**
 * Parse a branch node returned by {@link getFetchForkBranchesQuery}.
 * @param {Record<string, any>} node Ref node.
 * @param {string} branch Full branch name.
 * @param {Record<string, any>} [pullRequest] Pull request opened from the branch, from
 * {@link fetchForkBranchPullRequests}.
 * @returns {WorkflowPullRequest} Parsed branch. A branch that turns out to hold nothing is dropped
 * later, by {@link fetchForkPullRequests}, once its file list is known.
 */
export const parseForkBranch = (node, branch, pullRequest) => {
  const { message, committedDate, author } = node.target ?? {};
  // A merged pull request is finished with. Either the branch is simply left over, in which case
  // comparing it with the configured branch turns up nothing and it drops off the board, or the
  // contributor has edited the entry again since the merge, which makes it a fresh draft. Carrying
  // the merged pull request forward would instead try to reopen it when the entry moves to review
  const current = pullRequest?.state === 'MERGED' ? undefined : pullRequest;
  const { login, databaseId } = author?.user ?? {};
  const isOpen = current?.state === 'OPEN';
  // A closed pull request is treated the same as none at all: the contributor took the entry back
  // to the drafting stage, and moving it forward again reopens the request
  const inReview = isOpen && !current.isDraft;

  return {
    number: current?.number,
    nodeId: current?.id,
    // Without a pull request there’s no title to show, so the head commit’s message stands in. It’s
    // the message the pull request would be opened with anyway
    title: current?.title ?? message ?? '',
    url: current?.url,
    branch,
    // The branch head, rather than the pull request’s: a save compares it with the branch to find
    // out whether anything has been committed since, and a closed pull request’s head is stale
    headSHA: node.target?.oid,
    status: inReview ? 'pending_review' : 'draft',
    createdDate: new Date(current?.createdAt ?? committedDate),
    updatedDate: new Date(current?.updatedAt ?? committedDate),
    author: author?.name
      ? { name: author.name, email: author.email ?? '', id: databaseId, login }
      : undefined,
    // An open pull request already reports the files it changes, which saves comparing the branch
    // with the configured branch to work them out. The comparison is the only way to get them for a
    // branch without one, but it answers with a diff of every file, so it’s worth avoiding where
    // the paths are already at hand. A closed pull request is left to the comparison as well: its
    // diff is no longer a reliable account of a branch that has moved on since
    files: isOpen ? parseFileNodes(current.files?.nodes ?? []) : [],
  };
};

/**
 * Fetch the Editorial Workflow branches in the contributor’s fork.
 * @returns {Promise<WorkflowPullRequest[]>} Branches, with their pull requests where they have one.
 */
export const fetchForkBranches = async () => {
  const { owner, repo } = getWorkflowRepository();
  const prefix = getBranchPrefix();

  const { repository: result } = /** @type {{ repository: Record<string, any> }} */ (
    await fetchGraphQL(getFetchForkBranchesQuery(), {
      owner,
      repo,
      prefix: `refs/heads/${prefix}`,
    })
  );

  const nodes = /** @type {Record<string, any>[]} */ (result?.refs?.nodes ?? []);

  // The list isn’t paginated, and refs come back in alphabetical order, so going over the cap drops
  // an arbitrary set of branches from the board. Rare enough to leave unpaged, too confusing to
  // leave unsaid
  if (nodes.length === MAX_ITEMS.branches) {
    // eslint-disable-next-line no-console
    console.warn(
      `Only the first ${MAX_ITEMS.branches} Editorial Workflow branches in the fork are listed. ` +
        'Publish or discard some entries to see the rest.',
    );
  }

  const branches = nodes.map(({ name }) => `${prefix}${name}`);
  const pullRequests = await fetchForkBranchPullRequests(branches);
  /** @type {string[]} */
  const leftover = [];
  /** @type {WorkflowPullRequest[]} */
  const pending = [];

  nodes.forEach((node, index) => {
    const branch = branches[index];
    const pullRequest = pullRequests.get(branch);

    // A merged pull request whose head the branch still points at has nothing left on it. Tidying
    // it up keeps the fork from collecting a branch per published entry, and saves comparing each
    // one with the configured branch on every load just to find out it holds nothing. A branch the
    // contributor has committed to since the merge has a different head, so it survives and shows
    // up as a fresh draft
    if (pullRequest?.state === 'MERGED' && pullRequest.headRefOid === node.target?.oid) {
      leftover.push(branch);
    } else {
      pending.push(parseForkBranch(node, branch, pullRequest));
    }
  });

  // Deleting a branch is best effort: `deleteBranch` logs a failure rather than raising it, and a
  // branch that outlives this is picked up on the next load
  await runConcurrently(leftover, deleteBranch);

  return pending;
};

/**
 * Fetch the files a fork branch changes, and populate the `WorkflowFile` objects in place.
 * A draft has no pull request to list files from, so the branch is compared with the configured
 * branch instead. The comparison also reports the path a renamed file came from.
 * @param {WorkflowPullRequest} pullRequest Branch to complete.
 * @see https://docs.github.com/en/rest/commits/commits#compare-two-commits
 */
export const fetchForkBranchFileList = async (pullRequest) => {
  const { owner, repo, branch: baseBranch } = repository;
  // A comparison across repositories identifies the head branch by the fork’s owner
  const { owner: headOwner } = getWorkflowRepository();
  const base = encodePath(/** @type {string} */ (baseBranch));
  const head = `${encodeURIComponent(headOwner)}:${encodePath(pullRequest.branch)}`;

  const { files = [] } = /** @type {{ files?: Record<string, any>[] }} */ (
    await fetchAPI(`/repos/${owner}/${repo}/compare/${base}...${head}?per_page=${MAX_ITEMS.files}`)
  );

  pullRequest.files = parseRestFiles(files);
};

/**
 * Fetch the unpublished entries of an Open Authoring contributor, which live in their fork.
 * @returns {Promise<WorkflowPullRequest[]>} Branches, with their pull requests and changed files.
 */
export const fetchForkPullRequests = async () => {
  const branches = await fetchForkBranches();

  // Only a branch whose files {@link parseForkBranch} couldn’t read off an open pull request has to
  // be compared with the configured branch
  await runConcurrently(
    branches.filter(({ files }) => !files.length),
    fetchForkBranchFileList,
  );

  // The comparison reports the path a renamed file came from, but the pull request’s own file list
  // doesn’t, so those branches need the same follow-up request as the regular flow
  await runConcurrently(
    branches.filter(({ files }) => files.some(({ renamed }) => renamed)),
    fetchPullRequestFileList,
  );

  // A branch that no longer differs from the configured branch holds nothing to publish. That’s
  // what a branch left behind by a squash-merged pull request looks like
  const pending = branches.filter(({ files }) => files.length);

  await fetchPullRequestFiles(pending);

  return pending;
};

const FETCH_PULL_REQUEST_STATE_QUERY = `
  query($id: ID!) {
    node(id: $id) {
      ... on PullRequest {
        state
        isDraft
        baseRefName
        headRefOid
        headRepositoryOwner {
          login
        }
        author {
          login
        }
      }
    }
  }
`;

/**
 * Move an Open Authoring entry between the drafting and review stages. A contributor can’t label a
 * pull request on a repository they don’t have access to, so the stage is recorded in the pull
 * request itself: a draft is a branch with no pull request, or one that’s still a GitHub draft,
 * while an entry in review has a pull request waiting for a maintainer.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @param {WorkflowStatus} status New status.
 * @returns {Promise<WorkflowPullRequest>} Updated pull request, or a new one if the known one is no
 * longer the entry’s.
 * @throws {Error} When the entry is being marked ready to publish, which a contributor can’t do, or
 * has been published since the board was loaded: see {@link checkMergedBranch}.
 */
export const updateForkStatus = async (pullRequest, status) => {
  checkStatusAllowed(status);

  const { nodeId, branch, title } = pullRequest;

  // Nothing has been opened yet, so moving out of the drafting stage is what creates the pull
  // request. Moving within the drafting stage leaves the branch as it is
  if (nodeId === undefined) {
    return status === 'draft'
      ? { ...pullRequest, status, updatedDate: new Date() }
      : createPullRequest({ branch, title, status });
  }

  // The pull request may have been closed or reopened outside the CMS, so read the current state
  // rather than inferring it from the status the entry was last seen with
  const { node } = /** @type {{ node?: Record<string, any> }} */ (
    await fetchGraphQL(FETCH_PULL_REQUEST_STATE_QUERY, { id: nodeId })
  );

  const isEntryRequest =
    !!node && node.baseRefName === repository.branch && isForkPullRequest(node);

  // It may have been merged into the configured branch since the board was loaded. With nothing
  // committed to the branch since, the entry is published and has nothing left to review
  if (isEntryRequest && node.state === 'MERGED') {
    await checkMergedBranch({ branch, mergedSHA: node.headRefOid, fetchBranchHead, deleteBranch });
  }

  // Otherwise a merged pull request, or one aimed at another branch since the board was loaded, is
  // no longer the entry’s review, which is how the next load would see it too: reopening or taking
  // it out of draft would put a request for that other branch in front of the maintainers, or
  // claim a merged one is in review. So the entry carries on without it, as a fresh draft. GitHub
  // allows one open pull request per head and base, so one aimed elsewhere doesn’t stand in the way
  // of a new one to the configured branch
  // @see https://github.com/sveltia/sveltia-cms/security/advisories/GHSA-8h97-74c4-g246
  if (node && (node.state === 'MERGED' || !isEntryRequest)) {
    return updateForkStatus(
      { ...pullRequest, number: undefined, nodeId: undefined, url: undefined },
      status,
    );
  }

  const { state, isDraft } = node ?? {};

  if (status === 'draft') {
    // Converting the pull request to a draft keeps it — and the discussion on it — in place while
    // taking it out of the maintainers’ review queue
    if (state === 'OPEN' && !isDraft) {
      await updateDraftState(pullRequest, true);
    }
  } else {
    if (state === 'CLOSED') {
      await reopenPullRequest(pullRequest);
    }

    if (isDraft) {
      await updateDraftState(pullRequest, false);
    }
  }

  return { ...pullRequest, status, updatedDate: new Date() };
};
