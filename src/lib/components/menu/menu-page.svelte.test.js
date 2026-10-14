import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { customPageRegistry } from '$lib/services/api/registries';
import { backendName } from '$lib/services/backends';
import { user } from '$lib/services/user/account.svelte';
import { prefs } from '$lib/services/user/prefs.svelte';

import MenuPage from './menu-page.svelte';

describe('MenuPage', () => {
  test('lays out the account menu, and the help menu in developer mode', async () => {
    backendName.current = 'github';
    user.account = /** @type {any} */ ({ backendName: 'github', login: 'octocat' });
    prefs.devModeEnabled = false;

    const { container } = await render(MenuPage, {});

    expect(container.querySelector('h2')).toHaveTextContent('Menu');
    expect([...container.querySelectorAll('h3')].map((h3) => h3.textContent)).toEqual(['Account']);
    await expect.element(page.getByRole('menu', { name: 'Account' })).toBeVisible();

    prefs.devModeEnabled = true;

    try {
      await expect.element(page.getByRole('menu', { name: 'Help' })).toBeVisible();
    } finally {
      prefs.devModeEnabled = false;
    }
  });

  test('lists the custom pages above the account menu', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    window.location.hash = '#/menu';
    customPageRegistry.set('analytics', {
      id: 'analytics',
      label: 'Analytics',
      icon: 'monitoring',
      url: 'https://example.com/analytics',
      newTab: false,
    });
    customPageRegistry.set('docs', {
      id: 'docs',
      label: 'Docs',
      icon: 'help',
      url: 'https://example.com/docs',
      newTab: true,
    });

    try {
      const { container } = await render(MenuPage, {});

      expect([...container.querySelectorAll('h3')].map((h3) => h3.textContent)).toEqual([
        'Pages',
        'Account',
      ]);

      const menu = page.getByRole('menu', { name: 'Pages' });

      await menu.getByRole('menuitem', { name: 'Docs' }).click();
      expect(openSpy).toHaveBeenCalledWith(
        'https://example.com/docs',
        '_blank',
        'noopener,noreferrer',
      );

      await menu.getByRole('menuitem', { name: 'Analytics' }).click();
      await expect.poll(() => window.location.hash).toBe('#/pages/analytics');
    } finally {
      openSpy.mockRestore();
      customPageRegistry.clear();
    }
  });
});
