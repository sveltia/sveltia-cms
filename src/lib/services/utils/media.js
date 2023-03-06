/**
 * Get the metadata of an image, video or audio asset.
 *
 * @param {string} src Source URL.
 * @param {string} kind Media type: `image`, `video` or `audio`.
 * @returns {Promise<object>} Dimensions (width/height) and/or duration.
 */
export const getMediaMetadata = (src, kind) => {
  const isImage = kind === 'image';
  const element = isImage ? new Image() : document.createElement(kind);

  return new Promise((resolve) => {
    // eslint-disable-next-line jsdoc/require-jsdoc
    const listener = () => {
      resolve({
        dimensions:
          kind === 'audio'
            ? undefined
            : {
                width: isImage ? element.naturalWidth : element.videoWidth,
                height: isImage ? element.naturalHeight : element.videoHeight,
              },
        duration: isImage ? undefined : element.duration,
      });
    };

    element.addEventListener(isImage ? 'load' : 'loadedmetadata', listener, { once: true });
    element.src = src;
  });
};

/**
 * Format the given duration in the `hh:mm:ss` format. Note that it assumes the duration is less
 * than 24 hours.
 *
 * @param {number} duration Duration in seconds.
 * @returns {string} Formatted duration.
 */
export const formatDuration = (duration) => new Date(duration * 1000).toISOString().substr(11, 8);
