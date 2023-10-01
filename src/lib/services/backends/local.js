/* eslint-disable no-continue */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */

import { get, writable } from 'svelte/store';
import { allAssetPaths, allAssets } from '$lib/services/assets';
import { siteConfig } from '$lib/services/config';
import { allContentPaths, allEntries, dataLoaded } from '$lib/services/contents';
import { createFileList, parseAssetFiles, parseEntryFiles } from '$lib/services/parser';
import { getHash, readAsText } from '$lib/services/utils/files';
import IndexedDB from '$lib/services/utils/indexeddb';
import { escapeRegExp, stripSlashes } from '$lib/services/utils/strings';

const label = 'Local Repository';
/**
 * @type {import('svelte/store').Writable<?FileSystemDirectoryHandle>}
 */
const rootDirHandle = writable(null);
const rootDirHandleKey = 'root_dir_handle';
/**
 * @type {IndexedDB}
 */
let rootDirHandleDB;

/**
 * Get the project’s root directory handle so the app can read all the files under the directory.
 * The handle will be cached in IndexedDB for later use. Note that we need to request permission
 * each time the app is loaded.
 * @param {object} [options] Options.
 * @param {boolean} [options.forceReload] Whether to force getting the handle.
 * @returns {Promise<FileSystemDirectoryHandle>} Directory handle.
 * @throws {Error} When the File System Access API is not supported by the user’s browser.
 * @see https://developer.chrome.com/articles/file-system-access/#stored-file-or-directory-handles-and-permissions
 */
const getRootDirHandle = async ({ forceReload = false } = {}) => {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('unsupported');
  }

  /**
   * @type {FileSystemDirectoryHandle & { requestPermission: Function, entries: Function }}
   */
  let handle = forceReload ? undefined : await rootDirHandleDB.get(rootDirHandleKey);

  if (handle) {
    if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
      handle = undefined;
    } else {
      try {
        await handle.entries().next();
      } catch {
        // The directory may have been (re)moved
        handle = undefined;
      }
    }
  }

  if (!handle) {
    handle = await /** @type {any} */ (window).showDirectoryPicker();
    await rootDirHandleDB.set(rootDirHandleKey, handle);
  }

  return handle;
};

/**
 * Discard the root directory handle stored in the IndexedDB.
 */
const discardDirHandle = async () => {
  await rootDirHandleDB.delete(rootDirHandleKey);
};

/**
 * Initialize the backend.
 */
const init = () => {
  const { backend } = get(siteConfig);

  rootDirHandleDB = new IndexedDB(`${backend.name}:${backend.repo}`, 'file-system-handles');
};

/**
 * Sign in with the local Git repository. There is no actual sign-in; just show the directory picker
 * to get the handle, so we can read/write files.
 * @returns {Promise<User>} User info.
 */
const signIn = async () => {
  rootDirHandle.set(await getRootDirHandle());

  return { backendName: 'local' };
};

/**
 * Sign out from the local Git repository. There is no actual sign-out; just delete the cached
 * directory handle.
 */
const signOut = async () => {
  discardDirHandle();
};

/**
 * Get a file or directory handle at the given path.
 * @param {string} path Path to the file/directory.
 * @returns {Promise<(FileSystemFileHandle|FileSystemDirectoryHandle)>} Handle.
 */
const getHandleByPath = async (path) => {
  const pathParts = stripSlashes(path).split('/');
  const create = true;
  /**
   * @type {FileSystemFileHandle | FileSystemDirectoryHandle}
   */
  let handle = get(rootDirHandle);

  for (const name of pathParts) {
    handle = await (name.includes('.')
      ? /** @type {FileSystemDirectoryHandle} */ (handle).getFileHandle(name, { create })
      : /** @type {FileSystemDirectoryHandle} */ (handle).getDirectoryHandle(name, { create }));
  }

  return handle;
};

/**
 * Retrieve all files under the static directory.
 * @returns {Promise<object[]>} File list.
 */
const getAllFiles = async () => {
  const _rootDirHandle = get(rootDirHandle);
  const allFiles = [];

  const scanningPaths = [
    ...get(allContentPaths).map(({ file, folder }) => file || folder),
    ...get(allAssetPaths).map(({ internalPath }) => internalPath),
  ].map((path) => stripSlashes(path));

  // eslint-disable-next-line jsdoc/require-jsdoc
  const getRegEx = (path) => new RegExp(`^${escapeRegExp(path)}\\b`);
  const scanningPathsRegEx = scanningPaths.map(getRegEx);

  /**
   * Retrieve all the files under the given directory recursively.
   * @param {FileSystemDirectoryHandle | any} dirHandle Directory handle.
   */
  const iterate = async (dirHandle) => {
    for await (const [name, handle] of dirHandle.entries()) {
      if (name.startsWith('.')) {
        continue;
      }

      const path = (await _rootDirHandle.resolve(handle)).join('/');
      const hasMatchingPath = scanningPathsRegEx.some((re) => path.match(re));

      if (handle.kind === 'file') {
        if (!hasMatchingPath) {
          continue;
        }

        try {
          const file = await handle.getFile();

          allFiles.push({
            file,
            path,
            name,
            sha: await getHash(file),
            size: file.size,
            text: name.match(/\.(?:json|markdown|md|toml|ya?ml)$/i) ? await readAsText(file) : null,
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      }

      if (handle.kind === 'directory') {
        const regex = getRegEx(path);

        if (!hasMatchingPath && !scanningPaths.some((p) => p.match(regex))) {
          continue;
        }

        await iterate(handle);
      }
    }
  };

  await iterate(_rootDirHandle);

  return allFiles;
};

/**
 * Fetch file list and all the entry files, then cache them in the {@link allEntries} and
 * {@link allAssets} stores.
 */
const fetchFiles = async () => {
  const { entryFiles, assetFiles } = createFileList(await getAllFiles());

  allEntries.set(parseEntryFiles(entryFiles));
  allAssets.set(parseAssetFiles(assetFiles));
  dataLoaded.set(true);
};

/**
 * Save entries or assets locally.
 * @param {SavingFile[]} items Entries or files.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemWritableFileStream/write
 */
const saveFiles = async (items) => {
  await Promise.all(
    items.map(async ({ path, data }) => {
      const handle = await getHandleByPath(path);
      // @ts-ignore
      const writer = await handle.createWritable();

      await writer.write(data);
      await writer.close();
    }),
  );
};

/**
 * Delete files at the given paths.
 * @param {DeletingFile[]} items Entries or files.
 */
const deleteFiles = async (items) => {
  await Promise.all(
    items.map(async ({ path }) => {
      const pathArray = stripSlashes(path).split('/');
      const entryName = pathArray.pop();
      const handle = await getHandleByPath(pathArray.join('/'));

      // @ts-ignore
      await handle.removeEntry(entryName);
    }),
  );
};

/**
 * @type {BackendService}
 */
export default {
  label,
  init,
  signIn,
  signOut,
  fetchFiles,
  saveFiles,
  deleteFiles,
};
