import { loadModule } from '$lib/services/app/dependencies';
import { getAssetBlob } from '$lib/services/assets/info';
import { toFixed } from '$lib/services/utils/number';

/**
 * @import { Asset, AssetKind, GeoCoordinates } from '$lib/types/private';
 */

/**
 * Extract the timestamp and coordinates (latitude/longitude) from EXIF data of an image asset.
 * @param {Asset} asset Asset object.
 * @param {AssetKind} kind Media type: `image`, `video` or `audio`.
 * @returns {Promise<{ createdDate: Date | undefined, coordinates: GeoCoordinates | undefined }>}
 * Date/Time and GPS Coordinates. If the asset is not an image or does not have EXIF data, returns
 * `undefined`.
 * @see https://github.com/MikeKovarik/exifr
 * @todo Extract more EXIF metadata, such as camera model, exposure time, etc.
 */
export const extractExifData = async (asset, kind) => {
  const isImage = kind === 'image';
  const blob = isImage ? await getAssetBlob(asset) : null;

  if (!blob) {
    return { createdDate: undefined, coordinates: undefined };
  }

  /** @type {Record<string, any>} */
  let exif = {};

  try {
    /** @type {import('exifr')} */
    const { parse } = await loadModule('exifr', 'dist/lite.esm.mjs');

    exif = (await parse(blob)) ?? {};
  } catch {
    // EXIF is optional metadata, so a failed CDN load — due to a network issue or an ad blocker —
    // or an unparsable file shouldn’t block the caller
  }

  const { latitude, longitude, DateTimeOriginal, CreateDate: timestamp = DateTimeOriginal } = exif;

  return {
    createdDate: timestamp instanceof Date ? timestamp : undefined,
    coordinates:
      Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { latitude: toFixed(latitude, 7), longitude: toFixed(longitude, 7) }
        : undefined,
  };
};
