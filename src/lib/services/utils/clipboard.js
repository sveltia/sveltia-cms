import { isTextFileType } from '@sveltia/utils/file';
import mime from 'mime';

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
 * Check if the data of the given file can be copied to clipboard, going by its name, for a file
 * that hasn’t been fetched yet. See {@link canCopyFileData}.
 * @param {string} fileName File name.
 * @param {object} [options] Options.
 * @param {boolean} [options.isImage] Whether the file is known to be an image, e.g. as a cloud
 * service says so. Such a file is taken as copyable when its name has no extension to tell the
 * type by, as the image is most likely in a common format.
 * @returns {boolean} Result.
 */
export const canCopyFileDataByName = (fileName, { isImage = false } = {}) => {
  const type = mime.getType(fileName);

  return type ? canCopyFileData(type) : isImage;
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
