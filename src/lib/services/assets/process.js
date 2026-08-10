import { transformFile } from '$lib/services/integrations/media-libraries/default';
import { formatFileName } from '$lib/services/utils/file';
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
  if (slugifyFilename) {
    const { name, type, lastModified } = file;
    const newName = formatFileName(name, { slugificationEnabled: true });

    file = new File([file], newName, { type, lastModified });
  }

  if (!(await isValidImage(file))) {
    return { file, originalFile: undefined, oversized: false, invalid: true };
  }

  const preTransformFile = file;

  if (transformations) {
    file = await transformFile(file, transformations);
  }

  return {
    file,
    originalFile: file !== preTransformFile ? preTransformFile : undefined,
    oversized: file.size > maxFileSize,
    invalid: false,
  };
};
