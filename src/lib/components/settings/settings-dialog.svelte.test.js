import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { cmsConfig } from '$lib/services/config';

import SettingsDialog from './settings-dialog.svelte';

describe('SettingsDialog', () => {
  test('lists the categories and shows the selected panel', async () => {
    cmsConfig.current = /** @type {any} */ ({});

    await render(SettingsDialog, { open: true });

    const dialog = page.getByRole('dialog', { name: 'Settings' });
    const tabs = dialog.getByRole('tablist', { name: 'Categories' }).getByRole('tab');

    // Internationalization is only offered for a multilingual site
    expect(tabs.elements().map((el) => el.textContent?.trim())).toEqual([
      'palette Appearance',
      'language Language',
      'library_books Contents',
      'photo_library Media',
      'accessibility_new Accessibility',
      'code_xml Developer',
      'database Data Management',
    ]);
    await expect.element(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect.element(dialog.getByRole('heading', { name: 'Theme' })).toBeVisible();

    await tabs.nth(2).click();
    await expect.element(dialog.getByRole('heading', { name: 'Editor' })).toBeVisible();
  });

  test('offers the internationalization category for a multilingual site', async () => {
    cmsConfig.current = /** @type {any} */ ({ i18n: { locales: ['en', 'ja'] } });

    await render(SettingsDialog, { open: true });
    await expect.element(page.getByRole('tab', { name: 'Internationalization' })).toBeVisible();
  });

  test('reports when closed', async () => {
    const onClose = vi.fn();
    const props = $state({ open: true, onClose });

    await render(SettingsDialog, props);
    await page.getByRole('button', { name: 'Close' }).click();

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(props.open).toBe(false);
  });

  test('links each category to its panel, and moves the selection', async () => {
    cmsConfig.current = /** @type {any} */ ({});

    await render(SettingsDialog, { open: true });

    const dialog = page.getByRole('dialog', { name: 'Settings' });
    const appearance = dialog.getByRole('tab', { name: 'Appearance' });
    const data = dialog.getByRole('tab', { name: 'Data Management' });

    await expect.element(appearance).toHaveAttribute('aria-controls', 'prefs-tab-appearance');
    await expect.element(data).toHaveAttribute('aria-controls', 'prefs-tab-data');
    await expect
      .element(dialog.getByRole('tablist'))
      .toHaveAttribute('aria-orientation', 'vertical');

    await data.click();
    await expect.element(data).toHaveAttribute('aria-selected', 'true');
    await expect.element(appearance).toHaveAttribute('aria-selected', 'false');
    await expect.element(dialog.getByRole('heading', { name: 'Clear Data' })).toBeVisible();
  });

  test('opens with the bound prop, and closes without a handler', async () => {
    cmsConfig.current = /** @type {any} */ ({});

    const props = $state({ open: false });

    await render(SettingsDialog, props);
    expect(page.getByRole('dialog').elements()).toHaveLength(0);

    props.open = true;
    await expect.element(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect.poll(() => props.open).toBe(false);
  });
});
