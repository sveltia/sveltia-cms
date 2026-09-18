/**
 * @import {
 * RasterImageConversionFormat,
 * RasterImageFormat,
 * VectorImageFormat,
 * } from '$lib/types/public';
 */

/**
 * Raster image formats, including HEIC, which is an input format: only Safari displays it, so it
 * can only be uploaded where it’s converted.
 * @type {RasterImageFormat[]}
 */
export const RASTER_IMAGE_FORMATS = ['avif', 'gif', 'heic', 'jpeg', 'png', 'webp'];
/**
 * MIME types of a HEIC image. A HEIF file with a `.heif` extension has the `image/heif` type rather
 * than `image/heic`.
 */
export const HEIC_IMAGE_TYPES = ['image/heic', 'image/heif'];
/** MIME types of the raster image formats every browser displays, so HEIC is excluded. */
export const RASTER_IMAGE_TYPES = RASTER_IMAGE_FORMATS.filter((format) => format !== 'heic').map(
  (format) => `image/${format}`,
);
/**
 * Regex matching a raster image file extension at the end of a file name. JPEG files can also have
 * a `.jpe` or `.jfif` extension, and HEIC files a `.heif` extension, so those aliases are included.
 */
export const RASTER_IMAGE_EXTENSION_REGEX = /\b(?:avif|gif|heic|heif|jfif|jpe?g|jpe|png|webp)$/i;

/** @type {VectorImageFormat[]} */
export const VECTOR_IMAGE_FORMATS = ['svg'];
export const VECTOR_IMAGE_TYPES = ['image/svg+xml'];
export const VECTOR_IMAGE_EXTENSION_REGEX = /\b(?:svg)$/i;

export const SUPPORTED_IMAGE_FORMATS = [...RASTER_IMAGE_FORMATS, ...VECTOR_IMAGE_FORMATS];
export const SUPPORTED_IMAGE_TYPES = [...RASTER_IMAGE_TYPES, ...VECTOR_IMAGE_TYPES];
/**
 * MIME types an image field accepts when HEIC images are converted on upload. Listing the HEIC
 * types in `accept` is what makes the file picker offer HEIC photos — and makes iOS Safari hand
 * them over as they are rather than transcoded to JPEG — so they’re only listed in that case.
 */
export const SUPPORTED_IMAGE_TYPES_WITH_HEIC = [...SUPPORTED_IMAGE_TYPES, ...HEIC_IMAGE_TYPES];

/**
 * Get the labels of the image formats an `accept` list built from {@link SUPPORTED_IMAGE_TYPES} or
 * {@link SUPPORTED_IMAGE_TYPES_WITH_HEIC} covers, to tell the user which images are accepted.
 * @param {string | undefined} accept Accepted file type specifiers, comma-separated.
 * @returns {string[] | undefined} Labels, or `undefined` if the list isn’t one of those.
 */
export const getAcceptedImageFormatLabels = (accept) => {
  if (accept === SUPPORTED_IMAGE_TYPES.join(',')) {
    return ['GIF', 'JPEG', 'PNG', 'WebP', 'SVG'];
  }

  if (accept === SUPPORTED_IMAGE_TYPES_WITH_HEIC.join(',')) {
    return ['GIF', 'HEIC', 'JPEG', 'PNG', 'WebP', 'SVG'];
  }

  return undefined;
};

/** @type {RasterImageConversionFormat[]} */
export const RASTER_IMAGE_CONVERSION_FORMATS = ['webp'];
