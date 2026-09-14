import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import LeafletMap from './leaflet-map.svelte';

// Leaflet is normally fetched from a CDN; the installed package serves the same module here
vi.mock('$lib/services/app/dependencies', () => ({
  getUnpkgURL: vi.fn((name) => `https://unpkg.com/${name}`),
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
});
