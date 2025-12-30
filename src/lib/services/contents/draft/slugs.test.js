// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';

import {
  getCanonicalSlug,
  getFillSlugOptions,
  getLocalizedSlug,
  getLocalizedSlugs,
  getSlugs,
} from './slugs';

vi.mock('$lib/services/common/template', () => ({
  fillTemplate: vi.fn((template, options) => {
    // Simple mock implementation that replaces {{field}} with content[field]
    if (template === '{{slug}}') {
      return options.currentSlug || options.content?._slug || '';
    }

    return template.replace(/{{(.+?)}}/g, (match, field) => options.content?.[field] || '');
  }),
}));

vi.mock('$lib/services/contents/collection/index-file', () => ({
  getIndexFile: vi.fn(() => ({ name: 'index' })),
}));

describe('draft/slugs', () => {
  describe('getFillSlugOptions', () => {
    it('should return fill options for entry collection', () => {
      const draft = {
        collection: {
          name: 'posts',
          _type: 'entry',
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: undefined,
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post', body: 'Content' } },
        isIndexFile: false,
      };

      const result = getFillSlugOptions({ draft });

      expect(result).toEqual({
        collection: draft.collection,
        content: {
          title: 'My Post',
          body: 'Content',
          _slug: 'my-post',
        },
        isIndexFile: false,
      });
    });

    it('should use _ slug when locale slug not available', () => {
      const draft = {
        collection: {
          name: 'posts',
          _type: 'entry',
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: undefined,
        currentSlugs: { _: 'default-slug' },
        currentValues: { en: { title: 'My Post' } },
        isIndexFile: false,
      };

      const result = getFillSlugOptions({ draft });

      expect(result.content._slug).toBe('default-slug');
    });

    it('should handle file collection', () => {
      const draft = {
        collection: {
          name: 'settings',
          _type: 'file',
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: {
          name: 'config',
          _i18n: { defaultLocale: 'en' },
        },
        currentSlugs: {},
        currentValues: { en: { title: 'Config' } },
        isIndexFile: false,
      };

      const result = getFillSlugOptions({ draft });

      expect(result.collection).toEqual(draft.collection);
    });

    it('should handle index file', () => {
      const draft = {
        collection: {
          name: 'posts',
          _type: 'entry',
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: undefined,
        currentSlugs: { en: 'index' },
        currentValues: { en: { title: 'Index' } },
        isIndexFile: true,
      };

      const result = getFillSlugOptions({ draft });

      expect(result.isIndexFile).toBe(true);
    });
  });

  describe('getSlugs', () => {
    it('should return index file name for index files', () => {
      const draft = {
        isNew: false,
        collection: {
          _type: 'entry',
          identifier_field: 'title',
          slug: '{{title}}',
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: undefined,
        fileName: undefined,
        currentSlugs: { en: 'my-post' },
        isIndexFile: true,
      };

      const result = getSlugs({ draft });

      expect(result.defaultLocaleSlug).toBe('index');
      expect(result.localizedSlugs).toBeUndefined();
      expect(result.canonicalSlug).toBeUndefined();
    });

    it('should return fileName for file collection', () => {
      const draft = {
        isNew: false,
        collection: {
          _type: 'file',
          _i18n: {
            defaultLocale: 'en',
            canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
            structureMap: { i18nSingleFile: false },
          },
        },
        collectionFile: {
          name: 'config',
          _i18n: {
            defaultLocale: 'en',
            canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
            structureMap: { i18nSingleFile: false },
          },
        },
        fileName: 'config',
        currentSlugs: {},
        currentValues: { en: {} },
        currentLocales: { en: true },
        isIndexFile: false,
      };

      const result = getSlugs({ draft });

      expect(result.defaultLocaleSlug).toBe('config');
    });

    it('should use currentSlugs for existing entry', () => {
      const draft = {
        isNew: false,
        collection: {
          _type: 'entry',
          identifier_field: 'title',
          slug: '{{title}}',
          _i18n: {
            defaultLocale: 'en',
            canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
            structureMap: { i18nSingleFile: false },
          },
        },
        collectionFile: undefined,
        fileName: undefined,
        currentSlugs: { en: 'my-existing-post' },
        currentValues: { en: { title: 'My Existing Post' } },
        currentLocales: { en: true },
        isIndexFile: false,
      };

      const result = getSlugs({ draft });

      expect(result.defaultLocaleSlug).toBe('my-existing-post');
    });

    it('should use _ slug for existing entry when locale slug not available', () => {
      const draft = {
        isNew: false,
        collection: {
          _type: 'entry',
          identifier_field: 'title',
          slug: '{{title}}',
          _i18n: {
            defaultLocale: 'en',
            canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
            structureMap: { i18nSingleFile: false },
          },
        },
        collectionFile: undefined,
        fileName: undefined,
        currentSlugs: { _: 'default-post' },
        currentValues: { en: { title: 'Default Post' } },
        currentLocales: { en: true },
        isIndexFile: false,
      };

      const result = getSlugs({ draft });

      expect(result.defaultLocaleSlug).toBe('default-post');
    });

    it('should generate slug for new entry', async () => {
      const { fillTemplate } = await import('$lib/services/common/template');

      vi.mocked(fillTemplate).mockReturnValue('my-new-post');

      const draft = {
        isNew: true,
        collection: {
          _type: 'entry',
          identifier_field: 'title',
          slug: '{{title}}',
          _i18n: {
            defaultLocale: 'en',
            canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
            structureMap: { i18nSingleFile: false },
          },
        },
        collectionFile: undefined,
        fileName: undefined,
        currentSlugs: {},
        currentValues: { en: { title: 'My New Post' } },
        currentLocales: { en: true },
        isIndexFile: false,
      };

      const result = getSlugs({ draft });

      expect(result.defaultLocaleSlug).toBe('my-new-post');
      expect(fillTemplate).toHaveBeenCalled();
    });

    it('should use default identifier_field when not specified', async () => {
      const { fillTemplate } = await import('$lib/services/common/template');

      vi.mocked(fillTemplate).mockReturnValue('default-title-slug');

      const draft = {
        isNew: true,
        collection: {
          _type: 'entry',
          // No identifier_field specified
          _i18n: {
            defaultLocale: 'en',
            canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
            structureMap: { i18nSingleFile: false },
          },
        },
        collectionFile: undefined,
        fileName: undefined,
        currentSlugs: {},
        currentValues: { en: { title: 'Default Title' } },
        currentLocales: { en: true },
        isIndexFile: false,
      };

      const result = getSlugs({ draft });

      expect(result.defaultLocaleSlug).toBe('default-title-slug');
    });

    it('should handle canonical slug generation', async () => {
      const { fillTemplate } = await import('$lib/services/common/template');

      vi.mocked(fillTemplate).mockImplementation((template, options) => {
        if (template === '{{title | localize}}') {
          return 'my-post';
        }

        if (template === '{{slug}}') {
          return options.currentSlug || 'my-post';
        }

        return 'my-post';
      });

      const draft = {
        isNew: true,
        collection: {
          _type: 'entry',
          identifier_field: 'title',
          slug: '{{title | localize}}', // Need localize modifier for canonical slug
          _i18n: {
            defaultLocale: 'en',
            canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
            structureMap: { i18nSingleFile: false },
          },
        },
        collectionFile: undefined,
        fileName: undefined,
        currentSlugs: {},
        currentValues: { en: { title: 'My Post' } },
        currentLocales: { en: true },
        isIndexFile: false,
      };

      const result = getSlugs({ draft });

      expect(result.canonicalSlug).toBeDefined();
      expect(result.localizedSlugs).toBeDefined();
    });
  });

  describe('getLocalizedSlug (internal)', () => {
    it('should return slug for new entry with localized content', async () => {
      const { fillTemplate } = vi.mocked(await import('$lib/services/common/template'));

      fillTemplate.mockReturnValue('mon-article');

      const draft = {
        isNew: true,
        collection: {
          _type: 'entry',
          identifier_field: 'title',
          slug: '{{title}}',
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: undefined,
        currentSlugs: {},
        currentValues: {
          en: { title: 'My Article' },
          fr: { title: 'Mon Article' },
        },
        isIndexFile: false,
      };

      const result = getLocalizedSlug({
        draft,
        locale: 'fr',
        localizingKeyPaths: ['title'],
      });

      expect(result).toBe('mon-article');
      expect(fillTemplate).toHaveBeenCalledWith(
        '{{title}}',
        expect.objectContaining({
          locale: 'fr',
        }),
      );
    });

    it('should return existing slug for existing entry', () => {
      const draft = {
        isNew: false,
        collection: {
          _type: 'entry',
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: undefined,
        currentSlugs: { fr: 'mon-article-existant' },
        currentValues: {
          en: { title: 'My Existing Article' },
          fr: { title: 'Mon Article Existant' },
        },
        isIndexFile: false,
      };

      const result = getLocalizedSlug({
        draft,
        locale: 'fr',
        localizingKeyPaths: ['title'],
      });

      expect(result).toBe('mon-article-existant');
    });

    it('should fallback to _ slug when locale slug not available', () => {
      const draft = {
        isNew: false,
        collection: {
          _type: 'entry',
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: undefined,
        currentSlugs: { _: 'default-slug' },
        currentValues: {
          en: { title: 'My Article' },
          fr: { title: 'Mon Article' },
        },
        isIndexFile: false,
      };

      const result = getLocalizedSlug({
        draft,
        locale: 'fr',
        localizingKeyPaths: ['title'],
      });

      expect(result).toBe('default-slug');
    });

    it('should handle file type collection (non-entry)', async () => {
      const { fillTemplate } = vi.mocked(await import('$lib/services/common/template'));

      fillTemplate.mockReturnValue('some-file-slug');

      const draft = {
        isNew: true,
        collection: {
          _type: 'file',
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: undefined,
        currentSlugs: {},
        currentValues: {
          en: { title: 'Some File' },
          fr: { title: 'Un Fichier' },
        },
        isIndexFile: false,
      };

      const result = getLocalizedSlug({
        draft,
        locale: 'fr',
        localizingKeyPaths: ['title'],
      });

      expect(result).toBe('some-file-slug');
      // For file type, fillTemplate is called with default slug template
      expect(fillTemplate).toHaveBeenCalled();
    });
  });

  describe('getLocalizedSlugs (internal)', () => {
    it('should return undefined for single file i18n', () => {
      const draft = {
        collection: {
          _type: 'entry',
          identifier_field: 'title',
          slug: '{{title | localize}}',
          _i18n: {
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: true },
          },
        },
        collectionFile: undefined,
        currentLocales: { en: true, fr: true },
      };

      const result = getLocalizedSlugs({ draft, defaultLocaleSlug: 'my-article' });

      expect(result).toBeUndefined();
    });

    it('should return undefined when no localizing key paths', () => {
      const draft = {
        collection: {
          _type: 'entry',
          identifier_field: 'title',
          slug: '{{title}}', // No localize modifier
          _i18n: {
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false },
          },
        },
        collectionFile: undefined,
        currentLocales: { en: true, fr: true },
      };

      const result = getLocalizedSlugs({ draft, defaultLocaleSlug: 'my-article' });

      expect(result).toBeUndefined();
    });

    it('should return localized slug map when localize modifier present', async () => {
      const { fillTemplate } = vi.mocked(await import('$lib/services/common/template'));

      fillTemplate.mockImplementation((template, options) => {
        if (options.locale === 'fr') {
          return 'mon-article';
        }

        return 'my-article';
      });

      const draft = {
        collection: {
          _type: 'entry',
          identifier_field: 'title',
          slug: '{{title | localize}}',
          _i18n: {
            defaultLocale: 'en',
            structureMap: { i18nSingleFile: false },
          },
        },
        collectionFile: undefined,
        currentLocales: { en: true, fr: true },
        currentSlugs: {},
        currentValues: {
          en: { title: 'My Article' },
          fr: { title: 'Mon Article' },
        },
        isIndexFile: false,
        isNew: true,
      };

      const result = getLocalizedSlugs({ draft, defaultLocaleSlug: 'my-article' });

      expect(result).toEqual({
        en: 'my-article',
        fr: 'mon-article',
      });
    });
  });

  describe('getCanonicalSlug (internal)', () => {
    it('should return undefined when no localized slugs', () => {
      const draft = {
        collection: {
          _i18n: {
            canonicalSlug: { value: '{{slug}}' },
          },
        },
        collectionFile: undefined,
      };

      const result = getCanonicalSlug({
        draft,
        defaultLocaleSlug: 'my-article',
        localizedSlugs: undefined,
        fillSlugOptions: {},
      });

      expect(result).toBeUndefined();
    });

    it('should return default locale slug when template is {{slug}}', () => {
      const draft = {
        collection: {
          _i18n: {
            canonicalSlug: { value: '{{slug}}' },
          },
        },
        collectionFile: undefined,
      };

      const result = getCanonicalSlug({
        draft,
        defaultLocaleSlug: 'my-article',
        localizedSlugs: { en: 'my-article', fr: 'mon-article' },
        fillSlugOptions: {},
      });

      expect(result).toBe('my-article');
    });

    it('should use fillTemplate for custom canonical slug template', async () => {
      const { fillTemplate } = vi.mocked(await import('$lib/services/common/template'));

      fillTemplate.mockReturnValue('custom-canonical-key');

      const draft = {
        collection: {
          _i18n: {
            canonicalSlug: { value: '{{fields.customKey}}' },
          },
        },
        collectionFile: undefined,
      };

      const fillSlugOptions = {
        collection: draft.collection,
        content: { customKey: 'custom-canonical-key' },
        isIndexFile: false,
      };

      const result = getCanonicalSlug({
        draft,
        defaultLocaleSlug: 'my-article',
        localizedSlugs: { en: 'my-article', fr: 'mon-article' },
        fillSlugOptions,
      });

      expect(result).toBe('custom-canonical-key');
      expect(fillTemplate).toHaveBeenCalledWith(
        '{{fields.customKey}}',
        expect.objectContaining({
          currentSlug: 'my-article',
        }),
      );
    });
  });
});
