import { isObject } from '@sveltia/utils/object';
import { get } from 'svelte/store';
import { siteConfig } from '$lib/services/config';
import {
  optimizeSVG,
  rasterImageConversionFormats,
  rasterImageExtensionRegex,
  rasterImageFormats,
  transformImage,
} from '$lib/services/utils/media';

/**
 * @import {
 * FileField,
 * FileTransformations,
 * ImageField,
 * RasterImageTransformationOptions,
 * } from '$lib/types/public';
 */

/**
 * Get a default media library option. Support both new and legacy options at the field level and
 * global.
 * @param {'max_file_size' | 'transformations'} key Option key.
 * @param {ImageField | FileField} [fieldConfig] Field configuration.
 * @returns {any} Option.
 */
const getMediaLibraryOption = (key, fieldConfig) => {
  const _siteConfig = get(siteConfig);

  return (
    fieldConfig?.media_libraries?.default?.config?.[key] ??
    fieldConfig?.media_library?.config?.[key] ??
    _siteConfig?.media_libraries?.default?.config?.[key] ??
    (_siteConfig?.media_library?.name === 'default'
      ? _siteConfig.media_library.config?.[key]
      : undefined)
  );
};

/**
 * Get the maximum file size for uploads.
 * @param {ImageField | FileField} [fieldConfig] Field configuration.
 * @returns {number} Size.
 */
export const getMaxFileSize = (fieldConfig) => {
  const size = getMediaLibraryOption('max_file_size', fieldConfig);

  if (typeof size === 'number' && Number.isInteger(size)) {
    return size;
  }

  return Infinity;
};

/**
 * Get file transformation options.
 * @param {ImageField | FileField} [fieldConfig] Field configuration.
 * @returns {FileTransformations | undefined} Options.
 */
export const getFileTransformations = (fieldConfig) => {
  const option = getMediaLibraryOption('transformations', fieldConfig);

  if (isObject(option)) {
    return option;
  }

  return undefined;
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
      /** @type {string[]} */ (rasterImageFormats).includes(subType)
    ) {
      transformation = transformations.raster_image;
    }

    if (transformation) {
      const { format, quality, width, height } = transformation;
      const newFormat = format && rasterImageConversionFormats.includes(format) ? format : 'webp';

      const blob = await transformImage(file, {
        format: newFormat,
        quality: quality && Number.isSafeInteger(quality) ? quality : 85,
        width: width && Number.isSafeInteger(width) ? width : undefined,
        height: height && Number.isSafeInteger(height) ? height : undefined,
      });

      const newFileName =
        blob.type === `image/${newFormat}`
          ? rasterImageExtensionRegex.test(file.name)
            ? file.name.replace(rasterImageExtensionRegex, newFormat)
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
