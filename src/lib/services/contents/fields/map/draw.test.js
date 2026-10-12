import { beforeEach, describe, expect, test, vi } from 'vitest';

import { loadModule } from '$lib/services/app/dependencies';

import { createMapDrawController, fitMapToGeometry, getDrawnValue } from './draw';

/**
 * @import { GeoJSONStoreFeatures } from 'terra-draw';
 */

vi.mock('$lib/services/app/dependencies', () => ({
  loadModule: vi.fn(),
}));

/**
 * Create a feature on the map.
 * @param {string} id Feature ID.
 * @param {any} coordinates Coordinates.
 * @param {string} [type] Geometry type.
 * @returns {GeoJSONStoreFeatures} Feature.
 */
const feature = (id, coordinates, type = 'Point') =>
  /** @type {GeoJSONStoreFeatures} */ ({
    id,
    type: 'Feature',
    geometry: { type, coordinates },
    properties: {},
  });

/**
 * Create a fake Leaflet map.
 * @returns {any} Map.
 */
const createMap = () => ({ setView: vi.fn(), fitBounds: vi.fn() });

describe('getDrawnValue()', () => {
  test('takes a point once it’s created, rounding its coordinates', () => {
    expect(
      getDrawnValue({
        snapshot: [feature('a', [1, 1]), feature('b', [2.123456, 3.987654])],
        changeType: 'create',
        geometryType: 'Point',
        decimals: 2,
      }),
    ).toEqual({ value: '{"type":"Point","coordinates":[2.12,3.99]}', staleIds: ['a'] });
  });

  test('takes a line or polygon once the drawing is finished', () => {
    const line = feature(
      'a',
      [
        [1, 2],
        [3, 4],
      ],
      'LineString',
    );

    expect(
      getDrawnValue({
        snapshot: [line],
        changeType: 'create',
        geometryType: 'LineString',
        decimals: 7,
      }),
    ).toBeUndefined();
    expect(
      getDrawnValue({
        snapshot: [line],
        changeType: 'delete',
        geometryType: 'LineString',
        decimals: 7,
      }),
    ).toEqual({ value: '{"type":"LineString","coordinates":[[1,2],[3,4]]}', staleIds: [] });
  });

  test('takes nothing without a feature', () => {
    expect(getDrawnValue({ snapshot: [], changeType: 'create', decimals: 7 })).toBeUndefined();
  });
});

describe('fitMapToGeometry()', () => {
  test('centers the map on a point', () => {
    const map = createMap();

    fitMapToGeometry(map, { type: 'Point', coordinates: [139.69, 35.68] });
    expect(map.setView).toHaveBeenCalledWith([35.68, 139.69], 15);

    // An invalid point is ignored
    map.setView.mockClear();
    fitMapToGeometry(map, /** @type {any} */ ({ type: 'Point', coordinates: ['x', 'y'] }));
    expect(map.setView).not.toHaveBeenCalled();
  });

  test('fits the map to a line', () => {
    const map = createMap();

    fitMapToGeometry(map, {
      type: 'LineString',
      coordinates: [
        [1, 2],
        [3, 4],
      ],
    });
    expect(map.fitBounds).toHaveBeenCalledWith([
      [2, 1],
      [4, 3],
    ]);

    // An invalid line is ignored
    map.fitBounds.mockClear();
    fitMapToGeometry(map, /** @type {any} */ ({ type: 'LineString', coordinates: [['x', 'y']] }));
    expect(map.fitBounds).not.toHaveBeenCalled();
  });
});

/**
 * Tell that the editor is still there.
 * @returns {boolean} Result.
 */
const notCancelled = () => false;
/**
 * Tell that the editor has gone.
 * @returns {boolean} Result.
 */
const cancelled = () => true;

describe('createMapDrawController()', () => {
  /** @type {any} */
  let draw;
  /** @type {Record<string, (...args: any[]) => void>} */
  let listeners;
  /** @type {GeoJSONStoreFeatures[]} */
  let snapshot;
  /** @type {any} */
  let modeArgs;

  beforeEach(() => {
    listeners = {};
    snapshot = [];
    modeArgs = undefined;
    draw = {
      start: vi.fn(),
      stop: vi.fn(),
      setMode: vi.fn(),
      clear: vi.fn(),
      addFeatures: vi.fn(),
      removeFeatures: vi.fn(),
      getSnapshot: vi.fn(() => snapshot),
      on: vi.fn((name, fn) => {
        listeners[name] = fn;
      }),
    };

    /**
     * Create a fake mode class.
     * @param {string} name Mode name.
     * @returns {any} Class.
     */
    const mode = (name) =>
      // eslint-disable-next-line jsdoc/require-jsdoc
      class {
        mode = name;
      };

    vi.mocked(loadModule).mockImplementation(async (name) =>
      name === 'terra-draw'
        ? {
            // eslint-disable-next-line jsdoc/require-jsdoc
            TerraDraw: function TerraDraw(/** @type {any} */ args) {
              modeArgs = args;

              return draw;
            },
            TerraDrawPointMode: mode('point'),
            TerraDrawLineStringMode: mode('linestring'),
            TerraDrawPolygonMode: mode('polygon'),
          }
        : {
            // eslint-disable-next-line jsdoc/require-jsdoc
            TerraDrawLeafletAdapter: function TerraDrawLeafletAdapter(/** @type {any} */ args) {
              return { adapterArgs: args };
            },
          },
    );
  });

  test('gives up when cancelled while loading', async () => {
    const controller = await createMapDrawController({
      leaflet: /** @type {any} */ ({}),
      map: createMap(),
      decimals: 7,
      onChange: vi.fn(),
      isCancelled: cancelled,
    });

    expect(controller).toBeUndefined();
    expect(modeArgs).toBeUndefined();
  });

  test('starts the tools and reports a point drawn by the user', async () => {
    const leaflet = /** @type {any} */ ({});
    const map = createMap();
    const onChange = vi.fn();

    const controller = await createMapDrawController({
      leaflet,
      map,
      decimals: 2,
      onChange,
      isCancelled: notCancelled,
    });

    expect(controller).toBeDefined();
    expect(modeArgs.adapter.adapterArgs).toEqual({ lib: leaflet, map });
    expect(modeArgs.modes[0].mode).toBe('point');
    expect(draw.start).toHaveBeenCalled();
    expect(draw.setMode).toHaveBeenCalledWith('point');

    // A change made by the editor itself is ignored
    snapshot = [feature('a', [1, 2])];
    listeners.change([], 'create', { origin: 'api' });
    expect(onChange).not.toHaveBeenCalled();

    // An incomplete change is ignored
    listeners.change([], 'update', undefined);
    expect(onChange).not.toHaveBeenCalled();

    listeners.change([], 'create', undefined);
    expect(onChange).toHaveBeenCalledWith('{"type":"Point","coordinates":[1,2]}');
    expect(draw.removeFeatures).not.toHaveBeenCalled();

    // Only one feature is kept
    snapshot = [feature('a', [1, 2]), feature('b', [3, 4])];
    listeners.change([], 'create', {});
    expect(onChange).toHaveBeenLastCalledWith('{"type":"Point","coordinates":[3,4]}');
    expect(draw.removeFeatures).toHaveBeenCalledWith(['a']);

    controller?.stop();
    expect(draw.stop).toHaveBeenCalled();
  });

  test('shows a geometry, a default view and a location for a point', async () => {
    const map = createMap();

    const controller = await createMapDrawController({
      leaflet: /** @type {any} */ ({}),
      map,
      geometryType: 'Point',
      decimals: 2,
      onChange: vi.fn(),
      isCancelled: notCancelled,
    });

    controller?.showGeometry({ type: 'Point', coordinates: [1, 2] });
    expect(draw.clear).toHaveBeenCalledOnce();
    expect(draw.addFeatures).toHaveBeenCalledWith([
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [1, 2] },
        properties: { mode: 'point' },
      },
    ]);
    expect(map.setView).toHaveBeenCalledWith([2, 1], 15);

    controller?.showGeometry(undefined);
    expect(draw.clear).toHaveBeenCalledTimes(2);
    expect(draw.addFeatures).toHaveBeenCalledOnce();

    controller?.showDefaultView({ center: [139.69, 35.68], zoom: 10 });
    expect(map.setView).toHaveBeenLastCalledWith([35.68, 139.69], 10);
    controller?.showDefaultView({});
    expect(map.setView).toHaveBeenLastCalledWith([0, 0], 2);

    expect(controller?.setLocation({ latitude: 48.856613, longitude: 2.352222 })).toBe(
      '{"type":"Point","coordinates":[2.35,48.86]}',
    );
    expect(map.setView).toHaveBeenLastCalledWith([48.86, 2.35], 15);
    expect(draw.addFeatures).toHaveBeenLastCalledWith([
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [2.35, 48.86] },
        properties: { mode: 'point' },
      },
    ]);
  });

  test('only moves the map to a location for a polygon', async () => {
    const map = createMap();

    const controller = await createMapDrawController({
      leaflet: /** @type {any} */ ({}),
      map,
      geometryType: 'Polygon',
      decimals: 7,
      onChange: vi.fn(),
      isCancelled: notCancelled,
    });

    expect(modeArgs.modes[0].mode).toBe('polygon');
    expect(draw.setMode).toHaveBeenCalledWith('polygon');
    expect(controller?.setLocation({ latitude: 1, longitude: 2 })).toBeUndefined();
    expect(map.setView).toHaveBeenCalledWith([1, 2], 15);
    expect(draw.addFeatures).not.toHaveBeenCalled();
  });
});
