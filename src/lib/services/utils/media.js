import { isURL } from '@sveltia/utils/string';
import { getUnpkgURL } from '$lib/services/app/dependencies';

/**
 * @import {
 * AssetKind,
 * ImageFitOption,
 * InternalImageTransformationOptions,
 * } from '$lib/types/private';
 * @import { RasterImageConversionFormat, RasterImageFormat } from '$lib/types/public';
 */

/** @type {RasterImageFormat[]} */
export const rasterImageFormats = ['avif', 'bmp', 'gif', 'jpeg', 'png', 'webp'];
export const rasterImageExtensionRegex = /\b(?:avif|bmp|gif|jpe?g|png|webp)$/i;
/** @type {RasterImageConversionFormat[]} */
export const rasterImageConversionFormats = ['webp'];

/**
 * PDF.js distribution URL. We don’t bundle the library due to the large size and multiple files.
 * However, having it as a dependency in `package.json` allows us to include the latest version in
 * the UNPKG URL, making it faster to load the script without waiting for a redirect.
 * @see https://github.com/mozilla/pdf.js
 */
const pdfjsDistURL = getUnpkgURL('pdfjs-dist');
const pdfjsModuleURL = `${pdfjsDistURL}/build/pdf.min.mjs`;
const pdfjsWorkerURL = `${pdfjsDistURL}/build/pdf.worker.min.mjs`;

const pdfjsGetDocOptions = {
  isEvalSupported: false,
  disableAutoFetch: true,
  cMapUrl: `${pdfjsDistURL}/cmaps/`,
  iccUrl: `${pdfjsDistURL}/iccs/`,
  standardFontDataUrl: `${pdfjsDistURL}/standard_fonts/`,
  wasmUrl: `${pdfjsDistURL}/wasm/`,
};

/**
 * Placeholder for the PDF.js module.
 * @type {import('pdfjs-dist')}
 */
let pdfjs;

/**
 * Get the metadata of an image, video or audio asset.
 * @param {string} src Source URL.
 * @param {AssetKind} kind Media type: `image`, `video` or `audio`.
 * @returns {Promise<{
 * dimensions: { width: number, height: number } | undefined,
 * duration: number | undefined
 * }>} Dimensions (width/height) and/or duration.
 */
export const getMediaMetadata = (src, kind) => {
  const isImage = kind === 'image';

  const element = isImage
    ? new Image()
    : /** @type {HTMLMediaElement} */ (document.createElement(kind));

  return new Promise((resolve) => {
    // eslint-disable-next-line jsdoc/require-jsdoc
    const listener = () => {
      resolve({
        dimensions:
          kind === 'audio'
            ? undefined
            : {
                width: isImage
                  ? /** @type {HTMLImageElement} */ (element).naturalWidth
                  : /** @type {HTMLVideoElement} */ (element).videoWidth,
                height: isImage
                  ? /** @type {HTMLImageElement} */ (element).naturalHeight
                  : /** @type {HTMLVideoElement} */ (element).videoHeight,
              },
        duration: isImage ? undefined : /** @type {HTMLMediaElement} */ (element).duration,
      });
    };

    element.addEventListener(isImage ? 'load' : 'loadedmetadata', listener, { once: true });
    element.src = src;
  });
};

/**
 * Format the given duration in the `hh:mm:ss` format. Note that it assumes the duration is less
 * than 24 hours.
 * @param {number} duration Duration in seconds.
 * @returns {string} Formatted duration.
 */
export const formatDuration = (duration) => new Date(duration * 1000).toISOString().substr(11, 8);

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
const resizeCanvas = (canvas, source, target) => {
  const { scale, width, height } = calculateResize(source, target);

  canvas.width = width;
  canvas.height = height;

  return { scale, width, height };
};

/** @type {Record<string, boolean>} */
const encodingSupportMap = {};

/**
 * Check if the browser supports `canvas.convertToBlob()` encoding for the given format.
 * @param {string} format Format, like `webp`.
 * @returns {Promise<boolean>} Result.
 */
const checkIfEncodingIsSupported = async (format) => {
  if (format in encodingSupportMap) {
    return encodingSupportMap[format];
  }

  const type = `image/${format}`;
  const canvas = new OffscreenCanvas(1, 1);
  // Need this for Chrome
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
const exportCanvasAsBlob = async (canvas, { format = 'webp', quality = 85 } = {}) => {
  const type = `image/${format}`;

  if (
    !(await checkIfEncodingIsSupported(format)) &&
    /** @type {string[]} */ (rasterImageConversionFormats).includes(format)
  ) {
    const importURL = getUnpkgURL(`@jsquash/${format}`);
    const context = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    try {
      /** @type {import('@jsquash/webp').encode} */
      const encode = (await import(/* @vite-ignore */ `${importURL}/encode.js?module`)).default;
      const buffer = await encode(imageData, { quality });

      return new Blob([buffer], { type });
    } catch {
      //
    }
  }

  return canvas.convertToBlob({ type, quality: quality / 100 });
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
    const blobURL = URL.createObjectURL(blob);

    source = await new Promise((resolve) => {
      if (blob.type.startsWith('video/')) {
        const video = document.createElement('video');

        video.addEventListener(
          'canplay',
          async () => {
            video.pause();
            ({ videoWidth: width, videoHeight: height } = video);
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
        document.body.appendChild(video);
      } else {
        const image = new Image();

        image.addEventListener(
          'load',
          () => {
            ({ naturalWidth: width, naturalHeight: height } = image);
            resolve(image);
          },
          { once: true },
        );

        image.src = blobURL;
      }
    });

    URL.revokeObjectURL(blobURL);
  }

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
 * Create a thumbnail image of a PDF document using PDF.js.
 * @param {File | Blob} blob Source file.
 * @param {InternalImageTransformationOptions} [options] Options.
 * @returns {Promise<Blob>} Thumbnail blob.
 * @throws {Error} When the rendering failed.
 * @see https://github.com/mozilla/pdf.js/blob/master/examples/webpack/main.mjs
 * @see https://github.com/mozilla/pdf.js/issues/10478
 */
export const renderPDF = async (
  blob,
  { format = 'png', quality = 85, width = undefined, height = undefined, fit = 'scale-down' } = {},
) => {
  // Lazily load the PDF.js library
  if (!pdfjs) {
    try {
      pdfjs = await import(/* @vite-ignore */ pdfjsModuleURL);
      pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerURL;
    } catch {
      throw new Error('Failed to load PDF.js library');
    }
  }

  const url = URL.createObjectURL(blob);
  const canvas = new OffscreenCanvas(512, 512);
  const context = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));

  try {
    const pdfDocument = await pdfjs.getDocument({ ...pdfjsGetDocOptions, url }).promise;
    const pdfPage = await pdfDocument.getPage(1);
    const viewport = pdfPage.getViewport({ scale: 1 });

    const { scale } = resizeCanvas(
      canvas,
      { width: viewport.width, height: viewport.height },
      { width, height, fit },
    );

    await pdfPage.render({
      // @ts-ignore `OffscreenCanvas` is supported
      canvasContext: context,
      viewport: scale === 1 ? viewport : pdfPage.getViewport({ scale }),
    }).promise;

    URL.revokeObjectURL(url);
  } catch {
    throw new Error('Failed to render PDF');
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
  const importURL = getUnpkgURL('svgo');
  const string = await blob.text();

  try {
    /** @type {import('svgo')} */
    const { optimize } = await import(/* @vite-ignore */ `${importURL}/dist/svgo.browser.js`);
    const { data } = optimize(string);

    return new Blob([data], { type: blob.type });
  } catch {
    //
  }

  return blob;
};

/**
 * Check if the given string is a YouTube video URL.
 * @param {string} string URL-like string.
 * @returns {boolean} Result.
 */
export const isYouTubeVideoURL = (string) => {
  if (!isURL(string)) {
    return false;
  }

  const { origin, pathname, searchParams } = new URL(string);

  if (
    (origin === 'https://www.youtube.com' || origin === 'https://www.youtube-nocookie.com') &&
    ((pathname === '/watch' && searchParams.has('v')) ||
      (pathname === '/playlist' && searchParams.has('list')) ||
      pathname.startsWith('/embed/'))
  ) {
    return true;
  }

  if (origin === 'https://youtu.be' && !!pathname) {
    return true;
  }

  return false;
};

/**
 * Get an embeddable YouTube video URL from the given string.
 * @param {string} string URL-like string.
 * @returns {string} URL with privacy-enhanced mode enabled.
 */
export const getYouTubeEmbedURL = (string) => {
  const origin = 'https://www.youtube-nocookie.com';
  const { pathname, search, searchParams } = new URL(string);

  if (pathname === '/watch') {
    const params = new URLSearchParams(searchParams);
    let src = `${origin}/embed/${params.get('v')}`;

    if (params.get('list')) {
      params.delete('v');
      params.set('listType', 'playlist');
      src += `?${params.toString()}`;
    }

    return src;
  }

  if (pathname === '/playlist') {
    return `${origin}/embed/videoseries${search}`;
  }

  if (pathname.startsWith('/embed/')) {
    return `${origin}${pathname}${search}`;
  }

  // https://youtu.be
  return `${origin}/embed${pathname}${search}`;
};
