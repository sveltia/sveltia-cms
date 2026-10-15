import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { customPageRegistry } from '$lib/services/api/registries';
import { selectedCustomPageId } from '$lib/services/app/custom-pages';
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
    selectedCustomPageId.current = '';
    setEntries([]);
  });

  afterEach(() => {
    customPageRegistry.clear();
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

  test.each(['github', 'gitlab', 'gitea'])(
    'adds the workflow page when Editorial Workflow is enabled with the %s backend',
    async (name) => {
      // The page only exists when the backend implements the feature, so each one that does is
      // checked, not just the first
      backendName.current = name;
      cmsConfig.current = /** @type {any} */ ({
        backend: { name },
        publish_mode: 'editorial_workflow',
      });

      await render(PageSwitcher, {});
      expect(getPageLabels()).toEqual(['Contents', 'Assets', 'Editorial Workflow']);
    },
  );

  test('names the workflow page after the drafts with Preview Workflow', async () => {
    backendName.current = 'github';
    cmsConfig.current = /** @type {any} */ ({
      backend: { name: 'github' },
      publish_mode: 'preview',
    });

    await render(PageSwitcher, {});
    expect(getPageLabels()).toEqual(['Contents', 'Assets', 'Drafts']);
  });

  test('leaves the workflow page out when the backend doesn’t implement the feature', async () => {
    backendName.current = 'test-repo';
    cmsConfig.current = /** @type {any} */ ({
      backend: { name: 'test-repo' },
      publish_mode: 'editorial_workflow',
    });

    await render(PageSwitcher, {});
    expect(getPageLabels()).toEqual(['Contents', 'Assets']);
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

  test('lists the custom pages after the built-in ones, and the links after the page buttons', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    customPageRegistry.set('analytics', {
      id: 'analytics',
      label: 'Analytics',
      icon: 'monitoring',
      url: 'https://example.com/analytics',
      newTab: false,
    });
    customPageRegistry.set('docs', {
      id: 'docs',
      label: 'Docs',
      icon: 'help',
      url: 'https://example.com/docs',
      newTab: true,
    });

    try {
      await render(PageSwitcher, {});
      expect(getPageLabels()).toEqual(['Contents', 'Assets', 'Analytics']);

      const analytics = page.getByRole('radio', { name: 'Analytics' });

      await expect.element(analytics).toHaveAttribute('aria-keyshortcuts', 'Alt+3');
      await analytics.click();
      await expect.poll(() => window.location.hash).toBe('#/pages/analytics');

      // The router selects the page as the URL changes
      selectedPageName.current = 'pages';
      selectedCustomPageId.current = 'analytics';
      await expect.element(analytics).toBeChecked();
      await expect.element(page.getByRole('radio', { name: 'Contents' })).not.toBeChecked();

      // A link opens in a new tab, without leaving the page
      await page.getByRole('button', { name: 'Docs' }).click();
      expect(openSpy).toHaveBeenCalledWith(
        'https://example.com/docs',
        '_blank',
        'noopener,noreferrer',
      );
      expect(window.location.hash).toBe('#/pages/analytics');

      // A page registered after the toolbar has been rendered shows up too
      customPageRegistry.set('stats', {
        id: 'stats',
        label: 'Stats',
        icon: 'bar_chart',
        url: 'https://example.com/stats',
        newTab: false,
      });
      await expect.poll(getPageLabels).toEqual(['Contents', 'Assets', 'Analytics', 'Stats']);
    } finally {
      openSpy.mockRestore();
    }
  });

  test('gives keyboard shortcuts to the first nine pages only', async () => {
    Array.from({ length: 8 }, (_, index) => `page${index}`).forEach((id) => {
      customPageRegistry.set(id, { id, label: id, icon: 'extension', url: '/', newTab: false });
    });

    await render(PageSwitcher, {});
    await expect
      .element(page.getByRole('radio', { name: 'page6' }))
      .toHaveAttribute('aria-keyshortcuts', 'Alt+9');
    await expect
      .element(page.getByRole('radio', { name: 'page7' }))
      .not.toHaveAttribute('aria-keyshortcuts');
  });

  test('leaves the custom pages to the menu page on a small screen', async () => {
    env.isSmallScreen = true;
    customPageRegistry.set('analytics', {
      id: 'analytics',
      label: 'Analytics',
      icon: 'monitoring',
      url: 'https://example.com/analytics',
      newTab: false,
    });

    await render(PageSwitcher, {});
    expect(getPageLabels()).toEqual(['Contents', 'Assets', 'Menu']);
    expect(page.getByRole('button', { name: 'Analytics' }).elements()).toHaveLength(0);
  });
});
