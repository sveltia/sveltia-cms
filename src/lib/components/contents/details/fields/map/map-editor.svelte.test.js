import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { searchLocations } from '$lib/services/contents/fields/map/geocoding';

import MapEditor from './map-editor.svelte';

vi.mock('$lib/services/app/dependencies', () => ({
  getUnpkgURL: vi.fn((name) => `https://unpkg.com/${name}`),
  loadModule: vi.fn((library) => {
    if (library === 'leaflet') {
      return import('leaflet/dist/leaflet-src.esm.js');
    }

    if (library === 'terra-draw') {
      return import('terra-draw');
    }

    return import('terra-draw-leaflet-adapter');
  }),
  getChunkURLs: vi.fn(() => []),
  loadChunk: vi.fn(),
}));
vi.mock('$lib/services/contents/fields/map/geocoding', () => ({ searchLocations: vi.fn() }));

/**
 * Render the editor.
 * @param {Record<string, any>} [config] Field options.
 * @param {string} [currentValue] Field value.
 * @param {Record<string, any>} [props] Props to override.
 * @returns {Promise<{ props: any, container: HTMLElement }>} Props and container.
 */
const renderEditor = async (config = {}, currentValue = '', props = {}) => {
  const _props = $state({
    fieldConfig: { name: 'location', widget: 'map', ...config },
    currentValue,
    ...props,
  });

  const { container } = await render(MapEditor, /** @type {any} */ (_props));

  return { props: _props, container };
};

/**
 * Wait for the drawing tools to be ready.
 * @param {HTMLElement} container Container.
 * @returns {Promise<void>}
 */
const waitForMap = async (container) => {
  await expect.poll(() => container.querySelector('.leaflet-container')).not.toBeNull();
  // The drawing library is loaded after the map
  await sleep(300);
};

describe('MapEditor', () => {
  beforeEach(() => {
    vi.mocked(searchLocations).mockResolvedValue([]);
  });

  test('shows the map with the tools, clearing the value on request', async () => {
    const { props, container } = await renderEditor(
      {},
      JSON.stringify({ type: 'Point', coordinates: [139.6917, 35.6895] }),
    );

    await waitForMap(container);

    await expect
      .element(page.getByRole('searchbox'))
      .toHaveAttribute('placeholder', 'Find a Place');
    await expect.element(page.getByRole('button', { name: 'Use Your Location' })).toBeEnabled();

    const clear = page.getByRole('button', { name: 'Clear' });

    await expect.element(clear).toBeEnabled();
    await clear.click();
    expect(props.currentValue).toBe('');
    await expect.element(clear).toBeDisabled();
  });

  test('places a point at a searched location', async () => {
    vi.mocked(searchLocations).mockResolvedValue([
      /** @type {any} */ ({
        place_id: 1,
        display_name: 'Tokyo, Japan',
        lat: '35.6895',
        lon: '139.6917',
      }),
    ]);

    const { props, container } = await renderEditor({ decimals: 2 });

    await waitForMap(container);
    await page.getByRole('searchbox').fill('Tokyo');

    const listbox = page.getByRole('listbox', { name: 'Search Results' });

    await expect.element(listbox.getByRole('option', { name: 'Tokyo, Japan' })).toBeInTheDocument();
    expect(searchLocations).toHaveBeenCalledWith('Tokyo');

    await sleep(150);
    await listbox.getByRole('option', { name: 'Tokyo, Japan' }).click();

    await expect
      .poll(() => props.currentValue)
      .toBe(JSON.stringify({ type: 'Point', coordinates: [139.69, 35.69] }));
  });

  test('reports a search without results', async () => {
    const { container } = await renderEditor();

    await waitForMap(container);
    await page.getByRole('searchbox').fill('Nowhere');
    await expect.element(page.getByRole('alert')).toHaveTextContent('No results found.');
  });

  test('uses the current location', async () => {
    const { props, container } = await renderEditor();

    await waitForMap(container);

    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation((success) => {
      success(/** @type {any} */ ({ coords: { latitude: 48.8566, longitude: 2.3522 } }));
    });

    await page.getByRole('button', { name: 'Use Your Location' }).click();
    await expect
      .poll(() => props.currentValue)
      .toBe(JSON.stringify({ type: 'Point', coordinates: [2.3522, 48.8566] }));
  });

  test('reports a failure to get the location', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = await renderEditor();

    await waitForMap(container);

    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation((_success, error) => {
      error?.(/** @type {any} */ ({ code: 1, message: 'Denied' }));
    });

    await page.getByRole('button', { name: 'Use Your Location' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Geolocation Error' });

    await expect
      .element(dialog)
      .toHaveTextContent('Geolocation Error There was an error while retrieving your location. OK');
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect.poll(() => document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  test('reports a browser without geolocation', async () => {
    const { container } = await renderEditor();

    await waitForMap(container);

    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });

    try {
      await page.getByRole('button', { name: 'Use Your Location' }).click();
      await expect
        .element(page.getByRole('alertdialog', { name: 'Geolocation Error' }))
        .toHaveTextContent(
          'Geolocation Error Geolocation API is not supported by this browser. OK',
        );
    } finally {
      // @ts-ignore The instance property was added above
      delete navigator.geolocation;
    }
  });

  test('keeps a single point on the map', async () => {
    const { props, container } = await renderEditor(
      {},
      JSON.stringify({ type: 'Point', coordinates: [139.6917, 35.6895] }),
    );

    await waitForMap(container);
    // The drawing library renders the features in its own pane
    await expect.poll(() => container.querySelectorAll('.leaflet-30-pane path').length).toBe(1);

    // Clicking elsewhere on the map places the point there instead
    const map = /** @type {HTMLElement} */ (container.querySelector('.leaflet-container'));
    const { left, top, width, height } = map.getBoundingClientRect();
    const clientX = left + width / 4;
    const clientY = top + height / 4;

    ['pointerdown', 'pointerup'].forEach((type) => {
      map.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          isPrimary: true,
          pointerId: 1,
          clientX,
          clientY,
          button: 0,
        }),
      );
    });

    await expect
      .poll(() => props.currentValue)
      .not.toBe(JSON.stringify({ type: 'Point', coordinates: [139.6917, 35.6895] }));
    expect(container.querySelectorAll('.leaflet-30-pane path')).toHaveLength(1);
  });

  test('fits the map to a line, which a searched location can’t replace', async () => {
    vi.mocked(searchLocations).mockResolvedValue([
      /** @type {any} */ ({ place_id: 1, display_name: 'Tokyo, Japan', lat: '35.7', lon: '139.7' }),
    ]);

    const value = JSON.stringify({
      type: 'LineString',
      coordinates: [
        [139.69, 35.69],
        [139.75, 35.66],
      ],
    });

    const { props, container } = await renderEditor({ type: 'LineString' }, value);

    await waitForMap(container);
    // Lines are drawn in a pane of their own
    await expect.poll(() => container.querySelector('.leaflet-10-pane path')).not.toBeNull();

    await page.getByRole('searchbox').fill('Tokyo');

    const listbox = page.getByRole('listbox', { name: 'Search Results' });

    await expect.element(listbox.getByRole('option', { name: 'Tokyo, Japan' })).toBeInTheDocument();
    await sleep(150);
    await listbox.getByRole('option', { name: 'Tokyo, Japan' }).click();
    await sleep(100);
    expect(props.currentValue).toBe(value);

    // A point is not a valid value for the field
    props.currentValue = JSON.stringify({ type: 'Point', coordinates: [139.69, 35.69] });
    await expect.poll(() => container.querySelector('.leaflet-10-pane path')).toBeNull();
  });

  test('ignores an invalid value', async () => {
    const { container } = await renderEditor({}, 'not json');

    await waitForMap(container);
    await expect.element(page.getByRole('button', { name: 'Clear' })).toBeEnabled();
    expect(container.querySelector('.leaflet-marker-icon')).toBeNull();
  });

  test('starts at the configured center and zoom level without a value', async () => {
    const { container } = await renderEditor(
      { center: [139.7, 35.7], zoom: 10 },
      /** @type {any} */ (null),
    );

    await waitForMap(container);
    await expect
      .poll(() => container.querySelector('.leaflet-tile')?.getAttribute('src'))
      .toMatch(/\/10\/\d+\/\d+\.png$/);
  });

  test('doesn’t move the map to a geometry with broken coordinates', async () => {
    const { container, props } = await renderEditor(
      {},
      JSON.stringify({ type: 'Point', coordinates: ['x', 'y'] }),
    );

    await waitForMap(container);
    // The world map at zoom level 2
    await expect
      .poll(() => container.querySelector('.leaflet-tile')?.getAttribute('src'))
      .toMatch(/\/2\/\d+\/\d+\.png$/);

    props.fieldConfig = { name: 'location', widget: 'map', type: 'LineString' };
    props.currentValue = JSON.stringify({ type: 'LineString', coordinates: [['x', 'y']] });
    await sleep(300);
    await expect
      .poll(() => container.querySelector('.leaflet-tile')?.getAttribute('src'))
      .toMatch(/\/2\/\d+\/\d+\.png$/);
  });

  test('is read-only', async () => {
    const { container } = await renderEditor({}, '', { readonly: true, invalid: true });

    await waitForMap(container);
    await expect.element(page.getByRole('button', { name: 'Use Your Location' })).toBeDisabled();
    expect(container.querySelector('.map')).toHaveAttribute('inert');
    expect(container.querySelector('.map')).toHaveClass('invalid');
  });
});
