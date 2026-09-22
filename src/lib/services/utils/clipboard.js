import { isTextFileType } from '@sveltia/utils/file';

import { SUPPORTED_IMAGE_TYPES } from '$lib/services/utils/media/image';
import { transformImage } from '$lib/services/utils/media/image/transform';

/**
 * Check if the data of a file of the given type can be copied to clipboard. Browsers typically
 * support only plaintext and PNG image, so the file has to be plaintext or an image that can be
 * converted to PNG, and the `write()` method used for an image has to be available.
 * @param {string} type MIME type.
 * @returns {boolean} Result.
 */
export const canCopyFileData = (type) => {
  if (isTextFileType(type)) {
    return true;
  }

  if (SUPPORTED_IMAGE_TYPES.includes(type)) {
    return typeof navigator.clipboard.write === 'function';
  }

  return false;
};

/**
 * Copy the file data to clipboard. Given that browsers typically support only plaintext and PNG
 * image, convert the file if necessary.
 * @param {Blob} blob File.
 * @throws {Error} If the file is neither plaintext nor a supported image.
 */
export const copyFileData = async (blob) => {
  const { type } = blob;

  if (isTextFileType(type)) {
    await navigator.clipboard.writeText(await blob.text());

    return;
  }

  if (!SUPPORTED_IMAGE_TYPES.includes(type)) {
    throw new Error('Unsupported type');
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      'image/png': type === 'image/png' ? blob : await transformImage(blob),
    }),
  ]);
};
