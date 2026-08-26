// @vitest-environment jsdom

import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { pageLiveness, pingURL, resetPageLiveness } from '$lib/services/deployments/ping';
import { sendRequest } from '$lib/services/utils/networking';

vi.mock('$lib/services/utils/networking');

describe('Preview page liveness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T00:00:00Z'));
    vi.mocked(sendRequest).mockReset();
    resetPageLiveness();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // The test environment serves the page from this origin
  const { origin } = window.location;

  test('reports a page that responds as live', async () => {
    vi.mocked(sendRequest).mockResolvedValue(/** @type {any} */ ({ ok: true, status: 200 }));

    await expect(pingURL(`${origin}/posts/hello`)).resolves.toBe('ready');

    expect(sendRequest).toHaveBeenCalledWith(
      `${origin}/posts/hello`,
      { method: 'GET' },
      { responseType: 'raw' },
    );

    expect(get(pageLiveness)[`${origin}/posts/hello`]).toBe('ready');
  });

  test('reports a missing page as still building', async () => {
    vi.mocked(sendRequest).mockResolvedValue(/** @type {any} */ ({ ok: false, status: 404 }));

    await expect(pingURL(`${origin}/posts/hello`)).resolves.toBe('pending');
  });

  test('reports any other status as inconclusive', async () => {
    // A password-protected preview answers 401, and the link still works for a signed-in user
    vi.mocked(sendRequest).mockResolvedValue(/** @type {any} */ ({ ok: false, status: 401 }));

    await expect(pingURL(`${origin}/posts/hello`)).resolves.toBe('unknown');
  });

  test('reports a failed request as inconclusive', async () => {
    vi.mocked(sendRequest).mockRejectedValue(new Error('Network error'));

    await expect(pingURL(`${origin}/posts/hello`)).resolves.toBe('unknown');
  });

  test('sends no request for a cross-origin URL', async () => {
    await expect(pingURL('https://deploy-preview-1--site.netlify.app/posts/hello')).resolves.toBe(
      'unknown',
    );

    expect(sendRequest).not.toHaveBeenCalled();
  });

  test('sends no request for an unparseable URL', async () => {
    await expect(pingURL('not a url')).resolves.toBe('unknown');
    expect(sendRequest).not.toHaveBeenCalled();
  });

  test('checks the same URL only once within the cache window', async () => {
    vi.mocked(sendRequest).mockResolvedValue(/** @type {any} */ ({ ok: true, status: 200 }));

    await Promise.all([pingURL(`${origin}/a`), pingURL(`${origin}/a`)]);
    await pingURL(`${origin}/a`);

    expect(sendRequest).toHaveBeenCalledTimes(1);
  });

  test('checks again once the cache window has passed', async () => {
    vi.mocked(sendRequest).mockResolvedValue(/** @type {any} */ ({ ok: true, status: 200 }));

    await pingURL(`${origin}/a`);
    vi.setSystemTime(new Date('2026-08-17T00:01:00Z'));
    await pingURL(`${origin}/a`);

    expect(sendRequest).toHaveBeenCalledTimes(2);
  });

  test('leaves the store untouched when the result is unchanged', async () => {
    vi.mocked(sendRequest).mockResolvedValue(/** @type {any} */ ({ ok: true, status: 200 }));

    await pingURL(`${origin}/a`);

    const before = get(pageLiveness);

    vi.setSystemTime(new Date('2026-08-17T00:01:00Z'));
    await pingURL(`${origin}/a`);

    // The same object identity, so a component effect reading the store doesn’t re-run
    expect(get(pageLiveness)).toBe(before);
  });

  test('stops remembering pages once the cap is passed', async () => {
    vi.mocked(sendRequest).mockResolvedValue(/** @type {any} */ ({ ok: true, status: 200 }));

    // One more than the cap, so the oldest has to go
    const urls = Array.from({ length: 101 }, (_, index) => `${origin}/posts/${index}`);

    // eslint-disable-next-line no-restricted-syntax
    for (const url of urls) {
      // eslint-disable-next-line no-await-in-loop
      await pingURL(url);
    }

    const remembered = get(pageLiveness);

    expect(Object.keys(remembered).length).toBeLessThanOrEqual(100);
    // The most recent page is still there
    expect(remembered[urls[100]]).toBe('ready');
    // The first one has been let go, so asking again costs a fresh request
    expect(remembered[urls[0]]).toBeUndefined();

    vi.mocked(sendRequest).mockClear();
    await pingURL(urls[0]);
    expect(sendRequest).toHaveBeenCalledTimes(1);
  });

  test('lets expired results go before recently checked ones', async () => {
    vi.mocked(sendRequest).mockResolvedValue(/** @type {any} */ ({ ok: true, status: 200 }));

    const old = Array.from({ length: 60 }, (_, index) => `${origin}/old/${index}`);
    const recent = Array.from({ length: 45 }, (_, index) => `${origin}/recent/${index}`);

    // eslint-disable-next-line no-restricted-syntax
    for (const url of old) {
      // eslint-disable-next-line no-await-in-loop
      await pingURL(url);
    }

    // Everything above is now past its useful life
    vi.setSystemTime(new Date('2026-08-17T00:05:00Z'));

    // eslint-disable-next-line no-restricted-syntax
    for (const url of recent) {
      // eslint-disable-next-line no-await-in-loop
      await pingURL(url);
    }

    const remembered = get(pageLiveness);

    // The stale ones were the first to go, so every recent page survives
    recent.forEach((url) => expect(remembered[url]).toBe('ready'));
    expect(remembered[old[0]]).toBeUndefined();
  });

  test('forgets the cached results on reset', async () => {
    vi.mocked(sendRequest).mockResolvedValue(/** @type {any} */ ({ ok: true, status: 200 }));

    await pingURL(`${origin}/a`);
    resetPageLiveness();

    expect(get(pageLiveness)).toEqual({});

    await pingURL(`${origin}/a`);

    expect(sendRequest).toHaveBeenCalledTimes(2);
  });
});
