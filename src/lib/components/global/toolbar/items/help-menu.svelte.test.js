import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { env } from '$lib/services/user/env.svelte';
import { prefs } from '$lib/services/user/prefs.svelte';

import HelpMenu from './help-menu.svelte';

describe('HelpMenu', () => {
  test('offers the shortcuts only, unless in developer mode', async () => {
    env.hasMouse = true;
    prefs.devModeEnabled = false;

    await render(HelpMenu, {});

    const menu = page.getByRole('menu', { name: 'Help' });

    await expect.element(menu).toBeVisible();
    expect(
      menu
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.trim()),
    ).toEqual(['Keyboard Shortcuts']);
  });

  test('links to the documentation and community in developer mode', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    env.hasMouse = true;
    prefs.devModeEnabled = true;

    try {
      await render(HelpMenu, {});

      const items = page.getByRole('menuitem');

      expect(items.elements()).toHaveLength(10);

      const links = [
        ['Documentation', 'https://sveltiacms.app/en/docs'],
        [
          'Announcements',
          'https://github.com/sveltia/sveltia-cms/discussions/categories/announcements',
        ],
        ['Report Issue', 'https://github.com/sveltia/sveltia-cms/issues'],
        ['Share Feedback', 'https://github.com/sveltia/sveltia-cms/discussions/categories/ideas'],
        ['Get Help', 'https://github.com/sveltia/sveltia-cms/discussions/categories/q-a'],
        ['Donate', 'https://github.com/sponsors/kyoshino'],
        ['Follow Us on Bluesky', 'https://bsky.app/profile/sveltiacms.app'],
        ['Join Us on Discord', 'https://discord.com/invite/5hwCGqup5b'],
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const [name, url] of links) {
        // eslint-disable-next-line no-await-in-loop
        await page.getByRole('menuitem', { name }).click();
        expect(open).toHaveBeenLastCalledWith(url, '_blank', 'noopener,noreferrer');
      }
    } finally {
      open.mockRestore();
      prefs.devModeEnabled = false;
    }
  });
});
