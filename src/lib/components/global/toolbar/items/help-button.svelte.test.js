import { sleep } from '@sveltia/utils/misc';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { env } from '$lib/services/user/env.svelte';

import HelpButton from './help-button.svelte';

describe('HelpButton', () => {
  test('opens the help menu', async () => {
    env.hasMouse = true;

    await render(HelpButton, {});
    await page.getByRole('button', { name: 'Show Help Menu' }).click();

    await expect.element(page.getByRole('menu', { name: 'Help' })).toBeVisible();
    await expect.element(page.getByRole('menuitem', { name: 'Keyboard Shortcuts' })).toBeVisible();

    // Closing the shortcuts dialog returns the focus to the menu button
    await sleep(150);
    await page.getByRole('menuitem', { name: 'Keyboard Shortcuts' }).click();

    const dialog = page.getByRole('dialog', { name: 'Keyboard Shortcuts' });

    await expect.element(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
    await expect
      .poll(() => document.activeElement?.getAttribute('aria-label'))
      .toBe('Show Help Menu');
  });
});
