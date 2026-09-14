import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

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
});
