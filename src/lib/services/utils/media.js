import { isURL } from '@sveltia/utils/string';

/**
 * PDF.js distribution URL. We don’t bundle this because most users probably don’t have PDF files.
 * @see https://github.com/mozilla/pdf.js
 */
const pdfjsDistURL = 'https://unpkg.com/pdfjs-dist/build';
/**
 * Placeholder for the PDF.js module.
 * @type {{ getDocument: Function, GlobalWorkerOptions: { workerSrc: string } }}
 */
let pdfjs;

/**
 * Get the metadata of an image, video or audio asset.
 * @param {string} src - Source URL.
 * @param {AssetKind} kind - Media type: `image`, `video` or `audio`.
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
 * @param {number} duration - Duration in seconds.
 * @returns {string} Formatted duration.
 */
export const formatDuration = (duration) => new Date(duration * 1000).toISOString().substr(11, 8);

/**
 * Resize a canvas based on the given dimension.
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas - Canvas to be resized.
 * @param {number} width - Source image width.
 * @param {number} height - Source image height.
 * @param {number} [dimension] - Maximum width/height of the canvas.
 * @returns {number} Scale.
 */
const resizeCanvas = (canvas, width, height, dimension) => {
  let scale = 1;

  if (dimension) {
    if (width > height) {
      scale = dimension / width;
      canvas.width = dimension;
      canvas.height = height * scale;
    } else {
      scale = dimension / height;
      canvas.width = width * scale;
      canvas.height = dimension;
    }
  } else {
    canvas.width = width;
    canvas.height = height;
  }

  return scale;
};

/**
 * Convert the given image file to another format.
 * @param {File | Blob} blob - Source file.
 * @param {object} [options] - Options.
 * @param {'jpeg' | 'png' | 'webp'} [options.format] - New image format. Default: PNG.
 * @param {number} [options.quality] - Image quality between 0 and 1.
 * @param {number} [options.dimension] - Maximum width/height of the image.
 * @returns {Promise<Blob>} New image file.
 * @throws {Error} If the file is not an image.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
 * @see https://stackoverflow.com/q/62909538
 */
export const convertImage = async (
  blob,
  { format = 'png', quality = 1, dimension = undefined } = {},
) => {
  /** @type {CanvasImageSource} */
  let source;
  /** @type {number} */
  let width = 0;
  /** @type {number} */
  let height = 0;

  try {
    source = await createImageBitmap(blob);
    ({ width, height } = source);
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

  resizeCanvas(canvas, width, height, dimension);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  // Clean up
  if (source instanceof HTMLVideoElement) {
    document.body.removeChild(source);
  }

  return canvas.convertToBlob({ type: `image/${format}`, quality });
};

/**
 * Create a thumbnail image of a PDF document using PDF.js.
 * @param {File | Blob} blob - Source file.
 * @param {object} [options] - Options.
 * @param {'jpeg' | 'png' | 'webp'} [options.format] - New image format. Default: PNG.
 * @param {number} [options.quality] - Image quality between 0 and 1.
 * @param {number} [options.dimension] - Maximum width/height of the image.
 * @returns {Promise<Blob>} Thumbnail blob.
 * @throws {Error} When the rendering failed.
 * @see https://github.com/mozilla/pdf.js/blob/master/examples/webpack/main.mjs
 * @see https://github.com/mozilla/pdf.js/issues/10478
 */
export const renderPDF = async (
  blob,
  { format = 'png', quality = 1, dimension = undefined } = {},
) => {
  // Lazily load the PDF.js library
  if (!pdfjs) {
    try {
      // eslint-disable-next-line jsdoc/no-bad-blocks
      pdfjs = await import(/* @vite-ignore */ `${pdfjsDistURL}/pdf.min.mjs`);
      pdfjs.GlobalWorkerOptions.workerSrc = `${pdfjsDistURL}/pdf.worker.min.mjs`;
    } catch {
      throw new Error('Failed to load PDF.js library');
    }
  }

  const blobURL = URL.createObjectURL(blob);
  const canvas = new OffscreenCanvas(512, 512);
  const context = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));

  try {
    const pdfDocument = await pdfjs.getDocument({
      url: blobURL,
      isEvalSupported: false,
      disableAutoFetch: true,
    }).promise;

    const pdfPage = await pdfDocument.getPage(1);
    const viewport = pdfPage.getViewport({ scale: 1 });
    const { width, height } = viewport;
    const scale = resizeCanvas(canvas, width, height, dimension);

    await pdfPage.render({
      canvasContext: context,
      viewport: scale === 1 ? viewport : pdfPage.getViewport({ scale }),
    }).promise;

    URL.revokeObjectURL(blobURL);
  } catch {
    throw new Error('Failed to render PDF');
  }

  return canvas.convertToBlob({ type: `image/${format}`, quality });
};

/**
 * Check if the given string is a YouTube video URL.
 * @param {string} string - URL-like string.
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
 * @param {string} string - URL-like string.
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
