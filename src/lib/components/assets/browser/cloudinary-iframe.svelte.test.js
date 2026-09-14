import { beforeEach, describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { dialogOpen } from '$lib/services/integrations/media-libraries/cloud/cloudinary';
import { initTestConfig } from '$lib/test/config';

import CloudinaryIframe from './cloudinary-iframe.svelte';

describe('CloudinaryIframe', () => {
  beforeEach(() => {
    dialogOpen.current = false;
  });

  test('loads the media library console when Cloudinary is configured', async () => {
    await initTestConfig({
      media_libraries: {
        cloudinary: { config: { cloud_name: 'demo', api_key: '123', folder: { path: 'x' } } },
      },
    });

    await render(CloudinaryIframe);

    const iframe = /** @type {HTMLIFrameElement} */ (document.querySelector('#cloudinary-iframe'));

    expect(iframe).not.toBeNull();
    expect(iframe.title).toBe('Cloudinary media library');
    expect(iframe.dataset.mlId).toMatch(/^[0-9a-f-]{36}$/);

    const url = new URL(iframe.src);

    expect(url.origin + url.pathname).toBe(
      'https://console.cloudinary.com/console/media_library/cms',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      cloud_name: 'demo',
      api_key: '123',
      ml_id: iframe.dataset.mlId,
      pmHost: window.location.origin,
      new_cms: 'true',
    });

    // The frame is kept while the modal is closed
    expect(iframe.closest('dialog')?.open).toBe(false);
    dialogOpen.current = true;
    await expect.poll(() => iframe.closest('dialog')?.open).toBe(true);

    // Dismissing the modal closes the library
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => dialogOpen.current).toBe(false);
  });

  test('renders nothing without the credentials', async () => {
    await initTestConfig({ media_libraries: { cloudinary: { config: { cloud_name: 'demo' } } } });

    await render(CloudinaryIframe);

    expect(document.querySelector('#cloudinary-iframe')).toBeNull();

    // Or without any option
    await initTestConfig({ media_libraries: { cloudinary: /** @type {any} */ ({}) } });
    await render(CloudinaryIframe);

    expect(document.querySelector('#cloudinary-iframe')).toBeNull();

    // Or without Cloudinary at all
    await initTestConfig();
    await render(CloudinaryIframe);

    expect(document.querySelector('#cloudinary-iframe')).toBeNull();
  });
});
