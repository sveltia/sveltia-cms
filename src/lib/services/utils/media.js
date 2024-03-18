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
