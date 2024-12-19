/* eslint-disable no-continue */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */

import { getHash } from '@sveltia/utils/crypto';
import { getPathInfo, readAsText } from '@sveltia/utils/file';
import { IndexedDB } from '@sveltia/utils/storage';
import { escapeRegExp, stripSlashes } from '@sveltia/utils/string';
import { get, writable } from 'svelte/store';
import { allAssetFolders, allAssets } from '$lib/services/assets';
import { parseAssetFiles } from '$lib/services/assets/parser';
import { allBackendServices } from '$lib/services/backends';
import { createFileList, repositoryProps } from '$lib/services/backends/shared/data';
import { siteConfig } from '$lib/services/config';
import { allEntries, allEntryFolders, dataLoaded, entryParseErrors } from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';

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
   * @param {Record<string, any>} _obj - Object itself.
   * @param {string} key - Property name.
   * @returns {any} Property value.
   */
  // @ts-ignore
  get: (_obj, key) => (remoteRepository ?? repositoryProps)[key],
});

/**
 * @type {import('svelte/store').Writable<?FileSystemDirectoryHandle>}
 */
const rootDirHandle = writable(null);
const rootDirHandleKey = 'root_dir_handle';
/**
 * @type {IndexedDB | null | undefined}
 */
let rootDirHandleDB = undefined;

/**
 * Get the project’s root directory handle so the app can read all the files under the directory.
 * The handle will be cached in IndexedDB for later use.
 * @param {object} [options] - Options.
 * @param {boolean} [options.forceReload] - Whether to force getting the handle.
 * @param {boolean} [options.showPicker] - Whether to show the directory picker.
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

  /**
   * @type {FileSystemDirectoryHandle | null}
   */
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
 * Discard the root directory handle stored in the IndexedDB.
 */
const discardDirHandle = async () => {
  await rootDirHandleDB?.delete(rootDirHandleKey);
};

/**
 * Initialize the backend.
 */
const init = () => {
  const { name: service } = /** @type {SiteConfig} */ (get(siteConfig)).backend;

  remoteRepository = allBackendServices[service]?.getRepositoryInfo?.();

  const { databaseName } = remoteRepository ?? {};

  rootDirHandleDB = databaseName ? new IndexedDB(databaseName, 'file-system-handles') : null;
};

/**
 * Sign in with the local Git repository. There is no actual sign-in; just show the directory picker
 * to get the handle, so we can read/write files.
 * @param {SignInOptions} options - Options.
 * @returns {Promise<User>} User info. Since we don’t have any details for the local user, just
 * return the backend name.
 * @throws {Error} When the directory handle could not be acquired.
 */
const signIn = async ({ auto = false }) => {
  const handle = await getRootDirHandle({ showPicker: !auto });

  if (handle) {
    rootDirHandle.set(handle);
  } else {
    throw new Error('Directory handle could not be acquired');
  }

  return { backendName };
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
 * @param {string} path - Path to the file/directory.
 * @returns {Promise<FileSystemFileHandle | FileSystemDirectoryHandle>} Handle.
 */
const getHandleByPath = async (path) => {
  let handle = /** @type {FileSystemFileHandle | FileSystemDirectoryHandle} */ (get(rootDirHandle));

  if (!path) {
    return handle;
  }

  const pathParts = stripSlashes(path).split('/');
  const create = true;

  for (const name of pathParts) {
    handle = await (name.includes('.')
      ? /** @type {FileSystemDirectoryHandle} */ (handle).getFileHandle(name, { create })
      : /** @type {FileSystemDirectoryHandle} */ (handle).getDirectoryHandle(name, { create }));
  }

  return handle;
};

/**
 * Retrieve all files under the static directory.
 * @returns {Promise<BaseFileListItem[]>} File list.
 */
const getAllFiles = async () => {
  const _rootDirHandle = get(rootDirHandle);
  /** @type {{ file: File, path: string }[]} */
  const availableFileList = [];

  const scanningPaths = [
    ...get(allEntryFolders)
      .map(({ filePathMap, folderPath }) =>
        filePathMap ? Object.values(filePathMap) : [folderPath],
      )
      .flat(1),
    ...get(allAssetFolders).map(({ internalPath }) => internalPath),
  ].map((path) => stripSlashes(path ?? ''));

  /**
   * Get a regular expression to match the given path.
   * @param {string} path - Path.
   * @returns {RegExp} RegEx.
   */
  const getRegEx = (path) => new RegExp(`^${escapeRegExp(path)}\\b`);
  const scanningPathsRegEx = scanningPaths.map(getRegEx);

  /**
   * Retrieve all the files under the given directory recursively.
   * @param {FileSystemDirectoryHandle | any} dirHandle - Directory handle.
   */
  const iterate = async (dirHandle) => {
    for await (const [name, handle] of dirHandle.entries()) {
      if (name.startsWith('.')) {
        continue;
      }

      const path = (await _rootDirHandle?.resolve(handle))?.join('/') ?? '';
      const hasMatchingPath = scanningPathsRegEx.some((regex) => regex.test(path));

      if (handle.kind === 'file') {
        if (!hasMatchingPath) {
          continue;
        }

        try {
          /** @type {File} */
          let file = await handle.getFile();

          // Clone the file immediately to avoid potential permission problems
          file = new File([file], file.name, { type: file.type, lastModified: file.lastModified });

          availableFileList.push({ file, path });
        } catch (/** @type {any} */ ex) {
          // eslint-disable-next-line no-console
          console.error(ex);
        }
      }

      if (handle.kind === 'directory') {
        const regex = getRegEx(path);

        if (!hasMatchingPath && !scanningPaths.some((p) => regex.test(p))) {
          continue;
        }

        await iterate(handle);
      }
    }
  };

  await iterate(_rootDirHandle);

  return Promise.all(
    availableFileList.map(async ({ file, path }) => ({
      file,
      // The file path must be normalized, as certain non-ASCII characters (e.g. Japanese) can be
      // problematic particularly on macOS
      path: path.normalize(),
      size: file.size,
      sha: await (async () => {
        try {
          // Need `await` here to catch any exception
          return await getHash(file);
        } catch (/** @type {any} */ ex) {
          // eslint-disable-next-line no-console
          console.error(ex);
        }

        return '';
      })(),
    })),
  );
};

/**
 * Fetch file list and all the entry files, then cache them in the {@link allEntries} and
 * {@link allAssets} stores.
 */
const fetchFiles = async () => {
  const { entryFiles, assetFiles } = createFileList(await getAllFiles());

  // Load all entry text content
  await Promise.all(
    entryFiles.map(async (entryFile) => {
      try {
        entryFile.text = await readAsText(/** @type {File} */ (entryFile.file));
      } catch (/** @type {any} */ ex) {
        entryFile.text = '';
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    }),
  );

  const { entries, errors } = await prepareEntries(entryFiles);

  allEntries.set(entries);
  entryParseErrors.set(errors);
  allAssets.set(parseAssetFiles(assetFiles));
  dataLoaded.set(true);
};

/**
 * Save entries or assets locally.
 * @param {FileChange[]} changes - File changes to be saved.
 * @returns {Promise<(?File)[]>} - Created or updated files, if available.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemWritableFileStream/write
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/removeEntry
 */
const commitChanges = async (changes) =>
  Promise.all(
    changes.map(async ({ action, path, previousPath, data }) => {
      try {
        /** @type {FileSystemFileHandle | undefined} */
        let fileHandle;

        if (action === 'move' && previousPath) {
          const { dirname, basename } = getPathInfo(path);

          fileHandle = /** @type {FileSystemFileHandle} */ (await getHandleByPath(previousPath));

          if (dirname && dirname !== getPathInfo(previousPath).dirname) {
            await fileHandle.move(await getHandleByPath(dirname), basename);
          } else {
            await fileHandle.move(basename);
          }
        }

        if (['create', 'update', 'move'].includes(action) && data) {
          fileHandle ??= /** @type {FileSystemFileHandle} */ (await getHandleByPath(path));

          const writer = await fileHandle.createWritable();

          try {
            await writer.write(data);
          } catch {
            // Can throw if the file has just been moved/renamed without any change, and then the
            // `data` is no longer available
          } finally {
            await writer.close();
          }

          return fileHandle.getFile();
        }

        if (action === 'delete') {
          const { dirname, basename: fileName } = getPathInfo(stripSlashes(path));
          const dirPath = /** @type {string} */ (dirname);
          const dirPathArray = dirPath.split('/');
          let dirHandle = /** @type {FileSystemDirectoryHandle} */ (await getHandleByPath(dirPath));

          await dirHandle.removeEntry(fileName);

          // Delete an empty enclosing folder recursively
          for (;;) {
            /** @type {string[]} */
            const keys = [];

            for await (const key of dirHandle.keys()) {
              keys.push(key);
            }

            if (keys.length > 1 || !dirPathArray.length) {
              break;
            }

            const dirName = /** @type {string} */ (dirPathArray.pop());

            // Get the parent directory handle
            dirHandle = /** @type {FileSystemDirectoryHandle} */ (
              await getHandleByPath(dirPathArray.join('/'))
            );
            dirHandle.removeEntry(dirName);
          }
        }
      } catch (/** @type {any} */ ex) {
        // eslint-disable-next-line no-console
        console.error(ex);
      }

      return null;
    }),
  );

/**
 * @type {BackendService}
 */
export default {
  name: backendName,
  label,
  repository,
  init,
  signIn,
  signOut,
  fetchFiles,
  commitChanges,
};
