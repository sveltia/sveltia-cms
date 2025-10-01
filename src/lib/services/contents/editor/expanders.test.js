import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entryDraft } from '$lib/services/contents/draft';
import { getField } from '$lib/services/contents/entry/fields';

import {
  expandInvalidFields,
  getExpanderKeys,
  getInitialExpanderState,
  syncExpanderStates,
} from './expanders.js';

// Mock dependencies before importing
vi.mock('$lib/services/contents/draft', () => {
  // Create a proper mock store that can be used with get()
  const mockDraft = {
    expanderStates: { _: {} },
    currentValues: {},
    validities: {},
    isIndexFile: false,
  };

  const mockEntryDraft = {
    update: vi.fn().mockImplementation((fn) => {
      const updated = fn(mockDraft);

      if (updated) {
        Object.assign(mockDraft, updated);
      }

      return updated;
    }),
    subscribe: vi.fn().mockImplementation((callback) => {
      callback(mockDraft);
      return vi.fn(); // unsubscribe function
    }),
    set: vi.fn(),
    // Expose mock state for testing
    _mockState: mockDraft,
  };

  // For get() function to work, we need to make the mock behave like a store
  // The get() function checks for a subscribe method and calls it
  return {
    entryDraft: mockEntryDraft,
  };
});

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(),
}));

describe('editor/expanders', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the mock draft state
    const mockState = /** @type {any} */ (entryDraft)._mockState;

    mockState.expanderStates = { _: {} };
    mockState.currentValues = {};
    mockState.validities = {};
    mockState.isIndexFile = false;
  });

  describe('function exports', () => {
    it('should export all expected functions', () => {
      expect(typeof getInitialExpanderState).toBe('function');
      expect(typeof syncExpanderStates).toBe('function');
      expect(typeof getExpanderKeys).toBe('function');
      expect(typeof expandInvalidFields).toBe('function');
    });
  });

  describe('getInitialExpanderState', () => {
    it('should handle basic parameters without throwing', () => {
      expect(() => {
        getInitialExpanderState({
          key: 'test.0',
          locale: 'en',
          collapsed: false,
        });
      }).not.toThrow();
    });

    it('should handle empty key parameter', () => {
      expect(() => {
        getInitialExpanderState({
          key: '',
          locale: 'en',
          collapsed: true,
        });
      }).not.toThrow();
    });

    it('should handle different collapsed values', () => {
      expect(() => {
        getInitialExpanderState({
          key: 'field.1',
          locale: 'en',
          collapsed: true,
        });
      }).not.toThrow();

      expect(() => {
        getInitialExpanderState({
          key: 'field.2',
          locale: 'en',
          collapsed: false,
        });
      }).not.toThrow();
    });

    it('should handle different locale values', () => {
      expect(() => {
        getInitialExpanderState({
          key: 'test',
          locale: 'ja',
          collapsed: false,
        });
      }).not.toThrow();

      expect(() => {
        getInitialExpanderState({
          key: 'test',
          locale: 'fr',
          collapsed: false,
        });
      }).not.toThrow();
    });
  });

  describe('getExpanderKeys', () => {
    it('should handle valid parameters', () => {
      expect(() => {
        getExpanderKeys({
          collectionName: 'posts',
          fileName: undefined,
          valueMap: {},
          keyPath: 'test',
          isIndexFile: false,
        });
      }).not.toThrow();
    });

    it('should handle with fileName', () => {
      expect(() => {
        getExpanderKeys({
          collectionName: 'articles',
          fileName: 'test.md',
          valueMap: {},
          keyPath: 'content',
          isIndexFile: false,
        });
      }).not.toThrow();
    });

    it('should handle index file scenario', () => {
      expect(() => {
        getExpanderKeys({
          collectionName: 'pages',
          fileName: '_index.md',
          valueMap: {},
          keyPath: 'sections',
          isIndexFile: true,
        });
      }).not.toThrow();
    });
  });

  describe('syncExpanderStates', () => {
    it('should handle basic state map', () => {
      expect(() => {
        syncExpanderStates({
          'field.0': true,
          'content#': false,
        });
      }).not.toThrow();
    });

    it('should handle empty state map', () => {
      expect(() => {
        syncExpanderStates({});
      }).not.toThrow();
    });

    it('should handle complex nested paths', () => {
      expect(() => {
        syncExpanderStates({
          'sections.0.items.1': true,
          'metadata.tags.2': false,
          'author.profile#': true,
        });
      }).not.toThrow();
    });

    it('should call entryDraft.update when executed', () => {
      syncExpanderStates({
        'test.field': true,
      });

      // The function should attempt to update the draft
      expect(entryDraft.update).toHaveBeenCalled();
    });
  });

  describe('expandInvalidFields', () => {
    it('should handle valid parameters', () => {
      expect(() => {
        expandInvalidFields({
          collectionName: 'posts',
          fileName: undefined,
          currentValues: { en: {} },
        });
      }).not.toThrow();
    });

    it('should handle with fileName', () => {
      expect(() => {
        expandInvalidFields({
          collectionName: 'articles',
          fileName: 'test.md',
          currentValues: { en: {}, ja: {} },
        });
      }).not.toThrow();
    });

    it('should handle empty currentValues', () => {
      expect(() => {
        expandInvalidFields({
          collectionName: 'pages',
          fileName: undefined,
          currentValues: {},
        });
      }).not.toThrow();
    });

    it('should handle complex currentValues', () => {
      expect(() => {
        expandInvalidFields({
          collectionName: 'blog',
          fileName: 'post.md',
          currentValues: {
            en: { title: 'Test', content: 'Content' },
            ja: { title: 'テスト', content: 'コンテンツ' },
          },
        });
      }).not.toThrow();
    });

    it('should call entryDraft.update when executed', () => {
      expandInvalidFields({
        collectionName: 'test',
        currentValues: { en: {} },
      });

      // The function should attempt to update the draft
      expect(entryDraft.update).toHaveBeenCalled();
    });
  });

  describe('integration behavior', () => {
    it('should work with mocked dependencies', () => {
      // Set up mock return values
      vi.mocked(getField).mockReturnValue({
        name: 'testField',
        widget: 'string',
      });

      // Test that functions can be called with mocked dependencies
      expect(() => {
        getInitialExpanderState({
          key: 'test',
          locale: 'en',
          collapsed: false,
        });

        syncExpanderStates({
          'test.field': true,
        });

        expandInvalidFields({
          collectionName: 'test',
          currentValues: { en: {} },
        });
      }).not.toThrow();
    });

    it('should handle entryDraft update calls', () => {
      const mockUpdate = vi.fn();

      vi.mocked(entryDraft.update).mockImplementation(mockUpdate);

      syncExpanderStates({
        field1: true,
        field2: false,
      });

      expandInvalidFields({
        collectionName: 'posts',
        currentValues: { en: {} },
      });

      // Both functions should call entryDraft.update
      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe('getInitialExpanderState - auto collapsed behavior', () => {
    it('should handle collapsed auto with values', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.currentValues = {
        en: {
          'details.title': 'Test',
          'details.content': 'Content',
        },
      };

      const result = getInitialExpanderState({
        key: 'details#',
        locale: 'en',
        collapsed: 'auto',
      });

      expect(typeof result).toBe('boolean');
    });

    it('should handle collapsed auto without values', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.currentValues = {
        en: {},
      };

      const result = getInitialExpanderState({
        key: 'details#',
        locale: 'en',
        collapsed: 'auto',
      });

      expect(typeof result).toBe('boolean');
    });

    it('should use existing state if available', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.expanderStates = { _: { 'test.0': true } };

      const result = getInitialExpanderState({
        key: 'test.0',
        locale: 'en',
        collapsed: false,
      });

      expect(result).toBe(true);
    });

    it('should return false when existing state is false', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.expanderStates = { _: { 'test.0': false } };

      const result = getInitialExpanderState({
        key: 'test.0',
        locale: 'en',
        collapsed: true,
      });

      expect(result).toBe(false);
    });
  });

  describe('getExpanderKeys - widget types', () => {
    it('should handle object widget', () => {
      vi.mocked(getField).mockReturnValue({
        name: 'details',
        widget: 'object',
        fields: [],
      });

      const keys = getExpanderKeys({
        collectionName: 'posts',
        valueMap: {},
        keyPath: 'details',
      });

      expect(Array.isArray(keys)).toBe(true);
    });

    it('should handle list widget', () => {
      vi.mocked(getField).mockReturnValue({
        name: 'items',
        widget: 'list',
        field: { name: 'item', widget: 'string' },
      });

      const keys = getExpanderKeys({
        collectionName: 'posts',
        valueMap: {},
        keyPath: 'items.0',
      });

      expect(Array.isArray(keys)).toBe(true);
    });

    it('should handle nested paths with numbers', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'sections') {
          return { name: 'sections', widget: 'list', field: { widget: 'object' } };
        }

        if (keyPath === 'sections.0') {
          return { name: 'section', widget: 'object', fields: [] };
        }

        return undefined;
      });

      const keys = getExpanderKeys({
        collectionName: 'pages',
        valueMap: {},
        keyPath: 'sections.0.title',
      });

      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThan(0);
    });

    it('should handle parent object with fields', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'parent') {
          return { name: 'parent', widget: 'object', fields: [] };
        }

        return { name: 'child', widget: 'string' };
      });

      const keys = getExpanderKeys({
        collectionName: 'test',
        valueMap: {},
        keyPath: 'parent.child',
      });

      expect(Array.isArray(keys)).toBe(true);
    });

    it('should handle parent list with field', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'items') {
          return { name: 'items', widget: 'list', field: { widget: 'string' } };
        }

        return undefined;
      });

      const keys = getExpanderKeys({
        collectionName: 'test',
        valueMap: {},
        keyPath: 'items.0',
      });

      expect(Array.isArray(keys)).toBe(true);
    });
  });

  describe('expandInvalidFields - validity handling', () => {
    it('should handle invalid fields', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.validities = {
        en: {
          title: { valid: false },
          content: { valid: true },
        },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'title',
        widget: 'string',
      });

      expect(() => {
        expandInvalidFields({
          collectionName: 'posts',
          currentValues: { en: { title: '', content: 'test' } },
        });
      }).not.toThrow();
    });

    it('should handle multiple locales with validities', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.validities = {
        en: {
          field1: { valid: false },
        },
        ja: {
          field2: { valid: false },
        },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'field',
        widget: 'string',
      });

      expect(() => {
        expandInvalidFields({
          collectionName: 'posts',
          currentValues: {
            en: { field1: '' },
            ja: { field2: '' },
          },
        });
      }).not.toThrow();
    });

    it('should skip valid fields', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.validities = {
        en: {
          field1: { valid: true },
          field2: { valid: true },
        },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'field',
        widget: 'string',
      });

      expandInvalidFields({
        collectionName: 'posts',
        currentValues: { en: { field1: 'a', field2: 'b' } },
      });

      // Should still call update even if no invalid fields
      expect(entryDraft.update).toHaveBeenCalled();
    });
  });
});
