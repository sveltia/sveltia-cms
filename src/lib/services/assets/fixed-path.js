/**
 * @import { AssetFolderInfo } from '$lib/types/private';
 */

/**
 * Check if all the files of an asset folder sit below one fixed path. An entry-relative folder is
 * scattered across the entry folders, and a folder with template tags is only resolved per entry,
 * so neither has one. The All Assets folder has no path at all. Only a folder with a fixed path has
 * a single tree to browse by subfolder; the assets of any other folder are all listed at once.
 * @param {AssetFolderInfo | undefined} folder Asset folder.
 * @returns {folder is AssetFolderInfo} Result.
 */
export const hasFixedPath = (folder) =>
  !!folder && folder.internalPath !== undefined && !folder.entryRelative && !folder.hasTemplateTags;
