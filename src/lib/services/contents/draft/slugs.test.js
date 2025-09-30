// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';

import { getFillSlugOptions, getSlugs } from './slugs';

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
});
