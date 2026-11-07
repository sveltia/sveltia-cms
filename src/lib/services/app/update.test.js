// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getScriptVersionSpec } from '$lib/services/app/dependencies';
import { getLatestVersion, isUpdateAvailable } from '$lib/services/app/update';

vi.mock('$lib/services/app', () => ({
  UNPKG_BASE_URL: 'https://unpkg.com/@sveltia/cms',
  version: '1.0.0',
}));
vi.mock('$lib/services/app/dependencies', () => ({ getScriptVersionSpec: vi.fn() }));

/** @type {import('vitest').Mock} */
let fetchMock;
/** @type {import('vitest').MockInstance} */
let warnMock;

/**
 * Make `fetch` resolve with the given `package.json` contents.
 * @param {object} json Response body.
 * @param {boolean} [ok] Whether the response is successful.
 */
const respondWith = (json, ok = true) => {
  fetchMock.mockResolvedValue({
    ok,
    /**
     * Parse the body.
     * @returns {Promise<object>} Body.
     */
    json: () => Promise.resolve(json),
  });
};

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  warnMock = vi.spyOn(console, 'warn').mockImplementation(() => {});
  // Loaded from the CDN without a version unless a test says otherwise
  vi.mocked(getScriptVersionSpec).mockReturnValue('');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getLatestVersion()', () => {
  test('returns the published version', async () => {
    respondWith({ version: '1.2.3' });

    expect(await getLatestVersion()).toBe('1.2.3');
    expect(fetchMock).toHaveBeenCalledWith('https://unpkg.com/@sveltia/cms/package.json');
  });

  test('returns nothing for a failed response', async () => {
    respondWith({ version: '1.2.3' }, false);

    expect(await getLatestVersion()).toBeUndefined();
  });

  test('returns nothing for a response without a version', async () => {
    respondWith({});

    expect(await getLatestVersion()).toBeUndefined();
  });

  test('returns nothing for a network error', async () => {
    fetchMock.mockRejectedValue(new Error('Offline'));

    expect(await getLatestVersion()).toBeUndefined();
  });
});

describe('isUpdateAvailable()', () => {
  test('is false when the latest version is unknown', async () => {
    fetchMock.mockRejectedValue(new Error('Offline'));

    expect(await isUpdateAvailable()).toBe(false);
  });

  test('is false when running the latest version', async () => {
    respondWith({ version: '1.0.0' });

    expect(await isUpdateAvailable()).toBe(false);
    expect(warnMock).not.toHaveBeenCalled();
  });

  test('is false when the CDN reports an older version', async () => {
    respondWith({ version: '0.9.10' });

    expect(await isUpdateAvailable()).toBe(false);
    expect(warnMock).not.toHaveBeenCalled();
  });

  test('compares the versions part by part as numbers', async () => {
    respondWith({ version: '1.0.10' });

    expect(await isUpdateAvailable()).toBe(true);

    respondWith({ version: '1.0.0.1' });

    expect(await isUpdateAvailable()).toBe(true);
  });

  test('is true when the script is loaded unpinned from the CDN', async () => {
    respondWith({ version: '1.1.0' });

    expect(await isUpdateAvailable()).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('https://unpkg.com/@sveltia/cms/package.json');
    expect(warnMock).not.toHaveBeenCalled();
  });

  test('is true when a release within the version range of the script is available', async () => {
    vi.mocked(getScriptVersionSpec).mockReturnValue('%5E1');
    respondWith({ version: '1.1.0' });

    expect(await isUpdateAvailable()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('https://unpkg.com/@sveltia/cms@%5E1/package.json');
    expect(warnMock).not.toHaveBeenCalled();
  });

  test('is false with a warning when a release is only available outside the range', async () => {
    vi.mocked(getScriptVersionSpec).mockReturnValue('%5E1');
    fetchMock.mockImplementation(async (url) => ({
      ok: true,
      /**
       * Parse the body.
       * @returns {Promise<object>} Body.
       */
      json: async () => ({ version: url.includes('@%5E1') ? '1.0.0' : '2.0.0' }),
    }));

    expect(await isUpdateAvailable()).toBe(false);
    expect(fetchMock).toHaveBeenLastCalledWith('https://unpkg.com/@sveltia/cms/package.json');
    expect(warnMock).toHaveBeenCalledWith(
      expect.stringContaining('A new version (2.0.0) is available. You are using version 1.0.0.'),
    );
  });

  test('is false without a warning when no newer release is available for a range', async () => {
    vi.mocked(getScriptVersionSpec).mockReturnValue('%5E1');
    respondWith({ version: '1.0.0' });

    expect(await isUpdateAvailable()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warnMock).not.toHaveBeenCalled();
  });

  test('is false with a warning when the version is pinned', async () => {
    vi.mocked(getScriptVersionSpec).mockReturnValue(undefined);
    respondWith({ version: '1.1.0' });

    expect(await isUpdateAvailable()).toBe(false);
    expect(warnMock).toHaveBeenCalledWith(
      expect.stringContaining('A new version (1.1.0) is available. You are using version 1.0.0.'),
    );
  });
});
