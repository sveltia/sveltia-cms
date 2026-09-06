import { IndexedDB, LocalStorage } from '@sveltia/utils/storage';
import { get } from 'svelte/store';

import { backend, gitBackendServices } from '$lib/services/backends';
import { TEST_BACKEND_NAME, TEST_BACKEND_ROOT_DIR_NAME } from '$lib/services/backends/fs/test';

/**
 * Names of the IndexedDB object stores holding cached file contents and generated asset thumbnails.
 * The data in these stores can always be re-fetched or regenerated, so it’s safe to delete.
 * @type {string[]}
 */
const CACHE_STORE_NAMES = ['file-cache', 'asset-thumbnails'];
/**
 * Prefix shared by all the local storage keys written by the CMS, such as `sveltia-cms.prefs`.
 */
const LOCAL_STORAGE_KEY_PREFIX = 'sveltia-cms.';
/**
 * Local storage keys written by Netlify/Decap CMS. The CMS reads these for backward compatibility,
 * so they have to go as well; otherwise the user would be signed back in right after the reset.
 * @type {string[]}
 */
const LEGACY_LOCAL_STORAGE_KEYS = ['decap-cms-user', 'netlify-cms-user'];
/**
 * Pattern matching the IndexedDB database names created by the CMS, which are made up of a Git
 * backend name and a repository path, e.g. `github:owner/repo`. Used to leave any database owned by
 * the site hosting the CMS untouched.
 */
const DATABASE_NAME_REGEX = new RegExp(`^(?:${Object.keys(gitBackendServices).join('|')}):`);

/**
 * Delete the directory in the origin private file system (OPFS) where the `test-repo` backend keeps
 * entry and asset files. This is the backend’s only storage, so removing it resets the test site to
 * an empty state.
 * @returns {Promise<void>}
 */
const clearTestBackendFiles = async () => {
  try {
    const rootDirHandle = await navigator.storage.getDirectory();

    await rootDirHandle.removeEntry(TEST_BACKEND_ROOT_DIR_NAME, { recursive: true });
  } catch {
    // The directory may not exist yet, or the handle may not be available for security reasons
  }
};

/**
 * Delete all the locally cached files, including remote file contents and asset thumbnails.
 * @returns {Promise<void>}
 */
export const clearFileCache = async () => {
  const _backend = get(backend);
  const { databaseName } = _backend?.repository ?? {};

  if (databaseName) {
    await Promise.all(
      CACHE_STORE_NAMES.map((storeName) => new IndexedDB(databaseName, storeName).clear()),
    );
  }

  if (_backend?.name === TEST_BACKEND_NAME) {
    await clearTestBackendFiles();
  }
};

/**
 * Get the names of the IndexedDB databases created by the CMS. The database for the current
 * repository is always included, while any database left behind by another repository or backend is
 * picked up only where `IDBFactory.databases()` is available; Firefox doesn’t implement it.
 * @returns {Promise<string[]>} Database names.
 */
const getDatabaseNames = async () => {
  const { databaseName } = get(backend)?.repository ?? {};
  const names = new Set(databaseName ? [databaseName] : []);

  try {
    (await globalThis.indexedDB.databases?.())?.forEach(({ name }) => {
      if (name && DATABASE_NAME_REGEX.test(name)) {
        names.add(name);
      }
    });
  } catch {
    // Enumeration is best-effort; fall back to the current repository’s database alone
  }

  return [...names];
};

/**
 * Delete an IndexedDB database.
 * @param {string} name Database name.
 * @returns {Promise<void>}
 */
const deleteDatabase = async (name) =>
  new Promise((resolve) => {
    /**
     * Stop waiting for the deletion. This is also called on `blocked`, which fires when another
     * open connection keeps the deletion pending: the app is about to be reloaded anyway, and the
     * deletion goes through once the page unloads, so there’s no point in blocking on it.
     * @returns {void}
     */
    const done = () => resolve();
    const request = globalThis.indexedDB.deleteDatabase(name);

    request.onsuccess = done;
    request.onerror = done;
    request.onblocked = done;
  });

/**
 * Delete the local storage entries written by the CMS, leaving any entry owned by the site hosting
 * the CMS untouched.
 * @returns {Promise<void>}
 */
const clearLocalStorage = async () => {
  try {
    const keys = (await LocalStorage.keys()).filter(
      (key) => key.startsWith(LOCAL_STORAGE_KEY_PREFIX) || LEGACY_LOCAL_STORAGE_KEYS.includes(key),
    );

    await Promise.all(keys.map((key) => LocalStorage.delete(key)));
  } catch {
    // Storage access may be denied, e.g. when third-party cookies are blocked
  }
};

/**
 * Delete all the data the CMS keeps in the browser: the IndexedDB databases holding cached files,
 * asset thumbnails, draft backups and UI settings, the local storage entries holding the user’s
 * sign-in state and preferences, and the files stored by the `test-repo` backend.
 * @returns {Promise<void>}
 */
export const eraseAllData = async () => {
  const names = await getDatabaseNames();

  await Promise.all(names.map((name) => deleteDatabase(name)));
  await clearLocalStorage();
  await clearTestBackendFiles();
};
