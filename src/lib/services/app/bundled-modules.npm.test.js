// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import { BUNDLED_MARKER_ICON_URL, BUNDLED_MODULE_LOADERS } from './bundled-modules.npm';

describe('bundled modules in the npm build', () => {
  it.each([
    ['@discourse/heic', 'decode'],
    ['@jsquash/webp', 'default'],
    ['exifr', 'parse'],
    ['immutable', 'Map'],
    ['leaflet', 'map'],
    ['svgo', 'optimize'],
    ['terra-draw', 'TerraDraw'],
    ['terra-draw-leaflet-adapter', 'TerraDrawLeafletAdapter'],
    ['turndown', 'default'],
  ])('loads %s', async (library, exportName) => {
    await expect(BUNDLED_MODULE_LOADERS[library]()).resolves.toHaveProperty(exportName);
  });

  it('bundles the Leaflet marker icon', () => {
    expect(BUNDLED_MARKER_ICON_URL).toMatch(/\/leaflet\/dist\/images\/marker-icon-2x\.png$/);
  });
});
