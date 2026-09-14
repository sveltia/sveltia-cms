import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { announcedPageStatus } from '$lib/services/app/navigation';
import { cmsConfig } from '$lib/services/config';

import SettingsPage from './settings-page.svelte';

describe('SettingsPage', () => {
  beforeEach(() => {
    cmsConfig.current = /** @type {any} */ ({});
  });

  test('lists the categories as a menu, and opens one', async () => {
    window.location.hash = '#/settings';

    await render(SettingsPage, {});

    const menu = page.getByRole('menu', { name: 'Settings' });

    expect(
      menu
        .getByRole('menuitem')
        .elements()
        .map((el) => el.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual([
      'palette Appearance',
      'language Language',
      'library_books Contents',
      'photo_library Media',
      'accessibility_new Accessibility',
      'build Advanced',
    ]);

    await menu.getByRole('menuitem', { name: 'Contents' }).click();
    await expect.poll(() => window.location.hash).toBe('#/settings/contents');
    await expect.element(page.getByRole('heading', { name: 'Editor' })).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();
    await expect.poll(() => window.location.hash).toBe('#/settings');
  });

  test('shows a panel from the URL', async () => {
    window.location.hash = '#/settings/appearance';

    await render(SettingsPage, {});

    await expect.element(page.getByRole('heading', { name: 'Theme' })).toBeVisible();
  });

  test('reports an unknown panel', async () => {
    window.location.hash = '#/settings/unknown';

    await render(SettingsPage, {});

    await expect.element(page.getByRole('toolbar')).toHaveTextContent('arrow_back Page not found.');
    expect(announcedPageStatus.current).toBe('Page not found.');

    await page.getByRole('toolbar').getByRole('button', { name: 'Back' }).click();
    await expect.poll(() => window.location.hash).toBe('#/settings');
  });

  test('goes back to the menu from the index, and ignores other pages', async () => {
    window.location.hash = '#/settings';

    const { container } = await render(SettingsPage, {});
    const toolbar = page.getByRole('toolbar');

    await expect.element(toolbar).toHaveTextContent('arrow_back Settings');
    await toolbar.getByRole('button', { name: 'Back' }).click();
    await expect.poll(() => window.location.hash).toBe('#/menu');

    // Another page’s URL is none of this page’s business
    window.location.hash = '#/collections';
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(container.querySelector('h2')).toHaveTextContent('Settings');
  });
});
