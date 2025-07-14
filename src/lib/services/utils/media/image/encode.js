import { loadModule } from '$lib/services/app/dependencies';
import { RASTER_IMAGE_CONVERSION_FORMATS } from '$lib/services/utils/media/image';

/** @type {Record<string, boolean>} */
const encodingSupportMap = {};

/**
 * Check if the browser supports `canvas.convertToBlob()` encoding for the given format. Safari
 * doesn’t support native WebP encoding, so this returns `false` if the `format` is `webp`.
 * @param {string} format Format, like `webp`.
 * @returns {Promise<boolean>} Result.
 * @see https://bugs.webkit.org/show_bug.cgi?id=183257
 */
const checkIfEncodingIsSupported = async (format) => {
  if (format in encodingSupportMap) {
    return encodingSupportMap[format];
  }

  const type = `image/${format}`;
  const canvas = new OffscreenCanvas(1, 1);
  // Need this for Chrome for some reason
  // eslint-disable-next-line no-unused-vars
  const context = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const blob = await canvas.convertToBlob({ type });
  const result = blob.type === type;

  encodingSupportMap[format] = result;

  return result;
};

/**
 * Export Canvas data as an image blob. If the browser doesn’t support native encoding for the given
 * format (e.g. WebP on Safari), use the jSquash library as fallback.
 * @param {OffscreenCanvas} canvas Canvas to be exported.
 * @param {object} [options] Options.
 * @param {string} [options.format] Format, like `webp`.
 * @param {number} [options.quality] Image quality between 0 and 100.
 * @returns {Promise<Blob>} Image blob.
 * @see https://github.com/jamsinclair/jSquash
 */
export const exportCanvasAsBlob = async (canvas, { format = 'webp', quality = 85 } = {}) => {
  const type = `image/${format}`;

  if (
    !(await checkIfEncodingIsSupported(format)) &&
    /** @type {string[]} */ (RASTER_IMAGE_CONVERSION_FORMATS).includes(format)
  ) {
    const context = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    try {
      /** @type {import('@jsquash/webp').encode} */
      const encode = (await loadModule(`@jsquash/${format}`, 'encode.js?module')).default;
      const buffer = await encode(imageData, { quality });

      return new Blob([buffer], { type });
    } catch {
      //
    }
  }

  return canvas.convertToBlob({ type, quality: quality / 100 });
};
