import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { backendName } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { showContentOverlay } from '$lib/services/contents/editor';
import { user } from '$lib/services/user/account.svelte';
import { prefs } from '$lib/services/user/prefs.svelte';

import GlobalToolbar from './global-toolbar.svelte';

describe('GlobalToolbar', () => {
  test('lays out the global controls', async () => {
    backendName.current = 'github';
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github' } });
    user.account = /** @type {any} */ ({ backendName: 'github', login: 'octocat' });
    prefs.devModeEnabled = false;
    showContentOverlay.current = false;

    const { container } = await render(GlobalToolbar, {});

    await expect.element(page.getByRole('toolbar', { name: 'Global' })).toBeVisible();
    await expect.element(page.getByRole('radiogroup', { name: 'Switch Page' })).toBeVisible();
    await expect
      .element(page.getByRole('button', { name: 'Create Entry or Assets' }))
      .toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Show Account Menu' })).toBeVisible();
    expect(page.getByRole('button', { name: 'Show Help Menu' }).elements()).toHaveLength(0);
    expect(container.querySelector('.toolbar-wrapper')).not.toHaveAttribute('inert');
  });

  test('is inert while an overlay is shown, and offers help in developer mode', async () => {
    prefs.devModeEnabled = true;
    showContentOverlay.current = true;

    try {
      const { container } = await render(GlobalToolbar, {});

      expect(container.querySelector('.toolbar-wrapper')).toHaveAttribute('inert');
      expect(page.getByRole('button', { name: 'Show Help Menu' }).elements()).toHaveLength(1);
    } finally {
      prefs.devModeEnabled = false;
      showContentOverlay.current = false;
    }
  });
});
