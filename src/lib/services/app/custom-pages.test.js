import { beforeEach, describe, expect, test, vi } from 'vitest';

import { customPageRegistry } from '$lib/services/api/registries';
import { goto } from '$lib/services/app/navigation';
import { openNewTab } from '$lib/services/utils/window';

import {
  customPages,
  getCustomPageId,
  getCustomPagePath,
  openCustomPage,
  selectedCustomPage,
  selectedCustomPageId,
} from './custom-pages';

/**
 * @import { CustomPage } from '$lib/types/private';
 */

vi.mock('$lib/services/app/navigation', () => ({
  goto: vi.fn(),
}));
vi.mock('$lib/services/utils/window', () => ({
  openNewTab: vi.fn(),
}));

/** @type {CustomPage} */
const analyticsPage = {
  id: 'analytics',
  label: 'Analytics',
  icon: 'monitoring',
  url: 'https://example.com/analytics',
  newTab: false,
};

/** @type {CustomPage} */
const docsLink = {
  id: 'docs',
  label: 'Docs',
  icon: 'help',
  url: 'https://example.com/docs',
  newTab: true,
};

beforeEach(() => {
  customPageRegistry.clear();
  selectedCustomPageId.current = '';
});

describe('getCustomPageId()', () => {
  test('returns the page ID from a custom page route', () => {
    expect(getCustomPageId('/pages/analytics')).toBe('analytics');
  });

  test.each(['/pages', '/pages/analytics/more', '/collections/analytics', '/'])(
    'returns an empty string for %j',
    (path) => {
      expect(getCustomPageId(path)).toBe('');
    },
  );
});

describe('getCustomPagePath()', () => {
  test('returns the route of the page', () => {
    expect(getCustomPagePath(analyticsPage)).toBe('/pages/analytics');
  });
});

describe('customPages', () => {
  test('lists the registered pages in the order of registration', () => {
    expect(customPages.current).toEqual([]);

    customPageRegistry.set('docs', docsLink);
    customPageRegistry.set('analytics', analyticsPage);

    expect(customPages.current).toEqual([docsLink, analyticsPage]);
  });
});

describe('selectedCustomPage', () => {
  test('is undefined on any other page', () => {
    customPageRegistry.set('analytics', analyticsPage);

    expect(selectedCustomPage.current).toBeUndefined();
  });

  test('returns the page the URL points to, once it’s registered', () => {
    selectedCustomPageId.current = 'analytics';

    expect(selectedCustomPage.current).toBeUndefined();

    customPageRegistry.set('analytics', analyticsPage);

    expect(selectedCustomPage.current).toBe(analyticsPage);
  });
});

describe('openCustomPage()', () => {
  test('navigates to a page', () => {
    openCustomPage(analyticsPage);

    expect(goto).toHaveBeenCalledWith('/pages/analytics');
    expect(openNewTab).not.toHaveBeenCalled();
  });

  test('opens a link in a new tab', () => {
    openCustomPage(docsLink);

    expect(openNewTab).toHaveBeenCalledWith('https://example.com/docs');
    expect(goto).not.toHaveBeenCalled();
  });
});
