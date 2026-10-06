import { encodeBase64 } from '@sveltia/utils/file';

import { projectIds } from '$lib/services/backends/git/gitlab/fork';
import { getProjectId, repository } from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import {
  assertBranchNotMoved,
  createCommitMessage,
  fetchPerPathCommits,
} from '$lib/services/backends/git/shared/commits';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import { repositoryHead } from '$lib/services/backends/git/shared/fetch';
import { getOrCreateAsync } from '$lib/services/utils/cache';
import { getGitHash } from '$lib/services/utils/file';
import { forkedRepository, openAuthoring } from '$lib/services/workflow/open-authoring';

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
    throw createLocalizedError('Failed to retrieve the last commit hash.', 'repository_not_found', {
      repo,
    });
  }

  const { lastCommit } = result.project.repository.tree ?? {};

  if (!lastCommit) {
    throw createLocalizedError('Failed to retrieve the last commit hash.', 'branch_not_found', {
      repo,
      branch,
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
  // An Open Authoring contributor can’t write to the configured project at all, so a change that
  // doesn’t go through Editorial Workflow has nowhere to land. Fail here with an explanation rather
  // than letting the API reject the commit with a bare permission error
  if (openAuthoring.current && !options.branch) {
    throw createLocalizedError(
      'Cannot commit directly to the configured repository',
      'open_authoring.direct_commit_unsupported',
    );
  }

  // A workflow branch lives in the contributor’s fork with Open Authoring, while the configured
  // branch is only ever committed to by someone who can write to the configured project
  const fork = options.branch ? forkedRepository.current : undefined;
  const branch = options.branch ?? repository.branch;
  // On the configured branch, the commit the loaded site data reflects, which the caller has just
  // brought up to date. GitLab has no branch-level guard like GitHub’s `expectedHeadOid`: a
  // `start_sha` is refused on an existing branch unless `force` is set, which would discard someone
  // else’s push instead. But an action can take a `last_commit_id`, and GitLab 15.10+ refuses an
  // update, move or deletion when the file’s last commit on the branch differs from its last commit
  // as of that ID, i.e. when someone else has changed the file since. So the head goes with every
  // such action, which takes no lookup per file. A workflow branch is only ever written by its own
  // author, and its files differ from those on the configured branch, so it’s left alone
  const expectedHead = options.branch ? undefined : repositoryHead.current || undefined;

  const actions = await Promise.all(
    changes.map(async ({ action, path, previousPath, data = '' }) => ({
      action,
      content: typeof data === 'string' ? data : await encodeBase64(data),
      encoding: typeof data === 'string' ? 'text' : 'base64',
      file_path: path,
      previous_path: previousPath,
      ...(expectedHead && action !== 'create' ? { last_commit_id: expectedHead } : {}),
    })),
  );

  const endpoint = `/projects/${getProjectId(fork)}/repository/commits`;
  const body = { branch, commit_message: createCommitMessage(changes, options), actions };
  const { startBranch } = options;
  // With Open Authoring the branch is created in the contributor’s fork, but starts from the head
  // of the configured project rather than the fork’s own copy of it, so a fork that has fallen
  // behind or gained commits of its own doesn’t pass them on to the merge request. GitLab offers no
  // way to sync a fork, which makes this the only way to keep the merge request to the entry
  // edited. The project goes by its numeric ID: a path in the request body is taken as is, so the
  // encoded one {@link getProjectId} gives for a request path would name no project at all
  const startProject = fork ? { start_project: projectIds.base } : {};
  /** @type {CommitResponse} */
  let response;

  try {
    // GitLab rejects `start_branch` outright once the branch exists. That’s left to the caller to
    // sort out, because only the Editorial Workflow service can tell whether the branch is a
    // leftover to start over from or someone’s work in progress to commit onto
    response = /** @type {CommitResponse} */ (
      await fetchAPI(endpoint, {
        method: 'POST',
        body: startBranch ? { ...body, start_branch: startBranch, ...startProject } : body,
      })
    );
  } catch (/** @type {any} */ ex) {
    // GitLab refuses a changed file with a 400 Bad Request, like any other invalid request
    if (expectedHead && ex.cause?.status === 400) {
      await assertBranchNotMoved(expectedHead, fetchLastCommit);
    }

    throw ex;
  }

  const { id: sha, committed_date: committedDate } = response;

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
 * Avatar URLs looked up so far, keyed by email address. The commit history is fetched every time
 * the history of an entry is shown, and mostly lists the same few authors, so each of them is only
 * looked up once.
 * @type {Map<string, Promise<string | undefined>>}
 */
const avatarURLCache = new Map();

/**
 * Reset {@link avatarURLCache}. Used in tests.
 */
export const _resetAvatarURLCache = () => {
  avatarURLCache.clear();
};

/**
 * Fetch the avatar URL for a given email address.
 * @param {string} email Email address.
 * @returns {Promise<string | undefined>} Avatar URL, or `undefined` if not available.
 * @see https://docs.gitlab.com/api/avatar/
 */
const fetchAvatarURL = async (email) => {
  try {
    // A failure isn’t remembered, so the avatar can show up next time
    return await getOrCreateAsync(avatarURLCache, email, async () => {
      const { avatar_url: avatarURL } = /** @type {{ avatar_url: string }} */ (
        await fetchAPI(`/avatar?email=${encodeURIComponent(email)}&size=48`)
      );

      return avatarURL || undefined;
    });
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
  const { branch } = repository;
  const projectId = getProjectId();

  /** @type {FileCommit[]} */
  const commitList = await fetchPerPathCommits(
    paths,
    (path) =>
      /** @type {Promise<any[]>} */ (
        fetchAPI(
          `/projects/${projectId}/repository/commits` +
            `?ref_name=${encodeURIComponent(branch ?? '')}` +
            `&path=${encodeURIComponent(path)}&per_page=100`,
        )
      ),
    (commit) => ({
      sha: commit.id,
      authorName: commit.author_name,
      authorEmail: commit.author_email,
      authorAvatarURL: undefined,
      date: new Date(commit.committed_date),
    }),
  );

  // Resolve avatar URLs for unique author emails via the GitLab Avatar API
  /** @type {string[]} */
  const uniqueEmails = /** @type {string[]} */ (
    [...new Set(commitList.map((c) => c.authorEmail))].filter((e) => !!e)
  );

  /** @type {Map<string, string | undefined>} */
  const avatarMap = new Map();

  await runConcurrently(uniqueEmails, async (email) => {
    avatarMap.set(email, await fetchAvatarURL(email));
  });

  commitList.forEach((commit) => {
    commit.authorAvatarURL = avatarMap.get(/** @type {string} */ (commit.authorEmail));
  });

  return commitList;
};
