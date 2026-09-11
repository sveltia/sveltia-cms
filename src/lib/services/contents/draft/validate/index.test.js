// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getField, isFieldMultiple, isFieldRequired } from '$lib/services/contents/entry/fields';

import { validateEntry as _validateEntry, validateDraft } from '.';

vi.mock('$lib/services/contents/entry/fields');
vi.mock('$lib/services/contents/fields/key-value/pairs');
vi.mock('$lib/services/contents/fields/list/helpers');
vi.mock('$lib/services/contents/fields/rich-text');
vi.mock('$lib/services/contents/fields/string/validate');
vi.mock('$lib/services/contents/draft/validate/messages', () => ({
  getFieldValidationMessages: vi.fn(() => []),
}));
vi.mock('$lib/services/common/template');
vi.mock('$lib/services/config');
vi.mock('$lib/services/utils/regex');
vi.mock('$lib/services/contents/draft/validate/required', () => ({
  isRequiredEnforced: vi.fn(() => true),
}));

describe('draft/validate', () => {
  let mockEntryDraft;
  /**
   * Validate the mock entry draft.
   * @param {object} [options] Options other than the draft.
   * @returns {boolean} Whether the draft is valid.
   */
  const validateEntry = (options = {}) => _validateEntry({ draft: mockEntryDraft, ...options });

  beforeEach(async () => {
    vi.clearAllMocks();

    mockEntryDraft = {
      collection: {
        name: 'posts',
        _type: 'entry',
        _i18n: {
          i18nEnabled: true,
          defaultLocale: 'en',
        },
      },
      collectionName: 'posts',
      fileName: undefined,
      collectionFile: undefined,
      files: {},
      isIndexFile: false,
      currentLocales: { en: true },
      currentValues: { en: {} },
      extraValues: { en: {} },
      currentSlugs: { en: 'test-post' },
      slugEditor: { en: false },
    };

    vi.mocked(isFieldRequired).mockReturnValue(false);
    vi.mocked(isFieldMultiple).mockReturnValue(false);

    // Mock validation functions
    const { validateStringField } = await import('$lib/services/contents/fields/string/validate');

    vi.mocked(validateStringField).mockReturnValue({ tooShort: false, tooLong: false });

    // Mock getListFieldInfo
    const { getListFieldInfo } = await import('$lib/services/contents/fields/list/helpers');

    vi.mocked(getListFieldInfo).mockReturnValue({ hasSubFields: false });
  });

  describe('validateEntry', () => {
    it('should validate entire entry and update draft', () => {
      mockEntryDraft.currentValues = { en: { title: 'Test Post' } };

      vi.mocked(getField).mockReturnValue({ name: 'title', widget: 'string' });

      const result = validateEntry();

      expect(result).toBe(true);
      expect(mockEntryDraft.validities.en.title.valid).toBe(true);
      expect(mockEntryDraft.validationMessages.en.title).toEqual([]);
    });

    it('should return false when validation fails', () => {
      mockEntryDraft.currentValues = { en: { title: '' } };

      vi.mocked(getField).mockReturnValue({ name: 'title', widget: 'string', required: true });
      vi.mocked(isFieldRequired).mockReturnValue(true);

      const result = validateEntry();

      expect(result).toBe(false);
    });

    it('should validate slugs when slug editor is shown', () => {
      mockEntryDraft.currentSlugs = { en: '' };
      mockEntryDraft.slugEditor = { en: true };
      mockEntryDraft.currentValues = { en: {} };

      vi.mocked(getField).mockReturnValue(undefined);

      const result = validateEntry();

      expect(result).toBe(false);
    });

    it('should not validate slug when slug editor is hidden', () => {
      mockEntryDraft.currentSlugs = { en: '' };
      mockEntryDraft.slugEditor = { en: false };
      mockEntryDraft.currentValues = { en: {} };

      vi.mocked(getField).mockReturnValue(undefined);

      const result = validateEntry();

      expect(result).toBe(true);
    });

    it('should validate both currentValues and extraValues', () => {
      mockEntryDraft.currentValues = { en: { title: 'Test' } };
      mockEntryDraft.extraValues = { en: { extra: '' } };

      let callCount = 0;

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        callCount += 1;

        if (keyPath === 'title') {
          return { name: 'title', widget: 'string' };
        }

        if (keyPath === 'extra') {
          return { name: 'extra', widget: 'string', required: true };
        }

        return undefined;
      });

      vi.mocked(isFieldRequired).mockImplementation(
        ({ fieldConfig }) => fieldConfig?.required ?? false,
      );

      const result = validateEntry();

      expect(result).toBe(false);
      expect(callCount).toBeGreaterThan(0);
    });

    it('should accept an empty required field when required fields are not enforced', () => {
      mockEntryDraft.currentValues = { en: { title: '' } };

      vi.mocked(getField).mockReturnValue({ name: 'title', widget: 'string', required: true });
      vi.mocked(isFieldRequired).mockReturnValue(true);

      expect(validateEntry({ enforceRequired: false })).toBe(true);
      expect(validateEntry()).toBe(false);
    });

    it('should still validate the slug when required fields are not enforced', () => {
      mockEntryDraft.currentSlugs = { en: '' };
      mockEntryDraft.slugEditor = { en: true };
      mockEntryDraft.currentValues = { en: {} };

      vi.mocked(getField).mockReturnValue(undefined);

      expect(validateEntry({ enforceRequired: false })).toBe(false);
    });
  });

  describe('validateDraft', () => {
    it('should validate a draft that is not open in the editor', () => {
      const otherDraft = {
        ...mockEntryDraft,
        currentValues: { en: { title: '' } },
        extraValues: { en: {} },
      };

      vi.mocked(getField).mockReturnValue({ name: 'title', widget: 'string', required: true });
      vi.mocked(isFieldRequired).mockReturnValue(true);

      const result = validateDraft({ draft: otherDraft });

      expect(result.valid).toBe(false);
      expect(result.validities.en.title.valueMissing).toBe(true);
      expect(result.validationMessages).toHaveProperty('en');
    });

    it('should not touch the draft', () => {
      const otherDraft = { ...mockEntryDraft, currentValues: { en: { title: 'Test Post' } } };

      vi.mocked(getField).mockReturnValue({ name: 'title', widget: 'string' });

      expect(validateDraft({ draft: otherDraft }).valid).toBe(true);
      expect(otherDraft.validities).toBeUndefined();
      expect(otherDraft.validationMessages).toBeUndefined();
    });

    it('should honour the `enforceRequired` option', () => {
      const otherDraft = { ...mockEntryDraft, currentValues: { en: { title: '' } } };

      vi.mocked(getField).mockReturnValue({ name: 'title', widget: 'string', required: true });
      vi.mocked(isFieldRequired).mockReturnValue(true);

      expect(validateDraft({ draft: otherDraft, enforceRequired: false }).valid).toBe(true);
    });
  });
});
