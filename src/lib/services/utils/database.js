import { IndexedDB } from '@sveltia/utils/storage';

/**
 * Open a store in the IndexedDB database associated with the given repository. Each repository has
 * its own database, named after the backend and the repository path, so the stores, such as the
 * file cache and UI settings, are kept apart between sites.
 * @param {{ databaseName?: string } | undefined} repository Repository info.
 * @param {string} storeName Store name, e.g. `file-cache`.
 * @returns {IndexedDB | undefined} Database handle, or `undefined` if the repository has no
 * database, e.g. when the backend is not initialized yet.
 */
export const getRepositoryDatabase = (repository, storeName) => {
  const { databaseName } = repository ?? {};

  return databaseName ? new IndexedDB(databaseName, storeName) : undefined;
};

/**
 * Read all the records in a cache store.
 * @template T
 * @param {IndexedDB | null | undefined} db Cache store.
 * @returns {Promise<Map<string, T>>} Records keyed as in the store. Empty if there is no store or
 * it can’t be read, e.g. in a private window, so the caller computes everything again.
 */
export const readCacheEntries = async (db) => {
  try {
    return new Map((await db?.entries()) ?? []);
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return new Map();
  }
};

/**
 * Save new records in a cache store, and delete the ones no longer in use. Nothing is written if
 * there is nothing to save or delete. A failure is only logged, as the cache is a nicety: the next
 * load computes the records again.
 * @template T
 * @param {IndexedDB | null | undefined} db Cache store.
 * @param {Map<string, T>} newEntries Records to save.
 * @param {string[]} staleKeys Keys of the records to delete.
 */
export const updateCacheEntries = async (db, newEntries, staleKeys) => {
  if (!db) {
    return;
  }

  try {
    if (newEntries.size) {
      await db.saveEntries([...newEntries]);
    }

    if (staleKeys.length) {
      await db.deleteEntries(staleKeys);
    }
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error(ex);
  }
};
