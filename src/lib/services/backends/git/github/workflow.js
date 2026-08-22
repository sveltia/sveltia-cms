import { _ } from '@sveltia/i18n';
import { get } from 'svelte/store';

import { commitChanges } from '$lib/services/backends/git/github/commits';
import { getWorkflowRepository } from '$lib/services/backends/git/github/fork';
import { repository } from '$lib/services/backends/git/github/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { cmsConfig } from '$lib/services/config';
import { getBranchPrefix } from '$lib/services/workflow/branch';
import {
  getAllStatusLabels,
  getStatusFromLabels,
  getStatusLabel,
} from '$lib/services/workflow/labels';
import { forkedRepository, openAuthoring } from '$lib/services/workflow/open-authoring';

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
const MAX_ITEMS = {
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
          isCrossRepository
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

  // A workflow branch lives in the contributor’s fork with Open Authoring, so that’s where the
  // blobs have to be read from
  const { repository: result } = /** @type {{ repository: Record<string, any> }} */ (
    await fetchGraphQL(
      `
        query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            ${innerQuery}
          }
        }
      `,
      getWorkflowRepository(),
    )
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
 * Fetch all the open pull requests on the configured repository that carry a CMS status label,
 * along with the changed files. This is the regular flow, used by anyone who can write to the
 * repository; see {@link fetchForkPullRequests} for the Open Authoring one.
 * @returns {Promise<WorkflowPullRequest[]>} Pull requests.
 */
export const fetchLabelledPullRequests = async () => {
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
 * Build the query to fetch the pull request each of the given fork branches has, if any. A ref in
 * the fork doesn’t report the pull requests opened from it against the configured repository, so
 * they’re looked up from that repository instead, matched by head branch name. One aliased sub-
 * query per branch keeps it to a single request.
 * @param {string[]} branches Branch names to look up.
 * @returns {string} GraphQL query.
 * @see https://docs.github.com/en/graphql/reference/objects#repository
 */
const getFetchForkPullRequestsQuery = (branches) => `
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      ${branches
        .map(
          (branch, index) => `
            pr_${index}: pullRequests(
              headRefName: ${JSON.stringify(branch)}
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
                headRepositoryOwner {
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
          `,
        )
        .join('')}
    }
  }
`;

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

  const fork = get(forkedRepository);

  const { repository: result } = /** @type {{ repository: Record<string, any> }} */ (
    await fetchGraphQL(getFetchForkPullRequestsQuery(branches))
  );

  branches.forEach((branch, index) => {
    const [node] = (result?.[`pr_${index}`]?.nodes ?? []).filter(
      // The configured repository can have a branch of the same name, whose pull request isn’t the
      // contributor’s
      (/** @type {any} */ pr) => pr.headRepositoryOwner?.login === fork?.owner,
    );

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
    files: isOpen
      ? (current.files?.nodes ?? []).map((/** @type {any} */ { path, changeType }) => ({
          path,
          sha: '',
          size: 0,
          deleted: changeType === 'DELETED',
          // The previous path of a renamed file isn’t available here; it’s filled in by
          // {@link fetchPullRequestFileList}
          renamed: changeType === 'RENAMED',
        }))
      : [],
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

  return nodes.map((node, index) =>
    parseForkBranch(node, branches[index], pullRequests.get(branches[index])),
  );
};

/**
 * Fetch the files a fork branch changes, and populate the {@link WorkflowFile} objects in place.
 * A draft has no pull request to list files from, so the branch is compared with the configured
 * branch instead. The comparison also reports the path a renamed file came from.
 * @param {WorkflowPullRequest} pullRequest Branch to complete.
 * @see https://docs.github.com/en/rest/commits/commits#compare-two-commits
 */
export const fetchForkBranchFileList = async (pullRequest) => {
  const { owner, repo, branch: baseBranch } = repository;
  // A comparison across repositories identifies the head branch by the fork’s owner
  const { owner: headOwner } = getWorkflowRepository();
  const head = `${headOwner}:${pullRequest.branch}`;

  const { files = [] } = /** @type {{ files?: Record<string, any>[] }} */ (
    await fetchAPI(
      `/repos/${owner}/${repo}/compare/${encodeURI(`${baseBranch}...${head}`)}` +
        `?per_page=${MAX_ITEMS.files}`,
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

/**
 * Fetch all the unpublished entries the signed-in user has in progress.
 * @returns {Promise<WorkflowPullRequest[]>} Pull requests.
 */
export const fetchPullRequests = async () =>
  get(openAuthoring) ? fetchForkPullRequests() : fetchLabelledPullRequests();

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
  // With Open Authoring the branch is created in the contributor’s fork, which the sign-in has
  // already synced with the configured repository, so its head is the same commit
  const { owner, repo } = getWorkflowRepository();

  const { repository: base } = /** @type {{ repository: Record<string, any> }} */ (
    await fetchGraphQL(FETCH_BRANCH_BASE_QUERY, { owner, repo })
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

  try {
    await fetchAPI('', {
      method: 'POST',
      isGraphQL: true,
      body: {
        query: CREATE_REF_MUTATION.replace(/\n\s*/g, ' '),
        variables: {
          input: { repositoryId: base.id, name: `refs/heads/${branch}`, oid: sha },
        },
      },
    });
  } catch (/** @type {any} */ ex) {
    const message = ex.cause?.message ?? '';

    // “A ref named ... already exists in the repository.” The branch is left over from an earlier
    // pull request for the same entry — one the maintainer merged without deleting the branch, or
    // one that was discarded — and committing onto it is exactly what’s wanted. Anything else is a
    // real failure
    if (!message.includes('already exists')) {
      throw new Error('Failed to create the branch.', { cause: new Error(message || ex.message) });
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
  const fork = get(forkedRepository);
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
 * Commit the given changes on the workflow branch, creating the branch and the pull request if they
 * don’t exist yet.
 * @param {WorkflowSaveOptions} args Arguments.
 * @returns {Promise<{ commit: CommitResults, pullRequest: WorkflowPullRequest }>} Commit results
 * and the new or updated pull request.
 */
export const savePullRequest = async ({ changes, options, branch, title, status, pullRequest }) => {
  const headOid = pullRequest ? undefined : await createBranch(branch);
  const commit = await commitChanges(changes, { ...options, branch, headOid });

  if (pullRequest) {
    return { commit, pullRequest };
  }

  // With Open Authoring a draft is nothing but a branch in the contributor’s fork. The pull request
  // is opened when they hand the entry over for review, so maintainers aren’t notified about work
  // that isn’t ready for them. A removal has no review stages to move through, so its pull request
  // is opened right away like it is in the regular flow
  if (get(openAuthoring) && status === 'draft') {
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

const FETCH_PULL_REQUEST_STATE_QUERY = `
  query($id: ID!) {
    node(id: $id) {
      ... on PullRequest {
        state
        isDraft
      }
    }
  }
`;

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

/**
 * Move an Open Authoring entry between the drafting and review stages. A contributor can’t label a
 * pull request on a repository they don’t have access to, so the stage is recorded in the pull
 * request itself: a draft is a branch with no pull request, or one that’s still a GitHub draft,
 * while an entry in review has a pull request waiting for a maintainer.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @param {WorkflowStatus} status New status.
 * @returns {Promise<WorkflowPullRequest>} Updated pull request.
 * @throws {Error} When the entry is being marked ready to publish, which a contributor can’t do.
 */
export const updateForkStatus = async (pullRequest, status) => {
  if (status === 'pending_publish') {
    throw new Error('Cannot mark an entry ready to publish as an Open Authoring contributor', {
      cause: new Error(_('open_authoring.publish_unsupported')),
    });
  }

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
  const { node } = /** @type {{ node?: { state: string, isDraft: boolean } }} */ (
    await fetchGraphQL(FETCH_PULL_REQUEST_STATE_QUERY, { id: nodeId })
  );

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

/**
 * Update the pull request’s status label and draft state. A pull request in the `draft` status is
 * kept as a GitHub draft pull request, so it cannot be merged accidentally.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @param {WorkflowStatus} status New status.
 * @returns {Promise<WorkflowPullRequest>} Updated pull request.
 */
export const updateStatus = async (pullRequest, status) => {
  if (get(openAuthoring)) {
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
 * Merge the pull request and delete the workflow branch.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @see https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request
 */
export const publish = async (pullRequest) => {
  if (get(openAuthoring)) {
    throw new Error('Cannot publish as an Open Authoring contributor', {
      cause: new Error(_('open_authoring.publish_unsupported')),
    });
  }

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
