import { getPathInfo } from '@sveltia/utils/file';
import { compare } from '@sveltia/utils/string';

import { allAssetFolders, selectedAssetFolder } from '$lib/services/assets/folders';
import { gitConfigFiles } from '$lib/services/backends/git/shared/config';
import { slugify } from '$lib/services/common/slug';
import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';
import { createPath, sanitizeFileName } from '$lib/services/utils/file';
import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { Asset, AssetFolderInfo, AssetSubfolder, UploadingAssets } from '$lib/types/private';
 */

/**
 * Path of the subfolder being browsed below the selected asset folder’s `internalPath`, relative to
 * it. Empty at the folder root, and always empty for a folder that can’t be browsed by subfolder.
 * @type {{ current: string }}
 */
export const selectedSubfolderPath = createRawState('');

/**
 * Subfolder currently focused in the Asset Library, whose info is shown in the sidebar, if any.
 * @type {{ current: AssetSubfolder | undefined }}
 */
export const focusedSubfolder = createRawState();

/**
 * Subfolder being renamed with the Rename Folder dialog, if any.
 * @type {{ current: AssetSubfolder | undefined }}
 */
export const renamingSubfolder = createRawState();

/**
 * Subfolder being deleted with the Delete Folder dialog, if any.
 * @type {{ current: AssetSubfolder | undefined }}
 */
export const deletingSubfolder = createRawState();

/**
 * Get the directory part of a file path. Unlike `getPathInfo()`, which has no directory for a file
 * at the root, this is always a string, so a root file’s directory compares equal to the root path.
 * @param {string} path File path.
 * @returns {string} Directory path, which is an empty string for a file at the root.
 */
export const getDirName = (path) => getPathInfo(path).dirname ?? '';

/**
 * Check if the given asset folder can be browsed by subfolder, which takes a folder whose files all
 * sit below one fixed path: an entry-relative folder is scattered across the entry folders, and a
 * folder with template tags is only resolved per entry, so neither has a single tree to walk. The
 * All Assets folder has no path at all. The assets of such a folder are all listed at once.
 * @param {AssetFolderInfo | undefined} folder Asset folder.
 * @returns {folder is AssetFolderInfo} Result.
 */
export const canBrowseSubfolders = (folder) =>
  !!folder && folder.internalPath !== undefined && !folder.entryRelative && !folder.hasTemplateTags;

/**
 * Get the path of a file or directory relative to a base directory.
 * @param {string} path Path, e.g. `static/images/2024/photo.jpg`.
 * @param {string} basePath Base directory path, e.g. `static/images`. An empty string for the
 * repository root, below which every path sits as is.
 * @returns {string} Relative path, e.g. `2024/photo.jpg`. An empty string if the path is the base
 * directory itself or isn’t below it.
 */
export const getRelativePath = (path, basePath) => {
  if (basePath === '') {
    return path;
  }

  return path.startsWith(`${basePath}/`) ? path.slice(basePath.length + 1) : '';
};

/**
 * Get the path of the subfolder that a URL path points at, relative to the given asset folder.
 * @param {AssetFolderInfo} folder Asset folder.
 * @param {string} folderPath Folder path taken from the URL, e.g. `static/images/2024`.
 * @returns {string} Subfolder path, e.g. `2024`. An empty string for the folder root, or when the
 * folder can’t be browsed by subfolder.
 */
export const getSubfolderPath = (folder, folderPath) =>
  canBrowseSubfolders(folder)
    ? // `internalPath` is always a string for a folder that can be browsed
      getRelativePath(folderPath, /** @type {string} */ (folder.internalPath))
    : '';

/**
 * Find the asset folder that a URL path points at, along with the subfolder browsed below it.
 * @param {string} folderPath Folder path taken from the URL, e.g. `static/images/2024` or `-/all`.
 * @param {AssetFolderInfo} [knownFolder] Folder carried as history state. An internal path can be
 * shared by several folders, and the state settles which one is meant, so it takes precedence over
 * the lookup by path.
 * @returns {{ folder: AssetFolderInfo, subfolderPath: string } | undefined} Folder and subfolder
 * path, or `undefined` if the path doesn’t point at a configured folder or any subfolder of one.
 */
export const resolveAssetFolderPath = (folderPath, knownFolder = undefined) => {
  if (knownFolder) {
    return { folder: knownFolder, subfolderPath: getSubfolderPath(knownFolder, folderPath) };
  }

  const folders = allAssetFolders.current;

  const exactMatch = folders.find(({ internalPath, collectionName }) =>
    folderPath === '-/all'
      ? internalPath === undefined && collectionName === undefined
      : internalPath === folderPath,
  );

  if (exactMatch) {
    return { folder: exactMatch, subfolderPath: '' };
  }

  // The path can point below a folder. The deepest folder wins, so that a folder nested in another
  // gets its own subfolders rather than having them listed as the outer folder’s
  const parentFolder = folders
    .filter(
      (folder) =>
        canBrowseSubfolders(folder) &&
        (folder.internalPath === '' || folderPath.startsWith(`${folder.internalPath}/`)),
    )
    .sort(
      (a, b) =>
        /** @type {string} */ (b.internalPath).length -
        /** @type {string} */ (a.internalPath).length,
    )[0];

  return parentFolder
    ? { folder: parentFolder, subfolderPath: getSubfolderPath(parentFolder, folderPath) }
    : undefined;
};

/**
 * Path of the directory being browsed in the Asset Library, e.g. `static/images/2024`, which is
 * the selected asset folder’s `internalPath` joined with {@link selectedSubfolderPath}. It’s
 * `undefined` when the selected folder can’t be browsed by subfolder, in which case every asset
 * below the folder is listed at once.
 */
export const browsedDirPath = createDerivedState(() => {
  const folder = selectedAssetFolder.current;

  return canBrowseSubfolders(folder)
    ? createPath([folder.internalPath, selectedSubfolderPath.current])
    : undefined;
});

/**
 * Get the `internalPath` of the asset folder that a directory belongs to: the folder at that path,
 * or else the deepest one it sits below.
 * @param {string} dirPath Directory path.
 * @returns {string | undefined} Folder path, or `undefined` if the directory is outside every
 * folder.
 */
const getOwnerFolderPath = (dirPath) => resolveAssetFolderPath(dirPath)?.folder.internalPath;

/**
 * List the immediate subfolders of a directory. A folder isn’t an object of its own in a Git
 * repository, so the subfolders are read off the paths of the files below the directory: the assets
 * and, for a folder that holds no asset yet, the `.gitkeep` and other Git config files that keep
 * it in the repository.
 * @param {object} args Arguments.
 * @param {string} args.dirPath Directory path. An empty string for the repository root.
 * @param {Asset[]} args.assets Assets below the directory, at any depth. These are the assets of
 * the folder the directory belongs to, which leaves out the assets of another asset folder nested
 * in it, as those are that folder’s to list.
 * @returns {AssetSubfolder[]} Subfolders, sorted by name.
 */
export const getSubfolders = ({ dirPath, assets }) => {
  const prefix = dirPath ? `${dirPath}/` : '';
  /** @type {Set<string>} */
  const names = new Set();
  // A Git config file counts the same way as an asset: only when it belongs to the same asset
  // folder as the directory, so a nested asset folder isn’t listed for the `.gitkeep` it holds
  const ownerFolderPath = getOwnerFolderPath(dirPath);

  const configFiles = gitConfigFiles.current.filter(
    ({ path }) => getOwnerFolderPath(getDirName(path)) === ownerFolderPath,
  );

  [...assets, ...configFiles].forEach(({ path }) => {
    if (!path.startsWith(prefix)) {
      return;
    }

    const index = path.indexOf('/', prefix.length);

    if (index > prefix.length) {
      names.add(path.slice(prefix.length, index));
    }
  });

  return [...names].sort(compare).map((name) => ({ name, path: createPath([dirPath, name]) }));
};

/**
 * Get the path of the directory that uploaded files are saved to, which is the target folder’s
 * `internalPath` joined with the subfolder path, if any.
 * @param {UploadingAssets} uploadingAssets Files to be uploaded and their target folder.
 * @returns {string | undefined} Directory path, or `undefined` if the target folder has no path,
 * which is the case for the All Assets folder.
 */
export const getUploadDirPath = ({ folder, subfolderPath }) =>
  folder?.internalPath !== undefined ? createPath([folder.internalPath, subfolderPath]) : undefined;

/**
 * Format a new subfolder name the way an uploaded file name is: sanitized, and slugified when the
 * `slugify_filename` option is enabled, so a folder created by hand is named like the files that
 * will be saved in it.
 * @param {string} name Name as typed.
 * @returns {string} Folder name. An empty string if nothing usable is left.
 */
export const formatSubfolderName = (name) => {
  const { slugify_filename: slugificationEnabled } = getDefaultMediaLibraryOptions().config;
  const folderName = sanitizeFileName(name.trim());

  // The whole name is slugified: unlike a file name, a folder name has no extension to keep, so a
  // dot in it is just another character
  return slugificationEnabled ? slugify(folderName, { fallback: false }) : folderName;
};

/**
 * Check whether a subfolder can be given the name typed in the New Folder dialog.
 * @param {object} args Arguments.
 * @param {string} args.name Name to check, as typed.
 * @param {string[]} args.takenNames Names of the files and folders already in the parent
 * directory. A Git tree can’t hold a blob and a subtree under one name, so a file name is taken as
 * well.
 * @returns {'empty' | 'invalid' | 'duplicate' | undefined} What stops the name from being used, or
 * `undefined` if it can be used.
 */
export const validateSubfolderName = ({ name, takenNames }) => {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return 'empty';
  }

  const folderName = formatSubfolderName(trimmedName);

  // A name has to stay a single folder, a leading dot would hide the folder from most file
  // listings, and sanitization can leave nothing to name the folder with
  if (!folderName || trimmedName.includes('/') || folderName.startsWith('.')) {
    return 'invalid';
  }

  const normalizedName = folderName.normalize().toLowerCase();

  return takenNames.some((taken) => taken.normalize().toLowerCase() === normalizedName)
    ? 'duplicate'
    : undefined;
};
