import { getAssetFoldersByPath } from '$lib/services/assets/folders';
import { GIT_CONFIG_FILE_REGEX } from '$lib/services/backends/git/shared/config';
import { getEntryFoldersByPath } from '$lib/services/contents';
import { isIndexFile } from '$lib/services/contents/file/process';

/**
 * @import {
 * BaseAssetListItem,
 * BaseConfigListItem,
 * BaseEntryListItem,
 * BaseFileList,
 * BaseFileListItemProps,
 * } from '$lib/types/private';
 */

/**
 * Parse a list of all files on the repository/filesystem to create entry and asset lists, with the
 * relevant collection/file configuration added.
 * @param {BaseFileListItemProps[]} files Unfiltered file list.
 * @returns {BaseFileList} File list, including both entries and assets.
 */
export const createFileList = (files) => {
  /** @type {BaseEntryListItem[]} */
  const entryFiles = [];
  /** @type {BaseAssetListItem[]} */
  const assetFiles = [];
  /** @type {BaseConfigListItem[]} */
  const configFiles = [];
  /**
   * Paths already listed as entries. This runs over every file in the repository, so membership
   * needs to be O(1); scanning `entryFiles` per file would make the initial load O(files²).
   * @type {Set<string>}
   */
  const entryPaths = new Set();

  files.forEach((fileInfo) => {
    const { path, name } = fileInfo;

    if (name.startsWith('.')) {
      // Correct Git config files that we need, such as `.gitattributes` and `.gitkeep`, to enable
      // some features like Git LFS tracking and assets folder creation
      if (GIT_CONFIG_FILE_REGEX.test(name)) {
        configFiles.push({ ...fileInfo, type: 'config' });
      }
    } else {
      const [entryFolder] = getEntryFoldersByPath(path);

      // Correct entry files
      if (entryFolder) {
        entryFiles.push({ ...fileInfo, type: 'entry', folder: entryFolder });
        entryPaths.add(path);

        return;
      }

      // Correct asset files while excluding files already listed as entries. These files can appear
      // in the file list when a relative media path is configured for a collection. Also exclude
      // Hugo’s special index files. The asset folder is only looked up once the file is known not
      // to be an entry, as the lookup tests the path against every asset folder
      if (entryPaths.has(path) || isIndexFile(path)) {
        return;
      }

      const [assetFolder] = getAssetFoldersByPath(path);

      if (assetFolder) {
        assetFiles.push({ ...fileInfo, type: 'asset', folder: assetFolder });
      }
    }
  });

  const allFiles = [...entryFiles, ...assetFiles, ...configFiles];

  return { entryFiles, assetFiles, configFiles, allFiles, count: allFiles.length };
};

/**
 * Describe a file list for a debug message, e.g. `10 entry files, 2 asset files, 1 config files`.
 * @param {Pick<BaseFileList, 'entryFiles' | 'assetFiles' | 'configFiles'>} fileList File list.
 * @returns {string} Description.
 */
export const describeFileList = ({ entryFiles, assetFiles, configFiles }) =>
  `${entryFiles.length} entry files, ${assetFiles.length} asset files, ` +
  `${configFiles.length} config files`;
