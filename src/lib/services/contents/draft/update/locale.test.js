// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entryDraft } from '$lib/services/contents/draft';
import { createProxy } from '$lib/services/contents/draft/create/proxy';
import { getDefaultValues } from '$lib/services/contents/draft/defaults';
import { getField } from '$lib/services/contents/entry/fields';

import { copyDefaultLocaleValues, toggleLocale } from './locale';

vi.mock('$lib/services/contents/draft');
vi.mock('$lib/services/contents/draft/create/proxy');
vi.mock('$lib/services/contents/draft/defaults');
vi.mock('$lib/services/contents/entry/fields');
vi.mock('$lib/services/user/prefs', () => ({
  prefs: { subscribe: vi.fn(() => vi.fn()) },
}));
vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return {
    ...actual,
    get: vi.fn(() => ({ devModeEnabled: false })),
  };
});

describe('draft/update/locale', () => {
  let mockEntryDraft;
  let mockUpdate;
  let mockGet;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { get } = await import('svelte/store');

    mockGet = vi.mocked(get);

    mockEntryDraft = {
      collectionName: 'posts',
      fileName: undefined,
      isIndexFile: false,
      fields: [
        { name: 'title', widget: 'string', i18n: 'translate' },
        { name: 'body', widget: 'markdown', i18n: true },
        { name: 'date', widget: 'datetime', i18n: false },
      ],
      collection: {
        _i18n: { defaultLocale: 'en' },
      },
      collectionFile: undefined,
      currentLocales: { en: true },
      currentValues: {
        en: {
          title: 'English Title',
          body: 'English Body',
          date: '2024-01-01',
        },
      },
      originalValues: {
        en: {
          title: 'English Title',
          body: 'English Body',
          date: '2024-01-01',
        },
      },
      validities: { en: {} },
    };

    mockUpdate = vi.fn((fn) => {
      if (typeof fn === 'function') {
        return fn(mockEntryDraft);
      }

      return mockEntryDraft;
    });

    mockGet.mockImplementation((store) => {
      if (store === entryDraft) {
        return mockEntryDraft;
      }

      return undefined;
    });

    vi.mocked(entryDraft).update = mockUpdate;

    vi.mocked(createProxy).mockImplementation(({ target }) => target);

    vi.mocked(getDefaultValues).mockReturnValue({
      title: '',
      body: '',
      date: '',
    });

    vi.mocked(getField).mockImplementation(({ keyPath }) => {
      if (keyPath === 'title') {
        return { name: 'title', widget: 'string', i18n: 'translate' };
      }

      if (keyPath === 'body') {
        return { name: 'body', widget: 'markdown', i18n: true };
      }

      if (keyPath === 'date') {
        return { name: 'date', widget: 'datetime', i18n: false };
      }

      return undefined;
    });
  });

  describe('copyDefaultLocaleValues', () => {
    it('should copy values from default locale', () => {
      const content = {};
      const result = copyDefaultLocaleValues(content);

      // Translatable fields should be empty when not provided in content
      expect(result.title).toBe('');
      expect(result.body).toBe('');
      // Non-translatable fields (i18n: false) should not be copied to other locales
      expect(result.date).toBeUndefined();
    });

    it('should reset translatable text fields to empty when not provided', () => {
      const content = {};
      const result = copyDefaultLocaleValues(content);

      expect(result.title).toBe('');
    });

    it('should not copy non-translatable fields to other locales', () => {
      const content = {};
      const result = copyDefaultLocaleValues(content);

      // Fields with i18n: false should NOT be copied to new locales
      expect(result.date).toBeUndefined();
    });

    it('should remove i18n disabled fields', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'none' };
        }

        return undefined;
      });

      const content = { title: 'Title' };
      const result = copyDefaultLocaleValues(content);

      expect(result.title).toBeUndefined();
    });

    it('should preserve existing values for translatable fields', () => {
      const content = { title: 'Existing Translation', body: '' };
      const result = copyDefaultLocaleValues(content);

      // Existing values in content should be preserved
      expect(result.title).toBe('Existing Translation');
      expect(result.body).toBe('');
    });
  });

  describe('toggleLocale', () => {
    it('should enable a locale', () => {
      toggleLocale('ja');

      expect(mockUpdate).toHaveBeenCalled();

      const updateFn = mockUpdate.mock.calls[0][0];
      const result = updateFn(mockEntryDraft);

      expect(result.currentLocales.ja).toBe(true);
      expect(result.currentValues.ja).toBeDefined();
    });

    it('should disable a locale', () => {
      mockEntryDraft.currentLocales = { en: true, ja: true };
      mockEntryDraft.currentValues.ja = { title: 'Japanese Title' };
      mockEntryDraft.validities.ja = {};

      toggleLocale('ja');

      expect(mockUpdate).toHaveBeenCalled();

      const updateFn = mockUpdate.mock.calls[0][0];
      const result = updateFn(mockEntryDraft);

      expect(result.currentLocales.ja).toBe(false);
    });

    it('should initialize new locale with default values', () => {
      toggleLocale('ja');

      expect(mockUpdate).toHaveBeenCalled();
      expect(vi.mocked(getDefaultValues)).toHaveBeenCalled();
      expect(vi.mocked(createProxy)).toHaveBeenCalled();
    });

    it('should not reinitialize locale values when already exists', () => {
      mockEntryDraft.currentLocales = { en: true, ja: false };
      mockEntryDraft.currentValues.ja = { title: 'Existing' };
      mockEntryDraft.originalValues.ja = { title: 'Existing' };

      toggleLocale('ja');

      expect(mockUpdate).toHaveBeenCalled();

      const updateFn = mockUpdate.mock.calls[0][0];
      const result = updateFn(mockEntryDraft);

      expect(result.currentLocales.ja).toBe(true);
      expect(result.currentValues.ja.title).toBe('Existing');
    });

    it('should clear validities when disabling locale', () => {
      mockEntryDraft.currentLocales = { en: true, ja: true };
      mockEntryDraft.currentValues.ja = { title: 'Japanese' };
      mockEntryDraft.validities.ja = { title: { valid: false } };

      toggleLocale('ja');

      expect(mockUpdate).toHaveBeenCalled();

      const updateFn = mockUpdate.mock.calls[0][0];
      const result = updateFn(mockEntryDraft);

      expect(result.validities.ja).toEqual({});
    });
  });
});
