import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import {
  activated,
  consoleLoaded,
  dialogOpen,
  FRAME_ORIGIN,
  optionCacheMap,
} from '$lib/services/integrations/media-libraries/cloud/cloudinary';
import { openNewTab } from '$lib/services/utils/window';
import { initTestConfig } from '$lib/test/config';

import CloudinaryPanel from './cloudinary-panel.svelte';

vi.mock('$lib/services/utils/window', () => ({ openNewTab: vi.fn() }));

/**
 * Deliver a message as if it came from the Cloudinary console.
 * @param {any} data Message data.
 * @param {string} [origin] Origin.
 * @returns {void}
 */
const receiveMessage = (data, origin = FRAME_ORIGIN) => {
  window.dispatchEvent(new MessageEvent('message', { data, origin }));
};

describe('CloudinaryPanel', () => {
  beforeAll(async () => {
    await initTestConfig({
      media_libraries: {
        cloudinary: {
          config: { cloud_name: 'demo', api_key: '123', folder: { path: 'photos' } },
        },
      },
    });
  });

  beforeEach(() => {
    activated.current = false;
    consoleLoaded.current = false;
    dialogOpen.current = false;
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  test('asks to sign in first, then opens the library', async () => {
    await render(CloudinaryPanel, { onSelect: vi.fn() });

    await expect
      .element(page.getByText('After signing in, click the Sign In button again to continue.'))
      .toBeInTheDocument();
    await page.getByRole('button', { name: 'Activate Cloudinary' }).click();
    expect(openNewTab).toHaveBeenCalledWith(
      'https://console.cloudinary.com/console/media_library/cms_login?cms=true',
      { noopener: false },
    );

    // The console reports the sign-in
    receiveMessage(JSON.stringify({ type: 'login', consoleDomain: 'console.cloudinary.com' }));
    expect(activated.current).toBe(true);
    expect(dialogOpen.current).toBe(true);

    dialogOpen.current = false;
    await page.getByRole('button', { name: 'Open Cloudinary' }).click();
    expect(dialogOpen.current).toBe(true);
  });

  test('passes the selected assets on', async () => {
    const onSelect = vi.fn();

    await render(CloudinaryPanel, { onSelect });
    activated.current = true;
    dialogOpen.current = true;

    receiveMessage({
      type: 'ML_WIDGET_INSERT_DATA',
      data: {
        assets: [
          {
            secure_url: 'https://res.cloudinary.com/demo/a.png',
            derived: [{ secure_url: 'https://res.cloudinary.com/demo/c_fill/a.png' }],
          },
          { secure_url: 'https://res.cloudinary.com/demo/b.png' },
        ],
      },
    });

    // The transformed URL is preferred by default
    expect(onSelect).toHaveBeenCalledWith([
      { url: 'https://res.cloudinary.com/demo/c_fill/a.png' },
      { url: 'https://res.cloudinary.com/demo/b.png' },
    ]);
    expect(dialogOpen.current).toBe(false);

    dialogOpen.current = true;
    receiveMessage({ type: 'ML_WIDGET_HIDE' });
    expect(dialogOpen.current).toBe(false);
  });

  test('outputs the file name only, or the original URL, as configured', async () => {
    const onSelect = vi.fn();

    // The options can be set per field
    await render(CloudinaryPanel, {
      onSelect,
      fieldConfig: /** @type {any} */ ({
        name: 'image',
        widget: 'image',
        media_libraries: { cloudinary: { output_filename_only: true } },
      }),
    });
    activated.current = true;
    dialogOpen.current = true;
    receiveMessage({
      type: 'ML_WIDGET_INSERT_DATA',
      data: { assets: [{ secure_url: 'https://res.cloudinary.com/demo/a.png' }] },
    });
    expect(onSelect).toHaveBeenCalledWith([{ url: 'a.png' }]);

    const onSelectOriginal = vi.fn();

    await render(CloudinaryPanel, {
      onSelect: onSelectOriginal,
      fieldConfig: /** @type {any} */ ({
        name: 'photo',
        widget: 'image',
        media_libraries: { cloudinary: { use_transformations: false } },
      }),
    });
    dialogOpen.current = true;
    receiveMessage({
      type: 'ML_WIDGET_INSERT_DATA',
      data: {
        assets: [
          {
            secure_url: 'https://res.cloudinary.com/demo/b.png',
            derived: [{ secure_url: 'https://res.cloudinary.com/demo/c_fill/b.png' }],
          },
        ],
      },
    });
    expect(onSelectOriginal).toHaveBeenCalledWith([
      { url: 'https://res.cloudinary.com/demo/b.png' },
    ]);
  });

  test('ignores messages from elsewhere or in an unknown format', async () => {
    await render(CloudinaryPanel, { onSelect: vi.fn() });

    receiveMessage(JSON.stringify({ type: 'login', consoleDomain: 'x' }), 'https://evil.example');
    receiveMessage('not json');
    receiveMessage(42);
    expect(activated.current).toBe(false);
  });

  test('configures the widget once the console is loaded', async () => {
    const iframe = document.createElement('iframe');

    iframe.id = 'cloudinary-iframe';
    iframe.dataset.mlId = 'ml-1';
    document.body.appendChild(iframe);

    const postMessage = vi.spyOn(/** @type {Window} */ (iframe.contentWindow), 'postMessage');

    try {
      await render(CloudinaryPanel, {
        onSelect: vi.fn(),
        kind: 'image',
        multiple: true,
        fieldConfig: /** @type {any} */ ({ name: 'image', widget: 'image', max: 3 }),
      });

      receiveMessage({ type: 'consoleLoaded' });

      await vi.waitFor(() => expect(postMessage).toHaveBeenCalled());
      expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({
        type: 'ML_WIDGET_SHOW',
        data: {
          mlId: 'ml-1',
          config: {
            folder: { path: 'photos', resource_type: 'image' },
            multiple: true,
            max_files: 3,
          },
        },
      });
      expect(postMessage.mock.calls[0][1]).toBe(FRAME_ORIGIN);
    } finally {
      iframe.remove();
    }
  });

  test('falls back to the site options, then the defaults, for the widget', async () => {
    const iframe = document.createElement('iframe');

    iframe.id = 'cloudinary-iframe';
    iframe.dataset.mlId = 'ml-1';
    document.body.appendChild(iframe);

    const postMessage = vi.spyOn(/** @type {Window} */ (iframe.contentWindow), 'postMessage');
    /**
     * Get the configuration sent last.
     * @returns {any} Configuration.
     */
    const getSentConfig = () => JSON.parse(postMessage.mock.calls.at(-1)?.[0]).data.config;

    try {
      // The merged options are cached, so each configuration has to start over
      optionCacheMap.clear();
      // The site limits the number of files
      await initTestConfig({
        media_libraries: { cloudinary: { config: { cloud_name: 'demo', max_files: 5 } } },
      });
      await render(CloudinaryPanel, { onSelect: vi.fn() });
      receiveMessage({ type: 'consoleLoaded' });
      await vi.waitFor(() => expect(postMessage).toHaveBeenCalled());
      expect(getSentConfig()).toEqual({
        folder: { path: '', resource_type: 'raw' },
        multiple: false,
        max_files: 5,
      });

      // Nothing is configured
      optionCacheMap.clear();
      await initTestConfig({ media_libraries: { cloudinary: { config: { cloud_name: 'demo' } } } });
      await render(CloudinaryPanel, {
        onSelect: vi.fn(),
        fieldConfig: /** @type {any} */ ({ name: 'file', widget: 'file' }),
      });
      receiveMessage({ type: 'consoleLoaded' });
      await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(3));
      expect(getSentConfig().max_files).toBe(20);
    } finally {
      iframe.remove();
      optionCacheMap.clear();
      await initTestConfig({
        media_libraries: {
          cloudinary: {
            config: { cloud_name: 'demo', api_key: '123', folder: { path: 'photos' } },
          },
        },
      });
    }
  });

  test('can be hidden', async () => {
    const { container } = await render(CloudinaryPanel, { onSelect: vi.fn(), hidden: true });

    expect(container.children).toHaveLength(0);
  });
});
