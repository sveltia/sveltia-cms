import { _ } from '@sveltia/i18n';
import { encodeBase64 } from '@sveltia/utils/file';

import { repository } from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { createCommitMessage } from '$lib/services/backends/git/shared/commits';
import { getGitHash } from '$lib/services/utils/file';

/**
 * @import { CommitOptions, CommitResults, FileChange, FileCommit } from '$lib/types/private';
 */

/**
 * @typedef {object} FetchLastCommitResponse
 * @property {object} project Project information.
 * @property {object} project.repository Repository information.
 * @property {object} project.repository.tree Tree information.
 * @property {object} project.repository.tree.lastCommit Last commit information.
 * @property {string} project.repository.tree.lastCommit.sha Commit SHA-1 hash.
 * @property {string} project.repository.tree.lastCommit.message Commit message.
 */

/**
 * @typedef {object} CommitResponse
 * @property {string} id Commit SHA-1 hash.
 * @property {string} committed_date Commit date in ISO 8601 format.
 */

const FETCH_LAST_COMMIT_QUERY = `
  query($fullPath: ID!, $branch: String!) {
    project(fullPath: $fullPath) {
      repository {
        tree(ref: $branch) {
          lastCommit {
            sha
            message
          }
        }
      }
    }
  }
`;

/**
 * Fetch the last commit on the repository.
 * @returns {Promise<{ hash: string, message: string }>} Commit’s SHA-1 hash and message.
 * @throws {Error} When the branch could not be found.
 * @see https://docs.gitlab.com/api/graphql/reference/#tree
 */
export const fetchLastCommit = async () => {
  const { repo, branch } = repository;

  const result = /** @type {FetchLastCommitResponse} */ (
    await fetchGraphQL(FETCH_LAST_COMMIT_QUERY)
  );

  if (!result.project) {
    throw new Error('Failed to retrieve the last commit hash.', {
      cause: new Error(_('repository_not_found', { values: { repo } })),
    });
  }

  const { lastCommit } = result.project.repository.tree ?? {};

  if (!lastCommit) {
    throw new Error('Failed to retrieve the last commit hash.', {
      cause: new Error(_('branch_not_found', { values: { repo, branch } })),
    });
  }

  const { sha: hash, message } = lastCommit;

  return { hash, message };
};

/**
 * Save entries or assets remotely. Note that the `commitCreate` GraphQL mutation is broken and
 * images cannot be uploaded properly, so we use the REST API instead.
 * @param {FileChange[]} changes File changes to be saved.
 * @param {CommitOptions} options Commit options.
 * @returns {Promise<CommitResults>} Commit results, including the commit SHA and updated file SHAs.
 * @see https://docs.gitlab.com/api/commits.html#create-a-commit-with-multiple-files-and-actions
 * @see https://gitlab.com/gitlab-org/gitlab/-/merge_requests/31102
 * @see https://docs.gitlab.com/api/graphql/reference/#mutationcommitcreate
 * @see https://forum.gitlab.com/t/how-to-commit-a-image-via-gitlab-commit-api/26632/4
 */
export const commitChanges = async (changes, options) => {
  const { owner, repo, branch } = repository;

  const actions = await Promise.all(
    changes.map(async ({ action, path, previousPath, data = '' }) => ({
      action,
      content: typeof data === 'string' ? data : await encodeBase64(data),
      encoding: typeof data === 'string' ? 'text' : 'base64',
      file_path: path,
      previous_path: previousPath,
    })),
  );

  const { id: sha, committed_date: committedDate } = /** @type {CommitResponse} */ (
    await fetchAPI(`/projects/${encodeURIComponent(`${owner}/${repo}`)}/repository/commits`, {
      method: 'POST',
      body: {
        branch,
        commit_message: createCommitMessage(changes, options),
        actions,
      },
    })
  );

  // Calculate the SHA-1 hash for each file because the GitLab REST API does not return file SHAs
  const entries = await Promise.all(
    changes.map(async ({ path, data }) =>
      data === undefined ? null : [path, { sha: await getGitHash(data) }],
    ),
  );

  return {
    sha,
    date: new Date(committedDate),
    files: Object.fromEntries(entries.filter((entry) => !!entry)),
  };
};

/**
 * Fetch the avatar URL for a given email address.
 * @param {string} email Email address.
 * @returns {Promise<string | undefined>} Avatar URL, or `undefined` if not available.
 * @see https://docs.gitlab.com/api/avatar/
 */
const fetchAvatarURL = async (email) => {
  try {
    const { avatar_url: avatarURL } = /** @type {{ avatar_url: string }} */ (
      await fetchAPI(`/avatar?email=${encodeURIComponent(email)}&size=48`)
    );

    return avatarURL || undefined;
  } catch {
    return undefined;
  }
};

/**
 * Fetch commit history for the given file paths.
 * @param {string[]} paths File paths to fetch commit history for.
 * @returns {Promise<FileCommit[]>} Deduplicated and sorted list of commits.
 * @see https://docs.gitlab.com/api/commits/#list-repository-commits
 */
export const fetchFileCommits = async (paths) => {
  const { owner, repo, branch } = repository;
  const projectId = encodeURIComponent(`${owner}/${repo}`);

  const results = await Promise.all(
    paths.map(
      (path) =>
        /** @type {Promise<any[]>} */ (
          fetchAPI(
            `/projects/${projectId}/repository/commits` +
              `?ref_name=${encodeURIComponent(branch ?? '')}` +
              `&path=${encodeURIComponent(path)}&per_page=100`,
          )
        ),
    ),
  );

  /** @type {Map<string, FileCommit>} */
  const commitMap = new Map();

  results.flat().forEach((commit) => {
    if (!commitMap.has(commit.id)) {
      commitMap.set(commit.id, {
        sha: commit.id,
        authorName: commit.author_name,
        authorEmail: commit.author_email,
        authorAvatarURL: undefined,
        date: new Date(commit.committed_date),
      });
    }
  });

  // Resolve avatar URLs for unique author emails via the GitLab Avatar API
  /** @type {string[]} */
  const uniqueEmails = /** @type {string[]} */ (
    [...new Set([...commitMap.values()].map((c) => c.authorEmail))].filter((e) => !!e)
  );

  /** @type {Map<string, string | undefined>} */
  const avatarMap = new Map(
    await Promise.all(
      uniqueEmails.map(
        async (email) => /** @type {const} */ ([email, await fetchAvatarURL(email)]),
      ),
    ),
  );

  const commitList = [...commitMap.values()].sort((a, b) => b.date.getTime() - a.date.getTime());

  commitList.forEach((commit) => {
    commit.authorAvatarURL = avatarMap.get(/** @type {string} */ (commit.authorEmail));
  });

  return commitList;
};
