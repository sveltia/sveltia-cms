import { transformFile } from '$lib/services/integrations/media-libraries/default';
import { formatFileName } from '$lib/services/utils/file';

/**
 * @import { SharedMediaLibraryOptions } from '$lib/types/public';
 */

/**
 * @typedef {object} ProcessFileResult
 * @property {File} file Processed file.
 * @property {File | undefined} originalFile Pre-transformation file if a transformation was
 * applied.
 * @property {boolean} oversized Whether the file exceeds the maximum allowed size.
 */

/**
 * Process a file by applying slugification, transformation, and size validation.
 * @param {File} file File to process.
 * @param {SharedMediaLibraryOptions} [options] Processing options.
 * @returns {Promise<ProcessFileResult>} Result of processing the file.
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

  const preTransformFile = file;

  if (transformations) {
    file = await transformFile(file, transformations);
  }

  return {
    file,
    originalFile: file !== preTransformFile ? preTransformFile : undefined,
    oversized: file.size > maxFileSize,
  };
};
