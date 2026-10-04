import { IndexedDB } from '@sveltia/utils/storage';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  _resetUISettingsDB,
  DEFAULT_SIDEBAR_WIDTH,
  getSidebarWidth,
  saveSidebarWidth,
} from '$lib/services/app/ui-settings';
import { backend } from '$lib/services/backends';

/** @type {Map<string, Map<string, any>>} */
const stores = new Map();

vi.mock('@sveltia/utils/storage', () => ({
  IndexedDB: vi.fn(
    /**
     * Mock `IndexedDB` constructor, backed by an in-memory store per database and store name.
     * @param {string} databaseName Database name.
     * @param {string} storeName Store name.
     * @this {Record<string, any>}
     */
    function MockIndexedDB(databaseName, storeName) {
      const key = `${databaseName}/${storeName}`;

      if (!stores.has(key)) {
        stores.set(key, new Map());
      }

      const store = /** @type {Map<string, any>} */ (stores.get(key));

      Object.assign(this, {
        get: vi.fn(async (/** @type {string} */ k) => store.get(k)),
        set: vi.fn(async (/** @type {string} */ k, /** @type {any} */ v) => {
          store.set(k, v);
        }),
      });
    },
  ),
}));

vi.mock('$lib/services/backends', () => ({ backend: { current: undefined } }));

/**
 * Select a backend for the repository with the given database.
 * @param {string | undefined} databaseName Database name.
 */
const selectRepository = (databaseName) => {
  /** @type {any} */ (backend).current = { repository: { databaseName } };
};

describe('app/ui-settings', () => {
  beforeEach(() => {
    _resetUISettingsDB();
    stores.clear();
    selectRepository('github:owner/repo');
  });

  test('saves and restores the sidebar width of a page, keeping its other settings', async () => {
    stores.set('github:owner/repo/ui-settings', new Map([['contents-page', { other: true }]]));

    expect(await getSidebarWidth('contents-page')).toBe(DEFAULT_SIDEBAR_WIDTH);
    await saveSidebarWidth('contents-page', 320);

    expect(await getSidebarWidth('contents-page')).toBe(320);
    expect(stores.get('github:owner/repo/ui-settings')?.get('contents-page')).toEqual({
      other: true,
      sidebarWidth: 320,
    });
    // The width of another page is kept apart
    expect(await getSidebarWidth('assets-page')).toBe(DEFAULT_SIDEBAR_WIDTH);
  });

  test('reuses the store for the same repository, and opens another for a new one', async () => {
    await getSidebarWidth('contents-page');
    await saveSidebarWidth('contents-page', 300);
    await getSidebarWidth('assets-page');

    expect(IndexedDB).toHaveBeenCalledTimes(1);

    selectRepository('gitlab:owner/other');

    expect(await getSidebarWidth('contents-page')).toBe(DEFAULT_SIDEBAR_WIDTH);
    expect(IndexedDB).toHaveBeenCalledTimes(2);
    expect(IndexedDB).toHaveBeenLastCalledWith('gitlab:owner/other', 'ui-settings');
  });

  test('uses the default width and saves nothing without a database', async () => {
    selectRepository(undefined);

    expect(await getSidebarWidth('contents-page')).toBe(DEFAULT_SIDEBAR_WIDTH);
    await saveSidebarWidth('contents-page', 300);

    expect(IndexedDB).not.toHaveBeenCalled();
    expect(stores.size).toBe(0);

    // Nor without a backend
    /** @type {any} */ (backend).current = undefined;

    expect(await getSidebarWidth('contents-page')).toBe(DEFAULT_SIDEBAR_WIDTH);
  });
});
