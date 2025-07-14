/**
 * @import {
 * RasterImageConversionFormat,
 * RasterImageFormat,
 * VectorImageFormat,
 * } from '$lib/types/public';
 */

/** @type {RasterImageFormat[]} */
export const RASTER_IMAGE_FORMATS = ['avif', 'gif', 'jpeg', 'png', 'webp'];
export const RASTER_IMAGE_TYPES = RASTER_IMAGE_FORMATS.map((format) => `image/${format}`);
export const RASTER_IMAGE_EXTENSION_REGEX = /\b(?:avif|gif|jpe?g|png|webp)$/i;

/** @type {VectorImageFormat[]} */
export const VECTOR_IMAGE_FORMATS = ['svg'];
export const VECTOR_IMAGE_TYPES = ['image/svg+xml'];
export const VECTOR_IMAGE_EXTENSION_REGEX = /\b(?:svg)$/i;

export const SUPPORTED_IMAGE_FORMATS = [...RASTER_IMAGE_FORMATS, ...VECTOR_IMAGE_FORMATS];
export const SUPPORTED_IMAGE_TYPES = [...RASTER_IMAGE_TYPES, ...VECTOR_IMAGE_TYPES];

/** @type {RasterImageConversionFormat[]} */
export const RASTER_IMAGE_CONVERSION_FORMATS = ['webp'];
