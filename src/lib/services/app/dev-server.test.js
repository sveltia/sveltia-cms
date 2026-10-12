// @vitest-environment happy-dom

import { afterEach, describe, expect, test, vi } from 'vitest';

import { isLiveReloadedPage } from '$lib/services/app/dev-server';

describe('isLiveReloadedPage()', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    document.head.innerHTML = '';
  });

  /**
   * Add a script element to the document head. It has a non-JavaScript type, so happy-dom doesn’t
   * try to load it; the check only looks at the URL.
   * @param {string} src Script URL.
   */
  const addScript = (src) => {
    document.head.innerHTML = `<script type="text/plain" src="${src}"></script>`;
  };

  test('returns `true` on a page with the Vite client script', () => {
    vi.stubEnv('DEV', false);
    addScript('/@vite/client');
    expect(isLiveReloadedPage()).toBe(true);
  });

  test('returns `true` when the dev server is mounted under a base path', () => {
    vi.stubEnv('DEV', false);
    addScript('/blog/@vite/client');
    expect(isLiveReloadedPage()).toBe(true);
  });

  test('returns `false` on a static page', () => {
    vi.stubEnv('DEV', false);
    addScript('https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js');
    expect(isLiveReloadedPage()).toBe(false);
  });

  test('returns `false` on the CMS’s own development server', () => {
    addScript('/@vite/client');
    expect(import.meta.env.DEV).toBe(true);
    expect(isLiveReloadedPage()).toBe(false);
  });
});
