// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getLatestVersion, isUpdateAvailable } from '$lib/services/app/update';

vi.mock('$lib/services/app', () => ({
  UNPKG_BASE_URL: 'https://unpkg.com/@sveltia/cms',
  version: '1.0.0',
}));

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
  document.head.innerHTML = '';
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

  test('is true when the script is loaded unpinned from the CDN', async () => {
    const script = document.createElement('script');

    script.src = 'https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js';
    document.head.append(script);
    respondWith({ version: '1.1.0' });

    expect(await isUpdateAvailable()).toBe(true);
    expect(warnMock).not.toHaveBeenCalled();
  });

  test('is false with a warning when the version is pinned', async () => {
    const script = document.createElement('script');

    script.src = 'https://unpkg.com/@sveltia/cms@1.0.0/dist/sveltia-cms.js';
    document.head.append(script);
    respondWith({ version: '1.1.0' });

    expect(await isUpdateAvailable()).toBe(false);
    expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('1.1.0'));
  });
});
