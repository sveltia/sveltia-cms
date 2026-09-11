import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import the stores and functions to test
import {
  customPreviewStyleRegistry,
  customPreviewTemplateRegistry,
} from '$lib/services/api/registries';

import {
  activeInlineEditors,
  copyFromLocaleToast,
  editorFirstPane,
  editorSecondPane,
  selectAssetsView,
  showContentOverlay,
  showDuplicateToast,
  translatorApiKeyDialogState,
} from '.';

describe('editor/index', () => {
  beforeEach(() => {
    // Reset all stores to their initial values
    showContentOverlay.current = false;
    showDuplicateToast.current = false;
    activeInlineEditors.current = 0;
    translatorApiKeyDialogState.current = { show: false, multiple: false };
    copyFromLocaleToast.current = {
      id: undefined,
      show: false,
      status: 'success',
      message: undefined,
      count: 1,
      sourceLanguage: undefined,
    };
    editorFirstPane.current = null;
    editorSecondPane.current = null;
    selectAssetsView.current = undefined;
    // Clear the Set
    customPreviewStyleRegistry.clear();
  });

  describe('showContentOverlay', () => {
    it('should initialize as false', () => {
      expect(showContentOverlay.current).toBe(false);
    });

    it('should update when set to true', () => {
      showContentOverlay.current = true;
      expect(showContentOverlay.current).toBe(true);
    });

    it('should update when set to false', () => {
      showContentOverlay.current = true;
      showContentOverlay.current = false;
      expect(showContentOverlay.current).toBe(false);
    });
  });

  describe('showDuplicateToast', () => {
    it('should initialize as false', () => {
      expect(showDuplicateToast.current).toBe(false);
    });

    it('should update when set to true', () => {
      showDuplicateToast.current = true;
      expect(showDuplicateToast.current).toBe(true);
    });

    it('should update when set to false', () => {
      showDuplicateToast.current = true;
      showDuplicateToast.current = false;
      expect(showDuplicateToast.current).toBe(false);
    });
  });

  describe('activeInlineEditors', () => {
    it('should initialize as zero', () => {
      expect(activeInlineEditors.current).toBe(0);
    });

    it('should count multiple active editors', () => {
      activeInlineEditors.current += 1;
      activeInlineEditors.current += 1;
      expect(activeInlineEditors.current).toBe(2);
      activeInlineEditors.current -= 1;
      expect(activeInlineEditors.current).toBe(1);
      activeInlineEditors.current -= 1;
      expect(activeInlineEditors.current).toBe(0);
    });
  });

  describe('translatorApiKeyDialogState', () => {
    it('should initialize with correct default values', () => {
      const state = translatorApiKeyDialogState.current;

      expect(state).toEqual({
        show: false,
        multiple: false,
      });
    });

    it('should update show property', () => {
      translatorApiKeyDialogState.current = { show: true, multiple: false };
      expect(translatorApiKeyDialogState.current.show).toBe(true);
    });

    it('should update multiple property', () => {
      translatorApiKeyDialogState.current = { show: false, multiple: true };
      expect(translatorApiKeyDialogState.current.multiple).toBe(true);
    });

    it('should include resolve function when provided', () => {
      const mockResolve = vi.fn();

      translatorApiKeyDialogState.current = {
        show: true,
        multiple: false,
        resolve: mockResolve,
      };

      const state = translatorApiKeyDialogState.current;

      expect(state.resolve).toBe(mockResolve);
    });

    it('should update by spreading the current state', () => {
      translatorApiKeyDialogState.current = {
        ...translatorApiKeyDialogState.current,
        show: true,
      };

      expect(translatorApiKeyDialogState.current.show).toBe(true);
      expect(translatorApiKeyDialogState.current.multiple).toBe(false);
    });
  });

  describe('copyFromLocaleToast', () => {
    it('should initialize with correct default values', () => {
      const toast = copyFromLocaleToast.current;

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

      copyFromLocaleToast.current = newToast;
      expect(copyFromLocaleToast.current).toEqual(newToast);
    });

    it('should update individual properties by spreading the current state', () => {
      copyFromLocaleToast.current = {
        ...copyFromLocaleToast.current,
        show: true,
        count: 3,
      };

      const updated = copyFromLocaleToast.current;

      expect(updated.show).toBe(true);
      expect(updated.count).toBe(3);
      expect(updated.status).toBe('success'); // unchanged
    });

    it('should handle different status values', () => {
      copyFromLocaleToast.current = {
        id: 1,
        show: true,
        status: /** @type {'info'} */ ('info'),
        message: 'Info message',
        count: 1,
        sourceLanguage: 'fr',
      };

      expect(copyFromLocaleToast.current.status).toBe('info');
    });
  });

  describe('editorFirstPane', () => {
    it('should initialize as null', () => {
      expect(editorFirstPane.current).toBeNull();
    });

    it('should update when set to a pane value', () => {
      const pane = /** @type {import('$lib/types/private').EntryEditorPane} */ ({
        mode: 'edit',
        locale: 'en',
      });

      editorFirstPane.current = pane;
      expect(editorFirstPane.current).toBe(pane);
    });

    it('should reset to null', () => {
      editorFirstPane.current = /** @type {import('$lib/types/private').EntryEditorPane} */ ({
        mode: 'preview',
        locale: 'en',
      });
      editorFirstPane.current = null;
      expect(editorFirstPane.current).toBeNull();
    });
  });

  describe('editorSecondPane', () => {
    it('should initialize as null', () => {
      expect(editorSecondPane.current).toBeNull();
    });

    it('should update when set to a pane value', () => {
      const pane = /** @type {import('$lib/types/private').EntryEditorPane} */ ({
        mode: 'preview',
        locale: 'en',
      });

      editorSecondPane.current = pane;
      expect(editorSecondPane.current).toBe(pane);
    });

    it('should reset to null', () => {
      editorSecondPane.current = /** @type {import('$lib/types/private').EntryEditorPane} */ ({
        mode: 'edit',
        locale: 'en',
      });
      editorSecondPane.current = null;
      expect(editorSecondPane.current).toBeNull();
    });
  });

  describe('selectAssetsView', () => {
    it('should initialize as undefined', () => {
      expect(selectAssetsView.current).toBeUndefined();
    });

    it('should update when set to a view object', () => {
      const view = /** @type {import('$lib/types/private').SelectAssetsView} */ ({
        type: 'grid',
        sortBy: 'name',
      });

      selectAssetsView.current = view;
      expect(selectAssetsView.current).toEqual(view);
    });

    it('should handle different view types', () => {
      const listView = /** @type {import('$lib/types/private').SelectAssetsView} */ ({
        type: 'list',
      });

      selectAssetsView.current = listView;
      expect(selectAssetsView.current).toEqual(listView);
    });

    it('should reset to undefined', () => {
      selectAssetsView.current = { type: 'grid' };
      selectAssetsView.current = undefined;
      expect(selectAssetsView.current).toBeUndefined();
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

  describe('customPreviewTemplateRegistry', () => {
    beforeEach(() => {
      // Clear the Map before each test
      customPreviewTemplateRegistry.clear();
    });

    it('should be initialized as an empty Map', () => {
      expect(customPreviewTemplateRegistry).toBeInstanceOf(Map);
      expect(customPreviewTemplateRegistry.size).toBe(0);
    });

    it('should allow custom preview templates to be registered', () => {
      const templateName = 'posts';
      /**
       * Test component.
       * @returns {null} Component.
       */
      const component = () => null;

      customPreviewTemplateRegistry.set(templateName, component);

      expect(customPreviewTemplateRegistry.has(templateName)).toBe(true);
      expect(customPreviewTemplateRegistry.get(templateName)).toBe(component);
      expect(customPreviewTemplateRegistry.size).toBe(1);
    });

    it('should allow multiple templates to be registered', () => {
      /**
       * Test component 1.
       * @returns {null} Component.
       */
      const template1 = () => null;
      /**
       * Test component 2.
       * @returns {null} Component.
       */
      const template2 = () => null;

      customPreviewTemplateRegistry.set('posts', template1);
      customPreviewTemplateRegistry.set('pages', template2);

      expect(customPreviewTemplateRegistry.has('posts')).toBe(true);
      expect(customPreviewTemplateRegistry.has('pages')).toBe(true);
      expect(customPreviewTemplateRegistry.size).toBe(2);
    });

    it('should replace existing template when setting same name', () => {
      /**
       * Test component 1.
       * @returns {null} Component.
       */
      const component1 = () => null;
      /**
       * Test component 2.
       * @returns {null} Component.
       */
      const component2 = () => null;

      customPreviewTemplateRegistry.set('posts', component1);
      customPreviewTemplateRegistry.set('posts', component2);

      expect(customPreviewTemplateRegistry.size).toBe(1);
      expect(customPreviewTemplateRegistry.get('posts')).toBe(component2);
    });

    it('should allow templates to be removed', () => {
      /**
       * Test component.
       * @returns {null} Component.
       */
      const component = () => null;

      customPreviewTemplateRegistry.set('posts', component);
      expect(customPreviewTemplateRegistry.size).toBe(1);

      customPreviewTemplateRegistry.delete('posts');
      expect(customPreviewTemplateRegistry.size).toBe(0);
      expect(customPreviewTemplateRegistry.has('posts')).toBe(false);
    });

    it('should be a Map instance (not a store)', () => {
      // Verify it's not a Svelte store by checking it doesn't have subscribe method
      expect(typeof (/** @type {any} */ (customPreviewTemplateRegistry).subscribe)).toBe(
        'undefined',
      );
      expect(customPreviewTemplateRegistry).toBeInstanceOf(Map);
    });

    it('should return undefined when getting non-existent template', () => {
      expect(customPreviewTemplateRegistry.get('nonexistent')).toBeUndefined();
    });

    it('should support iteration over templates', () => {
      /**
       * Test component 1.
       * @returns {null} Component.
       */
      const component1 = () => null;
      /**
       * Test component 2.
       * @returns {null} Component.
       */
      const component2 = () => null;

      customPreviewTemplateRegistry.set('posts', component1);
      customPreviewTemplateRegistry.set('pages', component2);

      const entries = Array.from(customPreviewTemplateRegistry.entries());

      expect(entries).toHaveLength(2);
      expect(entries[0][0]).toBe('posts');
      expect(entries[1][0]).toBe('pages');
    });
  });
});
