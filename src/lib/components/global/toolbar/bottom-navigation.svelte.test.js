import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { showContentOverlay } from '$lib/services/contents/editor';
import { env } from '$lib/services/user/env.svelte';

import BottomNavigation from './bottom-navigation.svelte';

describe('BottomNavigation', () => {
  test('shows the page switcher in a toolbar', async () => {
    env.isSmallScreen = true;
    showContentOverlay.current = false;

    await render(BottomNavigation, {});

    const toolbar = page.getByRole('toolbar', { name: 'Global' });

    await expect.element(toolbar).toBeVisible();
    await expect.element(toolbar.getByRole('radio', { name: 'Menu' })).toBeVisible();
  });

  test('is inert while an overlay is shown', async () => {
    showContentOverlay.current = true;

    try {
      const { container } = await render(BottomNavigation, {});

      expect(container.querySelector('[inert]')).not.toBeNull();
    } finally {
      showContentOverlay.current = false;
    }
  });
});
