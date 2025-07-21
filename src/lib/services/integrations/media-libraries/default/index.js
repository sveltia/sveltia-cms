import { isObject } from '@sveltia/utils/object';
import { getMediaLibraryOptions } from '$lib/services/integrations/media-libraries';
import {
  RASTER_IMAGE_CONVERSION_FORMATS,
  RASTER_IMAGE_EXTENSION_REGEX,
  RASTER_IMAGE_FORMATS,
} from '$lib/services/utils/media/image';
import { optimizeSVG, transformImage } from '$lib/services/utils/media/image/transform';

/**
 * @import {
 * DefaultMediaLibraryConfig,
 * FileField,
 * FileTransformations,
 * ImageField,
 * RasterImageTransformationOptions,
 * } from '$lib/types/public';
 */

/**
 * Get normalized default media library options.
 * @param {object} [options] Options.
 * @param {FileField | ImageField} [options.fieldConfig] Field configuration.
 * @returns {{ config: DefaultMediaLibraryConfig }} Options.
 */
export const getDefaultMediaLibraryOptions = ({ fieldConfig } = {}) => {
  const options = getMediaLibraryOptions({ fieldConfig });

  /** @type {DefaultMediaLibraryConfig} */
  const {
    max_file_size: maxSize,
    slugify_filename: slugify,
    transformations,
  } = typeof options === 'boolean' ? {} : (options?.config ?? {});

  return {
    config: {
      max_file_size: typeof maxSize === 'number' && Number.isInteger(maxSize) ? maxSize : Infinity,
      slugify_filename: typeof slugify === 'boolean' ? slugify : false,
      transformations: isObject(transformations) ? transformations : undefined,
    },
  };
};

/**
 * Process the given file by applying a transformation if available.
 * @param {File} file Original file.
 * @param {FileTransformations} transformations File transformation options.
 * @returns {Promise<File>} Transformed file, or the original file if no transformation is applied.
 * @todo Move the `transformation` option validation to config parser.
 */
export const transformFile = async (file, transformations) => {
  const [type, subType] = file.type.split('/');

  // Process raster image
  if (type === 'image' && subType !== 'svg+xml') {
    /** @type {RasterImageTransformationOptions | undefined} */
    let transformation;

    if (subType in transformations) {
      transformation = /** @type {Record<string, any>} */ (transformations)[subType];
    } else if (
      'raster_image' in transformations &&
      /** @type {string[]} */ (RASTER_IMAGE_FORMATS).includes(subType)
    ) {
      transformation = transformations.raster_image;
    }

    if (transformation) {
      const { format, quality, width, height } = transformation;

      const newFormat =
        format && RASTER_IMAGE_CONVERSION_FORMATS.includes(format) ? format : 'webp';

      const blob = await transformImage(file, {
        format: newFormat,
        quality: quality && Number.isSafeInteger(quality) ? quality : 85,
        width: width && Number.isSafeInteger(width) ? width : undefined,
        height: height && Number.isSafeInteger(height) ? height : undefined,
      });

      const newFileName =
        blob.type === `image/${newFormat}`
          ? RASTER_IMAGE_EXTENSION_REGEX.test(file.name)
            ? file.name.replace(RASTER_IMAGE_EXTENSION_REGEX, newFormat)
            : file.name.concat(newFormat)
          : // Failed to transform
            file.name;

      return new File([blob], newFileName, { type: blob.type });
    }
  }

  // Process SVG image
  if (type === 'image' && subType === 'svg+xml' && transformations.svg?.optimize) {
    return new File([await optimizeSVG(file)], file.name, { type: file.type });
  }

  return file;
};
