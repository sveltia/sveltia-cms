import { IndexedDB } from '@sveltia/utils/storage';
import { get } from 'svelte/store';
import { allBackendServices } from '$lib/services/backends';
import { repositoryProps } from '$lib/services/backends/shared/data';
import { commitChanges, fetchFiles } from '$lib/services/backends/shared/fs';
import { siteConfig } from '$lib/services/config';

/**
 * @import {
 * BackendService,
 * FileChange,
 * InternalSiteConfig,
 * RepositoryInfo,
 * SignInOptions,
 * User,
 * } from '$lib/types/private';
 */

const backendName = 'local';
const label = 'Local Repository';
/**
 * @type {RepositoryInfo | undefined}
 */
let remoteRepository = undefined;

/**
 * @type {RepositoryInfo}
 */
const repository = new Proxy(/** @type {any} */ ({}), {
  /**
   * Define the getter.
   * @param {Record<string, any>} _obj Object itself.
   * @param {string} key Property name.
   * @returns {any} Property value.
   */
  // @ts-ignore
  get: (_obj, key) => (remoteRepository ?? repositoryProps)[key],
});

const rootDirHandleKey = 'root_dir_handle';
/**
 * @type {IndexedDB | null | undefined}
 */
let rootDirHandleDB = undefined;
/**
 * @type {FileSystemDirectoryHandle | undefined}
 */
let rootDirHandle = undefined;

/**
 * Get the project’s root directory handle so the app can read all the files under the directory.
 * The handle will be cached in IndexedDB for later use.
 * @param {object} [options] Options.
 * @param {boolean} [options.forceReload] Whether to force getting the handle.
 * @param {boolean} [options.showPicker] Whether to show the directory picker.
 * @returns {Promise<FileSystemDirectoryHandle | null>} Directory handle.
 * @throws {Error | AbortError | NotFoundError} When the File System Access API is not supported by
 * the user’s browser, when the directory picker was dismissed, or when the selected directory is
 * not a project root directory. There might be other reasons to throw.
 * @see https://developer.chrome.com/articles/file-system-access/#stored-file-or-directory-handles-and-permissions
 */
const getRootDirHandle = async ({ forceReload = false, showPicker = true } = {}) => {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('unsupported');
  }

  /** @type {FileSystemDirectoryHandle | null} */
  let handle = forceReload ? null : ((await rootDirHandleDB?.get(rootDirHandleKey)) ?? null);

  if (handle) {
    if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
      handle = null;
    } else {
      try {
        await handle.entries().next();
      } catch (/** @type {any} */ ex) {
        // The directory may have been (re)moved. Let the user pick the directory again
        handle = null;
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    }
  }

  if (!handle && showPicker) {
    // This wil throw `AbortError` when the user dismissed the picker
    handle = await window.showDirectoryPicker();

    if (handle) {
      // This will throw `NotFoundError` when it’s not a project root directory
      await handle.getDirectoryHandle('.git');
      // If it looks fine, cache the directory handle
      await rootDirHandleDB?.set(rootDirHandleKey, handle);
    }
  }

  return /** @type {FileSystemDirectoryHandle | null} */ (handle);
};

/**
 * Initialize the local backend.
 */
const init = () => {
  const { name: service } = /** @type {InternalSiteConfig} */ (get(siteConfig)).backend;

  remoteRepository = allBackendServices[service]?.getRepositoryInfo?.();

  const { databaseName } = remoteRepository ?? {};

  rootDirHandleDB = databaseName ? new IndexedDB(databaseName, 'file-system-handles') : null;
};

/**
 * Sign in with the local Git repository. There is no actual sign-in; just show the directory picker
 * to get the handle, so we can read/write files.
 * @param {SignInOptions} options Options.
 * @returns {Promise<User>} User info. Since we don’t have any details for the local user, just
 * return the backend name.
 * @throws {Error} When the directory handle could not be acquired.
 */
const signIn = async ({ auto = false }) => {
  const handle = await getRootDirHandle({ showPicker: !auto });

  if (handle) {
    rootDirHandle = handle;
  } else {
    throw new Error('Directory handle could not be acquired');
  }

  return { backendName };
};

/**
 * Sign out from the local Git repository. There is no actual sign-out; just discard the cached root
 * directory handle.
 */
const signOut = async () => {
  await rootDirHandleDB?.delete(rootDirHandleKey);
};

/**
 * Fetch file list and all the entry files, then cache them in the {@link allEntries} and
 * {@link allAssets} stores.
 * @returns {Promise<void>}
 */
const _fetchFiles = async () =>
  fetchFiles(/** @type {FileSystemDirectoryHandle} */ (rootDirHandle));

/**
 * Save entries or assets locally.
 * @param {FileChange[]} changes File changes to be saved.
 * @returns {Promise<(?File)[]>} Created or updated files, if available.
 */
const _commitChanges = async (changes) =>
  commitChanges(/** @type {FileSystemDirectoryHandle} */ (rootDirHandle), changes);

/**
 * @type {BackendService}
 */
export default {
  isRemoteGit: false,
  name: backendName,
  label,
  repository,
  init,
  signIn,
  signOut,
  fetchFiles: _fetchFiles,
  commitChanges: _commitChanges,
};
