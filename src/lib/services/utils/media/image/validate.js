import { RASTER_IMAGE_TYPES } from '$lib/services/utils/media/image';
import { sniffRasterImageFormat } from '$lib/services/utils/media/image/sniff';

/**
 * Check whether the given file is a usable raster image. Only the formats every target browser is
 * expected to decode are checked, so a file the browser simply lacks a decoder for — a TIFF image,
 * a real HEIC image or a video with an unsupported codec — is never reported as corrupt.
 *
 * A file that declares one of the checked formats but fails to decode is either corrupt or
 * mislabeled, the most common case being a HEIC photo saved with a `.jpg` extension. Uploading it
 * would put a broken asset in the repository, so it’s rejected up front — unless HEIC conversion is
 * configured, in which case the photo is decoded by a library while it’s converted, which is where
 * a failure is reported.
 * @param {File} file File to be checked.
 * @param {object} [options] Options.
 * @param {boolean} [options.convertHEIC] Whether HEIC images are converted on upload.
 * @returns {Promise<boolean>} Whether the file is usable. `true` for any file that isn’t checked.
 */
export const isValidImage = async (file, { convertHEIC = false } = {}) => {
  if (!(/** @type {string[]} */ (RASTER_IMAGE_TYPES).includes(file.type))) {
    return true;
  }

  // Sniff the content: only Safari decodes HEIC natively, so `createImageBitmap()` below would
  // reject a perfectly good photo that’s going to be converted
  if ((await sniffRasterImageFormat(file)) === 'heic') {
    return convertHEIC;
  }

  try {
    // `createImageBitmap()` decodes the actual bytes rather than trusting the file’s type, and it
    // does so off the main thread. It’s already used for image transformation.
    (await createImageBitmap(file)).close();

    return true;
  } catch {
    return false;
  }
};
