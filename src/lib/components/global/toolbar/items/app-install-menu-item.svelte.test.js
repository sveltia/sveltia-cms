import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import AppInstallMenuItem from './app-install-menu-item.svelte';

describe('AppInstallMenuItem', () => {
  test('appears once the browser offers to install the app, and prompts on click', async () => {
    const { container } = await render(AppInstallMenuItem, {});

    expect(container.children).toHaveLength(0);

    const prompt = vi.fn();
    const event = Object.assign(new Event('beforeinstallprompt'), { prompt });

    window.dispatchEvent(event);

    await page.getByRole('menuitem', { name: 'Install as App' }).click();
    expect(prompt).toHaveBeenCalledOnce();

    window.dispatchEvent(new Event('appinstalled'));
    await expect.poll(() => container.querySelectorAll('[role="menuitem"]').length).toBe(0);
  });
});
