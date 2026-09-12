import { getEntriesByAssetURL } from '$lib/services/contents/collection/entries';
import { getSourceInfo } from '$lib/services/utils/media';

/**
 * @import { Entry, ExternalAsset, MediaDimensions } from '$lib/types/private';
 */

/**
 * Media info of an asset on a cloud storage service.
 * @typedef {object} ExternalAssetDetails
 * @property {MediaDimensions} [dimensions] Media dimensions available for an image or video file.
 * @property {number} [duration] Media duration available for a video or audio file, in seconds.
 */

/**
 * Media info for the assets looked at so far, keyed by download URL. Collecting it loads the file
 * in a media element to read its dimensions and duration, and the result depends on nothing but
 * the file, so it’s gathered once per file rather than once per component asking for it.
 * @type {Map<string, Promise<ExternalAssetDetails>>}
 */
const cachedDetails = new Map();

/* v8 ignore next */
/**
 * Reset the media info cache. This is used in tests to reset the state between tests.
 */
export const _resetExternalAssetDetailsCache = () => {
  cachedDetails.clear();
};

/**
 * Get the media info of the given asset on a cloud storage service. Unlike a repository asset, the
 * file is loaded from its public URL, which doesn’t require the service to allow cross-origin
 * requests, but Exif data can’t be read. A failed attempt isn’t remembered, so a later caller can
 * try again.
 * @param {ExternalAsset} asset Asset.
 * @returns {Promise<ExternalAssetDetails>} Details, or an empty object for a file with no media
 * info.
 */
export const getExternalAssetDetails = (asset) => {
  const { kind, downloadURL } = asset;

  if (!['image', 'video', 'audio'].includes(kind)) {
    return Promise.resolve({});
  }

  let pending = cachedDetails.get(downloadURL);

  if (!pending) {
    pending = getSourceInfo(downloadURL, kind).catch((ex) => {
      cachedDetails.delete(downloadURL);

      throw ex;
    });

    cachedDetails.set(downloadURL, pending);
  }

  return pending;
};

/**
 * Get the list of entries using the given asset on a cloud storage service. Such an asset is
 * hotlinked, so its download URL is what the entries store.
 * @param {ExternalAsset} asset Asset.
 * @returns {Promise<Entry[]>} List of entries using the asset.
 */
export const getExternalAssetUsedEntries = async ({ downloadURL }) =>
  getEntriesByAssetURL(downloadURL);
