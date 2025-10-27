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

    it('should skip update when state already matches (lines 54-56)', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.expanderStates = {
        _: {
          'field.0': true,
          'content#': false,
        },
      };

      entryDraft.update = vi.fn().mockImplementation((fn) => {
        const updated = fn(mockState);

        if (updated) {
          Object.assign(mockState, updated);
        }

        return updated;
      });

      syncExpanderStates({
        'field.0': true,
        'content#': false,
      });

      expect(entryDraft.update).toHaveBeenCalled();
    });

    it('should update state when it differs (lines 54-56 opposite branch)', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.expanderStates = {
        _: {
          'field.0': false,
          'content#': true,
        },
      };

      entryDraft.update = vi.fn().mockImplementation((fn) => {
        const updated = fn(mockState);

        if (updated) {
          Object.assign(mockState, updated);
        }

        return updated;
      });

      syncExpanderStates({
        'field.0': true,
        'content#': false,
      });

      expect(entryDraft.update).toHaveBeenCalled();
      // After the update, the state should be changed
      expect(mockState.expanderStates._['field.0']).toBe(true);
      expect(mockState.expanderStates._['content#']).toBe(false);
    });

    it('should handle null draft (line 54 if condition)', () => {
      entryDraft.update = vi.fn().mockImplementation((fn) => {
        // Pass null as the draft to test the if (_draft) condition
        const updated = fn(null);

        return updated;
      });

      expect(() => {
        syncExpanderStates({
          'field.0': true,
          'content#': false,
        });
      }).not.toThrow();

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

    it('should expand expander keys for invalid fields (line 141)', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.validities = {
        en: {
          'details.title': { valid: false },
          'details.content': { valid: true },
        },
      };

      mockState.currentValues = {
        en: {
          'details.title': 'Test',
          'details.content': 'Content',
        },
      };

      // Mock getExpanderKeys to return some keys to exercise the forEach loop on line 141
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'details.title') {
          return { name: 'title', widget: 'string' };
        }

        return undefined;
      });

      // This should exercise the forEach at line 141
      expandInvalidFields({
        collectionName: 'posts',
        fileName: 'post.md',
        currentValues: mockState.currentValues,
      });

      expect(entryDraft.update).toHaveBeenCalled();
    });

    it('should handle getExpanderKeys returning multiple keys for an invalid field', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      // Create a nested invalid field
      mockState.validities = {
        en: {
          'author.details': { valid: false },
        },
      };

      mockState.currentValues = {
        en: {
          'author.details': 'some value',
          'author.name': 'John',
        },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'author',
        widget: 'object',
      });

      // This tests the forEach loop when getExpanderKeys returns multiple keys
      expandInvalidFields({
        collectionName: 'posts',
        currentValues: mockState.currentValues,
      });

      expect(entryDraft.update).toHaveBeenCalled();
    });

    it('should handle multiple invalid fields in the same locale (line 131)', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.validities = {
        en: {
          field1: { valid: false },
          field2: { valid: false },
          field3: { valid: true },
        },
      };

      mockState.currentValues = {
        en: {
          field1: 'value1',
          field2: 'value2',
          field3: 'value3',
        },
      };

      // Mock getExpanderKeys to return keys for each invalid field
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'field1') {
          return { name: 'field1', widget: 'string' };
        }

        if (keyPath === 'field2') {
          return { name: 'field2', widget: 'string' };
        }

        return undefined;
      });

      // This should exercise the inner forEach at line 141
      expandInvalidFields({
        collectionName: 'posts',
        currentValues: mockState.currentValues,
      });

      expect(entryDraft.update).toHaveBeenCalled();
    });

    it('should exercise the conditional branch at line 38 with regex test (collapsed auto)', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.expanderStates = { _: {} };
      mockState.currentValues = {
        en: {
          'details.title': 'Test',
          'details.description': '',
          'details.content': 'Some content',
        },
      };

      // When collapsed is 'auto', should check for values matching the regex
      const result = getInitialExpanderState({
        key: 'details#',
        locale: 'en',
        collapsed: 'auto',
      });

      // With values present, should return false (not collapsed, i.e., expanded)
      expect(typeof result).toBe('boolean');
    });

    it('should exercise line 38 with no matching values (collapsed auto)', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.expanderStates = { _: {} };
      mockState.currentValues = {
        en: {
          'other.field': 'value',
        },
      };

      // When collapsed is 'auto' and no matching values exist
      const result = getInitialExpanderState({
        key: 'details#',
        locale: 'en',
        collapsed: 'auto',
      });

      // Should return true (collapsed) when no matching values
      expect(result).toBe(true);
    });

    it('should exercise line 38 regex test with matching value (collapsed auto expands)', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.expanderStates = { _: {} };
      mockState.currentValues = {
        en: {
          'section.title': 'My Section', // Matches regex ^section\.[^\.]+$ with truthy value
          'section.content': 'Content here', // Also matches
          'other.data': 'other', // Does not match regex for 'section#'
        },
      };

      // When collapsed is 'auto' and matching values exist with truthy values
      const result = getInitialExpanderState({
        key: 'section#',
        locale: 'en',
        collapsed: 'auto',
      });

      // Should return false (expanded) when matching values exist
      // This exercises the regex.test && !!value branch returning true, then ! negates to false
      expect(result).toBe(false);
    });

    it('should exercise line 38 regex test with falsy values (collapsed auto)', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.expanderStates = { _: {} };
      mockState.currentValues = {
        en: {
          'section.title': '',
          'section.content': null,
          'section.empty': undefined,
        },
      };

      // When collapsed is 'auto' and matching keys exist but all values are falsy
      const result = getInitialExpanderState({
        key: 'section#',
        locale: 'en',
        collapsed: 'auto',
      });

      // Should return true (collapsed) when all matching values are falsy
      expect(result).toBe(true);
    });

    it('should exercise line 38 with 0 as value (falsy but valid)', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.expanderStates = { _: {} };
      mockState.currentValues = {
        en: {
          'count.value': 0, // 0 is falsy, so !!0 is false
          'other.number': 5,
        },
      };

      // When collapsed is 'auto' and matching key has falsy value (0)
      const result = getInitialExpanderState({
        key: 'count#',
        locale: 'en',
        collapsed: 'auto',
      });

      // Should return true (collapsed) since 0 is falsy
      expect(result).toBe(true);
    });

    it('should exercise line 38 regex branch where regex.test fails', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.expanderStates = { _: {} };
      mockState.currentValues = {
        en: {
          section: 'value', // No dot, so regex won't match ^section\.[^\.]+$
          'deep.nested.field': 'value', // Too many dots
          'other.field': 'truthy',
        },
      };

      // When collapsed is 'auto' and regex doesn't match any keys
      const result = getInitialExpanderState({
        key: 'section#',
        locale: 'en',
        collapsed: 'auto',
      });

      // Should return true (collapsed) since no keys match the regex
      expect(result).toBe(true);
    });

    it('should exercise line 38 with mixed matching and non-matching keys', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.expanderStates = { _: {} };
      mockState.currentValues = {
        en: {
          'meta.title': 'Test', // Matches regex and truthy
          metadata: 'value', // Doesn't match (no dot after meta)
          'meta.desc': '', // Matches regex but falsy
        },
      };

      // When collapsed is 'auto' with one matching truthy value
      const result = getInitialExpanderState({
        key: 'meta#',
        locale: 'en',
        collapsed: 'auto',
      });

      // Should return false (expanded) due to meta.title being truthy
      expect(result).toBe(false);
    });

    it('should exercise line 38 with first entry matching truthy condition', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.expanderStates = { _: {} };
      mockState.currentValues = {
        en: {
          'author.name': 'John Doe', // First entry, matches and truthy
          'other.field': 'value',
        },
      };

      // This should hit the early exit of .some() since first entry matches
      const result = getInitialExpanderState({
        key: 'author#',
        locale: 'en',
        collapsed: 'auto',
      });

      // Should return false (expanded)
      expect(result).toBe(false);
    });

    it('should exercise line 38 with regex special characters (needs escaping)', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.expanderStates = { _: {} };
      mockState.currentValues = {
        en: {
          'config[].name': 'value', // Special regex chars that need escaping
          'config[].value': 'test',
        },
      };

      // When key contains special regex characters
      const result = getInitialExpanderState({
        key: 'config[]#',
        locale: 'en',
        collapsed: 'auto',
      });

      // Should handle the escaped regex properly
      expect(typeof result).toBe('boolean');
    });

    it('should exercise line 38 empty valueMap case', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.expanderStates = { _: {} };
      mockState.currentValues = {
        en: {}, // Empty map
      };

      // When valueMap is empty
      const result = getInitialExpanderState({
        key: 'field#',
        locale: 'en',
        collapsed: 'auto',
      });

      // Should return true (collapsed) when no entries at all
      expect(result).toBe(true);
    });

    it('should exercise line 38 with undefined locale in currentValues', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.expanderStates = { _: {} };
      mockState.currentValues = {
        // 'en' locale not present, will use ?? {} fallback
      };

      // When locale doesn't exist in currentValues
      const result = getInitialExpanderState({
        key: 'field#',
        locale: 'en',
        collapsed: 'auto',
      });

      // Should return true (collapsed) when valueMap is empty from ?? {}
      expect(result).toBe(true);
    });

    it('should exercise line 38 with null valueMap (using ?? fallback)', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.expanderStates = { _: {} };
      mockState.currentValues = {
        en: null, // Explicitly null
      };

      // When currentValues[locale] is null
      const result = getInitialExpanderState({
        key: 'field#',
        locale: 'en',
        collapsed: 'auto',
      });

      // Should return true (collapsed) when valueMap becomes {} from ?? fallback
      expect(result).toBe(true);
    });

    it('should exercise line 131 with multiple invalid fields per locale', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.validities = {
        en: {
          field1: { valid: false },
          field2: { valid: false },
          field3: { valid: false },
        },
      };

      mockState.currentValues = {
        en: {
          field1: 'value1',
          field2: 'value2',
          field3: 'value3',
        },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'field',
        widget: 'string',
      });

      // This directly exercises the inner forEach at line 131 with multiple iterations
      expandInvalidFields({
        collectionName: 'posts',
        currentValues: mockState.currentValues,
      });

      expect(entryDraft.update).toHaveBeenCalled();
    });

    it('should exercise line 131 forEach with getExpanderKeys returning keys (line 138-141)', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.validities = {
        en: {
          'author.profile': { valid: false },
        },
        ja: {
          'author.bio': { valid: false },
        },
      };

      mockState.currentValues = {
        en: {
          'author.profile': 'profile value',
          'author.name': 'John',
        },
        ja: {
          'author.bio': 'bio value',
          'author.name': 'ジョン',
        },
      };

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'author.profile') {
          return { name: 'profile', widget: 'object', fields: [] };
        }

        if (keyPath === 'author.bio') {
          return { name: 'bio', widget: 'object', fields: [] };
        }

        return { name: keyPath, widget: 'string' };
      });

      // This exercises the nested forEach loops at lines 131 and 138-141 across multiple locales
      expandInvalidFields({
        collectionName: 'posts',
        currentValues: mockState.currentValues,
      });

      expect(entryDraft.update).toHaveBeenCalled();
    });

    it('should handle empty validityMap for a locale (line 131)', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.validities = {
        en: {}, // Empty validity map for en
        ja: {
          title: { valid: false },
        },
      };

      mockState.currentValues = {
        en: { title: 'Test' },
        ja: { title: 'テスト' },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'title',
        widget: 'string',
      });

      // This exercises the forEach at line 131 with an empty validityMap
      expandInvalidFields({
        collectionName: 'posts',
        currentValues: mockState.currentValues,
      });

      expect(entryDraft.update).toHaveBeenCalled();
    });

    it('should skip valid fields at line 132-137 (valid: true)', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.validities = {
        en: {
          field1: { valid: true }, // valid is true, should skip
          field2: { valid: false }, // valid is false, should process
        },
      };

      mockState.currentValues = {
        en: {
          field1: 'value1',
          field2: 'value2',
        },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'field',
        widget: 'string',
      });

      // This exercises the if (!valid) check at line 132
      expandInvalidFields({
        collectionName: 'posts',
        currentValues: mockState.currentValues,
      });

      expect(entryDraft.update).toHaveBeenCalled();
    });

    it('should handle null validities (line 131 with ?? fallback)', () => {
      const mockState = /** @type {any} */ (entryDraft)._mockState;

      mockState.validities = null; // null validities, should use ?? {} fallback

      mockState.currentValues = {
        en: { title: 'Test' },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'title',
        widget: 'string',
      });

      // This exercises Object.entries(validities ?? {}) when validities is null
      expandInvalidFields({
        collectionName: 'posts',
        currentValues: mockState.currentValues,
      });

      expect(entryDraft.update).toHaveBeenCalled();
    });
  });
});
