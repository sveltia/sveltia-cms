import { isObject } from '@sveltia/utils/object';

import { getMediaLibraryOptions } from '$lib/services/integrations/media-libraries';
import {
  RASTER_IMAGE_EXTENSION_REGEX,
  RASTER_IMAGE_FORMATS,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_IMAGE_TYPES_WITH_HEIC,
} from '$lib/services/utils/media/image';
import { sniffRasterImageFormat } from '$lib/services/utils/media/image/sniff';
import { optimizeSVG, transformImage } from '$lib/services/utils/media/image/transform';

/**
 * @import {
 * DefaultMediaLibraryConfig,
 * FileTransformations,
 * MediaField,
 * RasterImageFormat,
 * RasterImageTransformationOptions,
 * } from '$lib/types/public';
 */

/**
 * Get normalized default media library options.
 * @param {object} [options] Options.
 * @param {MediaField} [options.fieldConfig] Field configuration.
 * @returns {{ enabled: boolean, config: DefaultMediaLibraryConfig }} Options.
 */
export const getDefaultMediaLibraryOptions = ({ fieldConfig } = {}) => {
  const options = getMediaLibraryOptions({ fieldConfig });

  /** @type {DefaultMediaLibraryConfig} */
  const {
    max_file_size: maxSize,
    multiple,
    slugify_filename: slugify,
    transformations,
  } = typeof options === 'boolean' ? {} : (options?.config ?? {});

  return {
    enabled: options !== false,
    config: {
      max_file_size: typeof maxSize === 'number' && Number.isInteger(maxSize) ? maxSize : Infinity,
      multiple: typeof multiple === 'boolean' ? multiple : false,
      slugify_filename: typeof slugify === 'boolean' ? slugify : false,
      transformations: isObject(transformations) ? transformations : undefined,
    },
  };
};

/**
 * Normalize a format name to one of {@link RASTER_IMAGE_FORMATS}.
 * @param {string | undefined} format Format, like `jpeg`.
 * @returns {RasterImageFormat | undefined} Format, or `undefined` if it’s not one of them.
 */
const toRasterImageFormat = (format) =>
  format && /** @type {string[]} */ (RASTER_IMAGE_FORMATS).includes(format)
    ? /** @type {RasterImageFormat} */ (format)
    : undefined;

/**
 * Get the formats of a raster image file: the one its content says, and the one its type says. The
 * content is sniffed because a HEIC photo is often saved with a `.jpg` extension, and a `.heic`
 * file doesn’t get the `image/heic` type on every platform.
 * @param {File} file File.
 * @returns {Promise<{ sourceFormat?: RasterImageFormat, declaredFormat?: RasterImageFormat }>}
 * Formats. `sourceFormat` is `undefined` if the file isn’t a supported raster image.
 */
const getRasterImageFormats = async (file) => {
  const [type, subType] = file.type.split('/');

  if (type !== 'image' && !RASTER_IMAGE_EXTENSION_REGEX.test(file.name)) {
    return {};
  }

  const declaredFormat = toRasterImageFormat(subType);
  const sourceFormat = toRasterImageFormat(await sniffRasterImageFormat(file)) ?? declaredFormat;

  return { sourceFormat, declaredFormat };
};

/**
 * Check whether HEIC images are converted with the given transformations, either by a HEIC-specific
 * or a generic raster image transformation.
 * @param {FileTransformations | undefined} transformations File transformation options.
 * @returns {boolean} Result.
 */
export const canConvertHEIC = (transformations) =>
  !!(transformations?.heic ?? transformations?.raster_image);

/**
 * Get the MIME types an image field or picker accepts: the formats every browser displays, plus
 * HEIC if it’s converted on upload.
 * @param {FileTransformations | undefined} transformations File transformation options.
 * @returns {string[]} MIME types.
 */
export const getAcceptedImageTypes = (transformations) =>
  canConvertHEIC(transformations) ? SUPPORTED_IMAGE_TYPES_WITH_HEIC : SUPPORTED_IMAGE_TYPES;

/**
 * Process the given file by applying a transformation if available.
 * @param {File} file Original file.
 * @param {FileTransformations} transformations File transformation options. The options are
 * validated by the config parser, so they are used as is here.
 * @returns {Promise<File>} Transformed file, or the original file if no transformation is applied
 * or the transformation fails.
 * @throws {Error} If the file is a HEIC image to be converted that can’t be decoded. Browsers
 * other than Safari can’t display a HEIC image, so it’s not uploaded as is in that case.
 */
export const transformFile = async (file, transformations) => {
  const [type, subType] = file.type.split('/');

  // Process SVG image
  if (type === 'image' && subType === 'svg+xml') {
    if (transformations.svg?.optimize) {
      return new File([await optimizeSVG(file)], file.name, { type: file.type });
    }

    return file;
  }

  // Process raster image
  const { sourceFormat, declaredFormat } = await getRasterImageFormats(file);

  if (!sourceFormat) {
    return file;
  }

  const formatTransformations =
    /** @type {Record<string, RasterImageTransformationOptions | undefined>} */ (transformations);

  // A format-specific transformation for the actual format first, then one for the declared
  // format, so a JPEG image saved with a `.png` extension is still converted with `png` options
  /** @type {RasterImageTransformationOptions | undefined} */
  const transformation =
    formatTransformations[sourceFormat] ??
    (declaredFormat ? formatTransformations[declaredFormat] : undefined) ??
    transformations.raster_image;

  if (!transformation) {
    return file;
  }

  const { format = 'webp', quality = 85, width, height } = transformation;
  /** @type {Blob} */
  let blob;

  try {
    blob = await transformImage(file, { format, quality, width, height });
  } catch (error) {
    if (sourceFormat === 'heic') {
      throw new Error('Failed to decode HEIC image', { cause: error });
    }

    // The browser can’t decode the file, so upload it as is instead of failing the whole
    // selection. This mirrors `optimizeSVG`, which also falls back to the original blob.
    return file;
  }

  // Name the file after the format actually produced, which can differ from the requested one:
  // without native WebP encoding and the fallback encoder, a browser exports PNG instead
  const [, newFormat] = blob.type.split('/');

  const newFileName = RASTER_IMAGE_EXTENSION_REGEX.test(file.name)
    ? file.name.replace(RASTER_IMAGE_EXTENSION_REGEX, newFormat)
    : `${file.name}.${newFormat}`;

  return new File([blob], newFileName, { type: blob.type });
};
