// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entryDraft } from '$lib/services/contents/draft';

import { validateSlugs } from './slugs';

vi.mock('$lib/services/contents/draft');
vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return {
    ...actual,
    get: vi.fn(() => ({ devModeEnabled: false })),
  };
});

describe('draft/validate/slugs', () => {
  let mockEntryDraft;
  let mockGet;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { get } = await import('svelte/store');

    mockGet = vi.mocked(get);

    mockEntryDraft = {
      currentLocales: { en: true },
      currentSlugs: { en: 'test-post' },
      slugEditor: { en: false },
    };

    mockGet.mockImplementation((store) => {
      if (store === entryDraft) {
        return mockEntryDraft;
      }

      return undefined;
    });
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
