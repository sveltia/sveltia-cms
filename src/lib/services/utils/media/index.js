import ExifReader from 'exifreader';
import { toFixed } from '$lib/services/utils/number';

/**
 * @import { Asset, AssetKind, GeoCoordinates, MediaDimensions } from '$lib/types/private';
 */

/**
 * Regular expression to match the EXIF date/time format like `2023:10:01 12:34:56`.
 */
const EXIF_DATETIME_PATTERN =
  /^(?<year>\d{4}):(?<month>\d{2}):(?<date>\d{2}) (?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})$/;

/**
 * Get the dimensions and duration of an image, video or audio asset.
 * @param {string} src Source URL.
 * @param {AssetKind} kind Media type: `image`, `video` or `audio`.
 * @returns {Promise<{ dimensions: MediaDimensions | undefined, duration: number | undefined }>}
 * Dimensions (width/height) and duration.
 */
const getSourceInfo = (src, kind) => {
  const isImage = kind === 'image';

  const element = isImage
    ? new Image()
    : /** @type {HTMLMediaElement} */ (document.createElement(kind));

  return new Promise((resolve) => {
    // eslint-disable-next-line jsdoc/require-jsdoc
    const listener = () => {
      const dimensions =
        kind === 'audio'
          ? undefined
          : {
              width: isImage
                ? /** @type {HTMLImageElement} */ (element).naturalWidth
                : /** @type {HTMLVideoElement} */ (element).videoWidth,
              height: isImage
                ? /** @type {HTMLImageElement} */ (element).naturalHeight
                : /** @type {HTMLVideoElement} */ (element).videoHeight,
            };

      const duration = isImage ? undefined : /** @type {HTMLMediaElement} */ (element).duration;

      resolve({ dimensions, duration });
    };

    element.addEventListener(isImage ? 'load' : 'loadedmetadata', listener, { once: true });
    element.src = src;
  });
};

/**
 * Extract the timestamp and coordinates (latitude/longitude) from EXIF data of an image asset.
 * @param {Asset} asset Asset object.
 * @param {AssetKind} kind Media type: `image`, `video` or `audio`.
 * @returns {Promise<{ createdDate: Date | undefined, coordinates: GeoCoordinates | undefined }>}
 * Date/Time and GPS Coordinates. If the asset is not an image or does not have EXIF data, returns
 * `undefined`.
 * @see https://github.com/mattiasw/ExifReader
 * @todo Extract more EXIF metadata, such as camera model, exposure time, etc.
 */
const extractExifData = async (asset, kind) => {
  const isImage = kind === 'image';

  if (!isImage || !asset.file) {
    return { createdDate: undefined, coordinates: undefined };
  }

  const {
    exif: { DateTimeOriginal, DateTime } = { DateTimeOriginal: undefined, DateTime: undefined },
    gps: { Latitude, Longitude } = { Latitude: undefined, Longitude: undefined },
  } = (await ExifReader.load(asset.file, { expanded: true }).catch(() => {})) ?? {};

  const dateTimeStr = DateTimeOriginal?.description ?? DateTime?.description;
  const dateTimeMatch = dateTimeStr?.match(EXIF_DATETIME_PATTERN);
  let createdDate = undefined;
  let coordinates = undefined;

  if (dateTimeMatch?.groups) {
    const { year, month, date, hour, minute, second } = dateTimeMatch.groups;
    const dateTime = new Date(`${year}-${month}-${date}T${hour}:${minute}:${second}Z`);

    if (!Number.isNaN(dateTime.getTime())) {
      createdDate = dateTime;
    }
  }

  if (
    typeof Latitude === 'number' &&
    typeof Longitude === 'number' &&
    Number.isFinite(Latitude) &&
    Number.isFinite(Longitude)
  ) {
    coordinates = {
      latitude: toFixed(Latitude, 7),
      longitude: toFixed(Longitude, 7),
    };
  }

  return { createdDate, coordinates };
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
