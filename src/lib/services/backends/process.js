import { getAssetFoldersByPath } from '$lib/services/assets/folders';
import { GIT_CONFIG_FILE_REGEX } from '$lib/services/backends/config';
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
      const [assetFolder] = getAssetFoldersByPath(path);

      // Correct entry files
      if (entryFolder) {
        entryFiles.push({ ...fileInfo, type: 'entry', folder: entryFolder });
      }

      // Correct asset files while excluding files already listed as entries. These files can appear
      // in the file list when a relative media path is configured for a collection. Also exclude
      // Hugo’s special index files.
      if (assetFolder && !entryFiles.find((e) => e.path === path) && !isIndexFile(path)) {
        assetFiles.push({ ...fileInfo, type: 'asset', folder: assetFolder });
      }
    }
  });

  const allFiles = [...entryFiles, ...assetFiles, ...configFiles];

  return { entryFiles, assetFiles, configFiles, allFiles, count: allFiles.length };
};
