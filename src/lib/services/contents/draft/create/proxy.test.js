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
  isFieldRequired: vi.fn(),
}));

describe('contents/draft/create/proxy', () => {
  let mockGet;
  let mockGetCollection;
  let mockGetCollectionFile;
  let mockGetField;
  let mockIsFieldRequired;
  let mockEntryDraft;
  let mockI18nAutoDupEnabled;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import mocked modules
    const { get: getMock } = await import('svelte/store');
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getCollectionFile } = await import('$lib/services/contents/collection/files');
    const { getField, isFieldRequired } = await import('$lib/services/contents/entry/fields');
    const { entryDraft, i18nAutoDupEnabled } = await import('$lib/services/contents/draft');

    mockGet = getMock;
    mockGetCollection = getCollection;
    mockGetCollectionFile = getCollectionFile;
    mockGetField = getField;
    mockIsFieldRequired = isFieldRequired;
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
    mockIsFieldRequired.mockReturnValue(false);

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

    it('should update validity in real time for required string fields', async () => {
      const mockValidities = {
        en: { title: { valueMissing: false } },
        ja: {},
      };

      mockGet.mockImplementation((store) => {
        if (store === mockI18nAutoDupEnabled) {
          return false;
        }

        if (store === mockEntryDraft) {
          return {
            currentValues: { en: {}, ja: {} },
            validities: mockValidities,
          };
        }

        return undefined;
      });

      mockGetField.mockReturnValue({
        widget: 'string',
        required: true,
      });

      mockIsFieldRequired.mockReturnValue(true);

      const { createProxy } = await import('./proxy.js');

      const proxy = createProxy({
        draft: { collectionName: 'posts', fileName: undefined, isIndexFile: false },
        locale: 'en',
      });

      proxy.title = '';

      expect(mockValidities.en.title.valueMissing).toBe(true);

      proxy.title = 'Valid Title';

      expect(mockValidities.en.title.valueMissing).toBe(false);
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
  });
});
