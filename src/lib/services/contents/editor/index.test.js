import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import the stores and functions to test
import {
  copyFromLocaleToast,
  customPreviewStyleRegistry,
  editorFirstPane,
  editorSecondPane,
  selectAssetsView,
  showContentOverlay,
  showDuplicateToast,
  translatorApiKeyDialogState,
} from './index.js';

describe('editor/index', () => {
  beforeEach(() => {
    // Reset all stores to their initial values
    showContentOverlay.set(false);
    showDuplicateToast.set(false);
    translatorApiKeyDialogState.set({ show: false, multiple: false });
    copyFromLocaleToast.set({
      id: undefined,
      show: false,
      status: 'success',
      message: undefined,
      count: 1,
      sourceLanguage: undefined,
    });
    editorFirstPane.set(null);
    editorSecondPane.set(null);
    selectAssetsView.set(undefined);
    // Clear the Set
    customPreviewStyleRegistry.clear();
  });

  describe('showContentOverlay', () => {
    it('should initialize as false', () => {
      expect(get(showContentOverlay)).toBe(false);
    });

    it('should update when set to true', () => {
      showContentOverlay.set(true);
      expect(get(showContentOverlay)).toBe(true);
    });

    it('should update when set to false', () => {
      showContentOverlay.set(true);
      showContentOverlay.set(false);
      expect(get(showContentOverlay)).toBe(false);
    });
  });

  describe('showDuplicateToast', () => {
    it('should initialize as false', () => {
      expect(get(showDuplicateToast)).toBe(false);
    });

    it('should update when set to true', () => {
      showDuplicateToast.set(true);
      expect(get(showDuplicateToast)).toBe(true);
    });

    it('should update when set to false', () => {
      showDuplicateToast.set(true);
      showDuplicateToast.set(false);
      expect(get(showDuplicateToast)).toBe(false);
    });
  });

  describe('translatorApiKeyDialogState', () => {
    it('should initialize with correct default values', () => {
      const state = get(translatorApiKeyDialogState);

      expect(state).toEqual({
        show: false,
        multiple: false,
      });
    });

    it('should update show property', () => {
      translatorApiKeyDialogState.set({ show: true, multiple: false });
      expect(get(translatorApiKeyDialogState).show).toBe(true);
    });

    it('should update multiple property', () => {
      translatorApiKeyDialogState.set({ show: false, multiple: true });
      expect(get(translatorApiKeyDialogState).multiple).toBe(true);
    });

    it('should include resolve function when provided', () => {
      const mockResolve = vi.fn();

      translatorApiKeyDialogState.set({
        show: true,
        multiple: false,
        resolve: mockResolve,
      });

      const state = get(translatorApiKeyDialogState);

      expect(state.resolve).toBe(mockResolve);
    });

    it('should update using the update method', () => {
      translatorApiKeyDialogState.update((state) => ({
        ...state,
        show: true,
      }));

      expect(get(translatorApiKeyDialogState).show).toBe(true);
      expect(get(translatorApiKeyDialogState).multiple).toBe(false);
    });
  });

  describe('copyFromLocaleToast', () => {
    it('should initialize with correct default values', () => {
      const toast = get(copyFromLocaleToast);

      expect(toast).toEqual({
        id: undefined,
        show: false,
        status: 'success',
        message: undefined,
        count: 1,
        sourceLanguage: undefined,
      });
    });

    it('should update all properties correctly', () => {
      const newToast = {
        id: 123,
        show: true,
        status: /** @type {'error'} */ ('error'),
        message: 'Copy failed',
        count: 5,
        sourceLanguage: 'en',
      };

      copyFromLocaleToast.set(newToast);
      expect(get(copyFromLocaleToast)).toEqual(newToast);
    });

    it('should update individual properties using update method', () => {
      copyFromLocaleToast.update((toast) => ({
        ...toast,
        show: true,
        count: 3,
      }));

      const updated = get(copyFromLocaleToast);

      expect(updated.show).toBe(true);
      expect(updated.count).toBe(3);
      expect(updated.status).toBe('success'); // unchanged
    });

    it('should handle different status values', () => {
      copyFromLocaleToast.set({
        id: 1,
        show: true,
        status: /** @type {'info'} */ ('info'),
        message: 'Info message',
        count: 1,
        sourceLanguage: 'fr',
      });

      expect(get(copyFromLocaleToast).status).toBe('info');
    });
  });

  describe('editorFirstPane', () => {
    it('should initialize as null', () => {
      expect(get(editorFirstPane)).toBeNull();
    });

    it('should update when set to a pane value', () => {
      const pane = /** @type {import('$lib/types/private').EntryEditorPane} */ ({
        mode: 'edit',
        locale: 'en',
      });

      editorFirstPane.set(pane);
      expect(get(editorFirstPane)).toBe(pane);
    });

    it('should reset to null', () => {
      editorFirstPane.set(
        /** @type {import('$lib/types/private').EntryEditorPane} */ ({
          mode: 'preview',
          locale: 'en',
        }),
      );
      editorFirstPane.set(null);
      expect(get(editorFirstPane)).toBeNull();
    });
  });

  describe('editorSecondPane', () => {
    it('should initialize as null', () => {
      expect(get(editorSecondPane)).toBeNull();
    });

    it('should update when set to a pane value', () => {
      const pane = /** @type {import('$lib/types/private').EntryEditorPane} */ ({
        mode: 'preview',
        locale: 'en',
      });

      editorSecondPane.set(pane);
      expect(get(editorSecondPane)).toBe(pane);
    });

    it('should reset to null', () => {
      editorSecondPane.set(
        /** @type {import('$lib/types/private').EntryEditorPane} */ ({
          mode: 'edit',
          locale: 'en',
        }),
      );
      editorSecondPane.set(null);
      expect(get(editorSecondPane)).toBeNull();
    });
  });

  describe('selectAssetsView', () => {
    it('should initialize as undefined', () => {
      expect(get(selectAssetsView)).toBeUndefined();
    });

    it('should update when set to a view object', () => {
      const view = /** @type {import('$lib/types/private').SelectAssetsView} */ ({
        type: 'grid',
        sortBy: 'name',
      });

      selectAssetsView.set(view);
      expect(get(selectAssetsView)).toEqual(view);
    });

    it('should handle different view types', () => {
      const listView = /** @type {import('$lib/types/private').SelectAssetsView} */ ({
        type: 'list',
      });

      selectAssetsView.set(listView);
      expect(get(selectAssetsView)).toEqual(listView);
    });

    it('should reset to undefined', () => {
      selectAssetsView.set({ type: 'grid' });
      selectAssetsView.set(undefined);
      expect(get(selectAssetsView)).toBeUndefined();
    });
  });

  describe('customPreviewStyleRegistry', () => {
    beforeEach(() => {
      // Clear the Set before each test
      customPreviewStyleRegistry.clear();
    });

    it('should be initialized as an empty Set', () => {
      expect(customPreviewStyleRegistry).toBeInstanceOf(Set);
      expect(customPreviewStyleRegistry.size).toBe(0);
    });

    it('should allow custom preview styles to be added', () => {
      const styleUrl = 'https://example.com/style.css';

      customPreviewStyleRegistry.add(styleUrl);

      expect(customPreviewStyleRegistry.has(styleUrl)).toBe(true);
      expect(customPreviewStyleRegistry.size).toBe(1);
    });

    it('should allow multiple styles to be added', () => {
      const styleUrl1 = 'https://example.com/style1.css';
      const styleUrl2 = 'https://example.com/style2.css';

      customPreviewStyleRegistry.add(styleUrl1);
      customPreviewStyleRegistry.add(styleUrl2);

      expect(customPreviewStyleRegistry.has(styleUrl1)).toBe(true);
      expect(customPreviewStyleRegistry.has(styleUrl2)).toBe(true);
      expect(customPreviewStyleRegistry.size).toBe(2);
    });

    it('should not add duplicate styles', () => {
      const styleUrl = 'https://example.com/style.css';

      customPreviewStyleRegistry.add(styleUrl);
      customPreviewStyleRegistry.add(styleUrl); // Adding the same URL again

      expect(customPreviewStyleRegistry.size).toBe(1);
      expect(customPreviewStyleRegistry.has(styleUrl)).toBe(true);
    });

    it('should allow styles to be removed', () => {
      const styleUrl = 'https://example.com/temp.css';

      customPreviewStyleRegistry.add(styleUrl);
      expect(customPreviewStyleRegistry.size).toBe(1);

      customPreviewStyleRegistry.delete(styleUrl);
      expect(customPreviewStyleRegistry.size).toBe(0);
      expect(customPreviewStyleRegistry.has(styleUrl)).toBe(false);
    });

    it('should be a Set instance (not a store)', () => {
      // Verify it's not a Svelte store by checking it doesn't have subscribe method
      expect(typeof (/** @type {any} */ (customPreviewStyleRegistry).subscribe)).toBe('undefined');
      expect(customPreviewStyleRegistry).toBeInstanceOf(Set);
    });

    it('should return false when checking for non-existent style', () => {
      const styleUrl = 'https://example.com/nonexistent.css';

      expect(customPreviewStyleRegistry.has(styleUrl)).toBe(false);
    });

    it('should support iteration over styles', () => {
      const styleUrl1 = 'https://example.com/style1.css';
      const styleUrl2 = 'https://example.com/style2.css';

      customPreviewStyleRegistry.add(styleUrl1);
      customPreviewStyleRegistry.add(styleUrl2);

      const styles = Array.from(customPreviewStyleRegistry);

      expect(styles).toContain(styleUrl1);
      expect(styles).toContain(styleUrl2);
      expect(styles.length).toBe(2);
    });
  });

  describe('store reactivity', () => {
    it('should trigger subscriptions when stores are updated', () => {
      const mockCallback = vi.fn();
      const unsubscribe = showContentOverlay.subscribe(mockCallback);

      // Initial call with current value
      expect(mockCallback).toHaveBeenCalledWith(false);

      // Update should trigger subscription
      showContentOverlay.set(true);
      expect(mockCallback).toHaveBeenCalledWith(true);

      unsubscribe();
    });

    it('should handle multiple subscribers', () => {
      const mockCallback1 = vi.fn();
      const mockCallback2 = vi.fn();
      const unsubscribe1 = copyFromLocaleToast.subscribe(mockCallback1);
      const unsubscribe2 = copyFromLocaleToast.subscribe(mockCallback2);

      const newToast = {
        id: 456,
        show: true,
        status: /** @type {'info'} */ ('info'),
        message: 'Test message',
        count: 2,
        sourceLanguage: 'es',
      };

      copyFromLocaleToast.set(newToast);

      expect(mockCallback1).toHaveBeenCalledWith(newToast);
      expect(mockCallback2).toHaveBeenCalledWith(newToast);

      unsubscribe1();
      unsubscribe2();
    });
  });
});
