import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getAdditions,
  getAdditionsURL,
  isAdditionsEnabled,
  loadAdditions,
  requireAdditions,
} from '$lib/services/app/additions';
import { loadChunk } from '$lib/services/app/dependencies';
import { cmsConfig } from '$lib/services/config';

vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));
vi.mock('$lib/services/app/dependencies', () => ({
  loadChunk: vi.fn(async () => ({ startSession: vi.fn() })),
}));

describe('isAdditionsEnabled', () => {
  beforeEach(() => {
    cmsConfig.current = undefined;
  });

  test('is true for the GitHub backend with `auth_type: additions`', () => {
    cmsConfig.current = /** @type {any} */ ({
      backend: { name: 'github', repo: 'owner/repo', auth_type: 'additions' },
    });

    expect(isAdditionsEnabled()).toBe(true);
  });

  test('is false for another authentication type or backend, or without a configuration', () => {
    expect(isAdditionsEnabled()).toBe(false);
    expect(isAdditionsEnabled(/** @type {any} */ ({ backend: { name: 'github' } }))).toBe(false);
    expect(
      isAdditionsEnabled(
        /** @type {any} */ ({ backend: { name: 'gitlab', auth_type: 'additions' } }),
      ),
    ).toBe(false);
  });
});

describe('getAdditionsURL', () => {
  test('returns `base_url` without trailing slashes', () => {
    cmsConfig.current = /** @type {any} */ ({
      backend: { name: 'github', auth_type: 'additions', base_url: 'https://additions.example//' },
    });

    expect(getAdditionsURL()).toBe('https://additions.example');
  });
});

describe('loadAdditions / getAdditions', () => {
  test('loads the chunk once, with Sveltia CMS Additions only', async () => {
    cmsConfig.current = undefined;
    await expect(loadAdditions()).resolves.toBeUndefined();
    expect(loadChunk).not.toHaveBeenCalled();
    expect(getAdditions()).toBeUndefined();
    // Where the chunk must be there, its absence is a bug
    expect(() => requireAdditions()).toThrow('The additions chunk is not loaded yet.');

    cmsConfig.current = /** @type {any} */ ({
      backend: { name: 'github', repo: 'owner/repo', auth_type: 'additions' },
    });

    const chunk = await loadAdditions();

    expect(loadChunk).toHaveBeenCalledWith('additions');
    expect(chunk).toHaveProperty('startSession');
    expect(getAdditions()).toBe(chunk);
    expect(requireAdditions()).toBe(chunk);

    await expect(loadAdditions()).resolves.toBe(chunk);
    expect(loadChunk).toHaveBeenCalledOnce();

    // Not once the configuration no longer has it
    cmsConfig.current = undefined;
    expect(getAdditions()).toBeUndefined();
  });
});
