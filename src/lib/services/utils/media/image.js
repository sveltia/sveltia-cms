import { loadModule } from '$lib/services/app/dependencies';

/**
 * @import { ImageFitOption, InternalImageTransformationOptions } from '$lib/types/private';
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

/**
 * Calculate the size of resized canvas.
 * @param {{ width: number, height: number }} source Source dimensions.
 * @param {{ width?: number, height?: number, fit?: ImageFitOption }} [target] Target dimensions and
 * fit option.
 * @returns {{ scale: number, width: number, height: number }} Scale and new width/height.
 */
export const calculateResize = (
  { width: originalWidth, height: originalHeight },
  {
    width: targetWidth = originalWidth,
    height: targetHeight = originalHeight,
    fit = 'scale-down',
  } = {},
) => {
  const original = { scale: 1, width: originalWidth, height: originalHeight };

  if (originalWidth === targetHeight && originalHeight === targetHeight) {
    return original;
  }

  const isLandscape = originalWidth > originalHeight;
  const isSmaller = originalWidth < targetHeight || originalHeight < targetHeight;
  let scale = 1;
  let newWidth = 0;
  let newHeight = 0;

  if (fit === 'scale-down') {
    if (isSmaller) {
      return original;
    }

    fit = 'contain';
  }

  if (fit === 'contain') {
    if (isLandscape) {
      if (targetWidth > targetHeight) {
        scale = targetWidth / originalWidth;
        newWidth = targetWidth;
      } else {
        scale = targetHeight / originalWidth;
        newWidth = targetHeight;
      }

      newHeight = originalHeight * scale;
    } else {
      if (targetWidth > targetHeight) {
        scale = targetHeight / originalHeight;
        newHeight = targetHeight;
      } else {
        scale = targetWidth / originalHeight;
        newHeight = targetWidth;
      }

      newWidth = originalWidth * scale;
    }
  }

  return { scale, width: newWidth, height: newHeight };
};

/**
 * Resize a Canvas based on the given dimension.
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas Canvas to be resized.
 * @param {{ width: number, height: number }} source Source dimensions.
 * @param {{ width?: number, height?: number, fit?: ImageFitOption }} [target] Target dimensions and
 * fit option.
 * @returns {{ scale: number, width: number, height: number }} Scale and new width/height.
 */
export const resizeCanvas = (canvas, source, target) => {
  const { scale, width, height } = calculateResize(source, target);

  canvas.width = width;
  canvas.height = height;

  return { scale, width, height };
};

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
      const encode = (await loadModule(`@jsquash/${format}`, '/encode.js?module')).default;
      const buffer = await encode(imageData, { quality });

      return new Blob([buffer], { type });
    } catch {
      //
    }
  }

  return canvas.convertToBlob({ type, quality: quality / 100 });
};

/**
 * Get an image source from a Blob or File. If the Blob is a video, create a `<video>` element, and
 * return it. If it’s an image, create an `<img>` element and return it.
 * @param {File | Blob} blob File or blob to be converted to an image source.
 * @returns {Promise<{ source: CanvasImageSource, naturalWidth: number, naturalHeight: number }>}
 * Canvas image source and its natural dimensions.
 */
const createImageSource = async (blob) => {
  const blobURL = URL.createObjectURL(blob);
  /** @type {number} */
  let naturalWidth = 0;
  /** @type {number} */
  let naturalHeight = 0;

  const source = await new Promise((resolve) => {
    if (blob.type.startsWith('video/')) {
      const video = document.createElement('video');

      video.addEventListener(
        'canplay',
        async () => {
          video.pause();
          ({ videoWidth: naturalWidth, videoHeight: naturalHeight } = video);
          resolve(video);
        },
        { once: true },
      );

      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.src = blobURL;

      // Add `<video>` to DOM or it won’t be rendered on canvas
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
      document.body.appendChild(video);
    } else {
      const image = new Image();

      image.addEventListener(
        'load',
        () => {
          ({ naturalWidth, naturalHeight } = image);
          resolve(image);
        },
        { once: true },
      );

      image.src = blobURL;
    }
  });

  URL.revokeObjectURL(blobURL);

  return { source, naturalWidth, naturalHeight };
};

/**
 * Convert the given image file to another format.
 * @param {File | Blob} blob Source file.
 * @param {InternalImageTransformationOptions} [options] Options.
 * @returns {Promise<Blob>} New image file.
 * @throws {Error} If the file is not an image.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
 * @see https://stackoverflow.com/q/62909538
 */
export const transformImage = async (
  blob,
  { format = 'png', quality = 85, width = undefined, height = undefined, fit = 'scale-down' } = {},
) => {
  /** @type {CanvasImageSource} */
  let source;
  /** @type {number} */
  let naturalWidth = 0;
  /** @type {number} */
  let naturalHeight = 0;

  try {
    source = await createImageBitmap(blob);
    ({ width: naturalWidth, height: naturalHeight } = source);
  } catch {
    // Fall back to `<img>` or `<video>` when thrown; this includes SVG
    ({ source, naturalWidth, naturalHeight } = await createImageSource(blob));
  }

  width ??= naturalWidth;
  height ??= naturalHeight;

  const canvas = new OffscreenCanvas(512, 512);
  const context = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));

  resizeCanvas(canvas, { width: naturalWidth, height: naturalHeight }, { fit, width, height });
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  // Clean up
  if (source instanceof HTMLVideoElement) {
    document.body.removeChild(source);
  }

  return exportCanvasAsBlob(canvas, { format, quality });
};

/**
 * Optimize a SVG image using the SVGO library.
 * @param {File | Blob} blob Source file.
 * @returns {Promise<Blob>} Optimized image file.
 * @see https://github.com/svg/svgo/issues/1050
 */
export const optimizeSVG = async (blob) => {
  const string = await blob.text();

  try {
    /** @type {import('svgo')} */
    const { optimize } = await loadModule('svgo', '/dist/svgo.browser.js');
    const { data } = optimize(string);

    return new Blob([data], { type: blob.type });
  } catch {
    //
  }

  return blob;
};
