import { getPathInfo } from '@sveltia/utils/file';

import { slugify } from '$lib/services/common/slug';
import { renameIfNeeded, sanitizeFileName } from '$lib/services/utils/file';

/**
 * Format the file name for uploading, ensuring it is sanitized and optionally slugified. A leading
 * dot is dropped like the characters a file system won’t take, as a dot file is hidden: the CMS
 * doesn’t list one, so the file would be lost from sight once uploaded.
 * @param {string} originalName The original file name.
 * @param {object} [options] Options.
 * @param {boolean} [options.slugificationEnabled] Whether to slugify the file name.
 * @param {string[]} [options.assetNamesInSameFolder] List of asset names in the same folder to
 * avoid name conflicts.
 * @returns {string} The formatted file name, sanitized and possibly slugified.
 */
export const formatFileName = (
  originalName,
  { slugificationEnabled = false, assetNamesInSameFolder = [] } = {},
) => {
  let fileName = sanitizeFileName(originalName).replace(/^\.+/, '');

  if (slugificationEnabled) {
    const { filename, extension } = getPathInfo(fileName);
    const slug = slugify(filename);

    // Lowercase the extension to match the slug’s lowercase behavior, ensuring consistent file
    // references (e.g., `.JPG` → `.jpg`, `.MOV` → `.mov`)
    fileName = `${slug}${extension ? `.${extension.toLowerCase()}` : ''}`;
  }

  return renameIfNeeded(fileName, assetNamesInSameFolder);
};

/**
 * Check whether two file names refer to the same file once formatted for uploading. The comparison
 * ignores case, as files whose names only differ in case clash on a case-insensitive file system.
 * @param {string} name1 File name.
 * @param {string} name2 Another file name.
 * @returns {boolean} Result.
 */
export const isSameFileName = (name1, name2) =>
  formatFileName(name1).normalize().toLowerCase() ===
  formatFileName(name2).normalize().toLowerCase();

/**
 * Check whether an asset can be renamed to the given name.
 * @param {object} args Arguments.
 * @param {string} args.name Name as typed, trimmed.
 * @param {string} args.fileName Name the file will be given, which is `name` formatted with
 * {@link formatFileName}.
 * @param {string[]} args.otherNames Names of the other files in the same folder.
 * @param {string[]} [args.folderNames] Names of the subfolders in the same folder. A Git tree can’t
 * hold a file and a folder under one name.
 * @returns {'empty' | 'character' | 'leading_dot' | 'duplicate' | 'folder_duplicate' | undefined}
 * What stops the name from being used, or `undefined` if it can be used.
 */
export const validateAssetName = ({ name, fileName, otherNames, folderNames = [] }) => {
  if (!name) {
    return 'empty';
  }

  // Sanitization can leave nothing to name the file with
  if (name.includes('/') || !fileName) {
    return 'character';
  }

  // A dot file is hidden, so the CMS wouldn’t list the asset any more
  if (name.startsWith('.')) {
    return 'leading_dot';
  }

  // Case-insensitive, since `Photo.jpg` and `photo.jpg` clash on a case-insensitive file system
  // like macOS’s or Windows’s, and Unicode-normalized, as a name can be typed either way
  const normalizedName = fileName.normalize().toLowerCase();
  /**
   * Check if the name is taken.
   * @param {string[]} names Names to check against.
   * @returns {boolean} Result.
   */
  const isTaken = (names) => names.some((n) => n.normalize().toLowerCase() === normalizedName);

  if (isTaken(otherNames)) {
    return 'duplicate';
  }

  if (isTaken(folderNames)) {
    return 'folder_duplicate';
  }

  return undefined;
};
