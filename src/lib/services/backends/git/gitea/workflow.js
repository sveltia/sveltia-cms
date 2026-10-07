import { commitChanges } from '$lib/services/backends/git/gitea/commits';
import { getWorkflowRepository } from '$lib/services/backends/git/gitea/fork';
import {
  createPullRequest,
  deleteBranch,
  fetchAllPages,
  fetchBranchHead,
  fetchChangedFiles,
  fetchFileSHA,
  fetchPullRequestFileContents,
  fetchPullRequestFileList,
  isSameRepositoryPullRequest,
  parsePullRequest,
  resolveChangeSHAs,
  updateDraftState,
  updateLabels,
} from '$lib/services/backends/git/gitea/pull-requests';
import { repository } from '$lib/services/backends/git/gitea/repository';
import {
  fetchForkPullRequests,
  updateForkStatus,
} from '$lib/services/backends/git/gitea/workflow-fork';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import {
  checkPublishAllowed,
  createDraftPullRequest,
} from '$lib/services/backends/git/shared/fork';
import { encodePath } from '$lib/services/backends/git/shared/url';
import { isSquashMergeEnabled } from '$lib/services/backends/git/shared/workflow';
import { getAllStatusLabels } from '$lib/services/workflow/labels';
import { openAuthoring } from '$lib/services/workflow/open-authoring';

/**
 * @import {
 * CommitOptions,
 * CommitResults,
 * FileChange,
 * WorkflowChangedFile,
 * WorkflowMergeState,
 * WorkflowPullRequest,
 * WorkflowSaveOptions,
 * WorkflowStatus,
 * } from '$lib/types/private';
 */

/**
 * Fetch all the open pull requests on the configured repository that carry a CMS status label,
 * along with the changed files. This is the regular flow, used by anyone who can write to the
 * repository; see {@link fetchForkPullRequests} for the Open Authoring one.
 * @returns {Promise<WorkflowPullRequest[]>} Pull requests.
 * @see https://docs.gitea.com/api/next/#tag/issue/operation/issueListLabels
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoListPullRequests
 */
export const fetchLabelledPullRequests = async () => {
  const { owner, repo } = repository;
  const statusLabels = getAllStatusLabels();

  // The status labels are matched by the API rather than by {@link parsePullRequest}, so the item
  // cap applies to the CMS’s own pull requests instead of the repository’s most recently updated
  // ones, which could otherwise push the unpublished entries out of the result. The pull request
  // endpoint takes label IDs and matches a pull request carrying any of them, so the IDs are looked
  // up first. The issue endpoint takes names instead, but only matches an item carrying all of
  // them, which no pull request does once more than one status label exists
  const labelIds = (await fetchAllPages(`/repos/${owner}/${repo}/labels`))
    .filter(({ name }) => statusLabels.includes(name))
    .map(({ id }) => id);

  // Without a status label on the repository, no pull request can carry one
  if (!labelIds.length) {
    return [];
  }

  const labelQuery = labelIds.map((id) => `&labels=${id}`).join('');

  const items = await fetchAllPages(
    `/repos/${owner}/${repo}/pulls?state=open&sort=recentupdate${labelQuery}`,
  );

  // A pull request carrying more than one status label is listed once for each. The list reports
  // the head commit as of the instance’s own reference, which can trail a push by a moment, so each
  // match is read on its own below for the branch’s current head
  const numbers = [...new Set(items.map(({ number }) => /** @type {number} */ (number)))];
  /** @type {WorkflowPullRequest[]} */
  const pullRequests = [];

  await runConcurrently(numbers, async (number) => {
    const item = /** @type {Record<string, any>} */ (
      await fetchAPI(`/repos/${owner}/${repo}/pulls/${number}`)
    );

    const pullRequest = parsePullRequest(item);

    if (pullRequest) {
      pullRequests.push(pullRequest);
    }
  });

  pullRequests.sort((a, b) => b.updatedDate.getTime() - a.updatedDate.getTime());

  await runConcurrently(pullRequests, async (pullRequest) => {
    await fetchPullRequestFileList(pullRequest);
    await fetchPullRequestFileContents(pullRequest);
  });

  return pullRequests;
};

/**
 * Fetch all the unpublished entries of the signed-in user: the pull requests on the configured
 * repository that carry a CMS status label, or, for an Open Authoring contributor, the workflow
 * branches in their fork.
 * @returns {Promise<WorkflowPullRequest[]>} Pull requests.
 */
export const fetchPullRequests = async () =>
  openAuthoring.current ? fetchForkPullRequests() : fetchLabelledPullRequests();

/**
 * Fetch the open pull request from the given branch of the configured repository, whichever branch
 * it goes to. This is asked about a branch the CMS doesn’t know a pull request for, so one found
 * here is a pull request the board doesn’t show. The open pull requests are listed and matched
 * here, because the lookup by base and head branch returns a pull request in any state — after an
 * entry has been published and edited again, that can be the merged one rather than the open one.
 * @param {string} branch Branch name.
 * @returns {Promise<Record<string, any> | undefined>} Pull request, or `undefined` if none is open
 * from the branch.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoListPullRequests
 */
const fetchOpenPullRequest = async (branch) => {
  const { owner, repo } = repository;
  const items = await fetchAllPages(`/repos/${owner}/${repo}/pulls?state=open&sort=recentupdate`);

  // A pull request from a fork can have a head branch of the same name, but it isn’t this branch
  return items.find((item) => item.head?.ref === branch && isSameRepositoryPullRequest(item));
};

/**
 * Commit the given changes on a workflow branch that no pull request is known for. The branch is
 * usually created along with the commit, but it can already exist: it’s left over from an earlier
 * pull request for the same entry, which the CMS knows nothing about — one merged without deleting
 * the branch, or one that was closed on the instance rather than discarded here, which leaves the
 * branch behind. Starting the new pull request from the branch as it stands would carry that
 * earlier work into it — a merged one adds nothing, but a closed one brings back what was thrown
 * away — so the branch is deleted and created afresh from the configured branch. With Open
 * Authoring a draft is a branch without a pull request, so there’s no telling a leftover from a
 * live one; the branch is kept, and it shows up as a draft the next time the fork is listed. The
 * fork is the contributor’s own, so nobody else’s work can be on it.
 * @param {FileChange[]} changes Changes to be committed.
 * @param {CommitOptions} options Commit options, with the workflow branch.
 * @returns {Promise<CommitResults>} Commit results.
 * @throws {Error} When the branch exists and a pull request is open from it.
 */
const commitToNewBranch = async (changes, options) => {
  const { branch = '' } = options;
  // The configured branch is resolved by the time anything is saved, so it’s always there. With
  // Open Authoring it names the fork’s copy of the branch, which is where the new branch starts
  const startBranch = /** @type {string} */ (repository.branch);
  // A branch created from the start branch starts with the same files, so their SHAs are the ones
  // to commit against
  const freshChanges = await resolveChangeSHAs(changes, startBranch);

  try {
    return await commitChanges(freshChanges, { ...options, startBranch });
  } catch (/** @type {any} */ ex) {
    // Gitea/Forgejo rejects `new_branch` outright once the branch exists. Anything else is a real
    // failure
    if (ex.cause?.status !== 422) {
      throw ex;
    }
  }

  if (openAuthoring.current) {
    // The branch has moved on from the configured one, so the SHAs come from the branch itself
    return commitChanges(await resolveChangeSHAs(changes, branch), options);
  }

  // A pull request open from the branch is one the board doesn’t show: it has lost its status
  // label, it sits beyond the number of pull requests fetched, it goes to another branch, or it was
  // never the CMS’s. Committing onto it would take whatever else it holds along with the entry,
  // unseen, and deleting the branch would close it, so the save is refused instead
  const openPullRequest = await fetchOpenPullRequest(branch);

  if (openPullRequest) {
    throw createLocalizedError(
      'The workflow branch is in use by another pull request.',
      'workflow.branch_in_use',
      { number: `#${openPullRequest.number}` },
    );
  }

  await deleteBranch(branch);

  return commitChanges(freshChanges, { ...options, startBranch });
};

/**
 * Commit the given changes onto the branch of an existing pull request. GitHub can be told which
 * commit a commit has to go on top of, but Gitea/Forgejo can’t: a commit lands on whatever the
 * branch points at, and only the files it touches are checked against the blob SHAs it carries. So
 * the branch has to point at the commit the entry was loaded or saved at, which the conflict check
 * has just compared it with, or a commit pushed since — one the board never showed, say, because
 * the instance was still catching up with it — would go out with the save, vouched for by the head
 * recorded afterwards. Without a head on record there’s nothing to compare, which is refused just
 * the same. The blob SHAs are read at that commit too, so a push that lands in the last moment and
 * touches the same files makes the instance refuse the save.
 * @param {FileChange[]} changes Changes to be committed.
 * @param {CommitOptions} options Commit options, with the workflow branch.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @returns {Promise<CommitResults>} Commit results.
 * @throws {Error} When the branch is gone, or points at another commit than the one on record.
 */
const commitToExistingBranch = async (changes, options, pullRequest) => {
  const { branch = '' } = options;
  const { headSHA } = pullRequest;
  const head = await fetchBranchHead(branch);

  // The branch can have gone, e.g. with a pull request merged or closed on the instance, which is
  // worth saying in words rather than with the instance’s message about a branch it can’t find
  if (head === undefined) {
    throw createLocalizedError('Failed to save the changes.', 'branch_not_found', {
      repo: getWorkflowRepository().repo,
      branch,
    });
  }

  // Trying again reloads the entry first, which takes the other commit into account
  if (!headSHA || head !== headSHA) {
    throw createLocalizedError(
      'The workflow branch has moved since the entry was loaded.',
      'save_conflict.branch_moved',
    );
  }

  return commitChanges(await resolveChangeSHAs(changes, headSHA), options);
};

/**
 * Commit the given changes on the workflow branch, creating the branch and the pull request if they
 * don’t exist yet.
 * @param {WorkflowSaveOptions} args Arguments.
 * @returns {Promise<{ commit: CommitResults, pullRequest: WorkflowPullRequest }>} Commit results
 * and the new or updated pull request.
 */
export const savePullRequest = async ({ changes, options, branch, title, status, pullRequest }) => {
  if (pullRequest) {
    return {
      commit: await commitToExistingBranch(changes, { ...options, branch }, pullRequest),
      pullRequest,
    };
  }

  // The commit itself creates the workflow branch on the first save, so it doesn’t need a request
  // of its own
  const commit = await commitToNewBranch(changes, { ...options, branch });

  // A removal has no review stages to move through, so its pull request is opened right away like
  // it is in the regular flow
  if (openAuthoring.current && status === 'draft') {
    return { commit, pullRequest: createDraftPullRequest({ commit, branch, title }) };
  }

  return { commit, pullRequest: await createPullRequest({ branch, title, status }) };
};

/**
 * Update the pull request’s status label and draft state. A pull request in the `draft` status is
 * kept as a work-in-progress pull request, so it cannot be merged accidentally.
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

  // Only the transitions into and out of the `draft` status change the title, so moving between the
  // review and ready stages needs no further request
  if (isDraft !== (pullRequest.status === 'draft')) {
    await updateDraftState(pullRequest, isDraft);
  }

  return { ...pullRequest, status, updatedDate: new Date() };
};

/**
 * Map of the file statuses the REST API reports to {@link WorkflowChangedFile} ones. A copy adds a
 * file; `changed` and `unchanged` both modify it, the latter being what a binary file or a change
 * of mode alone is reported as.
 * @type {Record<string, WorkflowChangedFile['status']>}
 */
const REST_FILE_STATUSES = {
  added: 'added',
  copied: 'added',
  deleted: 'removed',
  renamed: 'renamed',
};

/**
 * Map of the content types the REST API reports to Git file modes. The API doesn’t tell an
 * executable file from a regular one, which makes no difference here: both are regular files.
 * @type {Record<string, string>}
 */
const CONTENT_TYPE_MODES = {
  file: '100644',
  symlink: '120000',
  submodule: '160000',
  dir: '040000',
};

/**
 * Fetch the Git file modes of the given files at the given commit, which tell a regular file from
 * a symbolic link or a submodule. The changed file list leaves the mode out, so the folders holding
 * the files are listed instead.
 * @param {object} args Arguments.
 * @param {string} args.headSHA Git object ID of the commit.
 * @param {string[]} args.paths File paths.
 * @returns {Promise<Map<string, string>>} Map of file path to its mode as an octal string.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetContentsList
 */
const fetchFileModes = async ({ headSHA, paths }) => {
  const { owner, repo } = repository;
  const dirs = [...new Set(paths.map((path) => path.slice(0, Math.max(path.lastIndexOf('/'), 0))))];
  /** @type {Map<string, string>} */
  const modes = new Map();

  await runConcurrently(dirs, async (dir) => {
    const entries = /** @type {Record<string, any>[]} */ (
      await fetchAPI(
        `/repos/${owner}/${repo}/contents${dir ? `/${encodePath(dir)}` : ''}` +
          `?ref=${encodeURIComponent(headSHA)}`,
      )
    );

    entries.forEach(({ path, type }) => {
      if (type in CONTENT_TYPE_MODES) {
        modes.set(path, CONTENT_TYPE_MODES[type]);
      }
    });
  });

  return modes;
};

/**
 * Read the pull request afresh right before it’s merged: where it goes, the commit its branch
 * points at, and the files it changes as of that commit. The merge is pinned to the commit, so the
 * files describe exactly what the merge would bring in, even if the branch moves on meanwhile.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @returns {Promise<WorkflowMergeState>} State.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetPullRequest
 */
export const fetchMergeState = async (pullRequest) => {
  const { owner, repo } = repository;
  const { number } = /** @type {{ number: number }} */ (pullRequest);

  // The head commit of a single pull request is the branch’s own, read when asked
  const item = /** @type {Record<string, any>} */ (
    await fetchAPI(`/repos/${owner}/${repo}/pulls/${number}`)
  );

  const headSHA = /** @type {string | undefined} */ (item.head?.sha);

  // The pull request is read from the configured repository, which is its base repository by
  // definition. Its name isn’t compared: the instance redirects a renamed repository, whose new
  // name the pull request would carry
  const onConfiguredBranches =
    item.base?.ref === repository.branch && isSameRepositoryPullRequest(item);

  if (!headSHA || !onConfiguredBranches) {
    return { headSHA, onConfiguredBranches: false, files: [], complete: false };
  }

  // The branch has moved on from the commit on record, which the check refuses outright, so there’s
  // no point in waiting for the file list of a commit that won’t be merged. The list is reported as
  // complete, or the check would put the refusal down to changes it can’t show instead
  if (headSHA !== pullRequest.headSHA) {
    return { headSHA, onConfiguredBranches, files: [], complete: true };
  }

  const { files, complete } = await fetchChangedFiles(number, headSHA);

  const changedFiles = files.map(({ filename, status, previous_filename: previousPath }) => ({
    path: /** @type {string} */ (filename),
    status: REST_FILE_STATUSES[status] ?? 'modified',
    previousPath: previousPath || undefined,
  }));

  const modes = await fetchFileModes({
    headSHA,
    paths: changedFiles.filter(({ status }) => status !== 'removed').map(({ path }) => path),
  });

  return {
    headSHA,
    onConfiguredBranches,
    files: changedFiles.map((file) => ({ ...file, mode: modes.get(file.path) })),
    complete,
  };
};

/**
 * Find which of the given files are the same at the given commit as on the configured branch, by
 * comparing the Git object IDs of their blobs. A file missing from both counts as the same.
 * @param {object} args Arguments.
 * @param {string} args.headSHA Git object ID of the commit.
 * @param {string[]} args.paths File paths.
 * @returns {Promise<string[]>} Paths of the files that are the same.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetContents
 */
export const fetchUnchangedPaths = async ({ headSHA, paths }) => {
  const { branch } = /** @type {{ branch: string }} */ (repository);
  /** @type {Set<string>} */
  const unchanged = new Set();

  await runConcurrently(paths, async (path) => {
    const [base, head] = await Promise.all([
      fetchFileSHA(path, branch, repository),
      fetchFileSHA(path, headSHA, repository),
    ]);

    if (base === head) {
      unchanged.add(path);
    }
  });

  return paths.filter((path) => unchanged.has(path));
};

/**
 * Check whether the given pull request has been merged. The endpoint answers with a status rather
 * than a body: `204 No Content` when it has, `404 Not Found` when it hasn’t.
 * @param {number} number Pull request number.
 * @returns {Promise<boolean>} `true` if the pull request has been merged.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoPullRequestIsMerged
 */
const isPullRequestMerged = async (number) => {
  const { owner, repo } = repository;

  const response = /** @type {Response} */ (
    await fetchAPI(`/repos/${owner}/${repo}/pulls/${number}/merge`, { responseType: 'raw' })
  );

  return response.ok;
};

/**
 * Merge the pull request and delete the workflow branch. The merge is pinned to the commit the
 * entry was loaded or saved at, so a commit pushed to the branch since — after the entry has been
 * reviewed — makes the instance refuse the merge rather than take it along unseen.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoMergePullRequest
 */
export const publish = async (pullRequest) => {
  checkPublishAllowed();

  const { owner, repo } = repository;
  const { number } = pullRequest;
  const squash = isSquashMergeEnabled();

  // A successful merge comes back as `200 OK` with an empty body, which can’t be parsed as JSON, so
  // the response is taken as is and the error case is handled here
  const response = /** @type {Response} */ (
    await fetchAPI(`/repos/${owner}/${repo}/pulls/${number}/merge`, {
      method: 'POST',
      responseType: 'raw',
      body: {
        // These fields were named in Pascal case until Gitea gave them snake case JSON names. A
        // current Gitea accepts either spelling, while an older one and Forgejo only take the
        // original names
        Do: squash ? 'squash' : 'merge',
        MergeTitleField: pullRequest.title,
        MergeMessageField: '',
        // Answered with `409 Conflict` when the branch points elsewhere
        head_commit_id: pullRequest.headSHA,
      },
    })
  );

  // Everything that stops a merge comes back as `405 Method Not Allowed`, including the pull
  // request having been merged already — by a maintainer working on the instance while this board
  // was open, say. That’s the outcome the user asked for, so it’s the branch cleanup below that’s
  // left to do rather than an error to report. Anything else the status covers, such as a failing
  // check or a conflict, is a real refusal
  if (response.status === 405 && (await isPullRequestMerged(/** @type {number} */ (number)))) {
    await deleteBranch(pullRequest.branch);

    return;
  }

  if (!response.ok) {
    const { message } = await response.json().catch(() => ({}));

    throw new Error('Failed to merge the pull request', {
      cause: { status: response.status, message },
    });
  }

  await deleteBranch(pullRequest.branch);
};

/**
 * Close the pull request without merging it, and delete the workflow branch.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoEditPullRequest
 */
export const discard = async (pullRequest) => {
  const { owner, repo } = repository;

  // An Open Authoring draft has no pull request yet, so deleting the branch is all there is to do
  if (pullRequest.number !== undefined) {
    try {
      await fetchAPI(`/repos/${owner}/${repo}/pulls/${pullRequest.number}`, {
        method: 'PATCH',
        body: { state: 'closed' },
      });
    } catch (/** @type {any} */ ex) {
      // The pull request was merged after the board was loaded, which the instance reports as a
      // precondition failure on any state change. There’s nothing left to close, and the branch is
      // still worth tidying up, so carry on
      if (ex.cause?.status !== 412) {
        throw ex;
      }
    }
  }

  await deleteBranch(pullRequest.branch);
};

/**
 * Gitea/Forgejo’s Editorial Workflow implementation.
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
