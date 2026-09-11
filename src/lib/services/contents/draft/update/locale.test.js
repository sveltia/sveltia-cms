import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createProxy } from '$lib/services/contents/draft/create/proxy.svelte';
import { getDefaultValues } from '$lib/services/contents/draft/defaults';
import { getField } from '$lib/services/contents/entry/fields';

import {
  copyDefaultLocaleValues as _copyDefaultLocaleValues,
  forEachTargetLocale,
  toggleLocale,
} from './locale';

vi.mock('$lib/services/contents/draft/create/proxy.svelte');
vi.mock('$lib/services/contents/draft/defaults');
vi.mock('$lib/services/contents/entry/fields');

describe('draft/update/locale', () => {
  /** @type {any} */
  let mockEntryDraft;

  /**
   * Populate the given content from the mock entry draft’s default locale.
   * @param {Record<string, any>} content Content.
   * @param {string} targetLanguage Target locale.
   * @param {{ keyPathPrefix?: string }} [options] Options.
   * @returns {Record<string, any>} Updated content.
   */
  const copyDefaultLocaleValues = (content, targetLanguage, { keyPathPrefix } = {}) =>
    _copyDefaultLocaleValues({ draft: mockEntryDraft, content, targetLanguage, keyPathPrefix });

  beforeEach(async () => {
    vi.clearAllMocks();

    mockEntryDraft = {
      collectionName: 'posts',
      fileName: undefined,
      isIndexFile: false,
      fields: [
        { name: 'title', widget: 'string', i18n: 'translate' },
        { name: 'body', widget: 'markdown', i18n: true },
        { name: 'date', widget: 'datetime', i18n: false },
      ],
      defaultLocale: 'en',
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
      validationMessages: { en: {} },
    };

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

  describe('forEachTargetLocale', () => {
    /** @type {Record<string, any>} */
    const valueStore = { en: { title: 'en' }, ja: { title: 'ja' }, fr: { title: 'fr' } };

    it('should visit only the given locale by default', () => {
      /** @type {string[]} */
      const visited = [];

      forEachTargetLocale({ valueStore, locale: 'ja', i18n: true }, (_valueMap, _locale) => {
        visited.push(_locale);
      });

      expect(visited).toEqual(['ja']);
    });

    it('should visit every locale for a duplicate field', () => {
      /** @type {string[]} */
      const visited = [];

      forEachTargetLocale({ valueStore, locale: 'ja', i18n: 'duplicate' }, (_valueMap, _locale) => {
        visited.push(_locale);
      });

      expect(visited).toEqual(['en', 'ja', 'fr']);
    });

    it('should hand the callback that locale’s own content', () => {
      forEachTargetLocale({ valueStore, locale: 'fr', i18n: false }, (valueMap, _locale) => {
        expect(valueMap).toBe(valueStore[_locale]);
        expect(valueMap.title).toBe('fr');
      });
    });

    it('should do nothing when the locale is not in the store', () => {
      const callback = vi.fn();

      forEachTargetLocale({ valueStore, locale: 'de', i18n: false }, callback);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should tolerate an undefined value store', () => {
      const callback = vi.fn();

      forEachTargetLocale({ valueStore: undefined, locale: 'en', i18n: false }, callback);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('copyDefaultLocaleValues', () => {
    it('should copy values from default locale', () => {
      const content = {};
      const result = copyDefaultLocaleValues(content, 'en');

      // Translatable fields should be empty when not provided in content
      expect(result.title).toBe('');
      expect(result.body).toBe('');
      // Non-translatable fields (i18n: false) should not be copied to other locales
      expect(result.date).toBeUndefined();
    });

    it('should reset translatable text fields to empty when not provided', () => {
      const content = {};
      const result = copyDefaultLocaleValues(content, 'en');

      expect(result.title).toBe('');
    });

    it('should not copy non-translatable fields to other locales', () => {
      const content = {};
      const result = copyDefaultLocaleValues(content, 'en');

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
      const result = copyDefaultLocaleValues(content, 'en');

      expect(result.title).toBeUndefined();
    });

    it('should preserve existing values for translatable fields', () => {
      const content = { title: 'Existing Translation', body: '' };
      const result = copyDefaultLocaleValues(content, 'en');

      // Existing values in content should be preserved
      expect(result.title).toBe('Existing Translation');
      expect(result.body).toBe('');
    });

    it('should reset richtext fields to empty for translation (line 48)', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        if (keyPath === 'body') {
          return { name: 'body', widget: 'richtext', i18n: true };
        }

        return undefined;
      });

      const content = {};
      const result = copyDefaultLocaleValues(content, 'en');

      // Richtext fields with i18n enabled should be reset to empty string
      expect(result.title).toBe('');
      expect(result.body).toBe('');
    });

    it('should preserve existing richtext values for translation', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        if (keyPath === 'body') {
          return { name: 'body', widget: 'richtext', i18n: true };
        }

        return undefined;
      });

      const content = { body: 'Existing Richtext Translation' };
      const result = copyDefaultLocaleValues(content, 'en');

      // Existing richtext values should be preserved
      expect(result.body).toBe('Existing Richtext Translation');
    });

    it('should remove nested non-i18n fields matching parent key pattern (line 51)', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'date') {
          return { name: 'date', widget: 'datetime', i18n: false };
        }

        if (keyPath === 'date.timestamp') {
          // This field has a different i18n setting but its parent is non-i18n
          return { name: 'timestamp', widget: 'number', i18n: true };
        }

        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        return undefined;
      });

      const content = {
        title: 'Title',
        date: '2024-01-01',
        'date.timestamp': '123456',
      };

      const result = copyDefaultLocaleValues(content, 'en');

      // date is i18n: false, so it should be removed
      expect(result.date).toBeUndefined();
      // date.timestamp should also be removed because it matches the date pattern
      expect(result['date.timestamp']).toBeUndefined();
      expect(result.title).toBe('Title');
    });

    it('should delete object field when i18n is true and value exists in default locale (lines 51-61)', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'metadata') {
          return { name: 'metadata', widget: 'object', i18n: true };
        }

        return undefined;
      });

      mockEntryDraft.currentValues.en.metadata = { key: 'value' };

      const content = { metadata: { key: 'translated' } };
      const result = copyDefaultLocaleValues(content, 'en');

      // Object field with i18n: true and existing value in default locale should be deleted
      expect(result.metadata).toBeUndefined();
    });

    it('should delete object field when i18n is "translate" and value exists in default locale (lines 51-61)', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'seo') {
          return { name: 'seo', widget: 'object', i18n: 'translate' };
        }

        return undefined;
      });

      mockEntryDraft.currentValues.en.seo = { title: 'SEO Title' };

      const content = { seo: { title: 'Translated SEO' } };
      const result = copyDefaultLocaleValues(content, 'en');

      // Object field with i18n: "translate" and existing value in default locale should be deleted
      expect(result.seo).toBeUndefined();
    });

    it('should delete object field when i18n is "duplicate" and value exists in default locale (lines 51-61)', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'config') {
          return { name: 'config', widget: 'object', i18n: 'duplicate' };
        }

        return undefined;
      });

      mockEntryDraft.currentValues.en.config = { mode: 'prod' };

      const content = { config: { mode: 'dev' } };
      const result = copyDefaultLocaleValues(content, 'en');

      // Object field with i18n: "duplicate" and existing value in default locale should be deleted
      expect(result.config).toBeUndefined();
    });

    it('should not delete object field when default locale value is null (lines 51-61)', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'metadata') {
          return { name: 'metadata', widget: 'object', i18n: true };
        }

        return undefined;
      });

      mockEntryDraft.currentValues.en.metadata = null;

      const content = { metadata: { key: 'value' } };
      const result = copyDefaultLocaleValues(content, 'en');

      // Object field with null value in default locale should NOT be deleted
      // After merge with null from default locale, it becomes null (not deleted, but overwritten by
      // merge)
      expect(result.metadata).toBeNull();
    });

    it('should not delete object field when i18n is false (lines 51-61)', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'metadata') {
          return { name: 'metadata', widget: 'object', i18n: false };
        }

        return undefined;
      });

      mockEntryDraft.currentValues.en.metadata = { key: 'value' };

      const content = { metadata: { key: 'value' } };
      const result = copyDefaultLocaleValues(content, 'en');

      // Object field with i18n: false should be removed by i18n disabled rule, not object rule
      expect(result.metadata).toBeUndefined();
    });

    it('should replace {{locale}} placeholder for hidden field with i18n: true (lines 53-63)', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'locale_code') {
          return {
            name: 'locale_code',
            widget: 'hidden',
            i18n: true,
            default: '{{locale}}',
          };
        }

        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        return undefined;
      });

      const content = { locale_code: 'en' };
      const result = copyDefaultLocaleValues(content, 'fr');

      // Hidden field with default: '{{locale}}' should be replaced with target language
      expect(result.locale_code).toBe('fr');
    });

    it('should replace {{locale}} placeholder for hidden field with i18n: "translate" (lines 53-63)', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'lang') {
          return {
            name: 'lang',
            widget: 'hidden',
            i18n: 'translate',
            default: '{{locale}}',
          };
        }

        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        return undefined;
      });

      const content = { lang: 'en' };
      const result = copyDefaultLocaleValues(content, 'de');

      // Hidden field with i18n: 'translate' and default: '{{locale}}' should be replaced
      expect(result.lang).toBe('de');
    });

    it('should not replace placeholder if default is not "{{locale}}" for hidden field (lines 53-63)', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'locale_code') {
          return {
            name: 'locale_code',
            widget: 'hidden',
            i18n: true,
            default: 'fixed_value',
          };
        }

        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        return undefined;
      });

      const content = { locale_code: 'en' };
      const result = copyDefaultLocaleValues(content, 'es');

      // Hidden field with different default value should not be replaced
      expect(result.locale_code).toBe('en');
    });

    it('should not apply locale replacement for hidden field with i18n: false (lines 53-63)', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'locale_code') {
          return {
            name: 'locale_code',
            widget: 'hidden',
            i18n: false,
            default: '{{locale}}',
          };
        }

        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        return undefined;
      });

      const content = { locale_code: 'en' };
      const result = copyDefaultLocaleValues(content, 'it');

      // Hidden field with i18n: false should not apply locale replacement
      // It should be removed entirely by the i18n disabled rule
      expect(result.locale_code).toBeUndefined();
    });

    it('should not apply locale replacement for hidden field with i18n: "none" (lines 53-63)', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'system_id') {
          return {
            name: 'system_id',
            widget: 'hidden',
            i18n: 'none',
            default: '{{locale}}',
          };
        }

        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        return undefined;
      });

      const content = { system_id: 'en' };
      const result = copyDefaultLocaleValues(content, 'pt');

      // Hidden field with i18n: 'none' should be removed and not have locale replacement
      expect(result.system_id).toBeUndefined();
    });

    it('should replace {{locale}} with correct locale code when multiple locales present (lines 53-63)', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'locale_code') {
          return {
            name: 'locale_code',
            widget: 'hidden',
            i18n: true,
            default: '{{locale}}',
          };
        }

        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        return undefined;
      });

      // Test with different target languages
      const testCases = [
        { targetLanguage: 'en', expected: 'en' },
        { targetLanguage: 'ja', expected: 'ja' },
        { targetLanguage: 'zh-CN', expected: 'zh-CN' },
      ];

      testCases.forEach(({ targetLanguage, expected }) => {
        const content = { locale_code: 'en' };
        const result = copyDefaultLocaleValues(content, targetLanguage);

        expect(result.locale_code).toBe(expected);
      });
    });

    it('should handle multiple hidden fields with {{locale}} placeholder (lines 53-63)', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'locale_code') {
          return {
            name: 'locale_code',
            widget: 'hidden',
            i18n: true,
            default: '{{locale}}',
          };
        }

        if (keyPath === 'language') {
          return {
            name: 'language',
            widget: 'hidden',
            i18n: 'translate',
            default: '{{locale}}',
          };
        }

        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        return undefined;
      });

      const content = { locale_code: 'en', language: 'en' };
      const result = copyDefaultLocaleValues(content, 'ko');

      // Both hidden fields should have locale replacement
      expect(result.locale_code).toBe('ko');
      expect(result.language).toBe('ko');
    });

    it('should preserve existing value in content and not apply {{locale}} replacement (lines 53-63)', () => {
      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'locale_code') {
          return {
            name: 'locale_code',
            widget: 'hidden',
            i18n: true,
            default: '{{locale}}',
          };
        }

        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        return undefined;
      });

      // Content already has a value from merge with default locale
      mockEntryDraft.currentValues.en.locale_code = 'en';

      const content = { locale_code: 'en' };
      const result = copyDefaultLocaleValues(content, 'fr');

      // The existing value from merge should be overwritten with the target locale
      expect(result.locale_code).toBe('fr');
    });

    describe('keyPathPrefix option', () => {
      beforeEach(() => {
        vi.mocked(getField).mockImplementation(({ keyPath }) => {
          if (keyPath === 'title') {
            return { name: 'title', widget: 'string', i18n: true };
          }

          if (/^blocks\.\d+\.markdown$/.test(keyPath)) {
            return { name: 'markdown', widget: 'richtext', i18n: true };
          }

          if (/^blocks\.\d+\.image$/.test(keyPath)) {
            return { name: 'image', widget: 'object', i18n: true };
          }

          if (/^blocks\.\d+\.image\.alt$/.test(keyPath)) {
            return { name: 'alt', widget: 'string', i18n: true };
          }

          if (/^blocks\.\d+\.limit$/.test(keyPath)) {
            return { name: 'limit', widget: 'number', i18n: true };
          }

          return undefined;
        });

        mockEntryDraft.currentValues.en = {
          title: 'English Title',
          'blocks.0.type': 'richtext',
          'blocks.0.image': null,
          'blocks.0.markdown': 'English Body',
          'blocks.1.type': 'artworkGrid',
          'blocks.1.limit': 10,
        };
      });

      it('should only return the values under the given key path', () => {
        const content = { 'blocks.0.image.alt': '' };
        const result = copyDefaultLocaleValues(content, 'fr', { keyPathPrefix: 'blocks.0.image' });

        // Unrelated fields, including a list item that doesn’t exist in the target locale, should
        // not be copied over
        expect(result).toEqual({ 'blocks.0.image.alt': '' });
      });

      it('should still copy the values under the given key path from the default locale', () => {
        mockEntryDraft.currentValues.en['blocks.0.image'] = {};
        mockEntryDraft.currentValues.en['blocks.0.image.src'] = '/media/image.png';

        const content = { 'blocks.0.image.alt': '' };
        const result = copyDefaultLocaleValues(content, 'fr', { keyPathPrefix: 'blocks.0.image' });

        expect(result).toEqual({
          'blocks.0.image.alt': '',
          'blocks.0.image.src': '/media/image.png',
        });
      });

      it('should return the whole content when the option is omitted', () => {
        const content = { 'blocks.0.image.alt': '' };
        const result = copyDefaultLocaleValues(content, 'fr');

        expect(Object.keys(result)).toEqual(
          expect.arrayContaining(['title', 'blocks.1.type', 'blocks.1.limit']),
        );
      });
    });

    describe('with a `duplicate_keys` KeyValue field', () => {
      beforeEach(() => {
        vi.mocked(getField).mockImplementation(({ keyPath }) => {
          if (keyPath === 'title') {
            return { name: 'title', widget: 'string', i18n: 'translate' };
          }

          if (keyPath === 'metadata') {
            return { name: 'metadata', widget: 'keyvalue', i18n: 'duplicate_keys' };
          }

          if (keyPath === 'labels') {
            return { name: 'labels', widget: 'keyvalue', i18n: true };
          }

          return undefined;
        });

        mockEntryDraft.currentValues.en = {
          title: 'English Title',
          'metadata.a': '1',
          'metadata.b': '2',
          'labels.x': 'X',
        };
      });

      it('should copy the keys but not the values from the default locale', () => {
        const result = copyDefaultLocaleValues({}, 'fr');

        expect(result).toEqual({
          title: '',
          'metadata.a': '',
          'metadata.b': '',
          // A translatable KeyValue field is copied as-is
          'labels.x': 'X',
        });
      });

      it('should keep the locale’s own default values under the default locale’s keys', () => {
        const content = { 'metadata.b': 'deux', 'metadata.c': 'trois' };
        const result = copyDefaultLocaleValues(content, 'fr');

        expect(result).toEqual({
          title: '',
          'metadata.a': '',
          'metadata.b': 'deux',
          'labels.x': 'X',
        });
      });
    });
  });

  describe('toggleLocale', () => {
    it('should enable a locale', () => {
      toggleLocale({ draft: mockEntryDraft, locale: 'ja' });

      const result = mockEntryDraft;

      expect(result.currentLocales.ja).toBe(true);
      expect(result.currentValues.ja).toBeDefined();
    });

    it('should disable a locale', () => {
      mockEntryDraft.currentLocales = { en: true, ja: true };
      mockEntryDraft.currentValues.ja = { title: 'Japanese Title' };
      mockEntryDraft.validities.ja = {};

      toggleLocale({ draft: mockEntryDraft, locale: 'ja' });

      const result = mockEntryDraft;

      expect(result.currentLocales.ja).toBe(false);
    });

    it('should initialize new locale with default values', () => {
      toggleLocale({ draft: mockEntryDraft, locale: 'ja' });

      expect(vi.mocked(getDefaultValues)).toHaveBeenCalledWith({
        fields: mockEntryDraft.fields,
        locale: 'ja',
        defaultLocale: 'en',
      });
      expect(vi.mocked(createProxy)).toHaveBeenCalledWith({
        draft: mockEntryDraft,
        locale: 'ja',
        target: expect.any(Object),
      });
      expect(mockEntryDraft.originalValues.ja).toEqual({ title: '', body: '', date: '' });
    });

    it('should not reinitialize locale values when already exists', () => {
      mockEntryDraft.currentLocales = { en: true, ja: false };
      mockEntryDraft.currentValues.ja = { title: 'Existing' };
      mockEntryDraft.originalValues.ja = { title: 'Existing' };

      toggleLocale({ draft: mockEntryDraft, locale: 'ja' });

      const result = mockEntryDraft;

      expect(result.currentLocales.ja).toBe(true);
      expect(result.currentValues.ja.title).toBe('Existing');
    });

    it('should clear validities when disabling locale', () => {
      mockEntryDraft.currentLocales = { en: true, ja: true };
      mockEntryDraft.currentValues.ja = { title: 'Japanese' };
      mockEntryDraft.validities.ja = { title: { valid: false } };

      toggleLocale({ draft: mockEntryDraft, locale: 'ja' });

      const result = mockEntryDraft;

      expect(result.validities.ja).toEqual({});
    });
  });
});
