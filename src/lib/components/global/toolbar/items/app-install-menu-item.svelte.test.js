import { afterEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { initAppInstallDetection, installPrompt } from '$lib/services/app/install';

import AppInstallMenuItem from './app-install-menu-item.svelte';

describe('AppInstallMenuItem', () => {
  /** @type {(() => void) | undefined} */
  let stop;

  afterEach(() => {
    stop?.();
    installPrompt.current = null;
  });

  test('appears when the browser offered to install the app before it was rendered', async () => {
    stop = initAppInstallDetection();

    const prompt = vi.fn();
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt });

    // The browser fires the event once, shortly after the page loads, while the account menu
    // holding this item is still closed
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    const { container } = await render(AppInstallMenuItem, {});

    await page.getByRole('menuitem', { name: 'Install as App' }).click();
    expect(prompt).toHaveBeenCalledOnce();
    // The prompt can only be shown once
    await expect.poll(() => container.querySelectorAll('[role="menuitem"]').length).toBe(0);
  });

  test('disappears once the app is installed', async () => {
    stop = initAppInstallDetection();

    const { container } = await render(AppInstallMenuItem, {});

    expect(container.children).toHaveLength(0);

    window.dispatchEvent(
      Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn() }),
    );
    await expect.element(page.getByRole('menuitem', { name: 'Install as App' })).toBeVisible();

    window.dispatchEvent(new Event('appinstalled'));
    await expect.poll(() => container.querySelectorAll('[role="menuitem"]').length).toBe(0);
  });
});
