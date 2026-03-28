/**
 * @import { ImageFitOption, MediaDimensions } from '$lib/types/private';
 */

/**
 * Calculate the size of resized canvas.
 * @param {MediaDimensions} source Source dimensions.
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

  if (originalWidth === targetWidth && originalHeight === targetHeight) {
    return original;
  }

  const isSmaller = originalWidth <= targetWidth && originalHeight <= targetHeight;
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
    scale = Math.min(targetWidth / originalWidth, targetHeight / originalHeight);
    newWidth = originalWidth * scale;
    newHeight = originalHeight * scale;
  }

  return { scale, width: newWidth, height: newHeight };
};

/**
 * Resize a Canvas based on the given dimension.
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas Canvas to be resized.
 * @param {MediaDimensions} source Source dimensions.
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
