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
 * Convert the given image file to another format.
 * @param {File | Blob} file - File to be converted, typically a JPEG file.
 * @param {'jpeg' | 'png' | 'webp'} format - New image format. Default: PNG.
 * @param {number} quality - Image quality between 0 and 1.
 * @returns {Promise<Blob>} New image file.
 * @throws {Error} If the file is not an image.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
 * @see https://stackoverflow.com/q/62909538
 */
export const convertImage = async (file, format = 'png', quality = 1) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Unsupported type');
  }

  const image = new Image();
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const blobURL = URL.createObjectURL(file);

  return new Promise((resolve) => {
    image.addEventListener('load', () => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context?.drawImage(image, 0, 0);

      canvas.toBlob(
        (blob) => {
          resolve(/** @type {Blob} */ (blob));
        },
        `image/${format}`,
        quality,
      );

      URL.revokeObjectURL(blobURL);
    });

    image.src = blobURL;
  });
};
