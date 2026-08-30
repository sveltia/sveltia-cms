import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entryDraft, i18nAutoDupEnabled } from '$lib/services/contents/draft';

import { updateNonPrimitiveValue } from '.';

// Keep the real `suspendAutoDuplication` so it still runs its callback and toggles the store,
// which the tests below spy on
vi.mock('$lib/services/contents/draft', async () => ({
  ...(await vi.importActual('$lib/services/contents/draft')),
}));
vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return {
    ...actual,
    get: vi.fn(() => ({ devModeEnabled: false })),
  };
});

describe('draft/update/index', () => {
  /** @type {any} */
  let mockEntryDraft;
  /** @type {any} */
  let mockUpdate;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockEntryDraft = {
      currentValues: {
        en: {
          'settings.theme': 'dark',
          'settings.fontSize': '14',
          'author.name': 'John Doe',
        },
        ja: {
          'settings.theme': '',
          'settings.fontSize': '',
          'author.name': '太郎',
        },
      },
    };

    mockUpdate = vi.fn((/** @type {any} */ fn) => {
      if (typeof fn === 'function') {
        const result = fn(mockEntryDraft);

        // Update the mock object to reflect changes
        Object.assign(mockEntryDraft, result);
        return result;
      }

      return mockEntryDraft;
    });

    vi.mocked(entryDraft).update = mockUpdate;
    vi.mocked(i18nAutoDupEnabled).set = vi.fn();
  });

  describe('updateNonPrimitiveValue', () => {
    it('should update a single-level object field', () => {
      const newValue = { theme: 'light', fontSize: '16' };

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'settings',
        locale: 'en',
        i18n: 'none',
        value: newValue,
      });

      expect(mockUpdate).toHaveBeenCalled();
      expect(vi.mocked(i18nAutoDupEnabled).set).toHaveBeenNthCalledWith(1, false);
      expect(vi.mocked(i18nAutoDupEnabled).set).toHaveBeenLastCalledWith(true);
    });

    it('should update only the specified locale when i18n is "none"', () => {
      const newValue = { theme: 'light', fontSize: '16' };

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'settings',
        locale: 'en',
        i18n: 'none',
        value: newValue,
      });

      // Verify the callback was called
      const callbackFn = mockUpdate.mock.calls[0][0];
      const result = callbackFn(mockEntryDraft);

      // English values should be updated
      expect(result.currentValues.en['settings.theme']).toBe('light');
      expect(result.currentValues.en['settings.fontSize']).toBe('16');

      // Japanese values should remain unchanged
      expect(result.currentValues.ja['settings.theme']).toBe('');
      expect(result.currentValues.ja['settings.fontSize']).toBe('');
    });

    it('should update all locales when i18n is "duplicate"', () => {
      const newValue = { theme: 'light', fontSize: '16' };

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'settings',
        locale: 'en',
        i18n: 'duplicate',
        value: newValue,
      });

      const callbackFn = mockUpdate.mock.calls[0][0];
      const result = callbackFn(mockEntryDraft);

      // Both English and Japanese should be updated
      expect(result.currentValues.en['settings.theme']).toBe('light');
      expect(result.currentValues.en['settings.fontSize']).toBe('16');
      expect(result.currentValues.ja['settings.theme']).toBe('light');
      expect(result.currentValues.ja['settings.fontSize']).toBe('16');
    });

    it('should remove all existing nested values before adding new ones', () => {
      const draftWithOldValues = {
        currentValues: {
          en: {
            'settings.theme': 'dark',
            'settings.fontSize': '14',
            'settings.old': 'value',
            'other.field': 'keep',
          },
        },
      };

      const newValue = { theme: 'light', fontSize: '16' };

      // Setup mockUpdate to use the draft with old values
      mockUpdate.mockImplementationOnce((/** @type {any} */ fn) => {
        if (typeof fn === 'function') {
          const result = fn(draftWithOldValues);

          Object.assign(draftWithOldValues, result);
          return result;
        }

        return draftWithOldValues;
      });

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'settings',
        locale: 'en',
        i18n: 'none',
        value: newValue,
      });

      const updateCallback = mockUpdate.mock.calls[0][0];
      const result = updateCallback(draftWithOldValues);

      // Old settings values should be removed
      expect(result.currentValues.en['settings.old']).toBeUndefined();
      // New settings values should be added
      expect(result.currentValues.en['settings.theme']).toBe('light');
      expect(result.currentValues.en['settings.fontSize']).toBe('16');
      // Other fields should remain
      expect(result.currentValues.en['other.field']).toBe('keep');
    });

    it('should remove exact keyPath match in addition to nested values', () => {
      const draftWithExactMatch = {
        currentValues: {
          en: {
            author: 'John Doe',
            'author.name': 'John',
            'author.email': 'john@example.com',
            'other.field': 'keep',
          },
        },
      };

      const newValue = { name: 'Jane', email: 'jane@example.com' };

      mockUpdate.mockImplementationOnce((/** @type {any} */ fn) => {
        if (typeof fn === 'function') {
          const result = fn(draftWithExactMatch);

          Object.assign(draftWithExactMatch, result);
          return result;
        }

        return draftWithExactMatch;
      });

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'author',
        locale: 'en',
        i18n: 'none',
        value: newValue,
      });

      const updateCallback = mockUpdate.mock.calls[0][0];
      const result = updateCallback(draftWithExactMatch);

      // Exact match should be removed, then field initialized with empty object
      expect(result.currentValues.en.author).toEqual({});
      // Nested values should be removed then re-added with flatten
      expect(result.currentValues.en['author.name']).toBe('Jane');
      expect(result.currentValues.en['author.email']).toBe('jane@example.com');
      // Other fields should remain
      expect(result.currentValues.en['other.field']).toBe('keep');
    });

    it('should handle array values correctly', () => {
      const newValue = ['item1', 'item2', 'item3'];

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'tags',
        locale: 'en',
        i18n: 'none',
        value: newValue,
      });

      const callbackFn = mockUpdate.mock.calls[0][0];

      const draftWithArray = {
        currentValues: {
          en: {},
        },
      };

      const result = callbackFn(draftWithArray);

      // Array should be flattened
      expect(result.currentValues.en['tags.0']).toBe('item1');
      expect(result.currentValues.en['tags.1']).toBe('item2');
      expect(result.currentValues.en['tags.2']).toBe('item3');
    });

    it('should handle deeply nested objects', () => {
      const newValue = {
        level1: {
          level2: {
            level3: 'value',
          },
        },
        other: 'data',
      };

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'nested',
        locale: 'en',
        i18n: 'none',
        value: newValue,
      });

      const callbackFn = mockUpdate.mock.calls[0][0];

      const result = callbackFn({
        currentValues: {
          en: {},
        },
      });

      expect(result.currentValues.en['nested.level1.level2.level3']).toBe('value');
      expect(result.currentValues.en['nested.other']).toBe('data');
    });

    it('should handle null or undefined draft gracefully', () => {
      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'settings',
        locale: 'en',
        i18n: 'none',
        value: { theme: 'light' },
      });

      const callbackFn = mockUpdate.mock.calls[0][0];

      // Should return null/undefined as-is
      expect(callbackFn(null)).toBeNull();
      expect(callbackFn(undefined)).toBeUndefined();
    });

    it('should handle missing locale in valueStoreKey gracefully', () => {
      const draftMissingLocale = {
        currentValues: {
          en: {},
          // ja locale is missing
        },
      };

      mockUpdate.mockImplementationOnce((/** @type {any} */ fn) => {
        if (typeof fn === 'function') {
          return fn(draftMissingLocale);
        }

        return draftMissingLocale;
      });

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'field',
        locale: 'en',
        i18n: 'none',
        value: { data: 'value' },
      });

      const callbackFn = mockUpdate.mock.calls[0][0];
      const result = callbackFn(draftMissingLocale);

      // Should handle gracefully when locale exists
      expect(result.currentValues.en['field.data']).toBe('value');
    });

    it('should handle empty object value', () => {
      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'empty',
        locale: 'en',
        i18n: 'none',
        value: {},
      });

      const callbackFn = mockUpdate.mock.calls[0][0];

      const draftWithExisting = {
        currentValues: {
          en: {
            'empty.old': 'value',
            'other.field': 'keep',
          },
        },
      };

      const result = callbackFn(draftWithExisting);

      // Old empty values should be removed
      expect(result.currentValues.en['empty.old']).toBeUndefined();
      // Field should be initialized with empty object
      expect(result.currentValues.en.empty).toEqual({});
      // Other fields should remain
      expect(result.currentValues.en['other.field']).toBe('keep');
    });

    it('should handle empty array value', () => {
      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'items',
        locale: 'en',
        i18n: 'none',
        value: [],
      });

      const callbackFn = mockUpdate.mock.calls[0][0];

      const draftWithArray = {
        currentValues: {
          en: {
            'items.0': 'old',
            'items.1': 'items',
          },
        },
      };

      const result = callbackFn(draftWithArray);

      // Old array items should be removed
      expect(result.currentValues.en['items.0']).toBeUndefined();
      expect(result.currentValues.en['items.1']).toBeUndefined();
      // Array should be initialized with empty array
      expect(result.currentValues.en.items).toEqual([]);
    });

    it('should toggle i18nAutoDupEnabled correctly', () => {
      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'settings',
        locale: 'en',
        i18n: 'none',
        value: { theme: 'light' },
      });

      const { calls } = vi.mocked(i18nAutoDupEnabled).set.mock;

      // Should be disabled at start
      expect(calls[0][0]).toBe(false);
      // Should be enabled at end
      expect(calls[calls.length - 1][0]).toBe(true);
    });

    it('should update currentValues by default when no valueStoreKey is specified', () => {
      const newValue = { color: 'blue' };

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'style',
        locale: 'en',
        i18n: 'none',
        value: newValue,
      });

      const callbackFn = mockUpdate.mock.calls[0][0];

      const result = callbackFn({
        currentValues: {
          en: {},
        },
      });

      expect(result.currentValues.en['style.color']).toBe('blue');
    });

    it('should support alternative valueStoreKey like "extraValues"', () => {
      const newValue = { color: 'blue' };

      updateNonPrimitiveValue({
        valueStoreKey: 'extraValues',
        keyPath: 'style',
        locale: 'en',
        i18n: 'none',
        value: newValue,
      });

      const callbackFn = mockUpdate.mock.calls[0][0];

      const result = callbackFn({
        extraValues: {
          en: {},
        },
      });

      expect(result.extraValues.en['style.color']).toBe('blue');
    });

    it('should initialize field with empty array to trigger validation for array values', () => {
      /** @type {any[]} */
      const newValue = [];

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'items',
        locale: 'en',
        i18n: 'none',
        value: newValue,
      });

      const callbackFn = mockUpdate.mock.calls[0][0];

      const result = callbackFn({
        currentValues: {
          en: {},
        },
      });

      // Field should be initialized with empty array even when value is empty
      expect(result.currentValues.en.items).toEqual([]);
    });

    it('should initialize field with empty object to trigger validation for object values', () => {
      const newValue = {};

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'config',
        locale: 'en',
        i18n: 'none',
        value: newValue,
      });

      const callbackFn = mockUpdate.mock.calls[0][0];

      const result = callbackFn({
        currentValues: {
          en: {},
        },
      });

      // Field should be initialized with empty object even when value is empty
      expect(result.currentValues.en.config).toEqual({});
    });

    it('should update only the target locale when i18n is not "duplicate"', () => {
      const newValue = { setting: 'value' };

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'config',
        locale: 'en',
        i18n: 'translate',
        value: newValue,
      });

      const callbackFn = mockUpdate.mock.calls[0][0];

      const result = callbackFn({
        currentValues: {
          en: {},
          ja: {},
          fr: {},
        },
      });

      expect(result.currentValues.en['config.setting']).toBe('value');
      expect(result.currentValues.ja['config.setting']).toBeUndefined();
      expect(result.currentValues.fr['config.setting']).toBeUndefined();
    });

    it('should handle mixed object and array structures', () => {
      const newValue = {
        data: [
          { id: 1, name: 'first' },
          { id: 2, name: 'second' },
        ],
        count: 2,
      };

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'items',
        locale: 'en',
        i18n: 'none',
        value: newValue,
      });

      const callbackFn = mockUpdate.mock.calls[0][0];

      const result = callbackFn({
        currentValues: {
          en: {},
        },
      });

      // Flattened structure should include array indices and object keys
      expect(result.currentValues.en['items.data.0.id']).toBe(1);
      expect(result.currentValues.en['items.data.0.name']).toBe('first');
      expect(result.currentValues.en['items.data.1.id']).toBe(2);
      expect(result.currentValues.en['items.data.1.name']).toBe('second');
      expect(result.currentValues.en['items.count']).toBe(2);
    });

    it('should not remove fields with similar prefix but different keyPath', () => {
      const draftWithSimilarFields = {
        currentValues: {
          en: {
            author: 'John',
            'author-note': 'Keep this',
            authors: 'Keep this too',
            'author.name': 'John Doe',
          },
        },
      };

      mockUpdate.mockImplementationOnce((/** @type {any} */ fn) => {
        if (typeof fn === 'function') {
          const result = fn(draftWithSimilarFields);

          Object.assign(draftWithSimilarFields, result);
          return result;
        }

        return draftWithSimilarFields;
      });

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'author',
        locale: 'en',
        i18n: 'none',
        value: { name: 'Jane', role: 'Editor' },
      });

      const updateCallback = mockUpdate.mock.calls[0][0];
      const result = updateCallback(draftWithSimilarFields);

      // Exact match should be removed, then field initialized with empty object
      expect(result.currentValues.en.author).toEqual({});
      // Fields with similar prefix but different keyPath should be kept
      expect(result.currentValues.en['author-note']).toBe('Keep this');
      expect(result.currentValues.en.authors).toBe('Keep this too');
      // Nested values should be removed then re-added
      expect(result.currentValues.en['author.name']).toBe('Jane');
      expect(result.currentValues.en['author.role']).toBe('Editor');
    });

    it('should apply changes only to specified locale when i18n is not duplicate', () => {
      const draftMultiLocale = {
        currentValues: {
          en: {
            field: 'old',
            'field.nested': 'old nested',
          },
          ja: {
            field: '古い',
            'field.nested': '古いネスト',
          },
          fr: {
            field: 'ancien',
            'field.nested': 'ancien imbriqué',
          },
        },
      };

      mockUpdate.mockImplementationOnce((/** @type {any} */ fn) => {
        if (typeof fn === 'function') {
          const result = fn(draftMultiLocale);

          Object.assign(draftMultiLocale, result);
          return result;
        }

        return draftMultiLocale;
      });

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'field',
        locale: 'ja',
        i18n: 'translate',
        value: { nested: '新しいネスト' },
      });

      const updateCallback = mockUpdate.mock.calls[0][0];
      const result = updateCallback(draftMultiLocale);

      // English should be unchanged
      expect(result.currentValues.en.field).toBe('old');
      expect(result.currentValues.en['field.nested']).toBe('old nested');

      // Japanese should be updated - field initialized with empty object
      expect(result.currentValues.ja.field).toEqual({});
      expect(result.currentValues.ja['field.nested']).toBe('新しいネスト');

      // French should be unchanged
      expect(result.currentValues.fr.field).toBe('ancien');
      expect(result.currentValues.fr['field.nested']).toBe('ancien imbriqué');
    });

    it('should update all locales when i18n is duplicate with multiple locales present', () => {
      const draftMultiLocaleForDuplicate = {
        currentValues: {
          en: {
            settings: 'old',
            'settings.theme': 'dark',
          },
          ja: {
            settings: '古い',
            'settings.theme': '暗い',
          },
          fr: {
            settings: 'ancien',
            'settings.theme': 'sombre',
          },
        },
      };

      mockUpdate.mockImplementationOnce((/** @type {any} */ fn) => {
        if (typeof fn === 'function') {
          const result = fn(draftMultiLocaleForDuplicate);

          Object.assign(draftMultiLocaleForDuplicate, result);
          return result;
        }

        return draftMultiLocaleForDuplicate;
      });

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'settings',
        locale: 'en',
        i18n: 'duplicate',
        value: { theme: 'light', mode: 'auto' },
      });

      const updateCallback = mockUpdate.mock.calls[0][0];
      const result = updateCallback(draftMultiLocaleForDuplicate);

      // All locales should be updated - settings initialized with empty object
      expect(result.currentValues.en.settings).toEqual({});
      expect(result.currentValues.en['settings.theme']).toBe('light');
      expect(result.currentValues.en['settings.mode']).toBe('auto');

      expect(result.currentValues.ja.settings).toEqual({});
      expect(result.currentValues.ja['settings.theme']).toBe('light');
      expect(result.currentValues.ja['settings.mode']).toBe('auto');

      expect(result.currentValues.fr.settings).toEqual({});
      expect(result.currentValues.fr['settings.theme']).toBe('light');
      expect(result.currentValues.fr['settings.mode']).toBe('auto');
    });

    it('should skip non-matching locales when i18n is not duplicate', () => {
      const draftSkipLocales = {
        currentValues: {
          en: {
            title: 'English Title',
            'title.short': 'EN',
          },
          ja: {
            title: '日本語タイトル',
            'title.short': 'JP',
          },
          fr: {
            title: 'Titre Français',
            'title.short': 'FR',
          },
        },
      };

      mockUpdate.mockImplementationOnce((/** @type {any} */ fn) => {
        if (typeof fn === 'function') {
          const result = fn(draftSkipLocales);

          Object.assign(draftSkipLocales, result);
          return result;
        }

        return draftSkipLocales;
      });

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'title',
        locale: 'ja',
        i18n: 'translate',
        value: { short: '日本語タイトル短形' },
      });

      const updateCallback = mockUpdate.mock.calls[0][0];
      const result = updateCallback(draftSkipLocales);

      // English should not be modified (early return triggered)
      expect(result.currentValues.en.title).toBe('English Title');
      expect(result.currentValues.en['title.short']).toBe('EN');

      // Japanese should be updated (matching locale) - title initialized with empty object
      expect(result.currentValues.ja.title).toEqual({});
      expect(result.currentValues.ja['title.short']).toBe('日本語タイトル短形');

      // French should not be modified (early return triggered)
      expect(result.currentValues.fr.title).toBe('Titre Français');
      expect(result.currentValues.fr['title.short']).toBe('FR');
    });

    it('should cover all branches of keyPath matching condition', () => {
      const draftComplexPaths = {
        currentValues: {
          en: {
            section: 'old section',
            'section.title': 'old title',
            'section.description': 'old desc',
            'section-note': 'different field - keep',
            sections: 'different field - keep',
          },
        },
      };

      mockUpdate.mockImplementationOnce((/** @type {any} */ fn) => {
        if (typeof fn === 'function') {
          const result = fn(draftComplexPaths);

          Object.assign(draftComplexPaths, result);
          return result;
        }

        return draftComplexPaths;
      });

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'section',
        locale: 'en',
        i18n: 'none',
        value: { title: 'new title', description: 'new desc', author: 'me' },
      });

      const updateCallback = mockUpdate.mock.calls[0][0];
      const result = updateCallback(draftComplexPaths);

      // Exact match should be removed, then field initialized with empty object
      expect(result.currentValues.en.section).toEqual({});
      // Nested matches should be removed then re-added
      expect(result.currentValues.en['section.title']).toBe('new title');
      expect(result.currentValues.en['section.description']).toBe('new desc');
      expect(result.currentValues.en['section.author']).toBe('me');
      // Non-matching fields should be preserved (tests the false branch)
      expect(result.currentValues.en['section-note']).toBe('different field - keep');
      expect(result.currentValues.en.sections).toBe('different field - keep');
    });

    it('should only delete fields matching exact keyPath or nested pattern', () => {
      const draftFieldsTest = {
        currentValues: {
          en: {
            config: 'old',
            'config.enabled': true,
            'config.timeout': 5000,
            'config-backup': 'different',
            configuration: 'different',
            template: 'keep',
          },
        },
      };

      mockUpdate.mockImplementationOnce((/** @type {any} */ fn) => {
        if (typeof fn === 'function') {
          const result = fn(draftFieldsTest);

          Object.assign(draftFieldsTest, result);
          return result;
        }

        return draftFieldsTest;
      });

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'config',
        locale: 'en',
        i18n: 'none',
        value: { enabled: false, timeout: 3000, version: '2.0' },
      });

      const updateCallback = mockUpdate.mock.calls[0][0];
      const result = updateCallback(draftFieldsTest);

      // Exact match deleted, then field initialized with empty object
      expect(result.currentValues.en.config).toEqual({});
      // Nested matches deleted then re-added
      expect(result.currentValues.en['config.enabled']).toBe(false);
      expect(result.currentValues.en['config.timeout']).toBe(3000);
      expect(result.currentValues.en['config.version']).toBe('2.0');
      // Non-matching fields (different prefix, different field) preserved
      expect(result.currentValues.en['config-backup']).toBe('different');
      expect(result.currentValues.en.configuration).toBe('different');
      expect(result.currentValues.en.template).toBe('keep');
    });

    it('should test OR condition branches separately - exact match then nested match', () => {
      const testDraft = {
        currentValues: {
          en: {
            user: 'old_exact',
            'user.name': 'old_nested',
            other: 'keep',
          },
        },
      };

      mockUpdate.mockImplementationOnce((/** @type {any} */ fn) => {
        if (typeof fn === 'function') {
          const result = fn(testDraft);

          Object.assign(testDraft, result);
          return result;
        }

        return testDraft;
      });

      updateNonPrimitiveValue({
        valueStoreKey: 'currentValues',
        keyPath: 'user',
        locale: 'en',
        i18n: 'none',
        value: { age: 30 },
      });

      const updateCallback = mockUpdate.mock.calls[0][0];
      const result = updateCallback(testDraft);

      // Exact match 'user' should be deleted, then field initialized with empty object
      expect(result.currentValues.en.user).toEqual({});
      // Nested match 'user.name' should be deleted then re-added
      expect(result.currentValues.en['user.name']).toBeUndefined();
      // Non-nested should be preserved
      expect(result.currentValues.en.other).toBe('keep');
      // New value should be added
      expect(result.currentValues.en['user.age']).toBe(30);
    });
  });
});
