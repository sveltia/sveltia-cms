import { _ } from '@sveltia/i18n';
import { encodeBase64 } from '@sveltia/utils/file';
import { get } from 'svelte/store';

import { repository } from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { createCommitMessage } from '$lib/services/backends/git/shared/commits';
import { user } from '$lib/services/user';

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
      cause: new Error(_('branch_not_found', { values: { repo, branch } })),
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

  const results = await Promise.all(
    paths.map(
      (path) =>
        /** @type {Promise<any[]>} */ (
          fetchAPI(
            `/repos/${owner}/${repo}/commits` +
              `?sha=${encodeURIComponent(branch ?? '')}` +
              `&path=${encodeURIComponent(path)}&limit=100`,
          )
        ),
    ),
  );

  /** @type {Map<string, FileCommit>} */
  const commitMap = new Map();

  results.flat().forEach((commit) => {
    if (!commitMap.has(commit.sha)) {
      commitMap.set(commit.sha, {
        sha: commit.sha,
        authorName: commit.commit?.author?.name ?? '',
        authorEmail: commit.commit?.author?.email,
        authorAvatarURL: commit.author?.avatar_url,
        authorLogin: commit.author?.login,
        date: new Date(commit.commit?.author?.date ?? commit.created),
      });
    }
  });

  return [...commitMap.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
};
