import { stripSlashes } from '@sveltia/utils/string';

import { allAssetFolders } from '$lib/services/assets/folders';
import { allEntryFolders } from '$lib/services/contents';

/**
 * The parts of the repository the CMS manages: the folders holding entries and assets, and the
 * files of file collections. Paths are relative to the configured root directory.
 * @typedef {object} ManagedPaths
 * @property {string[]} dirs Folders to list recursively. None of them is inside another.
 * @property {string[]} files Files outside those folders.
 */

/**
 * Get the part of the given path before its first template tag, such as `{{locale}}`, which is
 * the folder all the paths it stands for share.
 * @param {string} path Path, possibly with template tags.
 * @returns {string} Static part of the path, without a trailing slash. Empty if the path starts
 * with a tag.
 */
const getStaticPrefix = (path) => {
  const segments = path.split('/');
  const index = segments.findIndex((segment) => segment.includes('{{'));

  return (index === -1 ? segments : segments.slice(0, index)).join('/');
};

/**
 * Check whether the given path is the given folder or inside it.
 * @param {string} path Path.
 * @param {string} dir Folder path.
 * @returns {boolean} Result.
 */
const isWithin = (path, dir) => path === dir || path.startsWith(`${dir}/`);

/**
 * Work out which parts of the repository hold what the CMS manages, so a backend that lists files
 * a page at a time can list just those rather than the whole repository. Everything else, such as
 * the site’s templates, source code or dependencies, is left out of the file list anyway. This is
 * what the local backend scans as well.
 * @returns {ManagedPaths | undefined} Folders and files to list, or `undefined` if one of the
 * folders is the root directory itself, in which case the whole of it has to be listed.
 */
export const getManagedPaths = () => {
  /** @type {string[]} */
  const dirPaths = [];
  /** @type {string[]} */
  const filePaths = [];

  allEntryFolders.current.forEach(({ filePathMap, folderPathMap }) => {
    if (filePathMap) {
      Object.values(filePathMap).forEach((path) => {
        // A file path with a template tag left in it stands for files in more than one folder
        (path.includes('{{') ? dirPaths : filePaths).push(path);
      });
    } else {
      dirPaths.push(...Object.values(folderPathMap ?? {}));
    }
  });

  allAssetFolders.current.forEach(({ internalPath }) => {
    // The All Assets folder has no path of its own
    if (internalPath !== undefined) {
      dirPaths.push(internalPath);
    }
  });

  const prefixes = dirPaths.map((path) => getStaticPrefix(stripSlashes(path)));

  if (prefixes.some((prefix) => !prefix)) {
    return undefined;
  }

  const dirs = [...new Set(prefixes)]
    // A folder outside the root directory isn’t listed, as its files are dropped from the list
    .filter((prefix) => !prefix.startsWith('../'))
    .sort()
    // Sorted, a folder comes right before the ones inside it, which are listed along with it
    .filter((prefix, index, list) => !list.slice(0, index).some((dir) => isWithin(prefix, dir)));

  const files = [...new Set(filePaths.map((path) => stripSlashes(path)))].filter(
    (path) => !path.startsWith('../') && !dirs.some((dir) => isWithin(path, dir)),
  );

  return { dirs, files };
};
