import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import LeafletMap from './leaflet-map.svelte';

// Leaflet is normally fetched from a CDN; the installed package serves the same module here
vi.mock('$lib/services/app/dependencies', () => ({
  getUnpkgURL: vi.fn((name) => `https://unpkg.com/${name}`),
  getLeafletMarkerIconURL: vi.fn(
    async () => 'https://unpkg.com/leaflet/dist/images/marker-icon-2x.png',
  ),
  loadModule: vi.fn(() => import('leaflet/dist/leaflet-src.esm.js')),
  getChunkURLs: vi.fn(() => []),
  loadChunk: vi.fn(),
}));

describe('LeafletMap', () => {
  test('shows a map centred on the coordinates with a marker', async () => {
    const onReady = vi.fn();

    await render(LeafletMap, {
      coordinates: { latitude: 35.6895, longitude: 139.6917 },
      onReady,
    });

    const map = page.getByRole('application', {
      name: 'Map showing latitude 35.69, longitude 139.692',
    });

    await expect.element(map).toBeVisible();
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce());

    const { map: leafletMap } = onReady.mock.calls[0][0];
    const { lat, lng } = leafletMap.getCenter();

    expect(lat).toBeCloseTo(35.6895, 3);
    expect(lng).toBeCloseTo(139.6917, 3);
    expect(leafletMap.getZoom()).toBe(12);
    expect(map.element().querySelector('.leaflet-marker-icon')).not.toBeNull();
    // Attribution links open in a new tab
    expect(map.element().querySelector('a[href^="https:"]')).toHaveAttribute('target', '_blank');
  });

  test('shows the world without coordinates', async () => {
    const onReady = vi.fn();

    await render(LeafletMap, { coordinates: undefined, onReady });

    await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce());

    const { map } = onReady.mock.calls[0][0];

    expect(map.getZoom()).toBe(2);
    expect(page.getByRole('application').element()).not.toHaveAttribute('aria-label');
    expect(
      page.getByRole('application').element().querySelector('.leaflet-marker-icon'),
    ).toBeNull();
  });

  test('moves the marker when the coordinates change', async () => {
    const onReady = vi.fn();

    const { rerender } = await render(LeafletMap, {
      coordinates: { latitude: 35.6895, longitude: 139.6917 },
      onReady,
    });

    await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce());

    const { map } = onReady.mock.calls[0][0];
    const element = page.getByRole('application').element();

    await rerender({ coordinates: { latitude: 51.5074, longitude: -0.1278 } });

    await expect
      .element(page.getByRole('application'))
      .toHaveAccessibleName('Map showing latitude 51.507, longitude -0.128');
    await vi.waitFor(() => expect(map.getCenter().lat).toBeCloseTo(51.5074, 3));
    expect(map.getCenter().lng).toBeCloseTo(-0.1278, 3);
    expect(element.querySelectorAll('.leaflet-marker-icon')).toHaveLength(1);

    // The same location again leaves the map where the user has moved it
    map.setView([0, 0], 5);
    await rerender({ coordinates: { latitude: 51.5074, longitude: -0.1278 } });
    expect(map.getZoom()).toBe(5);

    await rerender({ coordinates: undefined });
    await vi.waitFor(() => expect(element.querySelector('.leaflet-marker-icon')).toBeNull());
  });

  test('doesn’t create the map once destroyed while Leaflet is loading', async () => {
    const onReady = vi.fn();
    const { loadModule } = await import('$lib/services/app/dependencies');
    /**
     * Resolve the pending import of Leaflet.
     * @type {(value: any) => void}
     */
    let resolve = () => {};

    vi.mocked(loadModule).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );

    const { unmount } = await render(LeafletMap, { coordinates: undefined, onReady });

    unmount();
    resolve(await import('leaflet/dist/leaflet-src.esm.js'));
    await new Promise((r) => {
      setTimeout(r, 100);
    });

    expect(onReady).not.toHaveBeenCalled();
  });
});
