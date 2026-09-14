import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { backendName } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { prefs } from '$lib/services/user/prefs.svelte';

import AdvancedPanel from './advanced-panel.svelte';

describe('AdvancedPanel', () => {
  beforeEach(() => {
    prefs.beta = false;
    prefs.devModeEnabled = false;
    prefs.deployHookURL = '';
    backendName.current = 'github';
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github' } });
  });

  test('toggles the beta and developer mode preferences', async () => {
    await render(AdvancedPanel, {});

    const beta = page.getByRole('switch', { name: 'Join Beta Program' });
    const dev = page.getByRole('switch', { name: 'Enable Developer Mode' });

    await expect.element(beta).not.toBeChecked();
    await expect.element(dev).not.toBeChecked();

    await dev.click();
    await expect.poll(() => prefs.devModeEnabled).toBe(true);
    prefs.devModeEnabled = false;
  });

  test('offers the deploy hook settings only when skipping CI is configured', async () => {
    const onChange = vi.fn();

    await render(AdvancedPanel, { onChange });
    expect(page.getByRole('textbox').elements()).toHaveLength(0);

    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github', skip_ci: true } });

    const url = page.getByRole('textbox', { name: 'Hook URL' });

    await expect.element(url).toBeVisible();
    await url.fill('https://example.com/hook');
    await url.element().blur();

    await expect.poll(() => prefs.deployHookURL).toBe('https://example.com/hook');
    expect(onChange).toHaveBeenCalledWith({ message: 'Hook URL saved.' });

    const auth = page.getByRole('textbox', { name: /^Authorization header/ });

    await auth.fill('Bearer abc');
    await auth.element().blur();
    await expect.poll(() => prefs.deployHookAuthHeader).toBe('Bearer abc');
    expect(onChange).toHaveBeenLastCalledWith({ message: 'Authorization header saved.' });

    await auth.fill('');
    await auth.element().blur();
    await expect.poll(() => prefs.deployHookAuthHeader).toBe('');
    expect(onChange).toHaveBeenLastCalledWith({ message: 'Authorization header removed.' });
  });

  test('asks for confirmation before clearing the data', async () => {
    await render(AdvancedPanel, {});
    await page.getByRole('button', { name: 'Clear File Cache' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Clear File Cache' });

    await expect.element(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.element(dialog).not.toBeInTheDocument();

    await page.getByRole('button', { name: 'Erase All Data' }).click();

    const eraseDialog = page.getByRole('alertdialog', { name: 'Erase All Data' });

    await expect.element(eraseDialog).toBeVisible();
    await eraseDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.element(eraseDialog).not.toBeInTheDocument();
  });
});
