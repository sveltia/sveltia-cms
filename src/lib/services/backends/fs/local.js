import { IndexedDB } from '@sveltia/utils/storage';
import { get } from 'svelte/store';

import { allBackendServices } from '$lib/services/backends';
import { loadFiles, saveChanges } from '$lib/services/backends/fs/shared/files';
import { cmsConfig } from '$lib/services/config';

/**
 * @import {
 * BackendService,
 * CommitResults,
 * FileChange,
 * InternalCmsConfig,
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
const REPOSITORY_PROPS = { service: '', label: '', owner: '', repo: '', branch: '' };

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
  get: (_obj, key) => (remoteRepository ?? REPOSITORY_PROPS)[key],
});

const ROOT_DIR_HANDLE_KEY = 'root_dir_handle';
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
 * @internal
 * @param {object} [options] Options.
 * @param {boolean} [options.forceReload] Whether to force getting the handle.
 * @param {boolean} [options.showPicker] Whether to show the directory picker.
 * @returns {Promise<FileSystemDirectoryHandle | null>} Directory handle.
 * @throws {Error | AbortError | NotFoundError} When the File System Access API is not supported by
 * the user’s browser, when the directory picker was dismissed, or when the selected directory is
 * not a project root directory. There might be other reasons to throw.
 * @see https://developer.chrome.com/articles/file-system-access/#stored-file-or-directory-handles-and-permissions
 */
export const getRootDirHandle = async ({ forceReload = false, showPicker = true } = {}) => {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('unsupported');
  }

  /** @type {FileSystemDirectoryHandle | null} */
  let handle = forceReload ? null : ((await rootDirHandleDB?.get(ROOT_DIR_HANDLE_KEY)) ?? null);

  if (handle) {
    if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
      handle = null;
    } else {
      try {
        await handle.entries().next();
      } catch (ex) {
        // The directory may have been (re)moved. Let the user pick the directory again
        handle = null;
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    }
  }

  if (!handle && showPicker) {
    // This will throw `AbortError` when the user dismissed the picker
    handle = await window.showDirectoryPicker();

    if (handle) {
      // Verify this is a project root by checking for `.git`. In a standard repository, `.git` is
      // a directory. In a git worktree, `.git` is a file containing a `gitdir:` pointer to the
      // main repository. Both are valid repository roots.
      try {
        await handle.getDirectoryHandle('.git');
      } catch (/** @type {any} */ ex) {
        if (ex.name === 'TypeMismatchError') {
          // `.git` exists but is a file (git worktree), which is still a valid repo root
          await handle.getFileHandle('.git');
        } else {
          throw ex;
        }
      }

      // If it looks fine, cache the directory handle
      await rootDirHandleDB?.set(ROOT_DIR_HANDLE_KEY, handle);
    }
  }

  return /** @type {FileSystemDirectoryHandle | null} */ (handle);
};

/**
 * Initialize the local backend.
 * @returns {RepositoryInfo | undefined} Repository info.
 */
const init = () => {
  const { name: service } = /** @type {InternalCmsConfig} */ (get(cmsConfig)).backend;

  remoteRepository = allBackendServices[service]?.init?.();

  const { databaseName } = remoteRepository ?? {};

  rootDirHandleDB = databaseName ? new IndexedDB(databaseName, 'file-system-handles') : null;

  return repository;
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
  await rootDirHandleDB?.delete(ROOT_DIR_HANDLE_KEY);
};

/**
 * Load file list and all the entry files from the file system, then cache them in the
 * {@link allEntries} and {@link allAssets} stores.
 */
const fetchFiles = async () => {
  await loadFiles(/** @type {FileSystemDirectoryHandle} */ (rootDirHandle));
};

/**
 * Save entries or assets locally.
 * @param {FileChange[]} changes File changes to be saved.
 * @returns {Promise<CommitResults>} Commit results, including a pseudo commit SHA, saved files, and
 * their blob SHAs.
 */
const commitChanges = async (changes) => saveChanges(rootDirHandle, changes);

/**
 * @type {BackendService}
 */
export default {
  isGit: false,
  name: backendName,
  label,
  repository,
  init,
  signIn,
  signOut,
  fetchFiles,
  commitChanges,
};
