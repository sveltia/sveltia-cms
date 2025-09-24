import { loadModule } from '$lib/services/app/dependencies';
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

  if (!isImage || !asset.file) {
    return { createdDate: undefined, coordinates: undefined };
  }

  /** @type {import('exifr')} */
  const { parse } = await loadModule('exifr', 'dist/lite.esm.mjs');

  const {
    latitude,
    longitude,
    DateTimeOriginal,
    CreateDate: timestamp = DateTimeOriginal,
  } = (await parse(asset.file).catch(() => {})) ?? {};

  return {
    createdDate: timestamp instanceof Date ? timestamp : undefined,
    coordinates:
      Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { latitude: toFixed(latitude, 7), longitude: toFixed(longitude, 7) }
        : undefined,
  };
};
