/* eslint-disable no-continue */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */

import { getHash } from '@sveltia/utils/crypto';
import { readAsText } from '@sveltia/utils/file';
import { IndexedDB } from '@sveltia/utils/storage';
import { escapeRegExp, stripSlashes } from '@sveltia/utils/string';
import { get, writable } from 'svelte/store';
import { allAssetFolders, allAssets } from '$lib/services/assets';
import { allBackendServices } from '$lib/services/backends';
import { repositoryProps } from '$lib/services/backends/shared/data';
import { siteConfig } from '$lib/services/config';
import { allEntries, allEntryFolders, dataLoaded } from '$lib/services/contents';
import { createFileList, parseAssetFiles, parseEntryFiles } from '$lib/services/parser';

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
 * @type {IndexedDB}
 */
let rootDirHandleDB;

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
   * @type {FileSystemDirectoryHandle & { requestPermission: Function, entries: Function } | null}
   */
  let handle = forceReload ? null : (await rootDirHandleDB.get(rootDirHandleKey)) ?? null;

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
      await rootDirHandleDB.set(rootDirHandleKey, handle);
    }
  }

  return /** @type {FileSystemDirectoryHandle | null} */ (handle);
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
  const { name: service, repo: projectPath } = /** @type {SiteConfig} */ (get(siteConfig)).backend;

  remoteRepository = allBackendServices[service]?.getRepositoryInfo?.();
  rootDirHandleDB = new IndexedDB(`${service}:${projectPath}`, 'file-system-handles');
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
  const pathParts = stripSlashes(path).split('/');
  const create = true;
  let handle = /** @type {FileSystemFileHandle | FileSystemDirectoryHandle} */ (get(rootDirHandle));

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
    ...get(allEntryFolders).map(({ filePath, folderPath }) => filePath || folderPath),
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
      const hasMatchingPath = scanningPathsRegEx.some((re) => path.match(re));

      if (handle.kind === 'file') {
        if (!hasMatchingPath) {
          continue;
        }

        try {
          availableFileList.push({ file: await handle.getFile(), path });
        } catch (/** @type {any} */ ex) {
          // eslint-disable-next-line no-console
          console.error(ex);
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

  return Promise.all(
    availableFileList.map(async ({ file, path }) => {
      const { name, size } = file;
      const [sha, text] = await Promise.all([
        getHash(file),
        name.match(/\.(?:json|markdown|md|toml|ya?ml)$/i) ? readAsText(file) : undefined,
      ]);

      // Both the file path and name should be normalized, as certain non-ASCII (Japanese)
      // characters can be problematic particularly on macOS
      return {
        file,
        path: path.normalize(),
        name: name.normalize(),
        sha,
        size,
        text,
      };
    }),
  );
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
 * @param {FileChange[]} changes - File changes to be saved.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemWritableFileStream/write
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/removeEntry
 */
const commitChanges = async (changes) => {
  await Promise.all(
    changes.map(async ({ action, path, data }) => {
      try {
        if (['create', 'update'].includes(action) && data) {
          const handle = /** @type {FileSystemFileHandle} */ (await getHandleByPath(path));
          const writer = await handle.createWritable();

          await writer.write(data);
          await writer.close();
        }

        if (action === 'delete') {
          const [, dirPath, fileName] = stripSlashes(path).match(/(.+)\/([^/]+)$/) ?? [];
          const handle = /** @type {FileSystemDirectoryHandle} */ (await getHandleByPath(dirPath));

          await handle.removeEntry(fileName);
        }
      } catch (/** @type {any} */ ex) {
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    }),
  );
};

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
