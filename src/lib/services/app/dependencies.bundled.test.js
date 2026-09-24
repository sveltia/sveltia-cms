// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Import a fresh copy of the module as built for npm, where the libraries and chunks are bundled.
 * @returns {Promise<typeof import('./dependencies')>} Module.
 */
const importNpmBuild = async () => {
  vi.stubEnv('DEV', false);
  vi.stubEnv('NPM_BUILD', 'true');
  // The loaders are chosen when the module is loaded
  vi.resetModules();

  return import('./dependencies');
};

describe('dependencies in the npm build', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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
  ])('loads %s from the bundle', async (library, exportName) => {
    const { loadModule } = await importNpmBuild();

    // The path is only used for UNPKG
    await expect(loadModule(library, 'ignored.js')).resolves.toHaveProperty(exportName);
  });

  it('bundles the Leaflet marker icon', async () => {
    const { getLeafletMarkerIconURL } = await importNpmBuild();

    await expect(getLeafletMarkerIconURL()).resolves.toMatch(
      /\/leaflet\/dist\/images\/marker-icon-2x\.png$/,
    );
  });

  it('loads a chunk from the bundle', async () => {
    const { loadChunk } = await importNpmBuild();

    await expect(loadChunk('react-dom')).resolves.toHaveProperty('createRoot');
  });
});
