import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import { createDraftPullRequest } from '$lib/services/backends/git/shared/fork';
import { cmsConfig } from '$lib/services/config';
import { openAuthoring } from '$lib/services/workflow/open-authoring';

/**
 * @import {
 * CommitOptions,
 * CommitResults,
 * FileChange,
 * RepositoryPath,
 * WorkflowChangedFile,
 * WorkflowPullRequest,
 * WorkflowSaveOptions,
 * WorkflowStatus,
 * } from '$lib/types/private';
 */

/**
 * Function to open a pull request on the service.
 * @typedef {(args: { branch: string, title: string, status: WorkflowStatus }) =>
 * Promise<WorkflowPullRequest>} CreatePullRequest
 */

/**
 * Whether the `squash_merges` backend option is enabled, so a pull request of Editorial Workflow is
 * squash-merged when the entry is published.
 * @returns {boolean} Result.
 */
export const isSquashMergeEnabled = () => {
  const { backend } = cmsConfig.current ?? {};

  return backend && 'squash_merges' in backend ? !!backend.squash_merges : false;
};

/**
 * Delete a branch with the given REST API request. A branch that’s already gone, for example when
 * its pull request was merged, is fine, and any other failure is only reported in the console.
 * @param {object} args Arguments.
 * @param {string} args.branch Branch name.
 * @param {string} args.path REST API path to send the `DELETE` request to.
 * @param {number[]} args.goneStatuses HTTP status codes meaning the branch is already gone.
 */
export const deleteRemoteBranch = async ({ branch, path, goneStatuses }) => {
  try {
    await fetchAPI(path, { method: 'DELETE', responseType: 'text' });
  } catch (/** @type {any} */ ex) {
    // The branch is already gone, which is what was wanted
    if (goneStatuses.includes(ex.cause?.status)) {
      return;
    }

    // Leaving the branch behind is harmless, but it makes the next pull request for the same entry
    // start from an existing branch, so make the failure visible rather than swallowing it
    // eslint-disable-next-line no-console
    console.warn(`Failed to delete the ${branch} branch.`, ex);
  }
};

/**
 * Open the pull request for a workflow branch the first save has just created. With Open Authoring
 * a draft is a branch without a pull request, so none is opened for it yet; a removal has no review
 * stages to move through, though, so its pull request is opened right away like it is in the
 * regular flow.
 * @param {object} args Arguments.
 * @param {CommitResults} args.commit Results of the commit that created the branch.
 * @param {string} args.branch Workflow branch name.
 * @param {string} args.title Pull request title.
 * @param {WorkflowStatus} args.status Status to open the pull request with.
 * @param {CreatePullRequest} args.createPullRequest Function to open a pull request on the service.
 * @returns {Promise<WorkflowPullRequest>} New pull request.
 */
export const openWorkflowPullRequest = async ({
  commit,
  branch,
  title,
  status,
  createPullRequest,
}) => {
  if (openAuthoring.current && status === 'draft') {
    return createDraftPullRequest({ commit, branch, title });
  }

  return createPullRequest({ branch, title, status });
};

/**
 * Commit the given changes on the workflow branch, creating the branch and the pull request if they
 * don’t exist yet. This is the flow of a service whose commit itself creates the workflow branch on
 * the first save, so it doesn’t need a request of its own.
 * @param {WorkflowSaveOptions} args Arguments.
 * @param {object} service Service-specific functions.
 * @param {(changes: FileChange[], options: CommitOptions) => Promise<CommitResults>}
 * service.commitToNewBranch Function to commit on a workflow branch no pull request is known for.
 * @param {(changes: FileChange[], options: CommitOptions, pullRequest: WorkflowPullRequest) =>
 * Promise<CommitResults>} service.commitToExistingBranch Function to commit onto the branch of an
 * existing pull request.
 * @param {CreatePullRequest} service.createPullRequest Function to open a pull request on the
 * service.
 * @returns {Promise<{ commit: CommitResults, pullRequest: WorkflowPullRequest }>} Commit results
 * and the new or updated pull request.
 */
export const saveWorkflowBranch = async (
  { changes, options, branch, title, status, pullRequest },
  { commitToNewBranch, commitToExistingBranch, createPullRequest },
) => {
  if (pullRequest) {
    return {
      commit: await commitToExistingBranch(changes, { ...options, branch }, pullRequest),
      pullRequest,
    };
  }

  const commit = await commitToNewBranch(changes, { ...options, branch });

  return {
    commit,
    pullRequest: await openWorkflowPullRequest({
      commit,
      branch,
      title,
      status,
      createPullRequest,
    }),
  };
};

/**
 * Commit the given changes on a workflow branch that no pull request is known for. The branch is
 * usually created along with the commit, but it can already exist: it’s left over from an earlier
 * pull request for the same entry, which the CMS knows nothing about — one merged without deleting
 * the branch, or one that was closed on the service rather than discarded here, which leaves the
 * branch behind. Starting the new pull request from the branch as it stands would carry that
 * earlier work into it — a merged one adds nothing, but a closed one brings back what was thrown
 * away — so the branch is deleted and created afresh from the configured branch. With Open
 * Authoring a draft is a branch without a pull request, so there’s no telling a leftover from a
 * live one; the branch is kept, and it shows up as a draft the next time the fork is listed. The
 * fork is the contributor’s own, so nobody else’s work can be on it.
 * @param {object} args Arguments.
 * @param {string} args.branch Workflow branch name.
 * @param {number} args.branchExistsStatus HTTP status code the service refuses a commit creating
 * the branch with once the branch exists.
 * @param {() => Promise<CommitResults>} args.commitFromStart Function to commit the changes on a
 * branch created from the configured one.
 * @param {() => Promise<CommitResults>} args.commitOnBranch Function to commit the changes onto the
 * existing branch.
 * @param {() => Promise<string | undefined>} args.findOpenPullRequest Function to look up a pull
 * request open from the branch, returning its reference, e.g. `#1`, or `undefined` if there’s none.
 * @param {string} args.inUseMessage English message of the error thrown when one is open.
 * @param {(branch: string) => Promise<void>} args.deleteBranch Function to delete the branch.
 * @returns {Promise<CommitResults>} Commit results.
 * @throws {Error} When the branch exists and a pull request is open from it.
 */
export const commitToNewWorkflowBranch = async ({
  branch,
  branchExistsStatus,
  commitFromStart,
  commitOnBranch,
  findOpenPullRequest,
  inUseMessage,
  deleteBranch,
}) => {
  try {
    return await commitFromStart();
  } catch (/** @type {any} */ ex) {
    // The service rejects creating the branch outright once it exists. Anything else is a real
    // failure
    if (ex.cause?.status !== branchExistsStatus) {
      throw ex;
    }
  }

  if (openAuthoring.current) {
    return commitOnBranch();
  }

  // A pull request open from the branch is one the board doesn’t show: it has lost its status
  // label, it sits beyond the number of pull requests fetched, it goes to another branch, or it was
  // never the CMS’s. Committing onto it would take whatever else it holds along with the entry,
  // unseen, and deleting the branch would close it, so the save is refused instead
  const number = await findOpenPullRequest();

  if (number) {
    throw createLocalizedError(inUseMessage, 'workflow.branch_in_use', { number });
  }

  await deleteBranch(branch);

  return commitFromStart();
};

/**
 * Make sure the workflow branch of an existing pull request still points at the commit the entry
 * was loaded or saved at, which the conflict check has just compared it with, before committing
 * onto it. Without a head on record there’s nothing to compare, which is refused just the same.
 * @param {object} args Arguments.
 * @param {string} args.branch Workflow branch name.
 * @param {string | undefined} args.headSHA Head commit on record.
 * @param {(branch: string) => Promise<string | undefined>} args.fetchBranchHead Function to fetch
 * the commit the branch points at, or `undefined` if the branch is gone.
 * @param {() => RepositoryPath} args.getWorkflowRepository Function to get the repository the
 * branch lives in.
 * @returns {Promise<string>} Head commit on record.
 * @throws {Error} When the branch is gone, or points at another commit than the one on record.
 */
export const assertBranchAtHead = async ({
  branch,
  headSHA,
  fetchBranchHead,
  getWorkflowRepository,
}) => {
  const head = await fetchBranchHead(branch);

  // The branch can have gone, e.g. with a pull request merged or closed on the service, which is
  // worth saying in words rather than with the service’s message about a branch it can’t find
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

  return headSHA;
};

/**
 * Get the folders holding the given files, each listed once. A file at the repository root is held
 * by the root, given as an empty string.
 * @param {string[]} paths File paths.
 * @returns {string[]} Folder paths.
 */
export const getParentDirs = (paths) => [
  ...new Set(paths.map((path) => path.slice(0, Math.max(path.lastIndexOf('/'), 0)))),
];

/**
 * Convert the changed files a pull request’s REST API reports to {@link WorkflowChangedFile} ones,
 * along with their Git file modes, which the list leaves out. A removed file has no mode to read.
 * @param {Record<string, any>[]} files Files returned by the REST API.
 * @param {object} args Arguments.
 * @param {Record<string, WorkflowChangedFile['status']>} args.statusMap Map of the file statuses
 * the REST API reports to {@link WorkflowChangedFile} ones. Any other status modifies the file.
 * @param {string} args.headSHA Git object ID of the commit the files are read at.
 * @param {(args: { headSHA: string, paths: string[] }) => Promise<Map<string, string>>}
 * args.fetchFileModes Function to fetch the modes of the given files at the given commit.
 * @returns {Promise<WorkflowChangedFile[]>} Changed files.
 */
export const toChangedFilesWithModes = async (files, { statusMap, headSHA, fetchFileModes }) => {
  const changedFiles = files.map(({ filename, status, previous_filename: previousPath }) => ({
    path: /** @type {string} */ (filename),
    status: statusMap[status] ?? 'modified',
    previousPath: /** @type {string | undefined} */ (previousPath || undefined),
  }));

  const modes = await fetchFileModes({
    headSHA,
    paths: changedFiles.filter(({ status }) => status !== 'removed').map(({ path }) => path),
  });

  return changedFiles.map((file) => ({ ...file, mode: modes.get(file.path) }));
};
