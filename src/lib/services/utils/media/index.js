import { extractExifData } from '$lib/services/utils/media/image/exif';

/**
 * @import { Asset, AssetKind, GeoCoordinates, MediaDimensions } from '$lib/types/private';
 */

/**
 * Get the dimensions of an image asset.
 * @param {string} src Source URL of the image.
 * @returns {Promise<{ dimensions: MediaDimensions }>} Dimensions (width/height) and duration.
 */
const getImageSourceInfo = (src) => {
  const element = new Image();

  return new Promise((resolve) => {
    // eslint-disable-next-line jsdoc/require-jsdoc
    const listener = () => {
      resolve({
        dimensions: { width: element.naturalWidth, height: element.naturalHeight },
      });
    };

    element.addEventListener('load', listener, { once: true });
    element.src = src;
  });
};

/**
 * Get the dimensions and duration of a video or audio asset.
 * @param {string} src Source URL of the media.
 * @param {AssetKind} kind Media type: `video` or `audio`.
 * @returns {Promise<{ dimensions?: MediaDimensions, duration: number }>} Dimensions and duration of
 * the media.
 */
const getMediaSourceInfo = async (src, kind) => {
  const element = /** @type {HTMLMediaElement} */ (document.createElement(kind));

  return new Promise((resolve) => {
    // eslint-disable-next-line jsdoc/require-jsdoc
    const listener = () => {
      const { duration } = element;

      if (kind === 'audio') {
        resolve({ duration });
      }

      const { videoWidth, videoHeight } = /** @type {HTMLVideoElement} */ (element);

      resolve({
        dimensions: { width: videoWidth, height: videoHeight },
        duration,
      });
    };

    element.addEventListener('loadedmetadata', listener, { once: true });
    element.src = src;
  });
};

/**
 * Get the dimensions and duration of an image, video or audio asset.
 * @param {string} src Source URL.
 * @param {AssetKind} kind Media type: `image`, `video` or `audio`.
 * @returns {Promise<{ dimensions?: MediaDimensions, duration?: number }>} Dimensions (width/height)
 * and duration.
 */
const getSourceInfo = async (src, kind) => {
  if (kind === 'image') {
    return getImageSourceInfo(src);
  }

  return getMediaSourceInfo(src, kind);
};

/**
 * Get the metadata of an image, video or audio asset.
 * @param {Asset} asset Asset object.
 * @param {string} src Source URL.
 * @param {AssetKind} kind Media type: `image`, `video` or `audio`.
 * @returns {Promise<{ dimensions: MediaDimensions | undefined, duration: number | undefined,
 * createdDate: Date | undefined, coordinates: GeoCoordinates | undefined }>} Metadata object
 * containing dimensions, duration, created date and coordinates.
 */
export const getMediaMetadata = async (asset, src, kind) => {
  const { dimensions, duration } = await getSourceInfo(src, kind);
  const { createdDate, coordinates } = await extractExifData(asset, kind);

  return { dimensions, duration, createdDate, coordinates };
};
