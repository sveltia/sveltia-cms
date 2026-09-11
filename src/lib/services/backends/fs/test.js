import { getDirectoryHandle, loadFiles, saveChanges } from '$lib/services/backends/fs/shared/files';
import { dataLoaded } from '$lib/services/contents';

/**
 * @import { BackendService, CommitResults, FileChange, User } from '$lib/types/private';
 */

/**
 * Name of the directory in the origin private file system (OPFS) where the entry and asset files
 * are stored.
 */
export const TEST_BACKEND_ROOT_DIR_NAME = 'sveltia-cms-test';
/**
 * Name of the test backend.
 */
export const TEST_BACKEND_NAME = 'test-repo';

const label = 'Test';
/**
 * @type {FileSystemDirectoryHandle | undefined}
 */
let rootDirHandle = undefined;
/**
 * Initialize the test backend. There is nothing to do here.
 * @returns {undefined}
 */
const init = () => undefined;

/**
 * Sign in with the test backend. There is no actual sign-in; just get the root directory handle in
 * the origin private file system (OPFS), so we can read/write files.
 * @returns {Promise<User>} User info. Since we don’t have any details for the local user, just
 * return the backend name.
 * @see https://web.dev/articles/origin-private-file-system
 * @todo Preload entry files on the demo site.
 */
const signIn = async () => {
  try {
    rootDirHandle = await getDirectoryHandle(
      await navigator.storage.getDirectory(),
      TEST_BACKEND_ROOT_DIR_NAME,
    );
  } catch {
    // Directory handle could not be acquired for security reasons, but we can ignore the error
  }

  return { backendName: TEST_BACKEND_NAME };
};

/**
 * Sign out from the test backend. There is nothing to do here.
 */
const signOut = async () => {};

/**
 * Load file list and all the entry files from the file system, then cache them in the
 * {@link allEntries} and {@link allAssets} stores. If the root directory handle is not available,
 * simply pretend that the data is loaded.
 */
const fetchFiles = async () => {
  if (rootDirHandle) {
    await loadFiles(rootDirHandle);
  } else {
    dataLoaded.current = true;
  }
};

/**
 * Save entries or assets in the OPFS using the root directory handle acquired during sign-in. If
 * the handle is not available, do nothing; the data will still be stored in the in-memory cache,
 * allowing the user to continue using the app without an error.
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
  name: TEST_BACKEND_NAME,
  label,
  init,
  signIn,
  signOut,
  fetchFiles,
  commitChanges,
};
