// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { initViewSettingsStorage } from '$lib/services/common/view';
import { selectedCollection } from '$lib/services/contents/collection';
import { currentView } from '$lib/services/contents/collection/view';

import { entryListSettings, initSettings } from './settings';

// Real reactive boxes are used for the mocked state, so that the effect created by `initSettings`
// reacts to changes made by the tests
vi.mock('$lib/services/contents/collection', async () => {
  const { createRawState } = await import('$lib/services/utils/state.svelte');

  return { selectedCollection: createRawState(undefined) };
});

vi.mock('$lib/services/contents/collection/view', async () => {
  const { createRawState } = await import('$lib/services/utils/state.svelte');

  return { currentView: createRawState({ type: 'list' }) };
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

describe('Test entryListSettings', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectedCollection.current = undefined;
    currentView.current = { type: 'list' };
    entryListSettings.current = undefined;
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
