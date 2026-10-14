// @vitest-environment happy-dom

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { initViewSettingsStorage } from '$lib/services/common/view';
import { selectedCollection } from '$lib/services/contents/collection';

import {
  currentView,
  entryListSettings,
  getEntryOrderKey,
  getEntryViewType,
  getEntryViewTypes,
  initSettings,
  viewBeforeReorder,
} from './settings';

/**
 * @import { ViewType } from '$lib/types/private';
 */

// Real reactive boxes are used for the mocked state, so that the effect created by `initSettings`
// reacts to changes made by the tests
vi.mock('$lib/services/contents/collection', async () => {
  const { createRawState } = await import('$lib/services/utils/state.svelte');

  return { selectedCollection: createRawState(undefined) };
});

vi.mock('$lib/services/common/view', () => ({
  initViewSettingsStorage: vi.fn(async (_repository, _key, state) => {
    state.current = {};
  }),
}));

/**
 * Wait for the effects to run.
 * @returns {Promise<void>} Promise that resolves after a short delay.
 */
const wait = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

/** @type {any} */
const backendService = { repository: { databaseName: 'test-db' } };

describe('Test currentView', () => {
  test('leaves the view type unset until the user picks one', () => {
    expect(currentView.current).toEqual({});
  });
});

describe('Test getEntryViewTypes()', () => {
  test('offers the table view only with the table columns configured', () => {
    expect(
      getEntryViewTypes(
        /** @type {any} */ ({ table_columns: ['title'], _thumbnailFieldNames: [] }),
      ),
    ).toEqual(['table', 'list']);
    expect(getEntryViewTypes(/** @type {any} */ ({ _thumbnailFieldNames: [] }))).toEqual(['list']);
  });

  test('offers the grid view only with thumbnails', () => {
    expect(
      getEntryViewTypes(
        /** @type {any} */ ({ summary_fields: ['summary'], _thumbnailFieldNames: ['image'] }),
      ),
    ).toEqual(['table', 'list', 'grid']);
    expect(getEntryViewTypes(/** @type {any} */ ({ _thumbnailFieldNames: ['image'] }))).toEqual([
      'list',
      'grid',
    ]);
  });

  test('offers the list view only without a collection', () => {
    expect(getEntryViewTypes(undefined)).toEqual(['list']);
  });
});

describe('Test getEntryViewType()', () => {
  /** @type {ViewType[]} */
  const types = ['table', 'list', 'grid'];
  const large = { types, isLargeScreen: true };

  test('uses the first view type until the user picks one', () => {
    expect(getEntryViewType({ ...large })).toBe('table');
    expect(getEntryViewType({ ...large, type: undefined })).toBe('table');
    expect(getEntryViewType({ ...large, types: ['list', 'grid'] })).toBe('list');
  });

  test('uses the view the user has picked', () => {
    expect(getEntryViewType({ ...large, type: 'table' })).toBe('table');
    expect(getEntryViewType({ ...large, type: 'list' })).toBe('list');
    expect(getEntryViewType({ ...large, type: 'grid' })).toBe('grid');
  });

  test('falls back to the default from a view not offered anymore', () => {
    // The collection no longer has thumbnails
    expect(getEntryViewType({ ...large, type: 'grid', types: ['table', 'list'] })).toBe('table');
    // The collection no longer has the table columns configured
    expect(getEntryViewType({ ...large, type: 'table', types: ['list', 'grid'] })).toBe('list');
  });

  test('uses the list view for the table view on a smaller screen', () => {
    const small = { types, isLargeScreen: false };

    expect(getEntryViewType({ ...small })).toBe('list');
    expect(getEntryViewType({ ...small, type: 'table' })).toBe('list');
    expect(getEntryViewType({ ...small, type: 'grid' })).toBe('grid');
    expect(getEntryViewType({ ...small, type: 'grid', types: ['table', 'list'] })).toBe('list');
  });

  test('always uses the list view in reorder mode', () => {
    expect(getEntryViewType({ ...large, type: 'grid', reordering: true })).toBe('list');
    expect(getEntryViewType({ ...large, type: 'table', reordering: true })).toBe('list');
  });
});

describe('Test entryListSettings', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectedCollection.current = undefined;
    currentView.current = { type: 'list' };
    entryListSettings.current = undefined;
    viewBeforeReorder.current = undefined;
    await wait();
  });

  test('is exported as reactive state', () => {
    expect(entryListSettings).toBeDefined();
    expect('current' in entryListSettings).toBe(true);
  });

  test('initializes the settings with the repository database', async () => {
    await initSettings(backendService);

    expect(initViewSettingsStorage).toHaveBeenCalledWith(
      backendService.repository,
      'contents-view',
      entryListSettings,
    );
    expect(entryListSettings.current).toEqual({});
  });

  test('saves the view under the selected collection when it is changed', async () => {
    await initSettings(backendService);
    await wait();

    selectedCollection.current = /** @type {any} */ ({ name: 'posts' });
    currentView.current = { type: 'grid' };
    await wait();

    expect(entryListSettings.current).toEqual({ posts: { type: 'grid' } });
  });

  test('keeps the view from before reorder mode saved while reordering', async () => {
    await initSettings(backendService);
    await wait();

    const view = { type: /** @type {const} */ ('list'), sort: { key: 'title' } };

    selectedCollection.current = /** @type {any} */ ({ name: 'posts' });
    currentView.current = view;
    await wait();

    // Reorder mode replaces the view, which must not overwrite the one the user goes back to, as
    // the page can be reloaded or another collection selected before reordering is over
    viewBeforeReorder.current = { collectionName: 'posts', view };
    currentView.current = { type: 'list', sort: { key: '_manual', order: 'ascending' } };
    await wait();

    expect(entryListSettings.current).toEqual({ posts: view });

    // Another collection’s view is saved as usual
    selectedCollection.current = /** @type {any} */ ({ name: 'pages' });
    currentView.current = { type: 'grid' };
    await wait();

    expect(entryListSettings.current).toEqual({ posts: view, pages: { type: 'grid' } });
  });

  test('does not save the view while no collection is selected', async () => {
    await initSettings(backendService);
    await wait();

    currentView.current = { type: 'grid' };
    await wait();

    expect(entryListSettings.current).toEqual({});
  });

  test('does not save the view when it is equal to the saved view', async () => {
    vi.mocked(initViewSettingsStorage).mockImplementationOnce(async (_repo, _key, state) => {
      state.current = { posts: { type: 'grid' } };

      return () => {};
    });

    await initSettings(backendService);
    await wait();

    const settings = entryListSettings.current;

    selectedCollection.current = /** @type {any} */ ({ name: 'posts' });
    currentView.current = { type: 'grid' };
    await wait();

    // The same object is kept, so nothing is persisted
    expect(entryListSettings.current).toBe(settings);
  });

  test('handles an undefined repository', async () => {
    await expect(initSettings(/** @type {any} */ ({}))).resolves.toBeUndefined();

    expect(initViewSettingsStorage).toHaveBeenCalledWith(
      undefined,
      'contents-view',
      entryListSettings,
    );
  });
});

describe('Test getEntryOrderKey()', () => {
  /** @type {any} */
  const view = {
    type: 'list',
    sort: { key: 'title', order: 'ascending' },
    filters: [{ field: 'draft', pattern: true }],
    group: { field: 'tags', pattern: '' },
    collapsedGroups: {},
  };

  test('changes with the sorting, filtering or grouping', () => {
    const key = getEntryOrderKey(view);

    expect(getEntryOrderKey({ ...view, sort: { key: 'date', order: 'descending' } })).not.toBe(key);
    expect(getEntryOrderKey({ ...view, filters: [] })).not.toBe(key);
    expect(getEntryOrderKey({ ...view, filter: { field: 'draft', pattern: true } })).not.toBe(key);
    expect(getEntryOrderKey({ ...view, group: null })).not.toBe(key);
  });

  test('stays the same when the entries stay where they are', () => {
    const key = getEntryOrderKey(view);

    expect(getEntryOrderKey({ ...view, type: 'grid' })).toBe(key);
    expect(getEntryOrderKey({ ...view, collapsedGroups: { tags: ['news'] } })).toBe(key);
    expect(getEntryOrderKey({ ...view, showMedia: true })).toBe(key);
  });
});
