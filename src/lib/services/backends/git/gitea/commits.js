import { encodeBase64 } from '@sveltia/utils/file';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { repository } from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { createCommitMessage } from '$lib/services/backends/git/shared/commits';
import { user } from '$lib/services/user';

/**
 * @import { CommitOptions, CommitResults, FileChange, User } from '$lib/types/private';
 */

/**
 * @typedef {object} CommitResponse
 * @property {object} commit Commit information, including the commit SHA and creation date.
 * @property {string} commit.sha Commit SHA.
 * @property {string} commit.created Commit creation date in ISO format.
 * @property {{ path: string, sha: string }[]} files List of saved files, each with its path and
 * SHA.
 */

/**
 * Fetch the last commit on the repository.
 * @returns {Promise<{ hash: string, message: string }>} Commit’s SHA-1 hash and message.
 * @throws {Error} When the branch could not be found.
 * @see https://docs.gitea.com/api/next/#tag/repository/operation/repoGetSingleCommit
 */
export const fetchLastCommit = async () => {
  const { owner, repo, branch } = repository;

  try {
    const {
      commit: { id: hash, message },
    } = /** @type {{ commit: { id: string, message: string }}} */ (
      await fetchAPI(`/repos/${owner}/${repo}/branches/${branch}`)
    );

    return { hash, message };
  } catch {
    throw new Error('Failed to retrieve the last commit hash.', {
      cause: new Error(get(_)('branch_not_found', { values: { repo, branch } })),
    });
  }
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
  const { name, email } = /** @type {User} */ (get(user));
  const date = new Date().toJSON();

  const files = await Promise.all(
    changes.map(async ({ action, path, previousPath, previousSha, data = '' }) => ({
      operation: action === 'move' ? 'update' : action,
      path,
      content: await encodeBase64(data),
      from_path: previousPath,
      sha: previousSha,
    })),
  );

  const { commit, files: savedFiles } = /** @type {CommitResponse} */ (
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

  return {
    sha: commit.sha,
    date: new Date(commit.created),
    files: Object.fromEntries(savedFiles.map(({ path, sha }) => [path, { sha }])),
  };
};
