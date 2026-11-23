import { createLRUMap } from '$lib/services/utils/cache';

/**
 * @import { RepositoryInfo } from '$lib/types/private';
 * @import { LRUMap } from '$lib/services/utils/cache';
 */

/**
 * Function to find the tree SHA of a directory at the given commit or branch.
 * @typedef {(ref: string, dirPath: string) => Promise<string | undefined>} DirSHALookup
 */

/**
 * Maximum number of directory lookups kept by each backend. The check for remote changes looks up
 * the old and new heads at the same time, so more than one is kept.
 */
const MAX_DIR_LOOKUPS = 4;
/**
 * Pattern of a full commit SHA, either SHA-1 or SHA-256.
 */
const COMMIT_SHA_REGEX = /^[\da-f]{40,64}$/;

/**
 * Wrap a function that looks the tree SHA of a directory up, so that a lookup at a commit is made
 * only once. A backend that can’t resolve a `ref:path` expression in a single request has to list
 * the directory holding the one looked up, and the check for remote changes and the file list that
 * follows it look the same directory up at the same commit. The tree of a directory at a commit
 * never changes, so the result can be reused, but a branch name moves, so it’s always looked up.
 * @param {RepositoryInfo} repository Repository info, whose owner and name are part of the cache
 * key, so a switch to another repository doesn’t reuse the lookups.
 * @param {DirSHALookup} lookUp Function to look a directory up without the cache.
 * @returns {{ fetchDirSHA: DirSHALookup, resetDirLookups: () => void }} The cached lookup, and a
 * function to forget the lookups, used in tests.
 */
export const createCachedDirSHALookup = (repository, lookUp) => {
  /** @type {LRUMap<string, string | undefined>} */
  const lookups = createLRUMap(MAX_DIR_LOOKUPS);

  return {
    /**
     * Find the tree SHA of a directory, reusing a lookup made at the same commit.
     * @param {string} ref Commit SHA or branch name.
     * @param {string} dirPath Directory path relative to the repository root.
     * @returns {Promise<string | undefined>} Tree SHA, or `undefined` if the directory doesn’t
     * exist.
     */
    fetchDirSHA: async (ref, dirPath) => {
      const key = `${repository.owner}/${repository.repo}:${ref}:${dirPath}`;

      if (lookups.has(key)) {
        return lookups.get(key);
      }

      const sha = await lookUp(ref, dirPath);

      if (COMMIT_SHA_REGEX.test(ref)) {
        lookups.set(key, sha);
      }

      return sha;
    },
    /**
     * Forget the lookups.
     */
    resetDirLookups: () => {
      lookups.clear();
    },
  };
};
