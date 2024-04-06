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
    // Fall back to `<img>` when thrown, possibly by SVG
    source = await new Promise((resolve) => {
      const image = new Image();
      const blobURL = URL.createObjectURL(blob);

      image.addEventListener('load', () => {
        ({ naturalWidth: width, naturalHeight: height } = image);
        resolve(image);
        URL.revokeObjectURL(blobURL);
      });

      image.src = blobURL;
    });
  }

  const canvas = new OffscreenCanvas(512, 512);
  const context = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));

  resizeCanvas(canvas, width, height, dimension);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

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

  const canvas = new OffscreenCanvas(512, 512);
  const context = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));

  try {
    const pdfDocument = await pdfjs.getDocument({
      url: URL.createObjectURL(blob),
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
  } catch {
    throw new Error('Failed to render PDF');
  }

  return canvas.convertToBlob({ type: `image/${format}`, quality });
};
