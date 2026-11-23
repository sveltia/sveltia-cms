import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { env } from '$lib/services/user/env.svelte';

import ShortcutsMenuItem from './shortcuts-menu-item.svelte';

describe('ShortcutsMenuItem', () => {
  test('opens the shortcuts dialog, then returns focus to the menu button', async () => {
    env.hasMouse = true;

    const menuButton = document.createElement('button');

    document.body.append(menuButton);

    try {
      await render(ShortcutsMenuItem, { menuButton });
      await page.getByRole('menuitem', { name: 'Keyboard Shortcuts' }).click();
      await expect.element(page.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeVisible();

      await page.getByRole('button', { name: 'Close' }).click();
      await expect.poll(() => document.activeElement).toBe(menuButton);
    } finally {
      menuButton.remove();
    }
  });

  test('is hidden on a touch device, which has no keyboard', async () => {
    env.hasMouse = false;

    await render(ShortcutsMenuItem, {});

    expect(page.getByRole('menuitem').elements()).toHaveLength(0);
  });
});
