// @ts-nocheck
import { describe, expect, it } from 'vitest';

import {
  getConfiguredSlugTemplate,
  getSlugOptions,
  hasLegacySlugEditorTag,
  hasLocalizedSlugs,
  LEGACY_LOCALIZED_SLUG_EDITOR_TAG,
  LEGACY_SLUG_EDITOR_TAG,
} from './slug';

describe('contents/collection/slug', () => {
  describe('getConfiguredSlugTemplate', () => {
    it('should return the slug option when it’s a string', () => {
      expect(getConfiguredSlugTemplate({ slug: '{{title}}' })).toBe('{{title}}');
    });

    it('should return the template property of the object form', () => {
      expect(getConfiguredSlugTemplate({ slug: { template: '{{name}}' } })).toBe('{{name}}');
    });

    it('should return undefined when no template is configured', () => {
      expect(getConfiguredSlugTemplate({})).toBeUndefined();
      expect(getConfiguredSlugTemplate({ slug: { editable: true } })).toBeUndefined();
      expect(getConfiguredSlugTemplate({ slug: { template: 1 } })).toBeUndefined();
      expect(getConfiguredSlugTemplate({ slug: 1 })).toBeUndefined();
    });
  });

  describe('hasLegacySlugEditorTag', () => {
    it('should detect the legacy tags', () => {
      expect(hasLegacySlugEditorTag(LEGACY_SLUG_EDITOR_TAG)).toBe(true);
      expect(hasLegacySlugEditorTag(LEGACY_LOCALIZED_SLUG_EDITOR_TAG)).toBe(true);
      expect(hasLegacySlugEditorTag('{{year}}-{{fields._slug}}')).toBe(true);
    });

    it('should return false for other templates', () => {
      expect(hasLegacySlugEditorTag('{{title}}')).toBe(false);
      expect(hasLegacySlugEditorTag(undefined)).toBe(false);
    });
  });

  describe('getSlugOptions', () => {
    it('should return the defaults without the slug option', () => {
      expect(getSlugOptions({})).toEqual({
        template: '{{title}}',
        editorRequired: false,
        editorValueIsSlug: true,
        editable: { create: true, update: true },
        localized: false,
        autoIncrement: false,
        hint: undefined,
        pattern: undefined,
      });
    });

    it('should number the slug with the auto_increment option, ignoring the template', () => {
      expect(
        getSlugOptions({
          slug: {
            template: '{{fields._slug}}',
            auto_increment: true,
            editable: true,
            i18n: true,
            hint: 'A number',
            pattern: ['^[0-9]+$', 'Numbers only'],
          },
        }),
      ).toEqual({
        template: '',
        editorRequired: false,
        editorValueIsSlug: true,
        editable: { create: true, update: true },
        localized: true,
        autoIncrement: true,
        hint: 'A number',
        pattern: ['^[0-9]+$', 'Numbers only'],
      });
      expect(getSlugOptions({ slug: { auto_increment: true, editable: ['update'] } })).toEqual(
        expect.objectContaining({
          editable: { create: false, update: true },
          localized: false,
          autoIncrement: true,
        }),
      );
    });

    it('should ignore the auto_increment option for entries stored in one file', () => {
      expect(
        getSlugOptions({ file: 'data/posts.json', slug: { auto_increment: true } }).autoIncrement,
      ).toBe(false);
    });

    it('should use the identifier field for the default template', () => {
      expect(getSlugOptions({ identifier_field: 'name' }).template).toBe('{{name}}');
      expect(getSlugOptions({ identifier_field: 'name', slug: {} }).template).toBe('{{name}}');
    });

    it('should use a template string as is', () => {
      expect(getSlugOptions({ slug: '{{year}}-{{title}}' })).toMatchObject({
        template: '{{year}}-{{title}}',
        editorRequired: false,
        editable: { create: true, update: true },
        localized: false,
      });
    });

    it('should make the slug uneditable for a collection storing the entries in one file', () => {
      expect(
        getSlugOptions({ file: 'data/members.json', slug: { editable: ['create', 'update'] } }),
      ).toMatchObject({
        template: '{{title}}',
        editable: { create: false, update: false },
      });
    });

    it('should ignore the delete option', () => {
      expect(getSlugOptions({ delete: false }).editable).toEqual({ create: true, update: true });
    });

    it('should pick the stages with the editable option', () => {
      expect(getSlugOptions({ slug: { editable: ['update'] } }).editable).toEqual({
        create: false,
        update: true,
      });
      expect(getSlugOptions({ slug: { editable: [] } }).editable).toEqual({
        create: false,
        update: false,
      });
    });

    it('should fill the slug from the identifier field unless editable is given explicitly', () => {
      // The slug editor is shown by default, prefilled with the slug the template fills
      expect(getSlugOptions({ slug: { hint: 'Hint' } })).toMatchObject({
        template: '{{title}}',
        editorRequired: false,
        editable: { create: true, update: true },
      });
      // Not editable on creation, so the template fills the slug
      expect(getSlugOptions({ slug: { editable: ['update'] } })).toMatchObject({
        template: '{{title}}',
        editorRequired: false,
      });
    });

    it('should support the legacy slug editor tag', () => {
      expect(getSlugOptions({ slug: '{{fields._slug}}' })).toMatchObject({
        template: '{{fields._slug}}',
        editorRequired: true,
        editable: { create: true, update: true },
        localized: false,
      });
    });

    it('should support the legacy localized slug editor tag', () => {
      expect(getSlugOptions({ slug: '{{fields._slug | localize}}' })).toMatchObject({
        template: '{{fields._slug | localize}}',
        editorRequired: true,
        editable: { create: true, update: true },
        localized: true,
      });
    });

    it('should tell whether the slug editor’s value is the whole slug', () => {
      expect(getSlugOptions({ slug: '{{fields._slug}}' }).editorValueIsSlug).toBe(true);
      expect(getSlugOptions({ slug: '{{fields._slug | localize}}' }).editorValueIsSlug).toBe(true);
      expect(getSlugOptions({ slug: { editable: true } }).editorValueIsSlug).toBe(true);
      expect(
        getSlugOptions({ slug: { template: '{{title}}', editable: true } }).editorValueIsSlug,
      ).toBe(true);
      expect(getSlugOptions({ slug: '{{year}}-{{fields._slug}}' }).editorValueIsSlug).toBe(false);
    });

    it('should support the legacy tags in the template property', () => {
      expect(
        getSlugOptions({ slug: { template: '{{fields._slug}}', editable: false } }),
      ).toMatchObject({ editorRequired: true, editable: { create: true, update: false } });
    });

    it('should take the slug from the slug editor alone when editable without a template', () => {
      expect(getSlugOptions({ slug: { editable: true } })).toMatchObject({
        template: '{{fields._slug}}',
        editorRequired: true,
        editable: { create: true, update: true },
        localized: false,
      });
      expect(getSlugOptions({ slug: { editable: ['create'], i18n: true } })).toMatchObject({
        template: '{{fields._slug | localize}}',
        editorRequired: true,
        editable: { create: true, update: false },
        localized: true,
      });
    });

    it('should keep the template when the slug is also editable on creation', () => {
      expect(getSlugOptions({ slug: { template: '{{title}}', editable: true } })).toMatchObject({
        template: '{{title}}',
        editorRequired: false,
        editable: { create: true, update: true },
      });
    });

    it('should not make any stage editable when the option is false', () => {
      expect(getSlugOptions({ slug: { editable: false } })).toMatchObject({
        template: '{{title}}',
        editable: { create: false, update: false },
      });
    });

    it('should ignore an editable option of an unsupported type', () => {
      expect(getSlugOptions({ slug: { editable: 'create' } }).editable).toEqual({
        create: false,
        update: false,
      });
    });

    it('should only localize the slug with i18n set to true', () => {
      expect(getSlugOptions({ slug: { i18n: true } }).localized).toBe(true);
      expect(getSlugOptions({ slug: { i18n: 'duplicate' } }).localized).toBe(false);
      expect(getSlugOptions({ slug: { i18n: false } }).localized).toBe(false);
    });

    it('should pass through the hint and pattern', () => {
      const pattern = ['^[a-z]+$', 'Lowercase letters only'];

      expect(getSlugOptions({ slug: { hint: 'Language code', pattern } })).toMatchObject({
        hint: 'Language code',
        pattern,
      });
    });
  });

  describe('hasLocalizedSlugs', () => {
    /**
     * Create an entry collection.
     * @param {object} [overrides] Property overrides.
     * @returns {any} Collection.
     */
    const createCollection = (overrides = {}) => ({
      _type: 'entry',
      slug: '{{title | localize}}',
      _i18n: {
        i18nEnabled: true,
        structureMap: { i18nSingleFile: false, i18nSingleFileDefaultRoot: false },
      },
      ...overrides,
    });

    it('should be true with the localize flag and a multi-file structure', () => {
      expect(hasLocalizedSlugs(createCollection())).toBe(true);
      expect(hasLocalizedSlugs(createCollection({ slug: '{{fields.title | localize}}' }))).toBe(
        true,
      );
    });

    it('should be false without the localize flag', () => {
      expect(hasLocalizedSlugs(createCollection({ slug: '{{title}}' }))).toBe(false);
      expect(hasLocalizedSlugs(createCollection({ slug: undefined }))).toBe(false);
    });

    it('should be false when the localize flag is only in an escaped tag', () => {
      expect(
        hasLocalizedSlugs(createCollection({ slug: '{{title}}-\\{{title | localize}}' })),
      ).toBe(false);
    });

    it('should be false with a single-file structure', () => {
      expect(
        hasLocalizedSlugs(
          createCollection({
            _i18n: { i18nEnabled: true, structureMap: { i18nSingleFile: true } },
          }),
        ),
      ).toBe(false);
      expect(
        hasLocalizedSlugs(
          createCollection({
            _i18n: { i18nEnabled: true, structureMap: { i18nSingleFileDefaultRoot: true } },
          }),
        ),
      ).toBe(false);
    });

    it('should be false for a monolingual collection', () => {
      const _i18n = { i18nEnabled: false, structureMap: {} };

      expect(hasLocalizedSlugs(createCollection({ _i18n }))).toBe(false);
      expect(hasLocalizedSlugs(createCollection({ _i18n, slug: { i18n: true } }))).toBe(false);
    });

    it('should be false for a file collection', () => {
      expect(hasLocalizedSlugs(createCollection({ _type: 'file' }))).toBe(false);
    });

    it('should be true with the i18n option of the slug', () => {
      expect(hasLocalizedSlugs(createCollection({ slug: { i18n: true } }))).toBe(true);
      expect(hasLocalizedSlugs(createCollection({ slug: { editable: true, i18n: true } }))).toBe(
        true,
      );
      // Even without any field tag to localize
      expect(
        hasLocalizedSlugs(createCollection({ slug: { template: '{{uuid}}', i18n: true } })),
      ).toBe(true);
    });

    it('should be false when the slug is duplicated', () => {
      expect(hasLocalizedSlugs(createCollection({ slug: { i18n: 'duplicate' } }))).toBe(false);
      expect(hasLocalizedSlugs(createCollection({ slug: { editable: true } }))).toBe(false);
    });

    it('should be false with the i18n option and a single-file structure', () => {
      expect(
        hasLocalizedSlugs(
          createCollection({
            slug: { i18n: true },
            _i18n: { i18nEnabled: true, structureMap: { i18nSingleFile: true } },
          }),
        ),
      ).toBe(false);
    });
  });
});
