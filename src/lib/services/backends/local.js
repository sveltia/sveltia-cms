/* eslint-disable no-continue */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */

import { get, writable } from 'svelte/store';
import { allAssetPaths, allAssets } from '$lib/services/assets';
import { siteConfig } from '$lib/services/config';
import { allContentPaths, allEntries } from '$lib/services/contents';
import { createFileList, parseAssetFiles, parseEntryFiles } from '$lib/services/parser';
import { getHash, readAsText } from '$lib/services/utils/files';
import { stripSlashes } from '$lib/services/utils/strings';

const label = 'Local Repository';
const url = null;
const storeName = 'file-system-handles';
/**
 * @type {import('svelte/store').Writable<?FileSystemDirectoryHandle>}
 */
const rootDirHandle = writable(null);
const rootDirHandleKey = 'root_dir_handle';
/**
 * @type {?IDBDatabase}
 */
let database;
/**
 * Get the object store.
 * @returns {IDBObjectStore} Store.
 */
const getStore = () => database.transaction([storeName], 'readwrite').objectStore(storeName);

/**
 * Get the project’s root directory handle so the app can read all the files under the directory.
 * The handle will be cached in IndexedDB for later use.
 * @param {object} [options] Options.
 * @param {boolean} [options.forceReload] Whether to force getting the handle.
 * @returns {Promise<FileSystemDirectoryHandle>} Directory handle.
 * @throws {Error} When the File System Access API is not supported by the user’s browser.
 */
const getRootDirHandle = async ({ forceReload = false } = {}) => {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('unsupported');
  }

  const { backend } = get(siteConfig);

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(`${backend.name}:${backend.repo}`, 1);

    /**
     * Called when the database is created or upgraded. Create a store.
     */
    request.onupgradeneeded = () => {
      database = request.result;
      database.createObjectStore(storeName);
    };

    /**
     * Called when the database is available.
     */
    request.onsuccess = () => {
      database = request.result;

      const _request = getStore().get(rootDirHandleKey);

      /**
       * Called when the store data is retrieved. Check if a handle is cached, and if not, request
       * permission to use it. Note that we need to request permission each time the app is loaded.
       * @see https://developer.chrome.com/articles/file-system-access/#stored-file-or-directory-handles-and-permissions
       */
      _request.onsuccess = async () => {
        /**
         * @type {FileSystemDirectoryHandle}
         */
        let handle = _request.result;

        if (handle && !forceReload) {
          const options = { mode: 'readwrite' };

          // @ts-ignore
          if ((await handle.requestPermission(options)) !== 'granted') {
            reject(new Error('permission_denied'));
            return;
          }
        } else {
          handle = await /** @type {any} */ (window).showDirectoryPicker();
          getStore().add(handle, rootDirHandleKey);
        }

        rootDirHandle.set(handle);
        resolve(handle);
      };
    };
  });
};

/**
 * Discard the root directory handle stored in the IndexedDB.
 */
const discardDirHandle = async () => {
  getStore().delete(rootDirHandleKey);
};

/**
 * Sign in with the local Git repository. There is no actual sign-in; just show the directory picker
 * to get the handle, so we can read/write files.
 * @returns {Promise<object>} User info.
 */
const signIn = async () => {
  await getRootDirHandle();

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
  ];

  /**
   * Retrieve all the files under the given directory recursively.
   * @param {(FileSystemDirectoryHandle | any)} dirHandle Directory handle.
   */
  const iterate = async (dirHandle) => {
    for await (const [name, handle] of dirHandle.entries()) {
      if (name.startsWith('.')) {
        continue;
      }

      if (handle.kind === 'file') {
        const path = (await _rootDirHandle.resolve(handle)).join('/');

        if (!scanningPaths.some((scanningPath) => path.startsWith(scanningPath))) {
          continue;
        }

        const file = await handle.getFile();

        allFiles.push({
          path,
          name,
          sha: await getHash(file),
          size: file.size,
          text: name.match(/\.(?:json|markdown|md|toml|ya?ml)$/i) ? await readAsText(file) : null,
        });
      }

      if (handle.kind === 'directory') {
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
};

/**
 * Save entries or assets locally.
 * @param {object[]} items Entries or files.
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
 * @param {object[]} items Entries or files.
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
  url,
  signIn,
  signOut,
  fetchFiles,
  saveFiles,
  deleteFiles,
};
