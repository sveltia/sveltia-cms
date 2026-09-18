import { hasCachedThumbnail } from '$lib/services/assets/info';
import { canConvertHEIC, transformFile } from '$lib/services/integrations/media-libraries/default';
import { formatFileName, getGitHash } from '$lib/services/utils/file';
import { RASTER_IMAGE_TYPES } from '$lib/services/utils/media/image';
import { sniffRasterImageFormat } from '$lib/services/utils/media/image/sniff';
import { isValidImage } from '$lib/services/utils/media/image/validate';

/**
 * @import { SharedMediaLibraryOptions } from '$lib/types/public';
 */

/**
 * @typedef {object} ProcessFileResult
 * @property {File} file Processed file.
 * @property {File | undefined} originalFile Pre-transformation file if a transformation was
 * applied.
 * @property {boolean} oversized Whether the file exceeds the maximum allowed size.
 * @property {boolean} invalid Whether the file is corrupt or mislabeled and therefore cannot be
 * uploaded.
 */

/**
 * Check whether the given file is a usable image, without decoding it again if it has been decoded
 * already: a thumbnail cached for the same content, e.g. because the file was shown in the asset
 * selection dialog, is proof enough. Decoding a large photo takes a good fraction of a second, and
 * it’s done on every file in a batch at once.
 * @param {File} file File to be checked.
 * @param {boolean} convertHEIC Whether HEIC images are converted on upload.
 * @returns {Promise<boolean>} Whether the file is usable. `true` for any file that isn’t checked.
 * @see isValidImage
 */
const isUsableImage = async (file, convertHEIC) => {
  // Only the formats `isValidImage()` decodes are worth looking up: hashing the file means reading
  // it in full, which a video or an archive on its way to a cloud service would never be otherwise
  if (!(/** @type {string[]} */ (RASTER_IMAGE_TYPES).includes(file.type))) {
    return true;
  }

  // A thumbnail proves a HEIC photo could be decoded by the library, not that it can be uploaded,
  // which depends on the configuration
  if ((await sniffRasterImageFormat(file)) !== 'heic') {
    try {
      if (await hasCachedThumbnail(await getGitHash(file))) {
        return true;
      }
    } catch {
      // The file couldn’t be read or the cache couldn’t be queried; either way the decoding check
      // below gives the answer, and a file that can’t be read is reported as invalid rather than
      // failing the whole batch
    }
  }

  return isValidImage(file, { convertHEIC });
};

/**
 * Process a file by applying slugification, transformation, and validation.
 * @param {File} file File to process.
 * @param {SharedMediaLibraryOptions} [options] Processing options.
 * @returns {Promise<ProcessFileResult>} Result of processing the file. An invalid file is returned
 * as is, because there’s nothing to transform and it won’t be uploaded anyway.
 */
export const processFile = async (
  file,
  {
    slugify_filename: slugifyFilename = false,
    transformations,
    max_file_size: maxFileSize = Infinity,
  } = {},
) => {
  // Check the original file object, whose hash is likely memoized already; a renamed copy would
  // have to be read again to be hashed
  const usable = await isUsableImage(file, canConvertHEIC(transformations));

  if (slugifyFilename) {
    const { name, type, lastModified } = file;
    const newName = formatFileName(name, { slugificationEnabled: true });

    file = new File([file], newName, { type, lastModified });
  }

  if (!usable) {
    return { file, originalFile: undefined, oversized: false, invalid: true };
  }

  const preTransformFile = file;

  if (transformations) {
    try {
      file = await transformFile(file, transformations);
    } catch {
      // A HEIC image that can’t be decoded; it can’t be uploaded as is, as nothing could display it
      return { file, originalFile: undefined, oversized: false, invalid: true };
    }
  }

  return {
    file,
    originalFile: file !== preTransformFile ? preTransformFile : undefined,
    oversized: file.size > maxFileSize,
    invalid: false,
  };
};
