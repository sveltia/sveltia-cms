import { formatFileName } from '$lib/services/assets/file-name';
import { hasCachedThumbnail } from '$lib/services/assets/info';
import { createAssetNameTemplate, fillAssetNameTemplate } from '$lib/services/assets/name';
import { uploadingAssets } from '$lib/services/assets/state';
import {
  canConvertHEIC,
  getDefaultMediaLibraryOptions,
  transformFile,
} from '$lib/services/integrations/media-libraries/default';
import { getGitHash } from '$lib/services/utils/file';
import { RASTER_IMAGE_TYPES } from '$lib/services/utils/media/image';
import { sniffRasterImageFormat } from '$lib/services/utils/media/image/sniff';
import { isValidImage } from '$lib/services/utils/media/image/validate';
import { createRawState, createRootEffect } from '$lib/services/utils/state.svelte';

/**
 * @import { ProcessedAssets } from '$lib/types/private';
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
 * Process a file by applying renaming, slugification, transformation, and validation.
 * @param {File} file File to process.
 * @param {SharedMediaLibraryOptions} [options] Processing options.
 * @param {object} [extraOptions] Extra options.
 * @param {string} [extraOptions.nameTemplate] The `filename_template` media library option to
 * rename the file with right away. A file added to an entry is named when the entry is saved
 * instead, as the template can refer to the entry content.
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
  { nameTemplate } = {},
) => {
  // Check the original file object, whose hash is likely memoized already; a renamed copy would
  // have to be read again to be hashed
  const usable = await isUsableImage(file, canConvertHEIC(transformations));

  if (nameTemplate || slugifyFilename) {
    const { name, type, lastModified } = file;

    let newName = nameTemplate
      ? fillAssetNameTemplate({
          nameTemplate: createAssetNameTemplate(nameTemplate),
          originalName: name,
        })
      : name;

    newName = formatFileName(newName, { slugificationEnabled: slugifyFilename });

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

/**
 * Sort processed files by whether they can be uploaded. A file that is both invalid and oversized
 * is reported as invalid only, as its size doesn’t matter once it can’t be uploaded anyway.
 * @param {ProcessFileResult[]} results Results of {@link processFile}.
 * @returns {{ validFiles: File[], oversizedFiles: File[], invalidFiles: File[] }} Processed files,
 * grouped.
 */
export const partitionProcessedFiles = (results) => ({
  validFiles: results
    .filter(({ oversized, invalid }) => !oversized && !invalid)
    .map(({ file }) => file),
  oversizedFiles: results
    .filter(({ oversized, invalid }) => oversized && !invalid)
    .map(({ file }) => file),
  invalidFiles: results.filter(({ invalid }) => invalid).map(({ file }) => file),
});

/**
 * Get the initial state of {@link processedAssets}, before any file is processed.
 * @returns {ProcessedAssets} State.
 */
const getInitialProcessedAssets = () => ({
  processing: false,
  validFiles: [],
  oversizedFiles: [],
  invalidFiles: [],
  transformedFileMap: new WeakMap(),
});

/**
 * Assets currently being processed. Updated whenever {@link uploadingAssets} changes.
 * @type {{ current: ProcessedAssets }}
 */
export const processedAssets = createRawState(getInitialProcessedAssets());

createRootEffect(() => {
  // Set when a newer selection supersedes this run. Processing a file is asynchronous and can take
  // a while — transcoding a large image, for one — so a run that started earlier may well settle
  // after a later one has, and it must not overwrite the newer results with its own stale ones.
  let superseded = false;
  const originalFiles = uploadingAssets.current.files;
  const { config } = getDefaultMediaLibraryOptions();

  processedAssets.current = getInitialProcessedAssets();

  (async () => {
    if (originalFiles.length && config.transformations) {
      processedAssets.current = { ...getInitialProcessedAssets(), processing: true };
    }

    // A file replacing an existing asset takes over its name, so it’s not renamed
    const nameTemplate = uploadingAssets.current.originalAssets?.length
      ? undefined
      : config.filename_template;

    const results = await Promise.all(
      originalFiles.map((file) => processFile(file, config, { nameTemplate })),
    );

    if (superseded) {
      return;
    }

    processedAssets.current = {
      processing: false,
      ...partitionProcessedFiles(results),
      transformedFileMap: new WeakMap(
        results
          .filter(({ originalFile }) => originalFile !== undefined)
          .map(({ file, originalFile }) => [file, /** @type {File} */ (originalFile)]),
      ),
    };
  })();

  // Called before the next run starts
  return () => {
    superseded = true;
  };
});
