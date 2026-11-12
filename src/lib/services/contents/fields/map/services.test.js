import { describe, expect, test, vi } from 'vitest';

import { loadChunk } from '$lib/services/app/dependencies';

import { mapServices } from './services';

vi.mock('$lib/services/app/dependencies', () => ({
  loadChunk: vi.fn(),
}));

describe('mapServices', () => {
  test('loads the services from the `map` chunk once', async () => {
    const services = { parseGeoJSON: vi.fn() };

    vi.mocked(loadChunk).mockResolvedValue(services);

    expect(() => mapServices.get()).toThrow('The map chunk is not loaded yet.');
    await expect(mapServices.load()).resolves.toBe(services);
    await expect(mapServices.load()).resolves.toBe(services);
    expect(mapServices.get()).toBe(services);
    expect(loadChunk).toHaveBeenCalledExactlyOnceWith('map');
  });
});
