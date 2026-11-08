/* eslint-disable no-await-in-loop */

import { mapConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { getRepositoryDatabase } from '$lib/services/utils/database';

/**
 * @import { IndexedDB } from '@sveltia/utils/storage';
 */

/**
 * The direct children of a Git tree, each as a `[name, sha]` pair. Names rather than paths are
 * kept, as a tree with the same content has the same ID wherever it is.
 * @typedef {object} TreeListing
 * @property {[string, string][]} trees Subtrees.
 * @property {[string, string][]} blobs Files.
 */

/**
 * A directory to list along with its subdirectories.
 * @typedef {object} TreeRoot
 * @property {string} path Directory path relative to the repository root, or an empty string for
 * the root itself.
 * @property {string} [sha] The directory’s tree ID. Without it, the directory is always listed,
 * though its subdirectories can still come from the cache.
 */

/**
 * Name of the IndexedDB store holding the tree listings, keyed with tree IDs.
 */
export const TREE_CACHE_STORE_NAME = 'tree-cache';

/**
 * Read all the cached tree listings.
 * @param {IndexedDB | undefined} db Database.
 * @returns {Promise<Map<string, TreeListing>>} Listings keyed with tree IDs. Empty if the database
 * is unavailable, e.g. in a private window, so everything is listed then.
 */
const readCache = async (db) => {
  try {
    return new Map(db ? await db.entries() : []);
  } catch {
    return new Map();
  }
};

/**
 * Store new tree listings, and delete the ones no longer in use.
 * @param {IndexedDB | undefined} db Database.
 * @param {Map<string, TreeListing>} listings New listings keyed with tree IDs.
 * @param {string[]} staleKeys Tree IDs to delete.
 */
const writeCache = async (db, listings, staleKeys) => {
  if (!db) {
    return;
  }

  try {
    if (listings.size) {
      await db.saveEntries([...listings]);
    }

    if (staleKeys.length) {
      await db.deleteEntries(staleKeys);
    }
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error('Failed to update the tree cache.', ex);
  }
};

/**
 * List the files in the given directories and all their subdirectories, a level at a time. A
 * backend that can only list a directory a page at a time would otherwise have to list every file
 * again whenever the branch moves on, however small the change. Instead, the listing of each
 * directory is cached under its tree ID, which stands for the whole content of the directory: a
 * directory whose ID is cached is taken from the cache along with everything inside it that hasn’t
 * changed, so a commit only costs the directories on the paths to the files it touched. Being
 * content-addressed, a cached listing can’t go stale. The directories of a level that have to be
 * listed are requested at the same time.
 * @param {object} args Arguments.
 * @param {{ databaseName?: string }} args.repository Repository info, which names the database.
 * @param {TreeRoot[]} args.roots Directories to list. None of them should be inside another.
 * @param {(path: string) => Promise<TreeListing>} args.fetchTreeListing Function to list the
 * direct children of a directory, given its path relative to the repository root.
 * @param {boolean} args.cacheable Whether the listings fetched can be cached, which is only the
 * case when `fetchTreeListing` reads a commit rather than a branch: a branch may move on between
 * requests, which could file a listing under the ID of another version of the directory.
 * @param {number} [args.concurrency] Maximum number of directories listed at the same time.
 * @returns {Promise<{ type: 'blob', path: string, sha: string }[]>} Files, with paths relative to
 * the repository root.
 */
export const listTrees = async ({
  repository,
  roots,
  fetchTreeListing,
  cacheable,
  concurrency,
}) => {
  const db = getRepositoryDatabase(repository, TREE_CACHE_STORE_NAME);
  const cache = await readCache(db);
  /** @type {Map<string, TreeListing>} */
  const fetched = new Map();
  /** @type {Map<string, Promise<TreeListing>>} */
  const pending = new Map();
  /** @type {Set<string>} */
  const visited = new Set();
  /** @type {{ type: 'blob', path: string, sha: string }[]} */
  const blobs = [];
  let completed = false;

  /**
   * Get the listing of a directory, from the cache if possible. A tree that appears more than once,
   * like two directories with the same content, is only listed once.
   * @param {TreeRoot} root Directory.
   * @returns {Promise<TreeListing>} Listing.
   */
  const getListing = async ({ path, sha }) => {
    if (!sha) {
      return fetchTreeListing(path);
    }

    visited.add(sha);

    const cached = cache.get(sha);

    if (cached) {
      return cached;
    }

    if (!pending.has(sha)) {
      pending.set(
        sha,
        fetchTreeListing(path).then((listing) => {
          // Git has no empty trees, so an empty listing means the directory couldn’t be found,
          // which mustn’t stick to its ID
          if (cacheable && (listing.trees.length || listing.blobs.length)) {
            fetched.set(sha, listing);
          }

          return listing;
        }),
      );
    }

    return /** @type {Promise<TreeListing>} */ (pending.get(sha));
  };

  try {
    let level = roots;

    while (level.length) {
      const listings = await mapConcurrently(level, getListing, { concurrency });
      const currentLevel = level;

      level = listings.flatMap(({ trees, blobs: files }, index) => {
        const { path } = currentLevel[index];
        const prefix = path ? `${path}/` : '';

        files.forEach(([name, sha]) => {
          blobs.push({ type: 'blob', path: `${prefix}${name}`, sha });
        });

        return trees.map(([name, sha]) => ({ path: `${prefix}${name}`, sha }));
      });
    }

    completed = true;
  } finally {
    // Keep what has been listed even if the walk failed, so a retry doesn’t start over, but only
    // prune the trees no longer in the repository once everything has been seen
    await writeCache(
      db,
      fetched,
      completed ? [...cache.keys()].filter((sha) => !visited.has(sha)) : [],
    );
  }

  return blobs;
};
