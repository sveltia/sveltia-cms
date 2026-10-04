import { encodeBase64 } from '@sveltia/utils/file';

import { fetchBranch, repository } from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import {
  createCommitMessage,
  fetchPerPathCommits,
} from '$lib/services/backends/git/shared/commits';
import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import { repositoryHead } from '$lib/services/backends/git/shared/fetch';
import { encodePath } from '$lib/services/backends/git/shared/url';
import { user } from '$lib/services/user/account.svelte';

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
 * @returns {Promise<string | undefined>} Blob SHA, or `undefined` for a new file.
 * @throws {Error} When the site data hasn’t been loaded, or the lookup failed.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetContents
 */
const getKnownSha = async ({ action, path, previousPath, previousSha }) => {
  if (action === 'create' || previousSha) {
    return previousSha;
  }

  const { owner, repo } = repository;
  const ref = repositoryHead.current;
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
  const { owner, repo, branch } = repository;
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
      const [content, sha] = await Promise.all([encodeBase64(data), getKnownSha(change)]);

      return {
        operation: action === 'move' ? 'update' : action,
        path,
        content,
        from_path: previousPath,
        sha,
      };
    }),
  );

  const expectedHead = repositoryHead.current;
  /** @type {CommitResponse} */
  let response;

  try {
    response = /** @type {CommitResponse} */ (
      await fetchAPI(`/repos/${owner}/${repo}/contents`, {
        method: 'POST',
        body: {
          branch,
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
    // Gitea, and a file someone else has created at the same path with a 422 on both. Tell it from
    // any other failure, as the GitHub backend does, so the user is told what happened and to try
    // again, which picks up the other change first. The head is looked up rather than the wording
    // relied upon. A failed lookup leaves the original error to be reported
    if (expectedHead && [409, 422].includes(ex.cause?.status)) {
      const head = await fetchLastCommit().catch(() => undefined);

      if (head && head.hash !== expectedHead) {
        throw createLocalizedError(
          'The branch has moved since the site data was loaded.',
          'save_conflict.branch_moved',
        );
      }
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
