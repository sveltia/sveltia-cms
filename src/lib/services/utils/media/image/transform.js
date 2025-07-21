import { loadModule } from '$lib/services/app/dependencies';
import { exportCanvasAsBlob } from '$lib/services/utils/media/image/encode';
import { resizeCanvas } from '$lib/services/utils/media/image/resize';

/**
 * @import { InternalImageTransformationOptions } from '$lib/types/private';
 */

/**
 * Create an image source from a Blob URL. This function creates an `<img>` element, waits for it to
 * load, and returns the image element along with its natural dimensions.
 * @param {object} args Arguments.
 * @param {File | Blob} args.blob File or blob to be converted to an image source.
 * @returns {Promise<{ source: CanvasImageSource, naturalWidth: number, naturalHeight: number }>}
 * Image element and its natural dimensions.
 */
export const createImageSource = async ({ blob }) => {
  const blobURL = URL.createObjectURL(blob);
  const image = new Image();

  return new Promise((resolve) => {
    image.addEventListener(
      'load',
      () => {
        resolve({
          source: image,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
        });

        URL.revokeObjectURL(blobURL);
      },
      { once: true },
    );
    image.src = blobURL;
  });
};

/**
 * Create a video source from a Blob URL. This function creates a `<video>` element, waits for it to
 * be ready, and returns the video element along with its natural dimensions.
 * @param {object} args Arguments.
 * @param {File | Blob} args.blob File or blob to be converted to an video source.
 * @returns {Promise<{ source: CanvasImageSource, naturalWidth: number, naturalHeight: number }>}
 * Video element and its natural dimensions.
 */
export const createVideoSource = async ({ blob }) => {
  const blobURL = URL.createObjectURL(blob);
  const video = document.createElement('video');

  return new Promise((resolve) => {
    video.addEventListener(
      'canplay',
      () => {
        video.pause();

        resolve({
          source: video,
          naturalWidth: video.videoWidth,
          naturalHeight: video.videoHeight,
        });

        URL.revokeObjectURL(blobURL);
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
  });
};

/**
 * Get an image source from a Blob or File. If the Blob is a video, create a `<video>` element, and
 * return it. If it’s an image, create an `<img>` element and return it.
 * @param {File | Blob} blob File or blob to be converted to an image source.
 * @returns {Promise<{ source: CanvasImageSource, naturalWidth: number, naturalHeight: number }>}
 * Canvas image source and its natural dimensions.
 */
export const createSource = async (blob) => {
  if (blob.type.startsWith('video/')) {
    return createVideoSource({ blob });
  }

  return createImageSource({ blob });
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
    ({ source, naturalWidth, naturalHeight } = await createSource(blob));
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
    const { optimize } = await loadModule('svgo', 'dist/svgo.browser.js');
    const { data } = optimize(string);

    return new Blob([data], { type: blob.type });
  } catch {
    //
  }

  return blob;
};
