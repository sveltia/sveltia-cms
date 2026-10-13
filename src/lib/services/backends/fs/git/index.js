import { findLfsTrackedPath } from '$lib/services/backends/fs/git/attributes';
import { commitSavedChanges, getAddedPaths } from '$lib/services/backends/fs/git/commit';
import { INDEX_LOCK_PATH } from '$lib/services/backends/fs/git/constants';
import { inspectRepository } from '$lib/services/backends/fs/git/repository';
import { toRepoChanges } from '$lib/services/backends/root-dir';
import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import {
 * CommitOptions,
 * CommitResults,
 * FileChange,
 * GitFileSystem,
 * LocalGitInspection,
 * LocalGitNotice,
 * LocalGitStatus,
 * } from '$lib/types/private';
 */

export { clearLocalGitCache } from '$lib/services/backends/fs/git/repository';

/**
 * Notice for the user when their changes have been saved but not committed. A new object is
 * assigned every time, so the same notice is shown again for the next save.
 * @type {{ current: LocalGitNotice | undefined }}
 */
export const localGitNotice = createRawState();

/**
 * Promise of the last operation in the queue. The operations run one at a time, so a commit doesn’t
 * find the changes another one has just staged.
 * @type {Promise<unknown>}
 */
let queue = Promise.resolve();

/**
 * Add an operation to the queue.
 * @template T
 * @param {() => Promise<T>} operation Operation.
 * @returns {Promise<T>} Result of the operation.
 */
const enqueue = (operation) => {
  const result = queue.then(operation);

  queue = result.catch(() => undefined);

  return result;
};

/**
 * Get the message of an error.
 * @param {unknown} ex Error.
 * @returns {string} Message.
 */
const describeError = (ex) => {
  // isomorphic-git wraps an internal error in a request to report it, keeping the cause in `data`
  const { message, data } = Object(ex);

  return data?.message ?? message ?? String(ex);
};

/**
 * Check whether the CMS can commit to a repository on the user’s computer right now. The check
 * waits for a save in progress, so the lock the CMS holds while committing isn’t taken for another
 * Git process’s.
 * @param {FileSystemDirectoryHandle} repoRootDirHandle Handle of the repository’s root directory.
 * @returns {Promise<LocalGitStatus>} Status.
 */
export const getLocalGitStatus = (repoRootDirHandle) =>
  enqueue(async () => {
    try {
      const { repository: _repository, ...status } = await inspectRepository(repoRootDirHandle);

      return status;
    } catch (ex) {
      return { ready: false, reason: 'error', detail: describeError(ex) };
    }
  });

/**
 * Save changes to the working tree of a repository on the user’s computer, and commit them to the
 * current branch, as a Git backend would to the remote repository. The changes are committed only
 * if the repository allows, so the user’s own work in progress isn’t mixed in; otherwise they’re
 * only saved, and the user is told why. A failure to commit doesn’t fail the save either. The index
 * is locked from the inspection to the commit, so Git can’t change it in between.
 * @param {object} args Arguments.
 * @param {FileSystemDirectoryHandle} args.repoRootDirHandle Handle of the repository’s root
 * directory.
 * @param {FileChange[]} args.changes Changes, with paths relative to the configured root
 * directory.
 * @param {CommitOptions} args.options Commit options.
 * @param {() => Promise<CommitResults>} args.save Function to save the changes to the files.
 * @returns {Promise<CommitResults>} Results of the save, with the ID and date of the commit if one
 * was made.
 * @throws {Error} If the changes couldn’t be saved.
 */
export const saveAndCommitChanges = ({ repoRootDirHandle, changes, options, save }) =>
  enqueue(async () => {
    const repoChanges = toRepoChanges(changes);
    /**
     * File system the index has been locked with, if the inspection got that far. Only this lock
     * is removed, never one another Git process holds.
     * @type {GitFileSystem | undefined}
     */
    let lockedFs;

    try {
      /** @type {LocalGitInspection} */
      let inspection;

      try {
        inspection = await inspectRepository(repoRootDirHandle, {
          /**
           * Remember the file system the index has been locked with.
           * @param {GitFileSystem} fs File system.
           */
          onLock: (fs) => {
            lockedFs = fs;
          },
        });

        if (inspection.repository) {
          const lfsPath = await findLfsTrackedPath(
            inspection.repository.fs,
            getAddedPaths(repoChanges),
          );

          if (lfsPath) {
            inspection = { ready: false, reason: 'lfs', detail: lfsPath };
          }
        }
      } catch (ex) {
        inspection = { ready: false, reason: 'error', detail: describeError(ex) };
      }

      const { repository, reason = 'error', detail } = inspection;
      const results = await save();

      if (!repository) {
        localGitNotice.current = { reason, detail };

        return results;
      }

      try {
        const commit = await commitSavedChanges(repository, repoChanges, options);

        return commit ? { ...results, sha: commit.oid, date: commit.date } : results;
      } catch (ex) {
        // eslint-disable-next-line no-console
        console.error(ex);
        localGitNotice.current = { reason: 'error', detail: describeError(ex) };

        return results;
      }
    } finally {
      try {
        await lockedFs?.unlink(INDEX_LOCK_PATH);
      } catch {
        //
      }
    }
  });
