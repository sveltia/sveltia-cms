import { describe, expect, test, vi } from 'vitest';

import { getToolbarPages } from '$lib/services/app/toolbar-pages';

vi.mock('@sveltia/i18n', async () => (await import('$lib/test/i18n')).createI18nMock());

vi.mock('$lib/services/app/custom-pages', () => ({
  getCustomPagePath: vi.fn(({ id }) => `/pages/${id}`),
}));

const baseArgs = {
  selectedPageName: '',
  searchMode: null,
  hasAssets: false,
  assetsLink: '/assets/-/all',
  workflowEnabled: false,
  workflowLabelKey: 'workflow.title',
  customPages: [],
  selectedCustomPageId: '',
  isSmallScreen: false,
};

describe('getToolbarPages()', () => {
  test('always lists Contents', () => {
    expect(getToolbarPages(baseArgs)).toEqual([
      {
        key: 'collections',
        label: 'contents',
        icon: 'article',
        link: '/collections',
        selected: false,
      },
    ]);
  });

  test('selects Contents or Assets while searching them', () => {
    const pages = getToolbarPages({ ...baseArgs, hasAssets: true, searchMode: 'assets' });

    expect(pages.map(({ key, selected }) => [key, selected])).toEqual([
      ['collections', false],
      ['assets', true],
    ]);

    expect(getToolbarPages({ ...baseArgs, searchMode: 'contents' })[0].selected).toBe(true);
  });

  test('lists Assets, the workflow, custom pages and Menu when available', () => {
    const pages = getToolbarPages({
      ...baseArgs,
      selectedPageName: 'workflow',
      hasAssets: true,
      workflowEnabled: true,
      customPages: [{ id: 'stats', label: 'Stats', icon: 'monitoring', newTab: false }],
      selectedCustomPageId: 'stats',
      isSmallScreen: true,
    });

    expect(pages).toEqual([
      expect.objectContaining({ key: 'collections', selected: false }),
      expect.objectContaining({ key: 'assets', link: '/assets/-/all', selected: false }),
      expect.objectContaining({
        key: 'workflow',
        label: 'workflow.title',
        link: '/workflow',
        selected: true,
      }),
      {
        key: 'pages/stats',
        label: 'Stats',
        icon: 'monitoring',
        link: '/pages/stats',
        selected: true,
      },
      expect.objectContaining({ key: 'menu', link: '/menu', selected: false }),
    ]);
  });

  test('selects Menu and Assets by page name', () => {
    expect(
      getToolbarPages({ ...baseArgs, selectedPageName: 'menu', isSmallScreen: true }).at(-1)
        ?.selected,
    ).toBe(true);

    expect(
      getToolbarPages({ ...baseArgs, selectedPageName: 'assets', hasAssets: true })[1].selected,
    ).toBe(true);
  });
});
