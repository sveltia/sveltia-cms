import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { cmsConfig } from '$lib/services/config';

import SiteLogo from './site-logo.svelte';

describe('SiteLogo', () => {
  test('shows nothing with the default logo', async () => {
    cmsConfig.current = /** @type {any} */ ({});

    const { container } = await render(SiteLogo, {});

    expect(container.children).toHaveLength(0);
  });

  test('shows a custom logo that opens the live site', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    cmsConfig.current = /** @type {any} */ ({
      logo: { src: 'https://example.com/logo.svg' },
      _siteURL: 'https://example.com',
    });

    try {
      const { container } = await render(SiteLogo, {});

      expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/logo.svg');
      await page.getByRole('button', { name: 'Visit Live Site' }).click();
      expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
    } finally {
      open.mockRestore();
    }
  });

  test('can be hidden from the header', async () => {
    cmsConfig.current = /** @type {any} */ ({
      logo: { src: 'https://example.com/logo.svg', show_in_header: false },
    });

    expect((await render(SiteLogo, {})).container.children).toHaveLength(0);
  });
});
