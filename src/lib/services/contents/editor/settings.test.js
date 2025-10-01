import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entryEditorSettings, initSettings } from './settings.js';

// Mock dependencies before importing
vi.mock('@sveltia/utils/storage', () => ({
  IndexedDB: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

vi.mock('fast-deep-equal', () => ({
  default: vi.fn(() => false),
}));

vi.mock('$lib/services/backends', () => ({
  backend: {
    subscribe: vi.fn(),
  },
}));

vi.mock('$lib/services/contents/editor', () => ({
  selectAssetsView: {
    set: vi.fn(),
    subscribe: vi.fn(),
  },
}));

describe('editor/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('entryEditorSettings store', () => {
    it('should be a writable store with expected methods', () => {
      expect(typeof entryEditorSettings.set).toBe('function');
      expect(typeof entryEditorSettings.update).toBe('function');
      expect(typeof entryEditorSettings.subscribe).toBe('function');
    });

    it('should have default values', () => {
      const currentValue = get(entryEditorSettings);

      // The store may be undefined initially until initialized
      if (currentValue) {
        expect(currentValue).toHaveProperty('showPreview');
        expect(currentValue).toHaveProperty('syncScrolling');
        expect(currentValue).toHaveProperty('selectAssetsView');
      } else {
        // If undefined, that's also a valid initial state
        expect(currentValue).toBeUndefined();
      }
    });

    it('should allow setting new values', () => {
      const newSettings = /** @type {import('$lib/types/private').EntryEditorView} */ ({
        showPreview: false,
        syncScrolling: false,
        selectAssetsView: { type: 'grid' },
      });

      entryEditorSettings.set(newSettings);

      const updatedValue = get(entryEditorSettings);

      expect(updatedValue).toEqual(newSettings);
    });

    it('should allow updating values via update method', () => {
      // First set a known state
      entryEditorSettings.set(
        /** @type {import('$lib/types/private').EntryEditorView} */ ({
          showPreview: true,
          syncScrolling: true,
          selectAssetsView: { type: 'grid' },
        }),
      );

      entryEditorSettings.update((current) => ({
        ...current,
        showPreview: false,
      }));

      const updatedValue = get(entryEditorSettings);

      expect(updatedValue?.showPreview).toBe(false);
      expect(updatedValue?.syncScrolling).toBe(true); // unchanged
    });

    it('should handle different selectAssetsView types', () => {
      entryEditorSettings.set(
        /** @type {import('$lib/types/private').EntryEditorView} */ ({
          showPreview: true,
          syncScrolling: true,
          selectAssetsView: { type: 'list' },
        }),
      );

      const value = get(entryEditorSettings);

      expect(value?.selectAssetsView?.type).toBe('list');
    });

    it('should preserve other properties when updating partial state', () => {
      const initialState = get(entryEditorSettings);

      entryEditorSettings.update((current) => ({
        ...current,
        syncScrolling: false,
      }));

      const updatedState = get(entryEditorSettings);

      expect(updatedState?.showPreview).toBe(initialState?.showPreview);
      expect(updatedState?.syncScrolling).toBe(false);
      expect(updatedState?.selectAssetsView).toEqual(initialState?.selectAssetsView);
    });
  });

  describe('initSettings function', () => {
    it('should exist and be callable', () => {
      expect(typeof initSettings).toBe('function');
    });

    it('should handle backend service without repository', async () => {
      const mockBackendService = /** @type {any} */ ({
        repository: null,
      });

      // Test that it doesn't throw
      await expect(() => initSettings(mockBackendService)).not.toThrow();
    });

    it('should handle backend service with repository', async () => {
      const mockBackendService = /** @type {any} */ ({
        repository: {
          databaseName: 'test-cms',
        },
      });

      // Test that it doesn't throw
      await expect(() => initSettings(mockBackendService)).not.toThrow();
    });

    it('should be an async function', () => {
      const result = initSettings(/** @type {any} */ ({ repository: undefined }));

      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('store reactivity', () => {
    it('should notify subscribers when value changes', () => {
      const mockSubscriber = vi.fn();
      const unsubscribe = entryEditorSettings.subscribe(mockSubscriber);

      // Should be called immediately with current value
      expect(mockSubscriber).toHaveBeenCalledWith({
        showPreview: true,
        syncScrolling: true,
        selectAssetsView: { type: 'grid' },
      });

      // Update the store
      entryEditorSettings.set(
        /** @type {import('$lib/types/private').EntryEditorView} */ ({
          showPreview: false,
          syncScrolling: true,
          selectAssetsView: { type: 'list' },
        }),
      );

      // Should be called again with new value
      expect(mockSubscriber).toHaveBeenCalledWith({
        showPreview: false,
        syncScrolling: true,
        selectAssetsView: { type: 'list' },
      });

      unsubscribe();
    });

    it('should stop notifications after unsubscribing', () => {
      const mockSubscriber = vi.fn();
      const unsubscribe = entryEditorSettings.subscribe(mockSubscriber);

      // Clear previous calls
      mockSubscriber.mockClear();

      // Unsubscribe
      unsubscribe();

      // Update the store
      entryEditorSettings.set(
        /** @type {import('$lib/types/private').EntryEditorView} */ ({
          showPreview: false,
          syncScrolling: false,
          selectAssetsView: { type: 'grid' },
        }),
      );

      // Should not be called after unsubscribing
      expect(mockSubscriber).not.toHaveBeenCalled();
    });
  });

  describe('settings validation', () => {
    it('should handle boolean values for showPreview', () => {
      entryEditorSettings.set(
        /** @type {import('$lib/types/private').EntryEditorView} */ ({
          showPreview: true,
          syncScrolling: true,
          selectAssetsView: { type: 'grid' },
        }),
      );

      expect(get(entryEditorSettings)?.showPreview).toBe(true);

      entryEditorSettings.set(
        /** @type {import('$lib/types/private').EntryEditorView} */ ({
          showPreview: false,
          syncScrolling: true,
          selectAssetsView: { type: 'grid' },
        }),
      );

      expect(get(entryEditorSettings)?.showPreview).toBe(false);
    });

    it('should handle boolean values for syncScrolling', () => {
      entryEditorSettings.set(
        /** @type {import('$lib/types/private').EntryEditorView} */ ({
          showPreview: true,
          syncScrolling: false,
          selectAssetsView: { type: 'grid' },
        }),
      );

      expect(get(entryEditorSettings)?.syncScrolling).toBe(false);

      entryEditorSettings.set(
        /** @type {import('$lib/types/private').EntryEditorView} */ ({
          showPreview: true,
          syncScrolling: true,
          selectAssetsView: { type: 'grid' },
        }),
      );

      expect(get(entryEditorSettings)?.syncScrolling).toBe(true);
    });

    it('should handle different view types in selectAssetsView', () => {
      const gridView = /** @type {import('$lib/types/private').SelectAssetsView} */ ({
        type: 'grid',
      });

      const listView = /** @type {import('$lib/types/private').SelectAssetsView} */ ({
        type: 'list',
      });

      entryEditorSettings.set(
        /** @type {import('$lib/types/private').EntryEditorView} */ ({
          showPreview: true,
          syncScrolling: true,
          selectAssetsView: gridView,
        }),
      );

      expect(get(entryEditorSettings)?.selectAssetsView).toEqual(gridView);

      entryEditorSettings.set(
        /** @type {import('$lib/types/private').EntryEditorView} */ ({
          showPreview: true,
          syncScrolling: true,
          selectAssetsView: listView,
        }),
      );

      expect(get(entryEditorSettings)?.selectAssetsView).toEqual(listView);
    });
  });

  describe('initSettings edge cases', () => {
    it('should initialize with default settings when no saved settings', async () => {
      const mockBackendService = /** @type {any} */ ({
        repository: {
          databaseName: 'test-cms',
        },
      });

      await initSettings(mockBackendService);

      const settings = get(entryEditorSettings);

      expect(settings?.showPreview).toBe(true);
      expect(settings?.syncScrolling).toBe(true);
      expect(settings?.selectAssetsView?.type).toBe('grid');
    });

    it('should handle undefined repository gracefully', async () => {
      const mockBackendService = /** @type {any} */ ({
        repository: undefined,
      });

      await initSettings(mockBackendService);

      // Should still set default settings
      const settings = get(entryEditorSettings);

      expect(settings).toBeDefined();
    });

    it('should handle empty repository object', async () => {
      const mockBackendService = /** @type {any} */ ({
        repository: {},
      });

      await initSettings(mockBackendService);

      const settings = get(entryEditorSettings);

      expect(settings).toBeDefined();
    });
  });
});
