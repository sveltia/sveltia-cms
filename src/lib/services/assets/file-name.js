import { getPathInfo } from '@sveltia/utils/file';

import { slugify } from '$lib/services/common/slug';
import { renameIfNeeded, sanitizeFileName } from '$lib/services/utils/file';

/**
 * Format the file name for uploading, ensuring it is sanitized and optionally slugified.
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
  let fileName = sanitizeFileName(originalName);

  if (slugificationEnabled) {
    const { filename, extension } = getPathInfo(fileName);
    const slug = slugify(filename);

    // Lowercase the extension to match the slug’s lowercase behavior, ensuring consistent file
    // references (e.g., `.JPG` → `.jpg`, `.MOV` → `.mov`)
    fileName = `${slug}${extension ? `.${extension.toLowerCase()}` : ''}`;
  }

  return renameIfNeeded(fileName, assetNamesInSameFolder);
};
