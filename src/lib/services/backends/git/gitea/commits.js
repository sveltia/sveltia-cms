import { encodeBase64 } from '@sveltia/utils/file';

import { getWorkflowRepository } from '$lib/services/backends/git/gitea/fork';
import { fetchBranch, repository } from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import {
  assertBranchNotMoved,
  createCommitMessage,
  fetchPerPathCommits,
} from '$lib/services/backends/git/shared/commits';
import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import { repositoryHead } from '$lib/services/backends/git/shared/fetch';
import { encodePath } from '$lib/services/backends/git/shared/url';
import { user } from '$lib/services/user/account.svelte';
import { openAuthoring } from '$lib/services/workflow/open-authoring';

/**
 * @import { CommitOptions, CommitResults, FileChange, FileCommit, User } from '$lib/types/private';
 */

/**
 * @typedef {object} CommitResponse
 * @property {object} commit Commit information, including the commit SHA and creation date.
 * @property {string} commit.sha Commit SHA.
 * @property {string} commit.created Commit creation date in ISO format.
 * @property {({ path: string, sha: string } | null)[]} files List of saved files, each with its
 * path and SHA. It can be `null` if the file was deleted.
 */

/**
 * Fetch the last commit on the repository.
 * @returns {Promise<{ hash: string, message: string }>} Commit’s SHA-1 hash and message.
 * @throws {Error} When the branch could not be found, or the request failed.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetSingleCommit
 */
export const fetchLastCommit = async () => {
  const { repo, branch } = repository;

  try {
    const {
      commit: { id: hash, message },
    } = /** @type {{ commit: { id: string, message: string }}} */ (await fetchBranch());

    return { hash, message };
  } catch (/** @type {any} */ ex) {
    // Only a 404 means the branch is missing. Anything else, like an expired token or an outage,
    // would be misreported as a missing branch, so pass it on as is
    if (ex.cause?.status !== 404) {
      throw ex;
    }

    throw createLocalizedError('Failed to retrieve the last commit hash.', 'branch_not_found', {
      repo,
      branch,
    });
  }
};

/**
 * Get the blob SHA of a file being updated, moved or deleted, as the user knows it. It normally
 * comes with the change, taken from the file cache or the asset list, but it can be missing, e.g.
 * while the cache is still being written after the site data is shown, or once it’s been cleared.
 * Gitea accepts a change without one whatever the file is now, overwriting someone else’s change,
 * so the SHA is then looked up as of the commit the site data reflects rather than the branch head,
 * which keeps the guard working.
 * @param {FileChange} change File change.
 * @param {string} [workflowBranch] Workflow branch the commit lands on, if it isn’t the configured
 * branch.
 * @returns {Promise<string | undefined>} Blob SHA, or `undefined` for a new file.
 * @throws {Error} When the site data hasn’t been loaded, or the lookup failed.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetContents
 */
const getKnownSha = async ({ action, path, previousPath, previousSha }, workflowBranch) => {
  if (action === 'create' || previousSha) {
    return previousSha;
  }

  // A workflow branch has moved on from the configured one, so the file is looked up on the branch
  // the commit lands on, in the repository it lives in. The Editorial Workflow service resolves
  // these ahead of the commit, so this is a fallback rather than the usual path
  const { owner, repo } = workflowBranch ? getWorkflowRepository() : repository;
  const ref = workflowBranch ?? repositoryHead.current;
  const knownPath = (action === 'move' && previousPath) || path;

  if (!ref) {
    throw new Error(`The last known version of ${knownPath} could not be determined.`);
  }

  const { sha } = /** @type {{ sha: string }} */ (
    await fetchAPI(
      `/repos/${owner}/${repo}/contents/${encodePath(knownPath)}?ref=${encodeURIComponent(ref)}`,
    )
  );

  return sha;
};

/**
 * Save entries or assets remotely.
 * @param {FileChange[]} changes File changes to be saved.
 * @param {CommitOptions} options Commit options.
 * @returns {Promise<CommitResults>} Commit results, including the commit SHA and updated file SHAs.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoChangeFiles
 */
export const commitChanges = async (changes, options) => {
  // An Open Authoring contributor can’t write to the configured repository at all, so a change that
  // doesn’t go through Editorial Workflow has nowhere to land. Fail here with an explanation rather
  // than letting the API reject the commit with a bare permission error
  if (openAuthoring.current && !options.branch) {
    throw createLocalizedError(
      'Cannot commit directly to the configured repository',
      'open_authoring.direct_commit_unsupported',
    );
  }

  // A workflow branch lives in the contributor’s fork with Open Authoring, while the configured
  // branch is only ever committed to by someone who can write to the configured repository
  const { owner, repo } = options.branch ? getWorkflowRepository() : repository;
  // An Editorial Workflow change lands on a workflow branch rather than the configured one
  const { branch = repository.branch, startBranch } = options;
  const commitMessage = createCommitMessage(changes, options);
  const { name, email } = /** @type {User} */ (user.account);
  const date = new Date().toJSON();

  // The API has no branch-level guard like GitHub’s `expectedHeadOid`, but an update, a move or a
  // deletion carries the blob SHA of the file as the user knows it, taken from the cached file list
  // rather than looked up now, so the commit is refused if someone else has changed the file since.
  // Gitea doesn’t insist on one, so it’s never left out
  const files = await Promise.all(
    changes.map(async (change) => {
      const { action, path, previousPath, data = '' } = change;

      const [content, sha] = await Promise.all([
        encodeBase64(data),
        getKnownSha(change, options.branch),
      ]);

      return {
        operation: action === 'move' ? 'update' : action,
        path,
        content,
        from_path: previousPath,
        sha,
      };
    }),
  );

  // The guard is about the configured branch. A workflow branch is guarded by the Editorial
  // Workflow service instead, which checks it for someone else’s commit before the save and reads
  // the blob SHAs at the commit the entry was loaded or saved at
  const expectedHead = options.branch ? undefined : repositoryHead.current;
  /** @type {CommitResponse} */
  let response;

  try {
    response = /** @type {CommitResponse} */ (
      await fetchAPI(`/repos/${owner}/${repo}/contents`, {
        method: 'POST',
        body: {
          // `new_branch` creates the target branch from `branch` as part of the commit.
          // Gitea/Forgejo rejects it outright once the branch exists. That’s left to the caller to
          // sort out, because only the Editorial Workflow service can tell whether the branch is a
          // leftover to start over from or someone’s work in progress to commit onto
          ...(startBranch ? { branch: startBranch, new_branch: branch } : { branch }),
          author: { name, email },
          committer: { name, email },
          dates: { author: date, committer: date },
          message: commitMessage,
          files,
        },
      })
    );
  } catch (/** @type {any} */ ex) {
    // A changed file is refused with a 409 Conflict on Forgejo and a 422 Unprocessable Entity on
    // Gitea, and a file someone else has created at the same path with a 422 on both
    if (expectedHead && [409, 422].includes(ex.cause?.status)) {
      await assertBranchNotMoved(expectedHead, fetchLastCommit);
    }

    throw ex;
  }

  const { commit, files: savedFiles } = response;

  return {
    sha: commit.sha,
    date: new Date(commit.created),
    files: Object.fromEntries(
      savedFiles.map((file, index) => [
        file?.path ?? changes[index].path,
        { sha: file?.sha ?? '' },
      ]),
    ),
  };
};

/**
 * Fetch commit history for the given file paths.
 * @param {string[]} paths File paths to fetch commit history for.
 * @returns {Promise<FileCommit[]>} Deduplicated and sorted list of commits.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetAllCommits
 */
export const fetchFileCommits = async (paths) => {
  const { owner, repo, branch } = repository;

  return fetchPerPathCommits(
    paths,
    (path) =>
      /** @type {Promise<any[]>} */ (
        fetchAPI(
          `/repos/${owner}/${repo}/commits` +
            `?sha=${encodeURIComponent(branch ?? '')}` +
            `&path=${encodeURIComponent(path)}&limit=100`,
        )
      ),
    (commit) => ({
      sha: commit.sha,
      authorName: commit.commit?.author?.name ?? '',
      authorEmail: commit.commit?.author?.email,
      authorAvatarURL: commit.author?.avatar_url,
      authorLogin: commit.author?.login,
      date: new Date(commit.commit?.author?.date ?? commit.created),
    }),
  );
};
