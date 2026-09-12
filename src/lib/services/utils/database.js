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
