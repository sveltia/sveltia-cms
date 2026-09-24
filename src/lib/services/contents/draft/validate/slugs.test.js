// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getSharedEntryFileName } from '$lib/services/contents/collection/nested';
import { getUnpublishedEntriesByCollection } from '$lib/services/workflow';

import {
  validateSlugs as _validateSlugs,
  getSlugValidationMessage,
  getTakenSlugs,
  validateSlug,
} from './slugs';

vi.mock('@sveltia/i18n', () => ({ _: vi.fn((key) => key) }));
vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));
vi.mock('$lib/services/workflow', () => ({
  getUnpublishedEntriesByCollection: vi.fn(() => []),
}));
vi.mock('$lib/services/contents/collection/nested', async (importOriginal) => ({
  ...(await importOriginal()),
  getSharedEntryFileName: vi.fn(),
}));

/**
 * Create an entry.
 * @param {string} id Entry ID.
 * @param {Record<string, string>} slugs Slug for each locale.
 * @param {object} [extra] Other properties.
 * @returns {any} Entry.
 */
const createEntry = (id, slugs, extra = {}) => ({
  id,
  slug: Object.values(slugs)[0],
  subPath: Object.values(slugs)[0],
  locales: Object.fromEntries(
    Object.entries(slugs).map(([locale, slug]) => [
      locale,
      { slug, path: `content/posts/${locale}/${slug}.md` },
    ]),
  ),
  ...extra,
});

describe('draft/validate/slugs', () => {
  let mockEntryDraft;
  /**
   * Validate the mock entry draft’s slugs.
   * @returns {object} Validation results.
   */
  const validateSlugs = () => _validateSlugs(mockEntryDraft);

  beforeEach(async () => {
    vi.clearAllMocks();

    vi.mocked(getEntriesByCollection).mockReturnValue([]);
    vi.mocked(getUnpublishedEntriesByCollection).mockReturnValue([]);
    vi.mocked(getSharedEntryFileName).mockReturnValue(undefined);

    mockEntryDraft = {
      collection: { _type: 'entry', slug: '{{fields._slug}}' },
      collectionName: 'posts',
      isNew: true,
      defaultLocale: 'en',
      originalSlugs: {},
      currentLocales: { en: true },
      currentSlugs: { en: 'test-post' },
      slugEditor: { en: false },
    };
  });

  describe('validateSlugs', () => {
    it('should return valid when slug editors are not shown', () => {
      mockEntryDraft.currentLocales = { en: true, fr: true };
      mockEntryDraft.currentSlugs = { en: 'test-post', fr: 'test-article' };
      mockEntryDraft.slugEditor = { en: false, fr: false };

      const result = validateSlugs();

      expect(result.valid).toBe(true);
      expect(result.validities.en._slug.valid).toBe(true);
      expect(result.validities.fr._slug.valid).toBe(true);
    });

    it('should not require the slug when the template can fill it', () => {
      mockEntryDraft.collection = {
        _type: 'entry',
        slug: { template: '{{title}}', editable: true },
      };
      mockEntryDraft.currentSlugs = { en: '' };
      mockEntryDraft.slugEditor = { en: true };

      const result = validateSlugs();

      expect(result.valid).toBe(true);
      expect(result.validities.en._slug.valueMissing).toBe(false);
    });

    it('should still reject whitespace when the template can fill the slug', () => {
      mockEntryDraft.collection = {
        _type: 'entry',
        slug: { template: '{{title}}', editable: true },
      };
      mockEntryDraft.currentSlugs = { en: 'my slug' };
      mockEntryDraft.slugEditor = { en: true };

      expect(validateSlugs().validities.en._slug.patternMismatch).toBe(true);
    });

    it('should not require the slug in a file collection', () => {
      mockEntryDraft.collection = { _type: 'file' };
      mockEntryDraft.currentSlugs = { en: '' };
      mockEntryDraft.slugEditor = { en: true };

      expect(validateSlugs().valid).toBe(true);
    });

    it('should return invalid when slug is empty and editor is shown', () => {
      mockEntryDraft.currentLocales = { en: true, fr: true };
      mockEntryDraft.currentSlugs = { en: '', fr: 'test-article' };
      mockEntryDraft.slugEditor = { en: true, fr: false };

      const result = validateSlugs();

      expect(result.valid).toBe(false);
      expect(result.validities.en._slug.valid).toBe(false);
      expect(result.validities.en._slug.valueMissing).toBe(true);
      expect(result.validities.fr._slug.valid).toBe(true);
    });

    it('should trim slug before validation', () => {
      mockEntryDraft.currentLocales = { en: true, fr: true };
      mockEntryDraft.currentSlugs = { en: '   ', fr: 'test' };
      mockEntryDraft.slugEditor = { en: true, fr: true };

      const result = validateSlugs();

      expect(result.valid).toBe(false);
      expect(result.validities.en._slug.valueMissing).toBe(true);
      expect(result.validities.fr._slug.valueMissing).toBe(false);
    });

    it('should invalidate slug when it contains a forward slash', () => {
      mockEntryDraft.currentLocales = { en: true, fr: true };
      mockEntryDraft.currentSlugs = { en: 'test/post', fr: 'test-article' };
      mockEntryDraft.slugEditor = { en: true, fr: false };

      const result = validateSlugs();

      expect(result.valid).toBe(false);
      expect(result.validities.en._slug.valid).toBe(false);
      expect(result.validities.en._slug.valueMissing).toBe(false);
      expect(result.validities.en._slug.patternMismatch).toBe(true);
      expect(result.validities.fr._slug.valid).toBe(true);
    });

    it('should invalidate slug when it contains whitespace', () => {
      mockEntryDraft.currentLocales = { en: true, fr: true };
      mockEntryDraft.currentSlugs = { en: 'test post', fr: 'test-article' };
      mockEntryDraft.slugEditor = { en: true, fr: false };

      const result = validateSlugs();

      expect(result.valid).toBe(false);
      expect(result.validities.en._slug.valid).toBe(false);
      expect(result.validities.en._slug.valueMissing).toBe(false);
      expect(result.validities.en._slug.patternMismatch).toBe(true);
      expect(result.validities.fr._slug.valid).toBe(true);
    });

    it('should treat an undefined slug as missing when the editor is shown', () => {
      mockEntryDraft.currentLocales = { en: true };
      mockEntryDraft.currentSlugs = { en: undefined };
      mockEntryDraft.slugEditor = { en: true };

      const result = validateSlugs();

      expect(result.valid).toBe(false);
      expect(result.validities.en._slug.valid).toBe(false);
      expect(result.validities.en._slug.valueMissing).toBe(true);
      expect(result.validities.en._slug.patternMismatch).toBe(false);
    });

    it('should require a slug the slug editor hasn’t set yet', () => {
      mockEntryDraft.currentLocales = { en: true, fr: true };
      mockEntryDraft.currentSlugs = {};
      mockEntryDraft.slugEditor = { en: true, fr: 'readonly' };

      const { valid, validities } = validateSlugs();

      expect(valid).toBe(false);
      expect(validities.en._slug.valueMissing).toBe(true);
      expect(validities.fr._slug.valueMissing).toBe(true);
    });

    it('should ignore slug for locales that are not currently enabled', () => {
      // Regression test for https://github.com/sveltia/sveltia-cms/issues/740
      mockEntryDraft.currentLocales = { en: true, fr: false };
      mockEntryDraft.currentSlugs = { en: 'test-post', fr: undefined };
      mockEntryDraft.slugEditor = { en: false, fr: true };

      const result = validateSlugs();

      expect(result.valid).toBe(true);
      expect(result.validities.en._slug.valid).toBe(true);
      expect(result.validities.fr._slug.valid).toBe(true);
      expect(result.validities.fr._slug.valueMissing).toBe(false);
    });
  });

  describe('getTakenSlugs', () => {
    it('should collect the slugs of the other entries for each locale', () => {
      vi.mocked(getEntriesByCollection).mockReturnValue([
        createEntry('1', { en: 'hello', fr: 'bonjour' }),
      ]);
      vi.mocked(getUnpublishedEntriesByCollection).mockReturnValue([
        createEntry('2', { en: 'draft' }),
      ]);
      mockEntryDraft.currentSlugs = { en: '', fr: '' };

      expect(getTakenSlugs(mockEntryDraft)).toEqual({ en: ['hello', 'draft'], fr: ['bonjour'] });
    });

    it('should collect the slugs for the given locales', () => {
      vi.mocked(getEntriesByCollection).mockReturnValue([
        createEntry('1', { en: 'hello', fr: 'bonjour' }),
      ]);
      mockEntryDraft.currentSlugs = {};

      expect(getTakenSlugs(mockEntryDraft, ['fr'])).toEqual({ fr: ['bonjour'] });
    });

    it('should collect the slugs in every locale for a locale-agnostic slug', () => {
      vi.mocked(getEntriesByCollection).mockReturnValue([
        createEntry('1', { en: 'hello', fr: 'bonjour' }),
      ]);
      mockEntryDraft.currentSlugs = { _: 'x' };

      expect(getTakenSlugs(mockEntryDraft)).toEqual({ _: ['hello', 'bonjour'] });
    });

    it('should leave out every version of the entry being edited and its own slugs', () => {
      const ownEntry = createEntry('own', { en: 'own' });

      vi.mocked(getEntriesByCollection).mockReturnValue([
        ownEntry,
        // A published version left behind under the old slug by a renaming draft
        createEntry('old', { en: 'old-slug' }),
        // Another entry with a slug equal to the entry’s original one
        createEntry('other', { en: 'original' }),
        createEntry('taken', { en: 'taken' }),
      ]);
      mockEntryDraft.isNew = false;
      mockEntryDraft.originalEntry = {
        ...ownEntry,
        workflow: { previousPaths: ['content/posts/en/old-slug.md'] },
      };
      mockEntryDraft.originalSlugs = { en: 'original' };
      mockEntryDraft.currentSlugs = { en: 'original' };

      expect(getTakenSlugs(mockEntryDraft)).toEqual({ en: ['taken'] });
    });
  });

  describe('validateSlug', () => {
    it('should report an empty slug only when required', () => {
      expect(validateSlug({ slug: '' })).toBe('empty');
      expect(validateSlug({ slug: '  ' })).toBe('empty');
      expect(validateSlug({ slug: undefined })).toBe('empty');
      expect(validateSlug({ slug: '', required: false })).toBeUndefined();
    });

    it('should report a slash or whitespace', () => {
      expect(validateSlug({ slug: 'a/b' })).toBe('invalid');
      expect(validateSlug({ slug: 'a b' })).toBe('invalid');
      expect(validateSlug({ slug: 'ab ' })).toBe('invalid');
    });

    it('should check the pattern', () => {
      const pattern = ['^[a-z]{2}$', 'Two letters'];

      expect(validateSlug({ slug: 'deu', pattern })).toBe('pattern');
      expect(validateSlug({ slug: 'de', pattern })).toBeUndefined();
      // A pattern that can’t be compiled is reported in the config instead
      expect(validateSlug({ slug: 'deu', pattern: ['[', 'Broken'] })).toBeUndefined();
    });

    it('should compare the slug with the taken ones the way it will be saved', () => {
      expect(validateSlug({ slug: 'Hello', takenSlugs: ['hello'], locale: 'en' })).toBe(
        'duplicate',
      );
      expect(validateSlug({ slug: 'hello', takenSlugs: ['world'] })).toBeUndefined();
    });
  });

  describe('getSlugValidationMessage', () => {
    it('should return the message of the pattern option', () => {
      expect(getSlugValidationMessage({ error: 'pattern', pattern: ['^a$', 'Only a'] })).toBe(
        'Only a',
      );
    });

    it('should fall back to the standard messages', () => {
      expect(getSlugValidationMessage({ error: 'pattern', pattern: ['^a$'] })).toBe(
        'edit_slug_error.pattern',
      );
      expect(getSlugValidationMessage({ error: 'duplicate' })).toBe('edit_slug_error.duplicate');
    });
  });

  describe('validateSlugs with the object form of the slug option', () => {
    it('should report a slug that doesn’t match the pattern with its message', () => {
      mockEntryDraft.collection = {
        _type: 'entry',
        slug: { editable: true, pattern: ['^[a-z]{2}$', 'Two letters'] },
      };
      mockEntryDraft.currentSlugs = { en: 'deu' };
      mockEntryDraft.slugEditor = { en: true };

      const { valid, validities } = validateSlugs();

      expect(valid).toBe(false);
      expect(validities.en._slug).toEqual({
        valueMissing: false,
        patternMismatch: false,
        customError: true,
        duplicateError: false,
        valid: false,
        customErrorMessage: 'Two letters',
      });
    });

    it('should report a slug taken by another entry', () => {
      vi.mocked(getEntriesByCollection).mockReturnValue([createEntry('1', { en: 'de' })]);
      mockEntryDraft.collection = { _type: 'entry', slug: { editable: true } };
      mockEntryDraft.currentSlugs = { en: 'de' };
      mockEntryDraft.slugEditor = { en: true };

      const { validities } = validateSlugs();

      expect(validities.en._slug.duplicateError).toBe(true);
      expect(validities.en._slug.customErrorMessage).toBe('edit_slug_error.duplicate');
    });

    it('should not look for other entries when the slug is empty', () => {
      mockEntryDraft.collection = {
        _type: 'entry',
        slug: { template: '{{title}}', editable: true },
      };
      mockEntryDraft.currentSlugs = { en: '' };
      mockEntryDraft.slugEditor = { en: true };

      expect(validateSlugs().valid).toBe(true);
      expect(getEntriesByCollection).not.toHaveBeenCalled();
    });

    it('should not report a duplicate when the value is only part of the slug', () => {
      vi.mocked(getEntriesByCollection).mockReturnValue([createEntry('1', { en: 'de' })]);
      mockEntryDraft.collection = { _type: 'entry', slug: '{{year}}-{{fields._slug}}' };
      mockEntryDraft.currentSlugs = { en: 'de' };
      mockEntryDraft.slugEditor = { en: true };

      expect(validateSlugs().valid).toBe(true);
    });
  });

  describe('validateSlugs for an existing entry', () => {
    beforeEach(() => {
      mockEntryDraft.isNew = false;
      mockEntryDraft.collection = { _type: 'entry' };
      mockEntryDraft.originalSlugs = { _: 'hello' };
      mockEntryDraft.slugEditor = { en: false };
    });

    it('should not validate a slug that hasn’t been edited', () => {
      mockEntryDraft.currentSlugs = { _: 'hello' };

      expect(validateSlugs().valid).toBe(true);
      expect(getEntriesByCollection).not.toHaveBeenCalled();
    });

    it('should validate an edited slug, which is always required', () => {
      mockEntryDraft.currentSlugs = { _: '' };
      expect(validateSlugs().validities._._slug.valueMissing).toBe(true);

      vi.mocked(getEntriesByCollection).mockReturnValue([createEntry('1', { en: 'world' })]);
      mockEntryDraft.currentSlugs = { _: 'world' };
      expect(validateSlugs().validities._._slug.duplicateError).toBe(true);

      mockEntryDraft.currentSlugs = { _: 'new-world' };
      expect(validateSlugs().valid).toBe(true);
    });

    it('should leave the folder of an entry stored as an index file to the path validation', () => {
      vi.mocked(getSharedEntryFileName).mockReturnValue('index');
      mockEntryDraft.currentSlugs = { _: 'guides/renamed/index' };

      expect(validateSlugs().valid).toBe(true);
    });

    it('should not validate a file collection’s entry', () => {
      mockEntryDraft.collection = { _type: 'file' };
      mockEntryDraft.currentSlugs = { _: '' };

      expect(validateSlugs().valid).toBe(true);
    });
  });
});
