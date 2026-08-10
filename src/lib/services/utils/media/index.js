import { extractExifData } from '$lib/services/utils/media/image/exif';

/**
 * @import { Asset, AssetKind, GeoCoordinates, MediaDimensions } from '$lib/types/private';
 */

/**
 * @typedef {object} SourceInfo
 * @property {MediaDimensions} [dimensions] Dimensions (width/height), if available.
 * @property {number} [duration] Duration in seconds, if available.
 */

/**
 * Probe a media element for its dimensions and duration. The source is always a blob URL, so the
 * element is guaranteed to fire either the success event or `error`; the latter resolves with an
 * empty result so that a file the browser cannot decode — a HEIC image saved with a `.jpg`
 * extension, say — never leaves the promise pending forever.
 * @internal
 * @param {object} args Arguments.
 * @param {HTMLImageElement | HTMLMediaElement} args.element Element to be probed.
 * @param {string} args.eventType Event that indicates the media info is available.
 * @param {string} args.src Source URL of the media.
 * @param {() => SourceInfo} args.getInfo Function to collect the info once the event fires.
 * @returns {Promise<SourceInfo>} Dimensions and duration, if available.
 */
const probeSource = ({ element, eventType, src, getInfo }) =>
  /** @type {Promise<SourceInfo>} */ (
    new Promise((resolve) => {
      element.addEventListener(eventType, () => resolve(getInfo()), { once: true });
      element.addEventListener('error', () => resolve({}), { once: true });
      element.src = src;
    })
  );

/**
 * Get the dimensions of an image asset.
 * @internal
 * @param {string} src Source URL of the image.
 * @returns {Promise<SourceInfo>} Dimensions (width/height). `dimensions` is `undefined` if the
 * image cannot be decoded.
 */
export const getImageSourceInfo = (src) => {
  const element = new Image();

  return probeSource({
    element,
    eventType: 'load',
    src,
    // eslint-disable-next-line jsdoc/require-jsdoc
    getInfo: () => ({
      dimensions: { width: element.naturalWidth, height: element.naturalHeight },
    }),
  });
};

/**
 * Get the dimensions and duration of a video or audio asset.
 * @internal
 * @param {string} src Source URL of the media.
 * @param {AssetKind} kind Media type: `video` or `audio`.
 * @returns {Promise<SourceInfo>} Dimensions and duration of the media. Both are `undefined` if the
 * media cannot be decoded.
 */
export const getMediaSourceInfo = async (src, kind) => {
  const element = /** @type {HTMLMediaElement} */ (document.createElement(kind));

  return probeSource({
    element,
    eventType: 'loadedmetadata',
    src,
    // eslint-disable-next-line jsdoc/require-jsdoc
    getInfo: () => {
      const { duration } = element;

      if (kind === 'audio') {
        return { duration };
      }

      const { videoWidth: width, videoHeight: height } = /** @type {HTMLVideoElement} */ (element);

      return { dimensions: { width, height }, duration };
    },
  });
};

/**
 * Get the dimensions and duration of an image, video or audio asset.
 * @internal
 * @param {string} src Source URL.
 * @param {AssetKind} kind Media type: `image`, `video` or `audio`.
 * @returns {Promise<SourceInfo>} Dimensions (width/height) and duration.
 */
export const getSourceInfo = async (src, kind) => {
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
