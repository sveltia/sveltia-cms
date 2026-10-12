import { loadModule } from '$lib/services/app/dependencies';
import { getGeometryBounds, roundCoordinates } from '$lib/services/contents/fields/map/helpers';
import { toFixed } from '$lib/services/utils/number';

/**
 * @import Leaflet from 'leaflet';
 * @import { GeoJSONStoreFeatures, GeoJSONStoreGeometries } from 'terra-draw';
 * @import { GeoCoordinates } from '$lib/types/private';
 * @import { MapField } from '$lib/types/public';
 */

/**
 * Controller of the drawing tools on a Map field’s map, created with
 * {@link createMapDrawController}.
 * @typedef {object} MapDrawController
 * @property {(geometry: GeoJSONStoreGeometries | undefined) => void} showGeometry Replace the drawn
 * feature with the given geometry, and fit the map to it. Without a geometry, the map is just
 * cleared.
 * @property {(view: { center?: [number, number], zoom?: number }) => void} showDefaultView Show the
 * configured center and zoom level, for a field without a valid value.
 * @property {(coordinates: GeoCoordinates) => string | undefined} setLocation Move the map to the
 * given location, and, for a Point field, put the point there. Returns the new value of a Point
 * field, rounded to the configured number of decimals.
 * @property {() => void} stop Stop the drawing tools.
 */

/**
 * Get the value to be stored for a feature the user has drawn, after a change in Terra Draw. A
 * point is complete once it’s created, while a line or polygon is complete once the drawing is
 * finished, which Terra Draw reports as the deletion of the provisional feature.
 * @param {object} args Arguments.
 * @param {GeoJSONStoreFeatures[]} args.snapshot Features on the map, the latest last.
 * @param {string} args.changeType Type of change Terra Draw reported.
 * @param {MapField['type']} [args.geometryType] Geometry type of the field. Default: `Point`.
 * @param {number} args.decimals Number of decimals the coordinates are rounded to.
 * @returns {{ value: string, staleIds: string[] } | undefined} Stringified GeoJSON geometry, and
 * the IDs of the other features to be removed, as the field only takes one. `undefined` if there is
 * nothing to store yet.
 */
export const getDrawnValue = ({ snapshot, changeType, geometryType = 'Point', decimals }) => {
  const feature = snapshot.at(-1);

  if (!feature || changeType !== (geometryType === 'Point' ? 'create' : 'delete')) {
    return undefined;
  }

  return {
    value: JSON.stringify({
      type: geometryType,
      coordinates: roundCoordinates(feature.geometry.coordinates, decimals),
    }),
    staleIds: snapshot.filter((f) => f.id !== feature.id).map((f) => /** @type {string} */ (f.id)),
  };
};

/**
 * Fit the map view to the given geometry. For a Point, the map is centered on the coordinates at
 * zoom level 15. For a LineString or Polygon, the map is fitted to the bounding box of all
 * coordinate pairs. Leaflet takes `[latitude, longitude]`, while GeoJSON has `[longitude,
 * latitude]`.
 * @param {Leaflet.Map} map Leaflet map.
 * @param {GeoJSONStoreGeometries} geometry GeoJSON geometry object.
 */
export const fitMapToGeometry = (map, geometry) => {
  if (geometry.type === 'Point') {
    const [longitude, latitude] = geometry.coordinates;

    if (typeof longitude === 'number' && typeof latitude === 'number') {
      map.setView([latitude, longitude], 15);
    }

    return;
  }

  const bounds = getGeometryBounds(geometry);

  if (bounds) {
    map.fitBounds(bounds);
  }
};

/**
 * Load Terra Draw and start the drawing tools on a Map field’s map. The libraries are not bundled
 * because of their size: a Map field may not be used often, and other services or adapters may be
 * supported in the future.
 * @param {object} args Arguments.
 * @param {Leaflet} args.leaflet Leaflet library.
 * @param {Leaflet.Map} args.map Leaflet map.
 * @param {MapField['type']} [args.geometryType] Geometry type of the field. Default: `Point`.
 * @param {number} args.decimals Number of decimals the coordinates are rounded to.
 * @param {(value: string) => void} args.onChange Function called with the stringified GeoJSON
 * geometry of a feature the user has drawn.
 * @param {() => boolean} args.isCancelled Function telling whether the editor has gone while the
 * libraries were loading, along with the map, so the tools are no longer needed.
 * @returns {Promise<MapDrawController | undefined>} Controller, or `undefined` if cancelled.
 */
export const createMapDrawController = async ({
  leaflet,
  map,
  geometryType = 'Point',
  decimals,
  onChange,
  isCancelled,
}) => {
  /** @type {import('terra-draw')} */
  const { TerraDraw, TerraDrawLineStringMode, TerraDrawPointMode, TerraDrawPolygonMode } =
    await loadModule('terra-draw', 'dist/terra-draw.module.js');

  /** @type {import('terra-draw-leaflet-adapter')} */
  const { TerraDrawLeafletAdapter } = await loadModule(
    'terra-draw-leaflet-adapter',
    'dist/terra-draw-leaflet-adapter.module.js?module',
  );

  if (isCancelled()) {
    return undefined;
  }

  const Mode = {
    Point: TerraDrawPointMode,
    LineString: TerraDrawLineStringMode,
    Polygon: TerraDrawPolygonMode,
  }[geometryType];

  const drawMode = geometryType.toLowerCase();

  const draw = new TerraDraw({
    adapter: new TerraDrawLeafletAdapter({ lib: leaflet, map }),
    modes: [new Mode()],
  });

  draw.start();
  draw.setMode(drawMode);

  draw.on('change', (_ids, changeType, context) => {
    // Ignore the features added or removed by the editor itself, e.g. the stored value: rounding
    // it would modify the entry as soon as it’s opened
    if (context && 'origin' in context) {
      return;
    }

    const result = getDrawnValue({
      snapshot: draw.getSnapshot(),
      changeType,
      geometryType,
      decimals,
    });

    if (!result) {
      return;
    }

    onChange(result.value);

    // Allow to have only one feature
    if (result.staleIds.length) {
      draw.removeFeatures(result.staleIds);
    }
  });

  /**
   * Replace the drawn feature with the given geometry.
   * @param {GeoJSONStoreGeometries} geometry Geometry.
   * @param {string} mode Draw mode of the feature.
   */
  const replaceFeature = (geometry, mode) => {
    draw.clear();
    draw.addFeatures([{ type: 'Feature', geometry, properties: { mode } }]);
  };

  return {
    /**
     * Replace the drawn feature with the given geometry, and fit the map to it.
     * @param {GeoJSONStoreGeometries | undefined} geometry Geometry. Without one, the map is just
     * cleared.
     */
    showGeometry: (geometry) => {
      if (!geometry) {
        draw.clear();

        return;
      }

      replaceFeature(geometry, drawMode);
      fitMapToGeometry(map, geometry);
    },
    /**
     * Show the configured center and zoom level.
     * @param {object} view View.
     * @param {[number, number]} [view.center] Center as `[longitude, latitude]`.
     * @param {number} [view.zoom] Zoom level.
     */
    showDefaultView: ({ center, zoom }) => {
      map.setView(center ? [center[1], center[0]] : [0, 0], zoom ?? 2);
    },
    /**
     * Move the map to the given location, and, for a Point field, put the point there.
     * @param {GeoCoordinates} coordinates Coordinates.
     * @returns {string | undefined} New value of a Point field.
     */
    setLocation: ({ latitude, longitude }) => {
      latitude = toFixed(latitude, decimals);
      longitude = toFixed(longitude, decimals);

      map.setView([latitude, longitude], 15);

      if (geometryType !== 'Point') {
        return undefined;
      }

      /** @type {GeoJSONStoreGeometries} */
      const geometry = { type: 'Point', coordinates: [longitude, latitude] };

      replaceFeature(geometry, 'point');

      return JSON.stringify(geometry);
    },
    /**
     * Stop the drawing tools.
     */
    stop: () => {
      draw.stop();
    },
  };
};
