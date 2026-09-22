import { getPathInfo } from '@sveltia/utils/file';

import { publishedAssets } from '$lib/services/assets';
import { assetUpdatesToast } from '$lib/services/assets/data';
import { deleteAssets } from '$lib/services/assets/data/delete';
import { moveAssets } from '$lib/services/assets/data/move';
import { focusedSubfolder } from '$lib/services/assets/subfolders';
import { gitConfigFiles } from '$lib/services/backends/git/shared/config';
import { saveChanges } from '$lib/services/backends/save';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';

/**
 * @import { Asset, BaseConfigListItem, FileChange } from '$lib/types/private';
 */

/**
 * Name of the placeholder file that keeps an otherwise empty folder in a Git repository, which has
 * no way to store a folder on its own.
 */
export const GITKEEP_FILE_NAME = '.gitkeep';

/**
 * Get the assets below a folder, at any depth. These are what a rename moves along and a deletion
 * removes, and what the deletion dialog checks the entries for.
 * @param {string} dirPath Folder path, e.g. `static/images/2024`.
 * @returns {Asset[]} Assets.
 */
export const getSubfolderAssets = (dirPath) =>
  publishedAssets.current.filter(({ path }) => path.startsWith(`${dirPath}/`));

/**
 * Get the Git config files below a folder, at any depth: the `.gitkeep` files that keep the empty
 * folders, and the odd `.gitignore`. Not being assets, these have to be moved and deleted along
 * with the folder separately.
 * @param {string} dirPath Folder path.
 * @returns {BaseConfigListItem[]} Files.
 */
const getSubfolderConfigFiles = (dirPath) =>
  gitConfigFiles.current.filter(({ path }) => path.startsWith(`${dirPath}/`));

/**
 * Create a subfolder in an asset folder by committing a `.gitkeep` file to it. The file is added to
 * the Git config file list once committed, which is what the Asset Library lists an empty folder
 * from, so the folder shows up without a reload.
 * @param {string} dirPath Path of the new folder, e.g. `static/images/2024`.
 * @throws {Error} When the commit fails.
 */
export const createSubfolder = async (dirPath) => {
  const path = `${dirPath}/${GITKEEP_FILE_NAME}`;

  const { commit } = await saveChanges({
    // An empty `File` rather than an empty string: the local backend takes a falsy `data` for a
    // file that needs no writing
    changes: [{ action: 'create', path, data: new File([], GITKEEP_FILE_NAME) }],
    options: { commitType: 'uploadMedia' },
  });

  /** @type {BaseConfigListItem} */
  const configFile = {
    type: 'config',
    path,
    name: GITKEEP_FILE_NAME,
    sha: commit.files[path]?.sha ?? '',
    size: 0,
    text: '',
  };

  gitConfigFiles.current = [...gitConfigFiles.current, configFile];
  assetUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, folderCreated: true };
};

/**
 * Rename a subfolder of an asset folder, which moves everything below it — the assets, whose
 * references in the entries are updated along, and the Git config files — in one commit.
 * @param {object} args Arguments.
 * @param {string} args.dirPath Current folder path, e.g. `static/images/2024`.
 * @param {string} args.newDirPath New folder path, e.g. `static/images/2025`.
 * @throws {Error} When the commit fails.
 */
export const renameSubfolder = async ({ dirPath, newDirPath }) => {
  const configFiles = getSubfolderConfigFiles(dirPath);
  /**
   * Get the path of a file once the folder has been renamed.
   * @param {string} path Current path.
   * @returns {string} New path.
   */
  const rebase = (path) => `${newDirPath}${path.slice(dirPath.length)}`;

  await moveAssets(
    'move',
    getSubfolderAssets(dirPath).map((asset) => ({ asset, path: rebase(asset.path) })),
    {
      extraChanges: configFiles.map(
        ({ path, sha, name, text }) =>
          /** @type {FileChange} */ ({
            action: 'move',
            path: rebase(path),
            previousPath: path,
            previousSha: sha,
            data: new File([text ?? ''], name),
          }),
      ),
      notify: false,
    },
  );

  gitConfigFiles.current = gitConfigFiles.current.map((file) =>
    configFiles.includes(file) ? { ...file, path: rebase(file.path) } : file,
  );

  // Keep the sidebar on the folder under its new name
  if (focusedSubfolder.current?.path === dirPath) {
    focusedSubfolder.current = { name: getPathInfo(newDirPath).basename, path: newDirPath };
  }

  assetUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, folderRenamed: true };
};

/**
 * Delete a subfolder of an asset folder along with everything below it: the assets, whose
 * references are removed from the entries, and the Git config files, all in one commit.
 * @param {string} dirPath Folder path, e.g. `static/images/2024`.
 * @throws {Error} When the commit fails, or when removing an asset reference would leave an entry
 * invalid. The dialog checks the latter before the deletion is confirmed.
 */
export const deleteSubfolder = async (dirPath) => {
  const configFiles = getSubfolderConfigFiles(dirPath);

  await deleteAssets(getSubfolderAssets(dirPath), {
    extraChanges: configFiles.map(
      ({ path, sha }) => /** @type {FileChange} */ ({ action: 'delete', path, previousSha: sha }),
    ),
    notify: false,
  });

  gitConfigFiles.current = gitConfigFiles.current.filter((file) => !configFiles.includes(file));

  // The sidebar has nothing to describe once the folder is gone
  if (focusedSubfolder.current?.path === dirPath) {
    focusedSubfolder.current = undefined;
  }

  assetUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, folderDeleted: true };
};
