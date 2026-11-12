// @vitest-environment happy-dom

import { TerraDrawExtend } from 'terra-draw';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createLeafletAdapter } from './leaflet-adapter';

/**
 * @import { GeoJSONStoreFeatures, TerraDrawAdapterStyling } from 'terra-draw';
 */

/**
 * Create a fake Leaflet map.
 * @returns {any} Map.
 */
const createMap = () => {
  const container = document.createElement('div');
  /** @type {Record<string, HTMLElement>} */
  const panes = {};

  return {
    panes,
    // eslint-disable-next-line jsdoc/require-jsdoc
    getContainer: () => container,
    getPane: vi.fn((name) => panes[name]),
    createPane: vi.fn((name) => {
      panes[name] = document.createElement('div');

      return panes[name];
    }),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    dragging: { enable: vi.fn(), disable: vi.fn() },
    doubleClickZoom: { enable: vi.fn(), disable: vi.fn() },
    latLngToContainerPoint: vi.fn(({ lng, lat }) => ({ x: lng * 2, y: lat * 2, extra: true })),
    containerPointToLatLng: vi.fn(([x, y]) => ({ lng: x / 2, lat: y / 2, extra: true })),
  };
};

/**
 * Create a fake Leaflet library, whose layers hold the given data and options.
 * @returns {any} Library.
 */
const createLeaflet = () => ({
  // eslint-disable-next-line jsdoc/require-jsdoc
  geoJSON: vi.fn((data, options) => ({ data, options, toGeoJSON: () => data })),
  circleMarker: vi.fn((latlng, options) => ({ latlng, options })),
});

/**
 * Create a feature.
 * @param {string | undefined} id Feature ID.
 * @param {string} type Geometry type.
 * @returns {GeoJSONStoreFeatures} Feature.
 */
const feature = (id, type = 'Point') =>
  /** @type {GeoJSONStoreFeatures} */ ({
    id,
    type: 'Feature',
    geometry: { type, coordinates: [] },
    properties: { mode: 'draw' },
  });

/**
 * Create styling functions returning the given styles for every feature.
 * @param {Partial<TerraDrawAdapterStyling>} [styles] Styles.
 * @returns {any} Styling functions keyed with the draw mode.
 */
const styling = (styles = {}) => ({
  // eslint-disable-next-line jsdoc/require-jsdoc
  draw: () => ({
    zIndex: 30,
    pointWidth: 6,
    pointColor: '#111111',
    pointOutlineWidth: 2,
    pointOutlineColor: '#222222',
    lineStringColor: '#333333',
    lineStringWidth: 4,
    polygonFillColor: '#444444',
    polygonFillOpacity: 0.3,
    polygonOutlineColor: '#555555',
    polygonOutlineWidth: 1,
    ...styles,
  }),
});

/** @type {any} */
let map;
/** @type {any} */
let leaflet;
/** @type {any} */
let adapter;

beforeEach(() => {
  map = createMap();
  leaflet = createLeaflet();
  adapter = createLeafletAdapter({ TerraDrawExtend, leaflet, map });
});

/**
 * Render the given changes.
 * @param {Partial<{ created: any[], updated: any[], deletedIds: string[] }>} changes Changes.
 * @param {any} [_styling] Styling functions.
 */
const render = (changes, _styling = styling()) => {
  adapter.render({ created: [], updated: [], unchanged: [], deletedIds: [], ...changes }, _styling);
};

/**
 * Get the layer added to the map with the given index.
 * @param {number} [index] Index.
 * @returns {any} Layer.
 */
const addedLayer = (index = 0) => map.addLayer.mock.calls[index][0];

describe('createLeafletAdapter()', () => {
  test('extends the base adapter of the given Terra Draw module', () => {
    expect(adapter).toBeInstanceOf(TerraDrawExtend.TerraDrawBaseAdapter);
  });

  test('draws a point as a circle in a pane for its z-index', () => {
    render({ created: [feature('a')] });

    const layer = addedLayer();
    const latlng = { lat: 1, lng: 2 };

    expect(layer.data).toEqual(feature('a'));

    layer.options.pointToLayer(feature('a'), latlng);

    expect(leaflet.circleMarker).toHaveBeenCalledWith(latlng, {
      radius: 6,
      stroke: true,
      color: '#222222',
      weight: 2,
      opacity: 1,
      fillColor: '#111111',
      fillOpacity: 1,
      pane: 'terra-draw-30',
      interactive: false,
    });
    expect(map.panes['terra-draw-30'].style.zIndex).toBe('630');

    // The pane is created only once
    layer.options.pointToLayer(feature('a'), latlng);
    expect(map.createPane).toHaveBeenCalledOnce();
  });

  test('applies the point opacities, without an outline if it has no width', () => {
    render(
      { created: [feature('a')] },
      styling({ pointOutlineWidth: 0, pointOpacity: 0.5, pointOutlineOpacity: 0.2 }),
    );
    addedLayer().options.pointToLayer(feature('a'), {});

    expect(leaflet.circleMarker).toHaveBeenLastCalledWith(
      {},
      expect.objectContaining({ stroke: false, opacity: 0.2, fillOpacity: 0.5 }),
    );
  });

  test('leaves the circle of a point as drawn', () => {
    render({ created: [feature('a')] });

    expect(addedLayer().options.style(feature('a'))).toEqual({});
    expect(map.createPane).not.toHaveBeenCalled();
  });

  test('styles a line', () => {
    render({ created: [feature('a', 'LineString')] });

    expect(addedLayer().options.style(feature('a', 'LineString'))).toEqual({
      color: '#333333',
      weight: 4,
      opacity: 1,
      pane: 'terra-draw-30',
      interactive: false,
    });

    render({ created: [feature('b', 'LineString')] }, styling({ lineStringOpacity: 0.4 }));

    expect(addedLayer(1).options.style(feature('b', 'LineString'))).toHaveProperty('opacity', 0.4);
  });

  test('styles a polygon', () => {
    render({ created: [feature('a', 'Polygon')] });

    expect(addedLayer().options.style(feature('a', 'Polygon'))).toEqual({
      stroke: true,
      color: '#555555',
      weight: 1,
      opacity: 1,
      fillColor: '#444444',
      fillOpacity: 0.3,
      pane: 'terra-draw-30',
      interactive: false,
    });

    render({ created: [feature('b', 'Polygon')] }, styling({ polygonOutlineOpacity: 0.6 }));

    expect(addedLayer(1).options.style(feature('b', 'Polygon'))).toHaveProperty('opacity', 0.6);
  });

  test('replaces the layer of an updated feature, and removes a deleted one', () => {
    render({ created: [feature('a')] });

    const created = addedLayer();

    render({ updated: [feature('a')] });

    expect(map.removeLayer).toHaveBeenCalledExactlyOnceWith(created);

    const updated = addedLayer(1);

    render({ deletedIds: ['a', 'unknown'] });

    expect(map.removeLayer).toHaveBeenCalledTimes(2);
    expect(map.removeLayer).toHaveBeenLastCalledWith(updated);
  });

  test('ignores a feature without an ID', () => {
    render({ created: [feature(undefined)] });

    expect(map.addLayer).not.toHaveBeenCalled();
  });

  describe('when only the styles have changed', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('redraws every feature with the new styles', () => {
      render({ created: [feature('a'), feature('b')] });

      const [layerA, layerB] = [addedLayer(0), addedLayer(1)];
      const newStyling = styling({ pointWidth: 10 });

      render({}, newStyling);

      expect(map.addLayer).toHaveBeenCalledTimes(2);

      vi.runAllTimers();

      expect(map.removeLayer.mock.calls).toEqual([[layerA], [layerB]]);
      expect(map.addLayer).toHaveBeenCalledTimes(4);
      expect(addedLayer(2).data).toEqual(feature('a'));
      expect(addedLayer(3).data).toEqual(feature('b'));

      addedLayer(2).options.pointToLayer(feature('a'), {});
      expect(leaflet.circleMarker).toHaveBeenLastCalledWith(
        {},
        expect.objectContaining({ radius: 10 }),
      );
    });
  });

  test('clears the features once registered', () => {
    const onClear = vi.fn();
    const onReady = vi.fn();

    render({ created: [feature('a')] });

    // Nothing to clear before the mode is registered
    adapter.clear();
    expect(map.removeLayer).not.toHaveBeenCalled();

    adapter.register({ onClear, onReady });
    expect(onReady).toHaveBeenCalledOnce();

    adapter.clear();
    expect(onClear).toHaveBeenCalledOnce();
    expect(map.removeLayer).toHaveBeenCalledExactlyOnceWith(addedLayer());

    // The mode may not have `onReady`
    adapter.unregister();
    expect(() => adapter.register({ onClear })).not.toThrow();
    adapter.unregister();
  });

  test('converts between coordinates and positions in the map container', () => {
    expect(adapter.project(1, 2)).toEqual({ x: 2, y: 4 });
    expect(map.latLngToContainerPoint).toHaveBeenCalledWith({ lng: 1, lat: 2 });
    expect(adapter.unproject(2, 4)).toEqual({ lng: 1, lat: 2 });
    expect(map.containerPointToLatLng).toHaveBeenCalledWith([2, 4]);
  });

  test('gets the coordinates of a pointer event', () => {
    vi.spyOn(map.getContainer(), 'getBoundingClientRect').mockReturnValue(
      /** @type {DOMRect} */ ({ left: 10, top: 20 }),
    );

    expect(adapter.getLngLatFromEvent({ clientX: 14, clientY: 26 })).toEqual({ lng: 2, lat: 3 });

    map.containerPointToLatLng.mockReturnValueOnce({ lng: NaN, lat: 0 });
    expect(adapter.getLngLatFromEvent({ clientX: 0, clientY: 0 })).toBeNull();

    map.containerPointToLatLng.mockReturnValueOnce({ lng: 0, lat: NaN });
    expect(adapter.getLngLatFromEvent({ clientX: 0, clientY: 0 })).toBeNull();
  });

  test('handles the events on the map container', () => {
    expect(adapter.getMapEventElement()).toBe(map.getContainer());
  });

  test('enables or disables dragging and zooming with a double click', () => {
    adapter.setDraggability(false);
    adapter.setDraggability(true);
    adapter.setDoubleClickToZoom(false);
    adapter.setDoubleClickToZoom(true);

    expect(map.dragging.disable).toHaveBeenCalledOnce();
    expect(map.dragging.enable).toHaveBeenCalledOnce();
    expect(map.doubleClickZoom.disable).toHaveBeenCalledOnce();
    expect(map.doubleClickZoom.enable).toHaveBeenCalledOnce();
  });

  test('sets or removes the cursor', () => {
    const { style } = map.getContainer();

    adapter.setCursor('crosshair');
    expect(style.cursor).toBe('crosshair');

    adapter.setCursor('unset');
    expect(style.cursor).toBe('');
  });
});
