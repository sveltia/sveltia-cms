import { encodeBase64 } from '@sveltia/utils/file';

import { clearSaveProgress, reportCommits } from '$lib/services/backends/commit-progress';
import { projectIds } from '$lib/services/backends/git/gitlab/fork';
import {
  fetchProjectBranchHead,
  getProjectId,
  repository,
} from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import {
  estimateRemainingCommits,
  getPayloadSize,
  isUploadFailure,
  sortAdditions,
  takeAdditions,
} from '$lib/services/backends/git/shared/commit-split';
import {
  assertBranchNotMoved,
  createCommitMessage,
  createLastCommitError,
  fetchPerPathCommits,
  MAX_FILE_COMMITS,
  signOffCommitMessage,
} from '$lib/services/backends/git/shared/commits';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { checkDirectCommitAllowed } from '$lib/services/backends/git/shared/fork';
import { repositoryHead } from '$lib/services/backends/git/shared/head';
import { getOrCreateAsync } from '$lib/services/utils/cache';
import { getGitHash } from '$lib/services/utils/file';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

/**
 * @import { CommitOptions, CommitResults, FileChange, FileCommit } from '$lib/types/private';
 * @import { FileAddition } from '$lib/services/backends/git/shared/commit-split';
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
 * @property {string[]} [parent_ids] SHA-1 hashes of the parent commits.
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
    throw createLastCommitError('repository_not_found', { repo });
  }

  const { lastCommit } = result.project.repository.tree ?? {};

  if (!lastCommit) {
    throw createLastCommitError('branch_not_found', { repo, branch });
  }

  const { sha: hash, message } = lastCommit;

  return { hash, message };
};

/**
 * Largest size of the encoded file contents sent in a single commit request (64 MB). The request
 * body has to stay below the limit of the instance and anything in front of it, e.g. the
 * `client_max_body_size` of 250 MB that GitLab’s bundled NGINX sets by default, or the 100 MB a
 * Cloudflare proxy takes, and both the browser and GitLab hold the whole body in memory. A larger
 * changeset is split into several commits, and an instance with a lower limit makes the commits
 * smaller still; see {@link commitChanges}.
 * @see https://github.com/sveltia/sveltia-cms/issues/1141
 */
export const MAX_COMMIT_PAYLOAD_SIZE = 64 * 1024 * 1024;

/**
 * Paths of the files a split save has created on the configured branch before failing on a later
 * commit. The retry saves them again under the same paths, which GitLab refuses to `create` once
 * they exist, so they’re deleted and created again instead. Cleared once a save has gone through.
 * @type {Set<string>}
 */
const landedPaths = new Set();

/**
 * Reset {@link landedPaths}. Used in tests.
 */
export const _resetLandedPaths = () => {
  landedPaths.clear();
};

/**
 * Check if the given file data is binary, which is sent Base64-encoded.
 * @param {FileChange['data']} data File data.
 * @returns {data is File} Result.
 */
const isBinary = (data) => data !== undefined && typeof data !== 'string';

/**
 * Save entries or assets remotely. Note that the `commitCreate` GraphQL mutation is broken and
 * images cannot be uploaded properly, so we use the REST API instead. The changes normally go into
 * a single commit, but a large changeset, typically an entry with many new images, is split into
 * several commits made one after another, with the entry files, moves and deletions in the last
 * one, like the GitHub backend does: a request over the body size limit of the instance fails with
 * 413 Content Too Large, which the browser reports as a network error, as the answer comes without
 * CORS headers. Unlike GitHub, GitLab doesn’t close a request that takes a while to upload, so the
 * commits aren’t sized to the upload speed: each takes up to {@link MAX_COMMIT_PAYLOAD_SIZE}, and a
 * commit that is too large or times out is retried with half of its files, at which size the
 * following commits stay. A changeset of a usual size therefore still makes a single commit.
 * @param {FileChange[]} changes File changes to be saved.
 * @param {CommitOptions} options Commit options.
 * @returns {Promise<CommitResults>} Commit results, including the commit SHA and updated file SHAs.
 * The commit is the last one made when the changes have been split.
 * @see https://docs.gitlab.com/api/commits.html#create-a-commit-with-multiple-files-and-actions
 * @see https://gitlab.com/gitlab-org/gitlab/-/merge_requests/31102
 * @see https://docs.gitlab.com/api/graphql/reference/#mutationcommitcreate
 * @see https://forum.gitlab.com/t/how-to-commit-a-image-via-gitlab-commit-api/26632/4
 */
export const commitChanges = async (changes, options) => {
  checkDirectCommitAllowed(options);

  // A workflow branch lives in the contributor’s fork with Open Authoring, while the configured
  // branch is only ever committed to by someone who can write to the configured project
  const fork = options.branch ? forkedRepository.current : undefined;
  const branch = /** @type {string} */ (options.branch ?? repository.branch);
  // The commit the branch is expected to point at: on the configured branch, the one the loaded
  // site data reflects, which the caller has just brought up to date; on a workflow branch, the
  // merge request’s head, which the caller has just compared the branch with. GitLab has no
  // branch-level guard like GitHub’s `expectedHeadOid`: a `start_sha` is refused on an existing
  // branch unless `force` is set, which would discard someone else’s push instead. But an action
  // can take a `last_commit_id`, and GitLab 15.10+ refuses an update, move or deletion when the
  // file’s last commit on the branch differs from its last commit as of that ID, i.e. when someone
  // else has changed the file since. So the head goes with every such action, which takes no lookup
  // per file. A workflow branch is named after the entry, not the editor, so others can push to it
  // too. The head stays the same for every commit of a split save: taking the previous commit
  // instead would let through a colleague’s change made before it, which that commit is on top of
  const expectedHead = (options.branch ? options.headOid : repositoryHead.current) || undefined;
  const lastCommit = expectedHead ? { last_commit_id: expectedHead } : {};
  // Files a failed save has left behind, which only the configured branch keeps track of, like the
  // head. A workflow branch is reset from scratch when no merge request comes out of it
  const landed = options.branch ? new Set() : landedPaths;
  /** @type {FileChange[]} */
  const writes = [];
  /** @type {string[]} */
  const deletedPaths = [];
  /** @type {FileChange[]} */
  const moves = [];

  // Moves and deletions go into the last commit along with the entries, so a file isn’t removed
  // before the entry stops referring to it
  changes.forEach((change) => {
    if (change.action === 'delete') {
      deletedPaths.push(change.path);
    } else if (change.action === 'move') {
      moves.push(change);
    } else {
      writes.push(change);
    }
  });

  /** @type {FileAddition[]} */
  const additions = await Promise.all(
    writes.map(async ({ path, data = '' }, index) => ({
      index,
      path,
      data,
      contents: isBinary(data) ? await encodeBase64(data) : data,
    })),
  );

  // A file created at a path a deletion or a move frees goes into the last commit, after them, as
  // GitLab applies the actions in order
  const { queue, addedAgain } = sortAdditions(
    additions,
    new Set([
      ...deletedPaths,
      ...moves.map(({ previousPath }) => /** @type {string} */ (previousPath)),
    ]),
  );

  // GitLab only runs a file through its Git LFS handling when it’s created: an `update`, or a
  // `move` with content, commits the bytes as a regular blob even if `.gitattributes` tracks the
  // path with LFS. A replaced binary file is therefore deleted and created again instead, which
  // makes the same tree for a file outside LFS. The deletion still carries `last_commit_id`, so a
  // file someone else has changed since is still refused. Text files, like entries, are updated as
  // is
  // @see https://github.com/sveltia/sveltia-cms/issues/1140
  /**
   * Get the commit actions that write the given file.
   * @param {FileAddition} addition File addition.
   * @returns {Record<string, any>[]} Actions.
   */
  const getWriteActions = ({ index, contents }) => {
    const { action, path, data } = writes[index];
    const encoding = isBinary(data) ? 'base64' : 'text';
    const create = { action: 'create', content: contents, encoding, file_path: path };

    // The file has been created by a commit of a save that failed afterwards, so it didn’t exist
    // as of the head yet
    if (landed.has(path)) {
      return [{ action: 'delete', file_path: path }, create];
    }

    if (action !== 'update') {
      return [create];
    }

    if (isBinary(data)) {
      return [{ action: 'delete', file_path: path, ...lastCommit }, create];
    }

    return [{ action, content: contents, encoding, file_path: path, ...lastCommit }];
  };

  // A moved binary file, i.e. an asset, keeps its content, so it’s moved without any: GitLab then
  // takes the existing blob, which is an LFS pointer for a file tracked with LFS, and the file
  // doesn’t have to be uploaded again. A text file, like an entry, can be rewritten as it’s moved.
  // `content` is left out rather than empty, which would empty the file
  const lastActions = [
    ...deletedPaths.map((path) => ({ action: 'delete', file_path: path, ...lastCommit })),
    ...moves.map(({ path, previousPath, data }) => ({
      action: 'move',
      ...(typeof data === 'string' ? { content: data, encoding: 'text' } : {}),
      file_path: path,
      previous_path: previousPath,
      ...lastCommit,
    })),
  ];

  const endpoint = `/projects/${getProjectId(fork)}/repository/commits`;
  const commitMessage = signOffCommitMessage(createCommitMessage(changes, options));
  const { startBranch } = options;
  // With Open Authoring the branch is created in the contributor’s fork, but starts from the head
  // of the configured project rather than the fork’s own copy of it, so a fork that has fallen
  // behind or gained commits of its own doesn’t pass them on to the merge request. GitLab offers no
  // way to sync a fork, which makes this the only way to keep the merge request to the entry
  // edited. The project goes by its numeric ID: a path in the request body is taken as is, so the
  // encoded one {@link getProjectId} gives for a request path would name no project at all
  const startProject = fork ? { start_project: projectIds.base } : {};
  // The commit the branch points at before each commit is made, as far as this save knows
  let previousHead = expectedHead;
  let payloadSize = MAX_COMMIT_PAYLOAD_SIZE;
  let commitCount = 0;
  /** @type {string | undefined} */
  let parentSha;
  /** @type {CommitResponse} */
  let response = /** @type {any} */ (undefined);

  // Commit the files in groups, each on top of the previous one. There is always at least one
  // commit, which can have no files to write, so a changeset with only deletions is still committed
  try {
    do {
      // The files still waiting, at the current commit size, make up the commits yet to be made
      reportCommits(commitCount, commitCount + estimateRemainingCommits(queue, payloadSize));

      const group = takeAdditions(queue, payloadSize);
      const isLast = !queue.length;
      const groupSize = getPayloadSize(group);

      const actions = [
        ...group.flatMap(getWriteActions),
        ...(isLast ? [...lastActions, ...addedAgain.flatMap(getWriteActions)] : []),
      ];

      const body = { branch, commit_message: commitMessage, actions };

      try {
        // GitLab rejects `start_branch` outright once the branch exists. That’s left to the caller
        // to sort out, because only the Editorial Workflow service can tell whether the branch is a
        // leftover to start over from or someone’s work in progress to commit onto. Only the first
        // commit of a split save creates the branch
        response = /** @type {CommitResponse} */ (
          // eslint-disable-next-line no-await-in-loop
          await fetchAPI(endpoint, {
            method: 'POST',
            body:
              startBranch && !commitCount
                ? { ...body, start_branch: startBranch, ...startProject }
                : body,
            // The commit can be sent again after a transient error: one that has already landed
            // is refused, as a created file then exists and a changed file has a newer last commit
            retryable: true,
          })
        );
      } catch (/** @type {any} */ ex) {
        // The request was too large for the instance or has taken too long. Put the files back and
        // try again with half of them, provided the branch is still where it was, so the commit
        // hasn’t landed. A branch the first commit was to create is still missing then
        if (
          group.length > 1 &&
          isUploadFailure(ex) &&
          // eslint-disable-next-line no-await-in-loop
          (await fetchProjectBranchHead(branch, fork).catch(() => null)) === previousHead
        ) {
          queue.unshift(...group);
          payloadSize = Math.floor(groupSize / 2);
          // eslint-disable-next-line no-continue
          continue;
        }

        // The commit the loaded site data, along with the commits this save has made, reflects:
        // the last of them, unless one has landed on top of someone else’s commit, which the site
        // data doesn’t reflect yet. The head is then the one the save started from
        const knownHead = parentSha === expectedHead ? previousHead : expectedHead;

        // GitLab refuses a changed file with a 400 Bad Request, like any other invalid request. A
        // workflow branch’s head is looked up by the Editorial Workflow service, which knows the
        // branch
        if (knownHead && !options.branch && ex.cause?.status === 400) {
          // eslint-disable-next-line no-await-in-loop
          await assertBranchNotMoved(knownHead, fetchLastCommit);
        }

        // Some of the assets have landed on the configured branch, but the entry hasn’t. Take the
        // last commit made as the known head, so the check before the retry doesn’t load those
        // assets, which would then be saved again under different names. The retry saves them
        // under the same paths instead, with the same content, along with the entry. A commit on
        // top of someone else’s is not taken, though: their commit would never be fetched, and the
        // retry, checking the files against a head that includes their change, would overwrite it
        if (commitCount && !options.branch) {
          repositoryHead.current = /** @type {string} */ (knownHead);
        }

        throw ex;
      }

      commitCount += 1;

      const parentId = response.parent_ids?.[0];

      // GitLab only checks the files being changed, so a commit can land on top of someone else’s
      // commit to another file; the caller tells that from the parent. Only the first commit is
      // expected to have one this save doesn’t know about
      if (commitCount === 1 || parentId !== previousHead) {
        parentSha = parentId;
      }

      previousHead = response.id;

      if (!isLast) {
        group.forEach(({ path }) => landed.add(path));
      }
    } while (queue.length);
  } finally {
    clearSaveProgress();
  }

  landed.clear();

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
    parentSha,
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
            `&path=${encodeURIComponent(path)}&per_page=${MAX_FILE_COMMITS}`,
        )
      ),
    (commit) => ({
      sha: commit.id,
      message: commit.title ?? '',
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
