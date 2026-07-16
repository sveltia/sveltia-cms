// cSpell:ignore lngs

import { isObject } from '@sveltia/utils/object';

import { toFixed } from '$lib/services/utils/number';

/**
 * @import { GeoJSONStoreGeometries } from 'terra-draw';
 * @import { MapField } from '$lib/types/public';
 */

/**
 * Check whether a string is a valid GeoJSON geometry object for the given geometry type.
 * @param {string} value Stringified GeoJSON geometry object.
 * @param {MapField['type']} [geometryType] Expected geometry type. Default: `Point`.
 * @returns {boolean} Whether the value is valid.
 */
export const isValidGeoJSON = (value, geometryType = 'Point') => {
  try {
    const geometry = JSON.parse(value);

    return (
      isObject(geometry) && geometry.type === geometryType && Array.isArray(geometry.coordinates)
    );
  } catch {
    return false;
  }
};

/**
 * Round all coordinates in a GeoJSON geometry to the specified number of decimal places. Works for
 * Point (`[lng, lat]`), LineString (`[[lng, lat], ...]`), and Polygon (`[[[lng, lat], ...], ...]`)
 * coordinate structures.
 * @param {GeoJSONStoreGeometries['coordinates']} coordinates GeoJSON coordinates to round.
 * @param {number} decimals Number of decimal places.
 * @returns {GeoJSONStoreGeometries['coordinates']} Rounded coordinates.
 */
export const roundCoordinates = (coordinates, decimals) =>
  /** @type {GeoJSONStoreGeometries['coordinates']} */ (
    coordinates.map((coords) =>
      Array.isArray(coords)
        ? coords.map((c) =>
            Array.isArray(c) ? c.map((cc) => toFixed(cc, decimals)) : toFixed(c, decimals),
          )
        : toFixed(coords, decimals),
    )
  );

/**
 * Compute the Leaflet-style bounding box of a non-Point GeoJSON geometry as `[[minLat, minLng],
 * [maxLat, maxLng]]`. Returns `null` if the geometry is a Point or if any coordinate value is not a
 * number.
 * @param {GeoJSONStoreGeometries} geometry GeoJSON geometry object.
 * @returns {[[number, number], [number, number]] | null} Bounding box, or `null`.
 */
export const getGeometryBounds = (geometry) => {
  if (geometry.type === 'Point') {
    return null;
  }

  // Polygon coordinates are nested one level deeper (`[[[lng, lat], ...]]`), so flatten first.
  const pairs = geometry.type === 'Polygon' ? geometry.coordinates.flat(1) : geometry.coordinates;

  if (!pairs.every((c) => typeof c[0] === 'number' && typeof c[1] === 'number')) {
    return null;
  }

  const lats = pairs.map((c) => c[1]);
  const lngs = pairs.map((c) => c[0]);

  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
};
