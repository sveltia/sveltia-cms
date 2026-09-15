import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { selectedPageName } from '$lib/services/app/navigation';
import { selectedCloudService } from '$lib/services/assets/external';
import { allAssetFolders, selectedAssetFolder } from '$lib/services/assets/folders';
import { backendName } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { searchMode } from '$lib/services/search';
import { env } from '$lib/services/user/env.svelte';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import PageSwitcher from './page-switcher.svelte';

/**
 * Get the labels of the page buttons.
 * @returns {(string | null)[]} Labels.
 */
const getPageLabels = () =>
  page
    .getByRole('radio')
    .elements()
    .map((el) => el.getAttribute('aria-label'));

describe('PageSwitcher', () => {
  beforeEach(() => {
    window.location.hash = '#/collections';
    selectedPageName.current = 'collections';
    searchMode.current = null;
    env.isSmallScreen = false;
    backendName.current = 'github';
    cmsConfig.current = /** @type {any} */ ({
      backend: { name: 'github' },
      media_folder: 'static',
    });
    allAssetFolders.current = /** @type {any} */ ([{ internalPath: 'static', publicPath: '/' }]);
    selectedAssetFolder.current = undefined;
    selectedCloudService.current = undefined;
    setEntries([]);
  });

  test('switches between the contents and assets pages', async () => {
    await render(PageSwitcher, {});

    const group = page.getByRole('radiogroup', { name: 'Switch Page' });

    await expect.element(group).toHaveAttribute('aria-controls', 'page-container');
    expect(getPageLabels()).toEqual(['Contents', 'Assets']);
    await expect.element(group.getByRole('radio', { name: 'Contents' })).toBeChecked();

    await group.getByRole('radio', { name: 'Assets' }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets/-/all');
  });

  test('hides the assets page without any asset folder, external location or linked file', async () => {
    allAssetFolders.current = [];
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github' } });

    await render(PageSwitcher, {});
    expect(getPageLabels()).toEqual(['Contents']);
  });

  test('links the assets page to the current external location', async () => {
    selectedCloudService.current = /** @type {any} */ ({
      serviceType: 'cloud_storage',
      serviceId: 'uploadcare',
    });

    await render(PageSwitcher, {});
    await page.getByRole('radio', { name: 'Assets' }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets/-/uploadcare');

    // Without any folder, the first external location is the assets page
    allAssetFolders.current = [];
    selectedCloudService.current = undefined;
    cmsConfig.current = /** @type {any} */ ({
      backend: { name: 'github' },
      media_libraries: { uploadcare: { config: { publicKey: 'abc' } } },
    });
    window.location.hash = '#/collections';
    await page.getByRole('radio', { name: 'Assets' }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets/-/uploadcare');
  });

  test('links the assets page to Linked Files when entries link files by URL', async () => {
    await initTestConfig({
      collections: [
        { name: 'posts', folder: 'content/posts', fields: [{ name: 'image', widget: 'image' }] },
      ],
    });
    allAssetFolders.current = [];
    setEntries([
      createMockEntry({
        slug: 'hello',
        content: { _default: { image: 'https://example.com/photo.jpg' } },
      }),
    ]);

    await render(PageSwitcher, {});
    expect(getPageLabels()).toEqual(['Contents', 'Assets']);

    await page.getByRole('radio', { name: 'Assets' }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets/-/linked');
  });

  test('adds the workflow page when Editorial Workflow is enabled', async () => {
    cmsConfig.current = /** @type {any} */ ({
      backend: { name: 'github' },
      publish_mode: 'editorial_workflow',
    });

    await render(PageSwitcher, {});
    expect(getPageLabels()).toEqual(['Contents', 'Assets', 'Editorial Workflow']);
  });

  test('adds the menu page on a small screen', async () => {
    env.isSmallScreen = true;

    await render(PageSwitcher, {});
    expect(getPageLabels()).toEqual(['Contents', 'Assets', 'Menu']);
  });

  test('selects the page matching the search mode', async () => {
    selectedPageName.current = 'search';
    searchMode.current = 'assets';

    await render(PageSwitcher, {});
    await expect.element(page.getByRole('radio', { name: 'Assets' })).toBeChecked();
  });
});
