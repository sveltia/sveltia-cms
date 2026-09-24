import { afterEach, describe, expect, it, vi } from 'vitest';

const loadExifr = vi.fn(async () => ({ parse: vi.fn() }));

vi.mock('$lib/services/app/bundled-modules', () => ({
  BUNDLED_MODULE_LOADERS: { exifr: loadExifr },
  BUNDLED_MARKER_ICON_URL: '/assets/marker-icon-2x.png',
}));

/**
 * Import a fresh copy of the module as built for npm, where the libraries and chunks are bundled.
 * @returns {Promise<typeof import('./dependencies')>} Module.
 */
const importNpmBuild = async () => {
  vi.stubEnv('DEV', false);
  vi.stubEnv('NPM_BUILD', 'true');
  // The chunk loaders are chosen when the module is loaded
  vi.resetModules();

  return import('./dependencies');
};

describe('dependencies in the npm build', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('loads a library with its bundled loader', async () => {
    const { loadModule } = await importNpmBuild();

    // The path is only used for UNPKG
    await expect(loadModule('exifr', 'ignored.js')).resolves.toHaveProperty('parse');
    expect(loadExifr).toHaveBeenCalledOnce();
  });

  it('uses the bundled Leaflet marker icon', async () => {
    const { getLeafletMarkerIconURL } = await importNpmBuild();

    await expect(getLeafletMarkerIconURL()).resolves.toBe('/assets/marker-icon-2x.png');
  });

  it('loads a chunk from the bundle', async () => {
    const { loadChunk } = await importNpmBuild();

    await expect(loadChunk('react-dom')).resolves.toHaveProperty('createRoot');
  });
});
