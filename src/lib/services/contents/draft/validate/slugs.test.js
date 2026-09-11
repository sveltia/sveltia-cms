// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { validateSlugs as _validateSlugs } from './slugs';

describe('draft/validate/slugs', () => {
  let mockEntryDraft;
  /**
   * Validate the mock entry draft’s slugs.
   * @returns {object} Validation results.
   */
  const validateSlugs = () => _validateSlugs(mockEntryDraft);

  beforeEach(async () => {
    vi.clearAllMocks();

    mockEntryDraft = {
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
});
