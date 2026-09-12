// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { selectedCloudService } from '$lib/services/assets/external';
import { selectedAssetFolder } from '$lib/services/assets/folders';
import { initViewSettingsStorage } from '$lib/services/common/view';

import {
  assetListSettings,
  currentView,
  defaultView,
  getSettingsKey,
  initSettings,
} from './settings.js';

// Real reactive boxes are used for the mocked state, so that the effects created by `initSettings`
// react to changes made by the tests
vi.mock('$lib/services/assets/external', async () => {
  const { createRawState } = await import('$lib/services/utils/state.svelte');

  return { selectedCloudService: createRawState(undefined) };
});

vi.mock('$lib/services/assets/folders', async () => {
  const { createRawState } = await import('$lib/services/utils/state.svelte');

  return { selectedAssetFolder: createRawState(undefined) };
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
/** @type {any} */
const uploadsFolder = { internalPath: 'uploads', publicPath: '/uploads' };
/** @type {any} */
const imagesFolder = { internalPath: 'images', publicPath: '/images' };
/** @type {any} */
const uploadcareService = { serviceId: 'uploadcare' };

describe('defaultView', () => {
  it('should have correct default view settings', () => {
    expect(defaultView).toEqual({
      type: 'grid',
      showInfo: true,
      sort: {
        key: 'name',
        order: 'ascending',
      },
    });
  });
});

describe('currentView', () => {
  it('should be defined as reactive state', () => {
    expect(currentView).toBeDefined();
    expect('current' in currentView).toBe(true);
  });
});

describe('assets/view/settings', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectedAssetFolder.current = undefined;
    selectedCloudService.current = undefined;
    currentView.current = { type: 'grid', showInfo: true };
    assetListSettings.current = undefined;
    await wait();
  });

  describe('getSettingsKey', () => {
    it('should return `*` when nothing is selected', () => {
      expect(getSettingsKey()).toBe('*');
    });

    it('should return the internal path of the selected folder', () => {
      selectedAssetFolder.current = uploadsFolder;
      expect(getSettingsKey()).toBe('uploads');
    });

    it('should return the prefixed service ID of the selected cloud storage service', () => {
      selectedCloudService.current = uploadcareService;
      expect(getSettingsKey()).toBe('-/uploadcare');
    });
  });

  describe('initSettings', () => {
    it('should initialize the settings with the repository database', async () => {
      await initSettings(backendService);

      expect(initViewSettingsStorage).toHaveBeenCalledWith(
        backendService.repository,
        'assets-view',
        assetListSettings,
      );

      await wait();

      // The current view, restored from the default, is saved right away
      expect(assetListSettings.current).toEqual({ '*': defaultView });
    });

    it('should restore the saved view when a different folder is selected', async () => {
      vi.mocked(initViewSettingsStorage).mockImplementationOnce(async (_repo, _key, state) => {
        state.current = { uploads: { type: 'list', showInfo: false } };

        return () => {};
      });

      await initSettings(backendService);
      await wait();

      selectedAssetFolder.current = uploadsFolder;
      await wait();

      expect(currentView.current).toEqual({ type: 'list', showInfo: false });
    });

    it('should fall back to the default view for a folder without saved settings', async () => {
      await initSettings(backendService);
      await wait();

      currentView.current = { type: 'list', showInfo: true };
      await wait();

      selectedAssetFolder.current = imagesFolder;
      await wait();

      expect(currentView.current).toEqual(defaultView);
      // A clone is stored, so that the default view is never mutated
      expect(currentView.current).not.toBe(defaultView);
    });

    it('should save the view when it is changed', async () => {
      await initSettings(backendService);
      await wait();

      selectedAssetFolder.current = uploadsFolder;
      await wait();

      currentView.current = { type: 'list', showInfo: true };
      await wait();

      expect(assetListSettings.current).toEqual({
        '*': defaultView,
        uploads: { type: 'list', showInfo: true },
      });
    });

    it('should restore and save the view per cloud storage service', async () => {
      vi.mocked(initViewSettingsStorage).mockImplementationOnce(async (_repo, _key, state) => {
        state.current = { '-/uploadcare': { type: 'list', showInfo: false } };

        return () => {};
      });

      await initSettings(backendService);
      await wait();

      selectedCloudService.current = uploadcareService;
      await wait();

      expect(currentView.current).toEqual({ type: 'list', showInfo: false });

      currentView.current = { type: 'grid', showInfo: false };
      await wait();

      expect(assetListSettings.current).toEqual({
        '*': defaultView,
        '-/uploadcare': { type: 'grid', showInfo: false },
      });
    });

    it('should save the view under `*` when no folder is selected', async () => {
      await initSettings(backendService);
      await wait();

      currentView.current = { type: 'list', showInfo: true };
      await wait();

      expect(assetListSettings.current).toEqual({ '*': { type: 'list', showInfo: true } });
    });

    it('should not save the view when it is equal to the saved view', async () => {
      vi.mocked(initViewSettingsStorage).mockImplementationOnce(async (_repo, _key, state) => {
        state.current = { '*': { type: 'grid', showInfo: true } };

        return () => {};
      });

      await initSettings(backendService);
      await wait();

      const settings = assetListSettings.current;

      currentView.current = { type: 'grid', showInfo: true };
      await wait();

      // The same object is kept, so nothing is persisted
      expect(assetListSettings.current).toBe(settings);
    });

    it('should handle an undefined repository', async () => {
      await expect(initSettings(/** @type {any} */ ({}))).resolves.toBeUndefined();

      expect(initViewSettingsStorage).toHaveBeenCalledWith(
        undefined,
        'assets-view',
        assetListSettings,
      );
    });
  });
});
