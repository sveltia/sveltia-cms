// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
}));

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFile: vi.fn(),
}));

vi.mock('$lib/services/contents/draft', () => ({
  entryDraft: {
    subscribe: vi.fn(),
  },
  i18nAutoDupEnabled: {
    subscribe: vi.fn(),
  },
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(),
}));

vi.mock('$lib/services/contents/draft/validate/fields', () => ({
  revalidateField: vi.fn(),
}));

describe('contents/draft/create/proxy', () => {
  let mockGet;
  let mockGetCollection;
  let mockGetCollectionFile;
  let mockGetField;
  let mockRevalidateField;
  let mockEntryDraft;
  let mockI18nAutoDupEnabled;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import mocked modules
    const { get: getMock } = await import('svelte/store');
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getCollectionFile } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { entryDraft, i18nAutoDupEnabled } = await import('$lib/services/contents/draft');
    const { revalidateField } = await import('$lib/services/contents/draft/validate/fields');

    mockGet = getMock;
    mockGetCollection = getCollection;
    mockGetCollectionFile = getCollectionFile;
    mockGetField = getField;
    mockRevalidateField = revalidateField;
    mockEntryDraft = entryDraft;
    mockI18nAutoDupEnabled = i18nAutoDupEnabled;

    // Setup default mocks
    mockGetCollection.mockReturnValue({
      name: 'posts',
      _i18n: {
        defaultLocale: 'en',
        canonicalSlug: { key: 'translationKey' },
      },
    });

    mockGetCollectionFile.mockReturnValue(undefined);
    mockGetField.mockReturnValue(undefined);

    mockGet.mockImplementation((store) => {
      if (store === mockI18nAutoDupEnabled) {
        return true;
      }

      if (store === mockEntryDraft) {
        return {
          currentValues: {
            en: {},
            ja: {},
          },
          validities: {
            en: {},
            ja: {},
          },
        };
      }

      return undefined;
    });
  });

  describe('copyDefaultLocaleValue', () => {
    it('should copy value to other locales', async () => {
      const mockCurrentValues = {
        en: {},
        fr: {},
        de: {},
      };

      mockGet.mockImplementation((store) => {
        if (store === mockEntryDraft) {
          return { currentValues: mockCurrentValues };
        }

        return undefined;
      });

      const { copyDefaultLocaleValue } = await import('./proxy.js');

      copyDefaultLocaleValue({
        getFieldArgs: { keyPath: 'title' },
        fieldConfig: { widget: 'string' },
        sourceLanguage: 'en',
        value: 'Hello World',
      });

      expect(mockCurrentValues.en.title).toBeUndefined();
      expect(mockCurrentValues.fr.title).toBe('Hello World');
      expect(mockCurrentValues.de.title).toBe('Hello World');
    });

    it('should not copy value to source locale', async () => {
      const mockCurrentValues = {
        en: { title: 'Original' },
        fr: {},
      };

      mockGet.mockImplementation((store) => {
        if (store === mockEntryDraft) {
          return { currentValues: mockCurrentValues };
        }

        return undefined;
      });

      const { copyDefaultLocaleValue } = await import('./proxy.js');

      copyDefaultLocaleValue({
        getFieldArgs: { keyPath: 'title' },
        fieldConfig: { widget: 'string' },
        sourceLanguage: 'en',
        value: 'New Value',
      });

      expect(mockCurrentValues.en.title).toBe('Original');
      expect(mockCurrentValues.fr.title).toBe('New Value');
    });

    it('should not copy if parent object does not exist in nested keyPath', async () => {
      const mockCurrentValues = {
        en: { 'parent.child': 'value' },
        fr: {},
      };

      mockGet.mockImplementation((store) => {
        if (store === mockEntryDraft) {
          return { currentValues: mockCurrentValues };
        }

        return undefined;
      });

      mockGetField.mockReturnValue(undefined);

      const { copyDefaultLocaleValue } = await import('./proxy.js');

      copyDefaultLocaleValue({
        getFieldArgs: { keyPath: 'parent.child' },
        fieldConfig: { widget: 'string' },
        sourceLanguage: 'en',
        value: 'nested value',
      });

      expect(mockCurrentValues.fr['parent.child']).toBeUndefined();
    });

    it('should copy if parent object exists in nested keyPath', async () => {
      const mockCurrentValues = {
        en: { 'parent.name': 'Parent', 'parent.child': 'value' },
        fr: { 'parent.name': 'Parent FR' },
      };

      mockGet.mockImplementation((store) => {
        if (store === mockEntryDraft) {
          return { currentValues: mockCurrentValues };
        }

        return undefined;
      });

      mockGetField.mockReturnValue(undefined);

      const { copyDefaultLocaleValue } = await import('./proxy.js');

      copyDefaultLocaleValue({
        getFieldArgs: { keyPath: 'parent.child' },
        fieldConfig: { widget: 'string' },
        sourceLanguage: 'en',
        value: 'nested value',
      });

      expect(mockCurrentValues.fr['parent.child']).toBe('nested value');
    });

    it('should handle relation field with {{locale}} template in value_field', async () => {
      const mockCurrentValues = {
        en: {},
        fr: {},
      };

      mockGet.mockImplementation((store) => {
        if (store === mockEntryDraft) {
          return { currentValues: mockCurrentValues };
        }

        return undefined;
      });

      const { copyDefaultLocaleValue } = await import('./proxy.js');

      copyDefaultLocaleValue({
        getFieldArgs: { keyPath: 'related' },
        fieldConfig: {
          widget: 'relation',
          value_field: '{{locale}}/{{slug}}',
        },
        sourceLanguage: 'en',
        value: 'en/my-post',
      });

      expect(mockCurrentValues.fr.related).toBe('fr/my-post');
    });

    it('should handle relation field with {{locale}} template for multiple locales', async () => {
      const mockCurrentValues = {
        en: {},
        fr: {},
        es: {},
      };

      mockGet.mockImplementation((store) => {
        if (store === mockEntryDraft) {
          return { currentValues: mockCurrentValues };
        }

        return undefined;
      });

      const { copyDefaultLocaleValue } = await import('./proxy.js');

      copyDefaultLocaleValue({
        getFieldArgs: { keyPath: 'related' },
        fieldConfig: {
          widget: 'relation',
          value_field: '{{locale}}/{{slug}}',
        },
        sourceLanguage: 'en',
        value: 'en/my-post',
      });

      // Every locale gets its own prefix; the source value must not be mutated in the loop
      expect(mockCurrentValues.fr.related).toBe('fr/my-post');
      expect(mockCurrentValues.es.related).toBe('es/my-post');
    });

    it('should handle relation field with {{locale}} template and non-string value', async () => {
      const mockCurrentValues = {
        en: {},
        fr: {},
      };

      mockGet.mockImplementation((store) => {
        if (store === mockEntryDraft) {
          return { currentValues: mockCurrentValues };
        }

        return undefined;
      });

      const { copyDefaultLocaleValue } = await import('./proxy.js');

      copyDefaultLocaleValue({
        getFieldArgs: { keyPath: 'related' },
        fieldConfig: {
          widget: 'relation',
          value_field: '{{locale}}/{{slug}}',
        },
        sourceLanguage: 'en',
        value: undefined,
      });

      expect(mockCurrentValues.fr.related).toBeUndefined();
    });

    it('should handle relation field without {{locale}} template', async () => {
      const mockCurrentValues = {
        en: {},
        fr: {},
      };

      mockGet.mockImplementation((store) => {
        if (store === mockEntryDraft) {
          return { currentValues: mockCurrentValues };
        }

        return undefined;
      });

      const { copyDefaultLocaleValue } = await import('./proxy.js');

      copyDefaultLocaleValue({
        getFieldArgs: { keyPath: 'related' },
        fieldConfig: {
          widget: 'relation',
          value_field: '{{slug}}',
        },
        sourceLanguage: 'en',
        value: 'my-post',
      });

      expect(mockCurrentValues.fr.related).toBe('my-post');
    });

    it('should handle relation field with default value_field', async () => {
      const mockCurrentValues = {
        en: {},
        fr: {},
      };

      mockGet.mockImplementation((store) => {
        if (store === mockEntryDraft) {
          return { currentValues: mockCurrentValues };
        }

        return undefined;
      });

      const { copyDefaultLocaleValue } = await import('./proxy.js');

      copyDefaultLocaleValue({
        getFieldArgs: { keyPath: 'related' },
        fieldConfig: {
          widget: 'relation',
          // No value_field specified, defaults to {{slug}}
        },
        sourceLanguage: 'en',
        value: 'my-post',
      });

      expect(mockCurrentValues.fr.related).toBe('my-post');
    });

    it('should not overwrite existing value if same', async () => {
      const mockCurrentValues = {
        en: {},
        fr: { title: 'Same Value' },
      };

      mockGet.mockImplementation((store) => {
        if (store === mockEntryDraft) {
          return { currentValues: mockCurrentValues };
        }

        return undefined;
      });

      const { copyDefaultLocaleValue } = await import('./proxy.js');

      copyDefaultLocaleValue({
        getFieldArgs: { keyPath: 'title' },
        fieldConfig: { widget: 'string' },
        sourceLanguage: 'en',
        value: 'Same Value',
      });

      expect(mockCurrentValues.fr.title).toBe('Same Value');
    });

    it('should overwrite different value', async () => {
      const mockCurrentValues = {
        en: {},
        fr: { title: 'Old Value' },
      };

      mockGet.mockImplementation((store) => {
        if (store === mockEntryDraft) {
          return { currentValues: mockCurrentValues };
        }

        return undefined;
      });

      const { copyDefaultLocaleValue } = await import('./proxy.js');

      copyDefaultLocaleValue({
        getFieldArgs: { keyPath: 'title' },
        fieldConfig: { widget: 'string' },
        sourceLanguage: 'en',
        value: 'New Value',
      });

      expect(mockCurrentValues.fr.title).toBe('New Value');
    });

    it('should copy if parent field exists via getField', async () => {
      const mockCurrentValues = {
        en: { 'parent.child': 'value' },
        fr: {},
      };

      mockGet.mockImplementation((store) => {
        if (store === mockEntryDraft) {
          return { currentValues: mockCurrentValues };
        }

        return undefined;
      });

      mockGetField.mockImplementation(({ keyPath }) => {
        if (keyPath === 'parent') {
          return { widget: 'object' };
        }

        return undefined;
      });

      const { copyDefaultLocaleValue } = await import('./proxy.js');

      copyDefaultLocaleValue({
        getFieldArgs: { keyPath: 'parent.child', collectionName: 'posts' },
        fieldConfig: { widget: 'string' },
        sourceLanguage: 'en',
        value: 'nested value',
      });

      expect(mockCurrentValues.fr['parent.child']).toBe('nested value');
    });

    it('should replace the source locale prefix using startsWith/slice', async () => {
      const mockCurrentValues = { pt: {}, de: {} };

      mockGet.mockImplementation((store) => {
        if (store === mockEntryDraft) {
          return { currentValues: mockCurrentValues };
        }

        return undefined;
      });

      const { copyDefaultLocaleValue } = await import('./proxy.js');

      copyDefaultLocaleValue({
        getFieldArgs: { keyPath: 'slug' },
        fieldConfig: { widget: 'relation', value_field: '{{locale}}/{{slug}}' },
        sourceLanguage: 'pt',
        value: 'pt/article-one',
      });

      expect(mockCurrentValues.de.slug).toBe('de/article-one');
    });

    it('should not modify the value when it does not start with the source locale prefix', async () => {
      const mockCurrentValues = { en: {}, fr: {} };

      mockGet.mockImplementation((store) => {
        if (store === mockEntryDraft) {
          return { currentValues: mockCurrentValues };
        }

        return undefined;
      });

      const { copyDefaultLocaleValue } = await import('./proxy.js');

      // value starts with a different locale — no substitution expected
      copyDefaultLocaleValue({
        getFieldArgs: { keyPath: 'slug' },
        fieldConfig: { widget: 'relation', value_field: '{{locale}}/{{slug}}' },
        sourceLanguage: 'en',
        value: 'de/foreign-slug',
      });

      expect(mockCurrentValues.fr.slug).toBe('de/foreign-slug');
    });
  });

  describe('createProxy', () => {
    it('should return undefined if collection not found', async () => {
      mockGetCollection.mockReturnValue(undefined);

      const { createProxy } = await import('./proxy.js');

      const result = createProxy({
        draft: { collectionName: 'nonexistent', fileName: undefined, isIndexFile: false },
        locale: 'en',
      });

      expect(result).toBeUndefined();
    });

    it('should return undefined if collection file not found when fileName is provided', async () => {
      mockGetCollectionFile.mockReturnValue(undefined);

      const { createProxy } = await import('./proxy.js');

      const result = createProxy({
        draft: { collectionName: 'posts', fileName: 'about', isIndexFile: false },
        locale: 'en',
      });

      expect(result).toBeUndefined();
    });

    it('should create a proxy for the target object', async () => {
      const { createProxy } = await import('./proxy.js');
      const target = { title: 'Test' };

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'en',
        target,
      });

      expect(proxy).toBeDefined();
      expect(proxy.title).toBe('Test');
    });

    it('should update values through proxy', async () => {
      const { createProxy } = await import('./proxy.js');
      const target = {};

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'en',
        target,
      });

      proxy.title = 'New Title';

      expect(target.title).toBe('New Title');
      expect(proxy.title).toBe('New Title');
    });

    it('should duplicate values to other locales when i18n is duplicate', async () => {
      const mockCurrentValues = {
        en: {},
        ja: {},
      };

      mockGet.mockImplementation((store) => {
        if (store === mockI18nAutoDupEnabled) {
          return true;
        }

        if (store === mockEntryDraft) {
          return {
            currentValues: mockCurrentValues,
            validities: { en: {}, ja: {} },
          };
        }

        return undefined;
      });

      mockGetField.mockReturnValue({
        widget: 'string',
        i18n: 'duplicate',
      });

      const { createProxy } = await import('./proxy.js');

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'en',
        target: mockCurrentValues.en,
      });

      proxy.title = 'Title';

      expect(mockCurrentValues.en.title).toBe('Title');
      expect(mockCurrentValues.ja.title).toBe('Title');
    });

    it('should not duplicate values when auto-duplication is disabled', async () => {
      const mockCurrentValues = {
        en: {},
        ja: {},
      };

      mockGet.mockImplementation((store) => {
        if (store === mockI18nAutoDupEnabled) {
          return false;
        }

        if (store === mockEntryDraft) {
          return {
            currentValues: mockCurrentValues,
            validities: { en: {}, ja: {} },
          };
        }

        return undefined;
      });

      mockGetField.mockReturnValue({
        widget: 'string',
        i18n: 'duplicate',
      });

      const { createProxy } = await import('./proxy.js');

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'en',
        target: mockCurrentValues.en,
      });

      proxy.title = 'Title';

      expect(mockCurrentValues.en.title).toBe('Title');
      expect(mockCurrentValues.ja.title).toBeUndefined();
    });

    it('should not duplicate values when locale is not default locale', async () => {
      const mockCurrentValues = {
        en: {},
        ja: {},
      };

      mockGet.mockImplementation((store) => {
        if (store === mockI18nAutoDupEnabled) {
          return true;
        }

        if (store === mockEntryDraft) {
          return {
            currentValues: mockCurrentValues,
            validities: { en: {}, ja: {} },
          };
        }

        return undefined;
      });

      mockGetField.mockReturnValue({
        widget: 'string',
        i18n: 'duplicate',
      });

      const { createProxy } = await import('./proxy.js');

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'ja',
        target: mockCurrentValues.ja,
      });

      proxy.title = 'タイトル';

      expect(mockCurrentValues.ja.title).toBe('タイトル');
      expect(mockCurrentValues.en.title).toBeUndefined();
    });

    it('should handle relation field with locale template', async () => {
      const mockCurrentValues = {
        en: {},
        fr: {},
      };

      mockGet.mockImplementation((store) => {
        if (store === mockI18nAutoDupEnabled) {
          return true;
        }

        if (store === mockEntryDraft) {
          return {
            currentValues: mockCurrentValues,
            validities: { en: {}, fr: {} },
          };
        }

        return undefined;
      });

      mockGetField.mockReturnValue({
        widget: 'relation',
        value_field: '{{locale}}/{{slug}}',
        i18n: 'duplicate',
      });

      const { createProxy } = await import('./proxy.js');

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'en',
        target: mockCurrentValues.en,
      });

      proxy.related = 'en/my-post';

      expect(mockCurrentValues.en.related).toBe('en/my-post');
      expect(mockCurrentValues.fr.related).toBe('fr/my-post');
    });

    it('should skip copying canonical slug field', async () => {
      const mockCurrentValues = {
        en: {},
        ja: {},
      };

      mockGet.mockImplementation((store) => {
        if (store === mockI18nAutoDupEnabled) {
          return true;
        }

        if (store === mockEntryDraft) {
          return {
            currentValues: mockCurrentValues,
            validities: { en: {}, ja: {} },
          };
        }

        return undefined;
      });

      const { createProxy } = await import('./proxy.js');

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'en',
        target: mockCurrentValues.en,
      });

      proxy.translationKey = 'abc123';

      expect(mockCurrentValues.en.translationKey).toBe('abc123');
      // Should not copy the canonical slug to other locales
      expect(mockCurrentValues.ja.translationKey).toBeUndefined();
    });

    it('should delete properties from other locales when auto-duplication is enabled', async () => {
      const mockCurrentValues = {
        en: { title: 'Title' },
        ja: { title: 'タイトル' },
      };

      mockGet.mockImplementation((store) => {
        if (store === mockI18nAutoDupEnabled) {
          return true;
        }

        if (store === mockEntryDraft) {
          return {
            currentValues: mockCurrentValues,
            validities: { en: {}, ja: {} },
          };
        }

        return undefined;
      });

      mockGetField.mockReturnValue({
        widget: 'string',
        i18n: 'duplicate',
      });

      const { createProxy } = await import('./proxy.js');

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'en',
        target: mockCurrentValues.en,
      });

      delete proxy.title;

      expect(mockCurrentValues.en.title).toBeUndefined();
      expect(mockCurrentValues.ja.title).toBeUndefined();
    });

    it('should revalidate the updated field in real time', async () => {
      const mockDraft = {
        currentValues: { en: {}, ja: {} },
        validities: { en: { title: { valueMissing: false } }, ja: {} },
      };

      mockGet.mockImplementation((store) => {
        if (store === mockI18nAutoDupEnabled) {
          return false;
        }

        if (store === mockEntryDraft) {
          return mockDraft;
        }

        return undefined;
      });

      mockGetField.mockReturnValue({ widget: 'string', required: true });

      const { createProxy } = await import('./proxy.js');

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'en',
      });

      proxy.title = 'Valid Title';

      expect(mockRevalidateField).toHaveBeenCalledWith({
        draft: mockDraft,
        locale: 'en',
        keyPath: 'title',
        value: 'Valid Title',
        valueMap: { title: 'Valid Title' },
      });
    });

    it('should not revalidate when the field is unknown', async () => {
      mockGetField.mockReturnValue(undefined);

      const { createProxy } = await import('./proxy.js');

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'en',
      });

      proxy.unknown = 'Value';

      expect(mockRevalidateField).not.toHaveBeenCalled();
    });

    it('should not revalidate when there is no draft', async () => {
      mockGet.mockImplementation(() => undefined);
      mockGetField.mockReturnValue({ widget: 'string' });

      const { createProxy } = await import('./proxy.js');

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'en',
      });

      proxy.title = 'Title';

      expect(mockRevalidateField).not.toHaveBeenCalled();
    });

    it('should use getValueMap function when provided', async () => {
      const customValueMap = { existingField: 'value' };
      const getValueMap = vi.fn(() => customValueMap);

      mockGetField.mockImplementation(({ valueMap }) => {
        if (valueMap === customValueMap) {
          return { widget: 'string', i18n: false };
        }

        return undefined;
      });

      const { createProxy } = await import('./proxy.js');

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'en',
        target: {},
        getValueMap,
      });

      proxy.title = 'Title';

      expect(getValueMap).toHaveBeenCalled();
    });

    it('should use collection file i18n when available', async () => {
      mockGetCollection.mockReturnValue({
        name: 'pages',
        _i18n: {
          defaultLocale: 'en',
          canonicalSlug: { key: 'id' },
        },
      });

      mockGetCollectionFile.mockReturnValue({
        name: 'about',
        _i18n: {
          defaultLocale: 'fr',
          canonicalSlug: { key: 'customKey' },
        },
      });

      const { createProxy } = await import('./proxy.js');
      const target = {};

      const proxy = createProxy({
        draft: { collectionName: 'pages', fileName: 'about', isIndexFile: false },
        locale: 'fr',
        target,
      });

      proxy.customKey = 'should-not-duplicate';

      expect(target.customKey).toBe('should-not-duplicate');
    });

    it('should delete property without syncing to other locales when auto-duplication is disabled (line 154)', async () => {
      const mockCurrentValues = {
        en: { title: 'Title' },
        ja: { title: 'タイトル' },
      };

      mockGet.mockImplementation((store) => {
        if (store === mockI18nAutoDupEnabled) {
          return false;
        }

        if (store === mockEntryDraft) {
          return {
            currentValues: mockCurrentValues,
            validities: { en: {}, ja: {} },
          };
        }

        return undefined;
      });

      // Return undefined so that getFieldInfo returns fieldConfig: undefined,
      // triggering the early return on line 154
      mockGetField.mockReturnValue(undefined);

      const { createProxy } = await import('./proxy.js');

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'en',
        target: mockCurrentValues.en,
      });

      delete proxy.title;

      // Only the source locale property is deleted; fieldConfig was undefined so no sync
      expect(mockCurrentValues.en.title).toBeUndefined();
      expect(mockCurrentValues.ja.title).toBe('タイトル');
    });

    it('should not update obj when new value equals existing value (line 115 false branch)', async () => {
      const target = { title: 'Same Value' };
      const { createProxy } = await import('./proxy.js');

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'en',
        target,
      });

      // Setting the same value that already exists on the target
      proxy.title = 'Same Value';

      // Value is still 'Same Value' (not changed, and no error)
      expect(target.title).toBe('Same Value');
    });

    it('should revalidate the updated field with a non-string value', async () => {
      const mockDraft = {
        currentValues: { en: {}, ja: {} },
        validities: { en: { count: { valueMissing: false } }, ja: {} },
      };

      mockGet.mockImplementation((store) => {
        if (store === mockI18nAutoDupEnabled) {
          return false;
        }

        if (store === mockEntryDraft) {
          return mockDraft;
        }

        return undefined;
      });

      mockGetField.mockReturnValue({ widget: 'number', required: true });

      const { createProxy } = await import('./proxy.js');

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'en',
      });

      proxy.count = 42;

      expect(mockRevalidateField).toHaveBeenCalledWith(
        expect.objectContaining({ keyPath: 'count', value: 42 }),
      );
    });

    it('should not delete from other locales when shouldAutoDuplicate is false (line 158 false branch)', async () => {
      const mockCurrentValues = {
        en: { title: 'Title' },
        ja: { title: 'タイトル' },
      };

      mockGet.mockImplementation((store) => {
        if (store === mockI18nAutoDupEnabled) {
          return true;
        }

        if (store === mockEntryDraft) {
          return {
            currentValues: mockCurrentValues,
            validities: { en: {}, ja: {} },
          };
        }

        return undefined;
      });

      // fieldConfig exists but i18n is 'translate', not 'duplicate' → shouldAutoDuplicate = false
      mockGetField.mockReturnValue({ widget: 'string', i18n: 'translate' });

      const { createProxy } = await import('./proxy.js');

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'en',
        target: mockCurrentValues.en,
      });

      delete proxy.title;

      // en.title is deleted (local delete), but ja.title stays because shouldAutoDuplicate=false
      expect(mockCurrentValues.en.title).toBeUndefined();
      expect(mockCurrentValues.ja.title).toBe('タイトル');
    });
  });
});
