// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entryDraft } from '$lib/services/contents/draft';
import { getField, isFieldMultiple, isFieldRequired } from '$lib/services/contents/entry/fields';

import { validateEntry, validateFields } from './validate';

vi.mock('$lib/services/contents/entry/fields');
vi.mock('$lib/services/contents/draft');
vi.mock('$lib/services/contents/widgets/key-value/helper');
vi.mock('$lib/services/contents/widgets/list/helper');
vi.mock('$lib/services/contents/widgets/markdown');
vi.mock('$lib/services/contents/widgets/string/validate');
vi.mock('$lib/services/common/template');
vi.mock('$lib/services/config');
vi.mock('$lib/services/utils/misc');
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

describe('draft/validate', () => {
  let mockEntryDraft;
  let mockGet;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { get } = await import('svelte/store');

    mockGet = vi.mocked(get);

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

    mockGet.mockImplementation((store) => {
      if (store === entryDraft) {
        return mockEntryDraft;
      }

      return undefined;
    });

    vi.mocked(isFieldRequired).mockReturnValue(false);
    vi.mocked(isFieldMultiple).mockReturnValue(false);

    // Mock validation functions
    const { validateStringField } = await import('$lib/services/contents/widgets/string/validate');
    const validateStringFieldMock = vi.mocked(validateStringField);

    validateStringFieldMock.mockReturnValue({
      tooShort: false,
      tooLong: false,
    });

    // Mock getListFieldInfo
    const { getListFieldInfo } = await import('$lib/services/contents/widgets/list/helper');
    const getListFieldInfoMock = vi.mocked(getListFieldInfo);

    getListFieldInfoMock.mockReturnValue({
      hasSubFields: false,
    });
  });

  describe('validateFields', () => {
    it('should validate all fields and return valid state', () => {
      mockEntryDraft.currentValues = {
        en: {
          title: 'Test Post',
          body: 'Content',
        },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'title',
        widget: 'string',
      });

      const result = validateFields('currentValues');

      expect(result.valid).toBe(true);
      expect(result.validities).toHaveProperty('en');
    });

    it('should mark required field as invalid when empty', () => {
      mockEntryDraft.currentValues = {
        en: {
          title: '',
        },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'title',
        widget: 'string',
        required: true,
      });

      vi.mocked(isFieldRequired).mockReturnValue(true);

      const result = validateFields('currentValues');

      expect(result.valid).toBe(false);
      expect(result.validities.en.title).toMatchObject({
        valueMissing: true,
      });
      // valid is a computed property from the Proxy
      expect(result.validities.en.title.valid).toBe(false);
    });

    it('should skip validation for disabled locales', () => {
      mockEntryDraft.currentLocales = { en: true, ja: false };
      mockEntryDraft.currentValues = {
        en: { title: 'Test' },
        ja: { title: '' },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'title',
        widget: 'string',
        required: true,
      });

      vi.mocked(isFieldRequired).mockReturnValue(true);

      const result = validateFields('currentValues');

      expect(result.validities.ja.title).toMatchObject({
        valid: true,
      });
    });

    it('should validate list field with minimum items', () => {
      mockEntryDraft.currentValues = {
        en: {
          tags: [],
          'tags.0': 'tag1',
        },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'tags',
        widget: 'list',
        min: 2,
      });

      const result = validateFields('currentValues');

      expect(result.valid).toBe(false);
      expect(result.validities.en.tags).toMatchObject({
        rangeUnderflow: true,
      });
      expect(result.validities.en.tags.valid).toBe(false);
    });

    it('should validate list field with maximum items', () => {
      mockEntryDraft.currentValues = {
        en: {
          'tags.0': 'tag1',
          'tags.1': 'tag2',
          'tags.2': 'tag3',
        },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'tags',
        widget: 'list',
        max: 2,
      });

      const result = validateFields('currentValues');

      expect(result.valid).toBe(false);
      expect(result.validities.en.tags).toMatchObject({
        rangeOverflow: true,
      });
      expect(result.validities.en.tags.valid).toBe(false);
    });

    it('should validate object field as required', () => {
      mockEntryDraft.currentValues = {
        en: {
          metadata: undefined, // Present but undefined
        },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'metadata',
        widget: 'object',
        required: true,
      });

      vi.mocked(isFieldRequired).mockReturnValue(true);

      const result = validateFields('currentValues');

      expect(result.valid).toBe(false);
      expect(result.validities.en.metadata).toMatchObject({
        valueMissing: true,
      });
      expect(result.validities.en.metadata.valid).toBe(false);
    });

    it('should skip validation for compute widget', () => {
      mockEntryDraft.currentValues = {
        en: {
          computed: '',
        },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'computed',
        widget: 'compute',
      });

      const result = validateFields('currentValues');

      expect(result.valid).toBe(true);
    });

    it('should handle fields with pattern validation', async () => {
      mockEntryDraft.currentValues = {
        en: {
          phone: '123',
        },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'phone',
        widget: 'string',
        pattern: ['^\\d{10}$', 'Must be 10 digits'],
      });

      const { getRegex } = await import('$lib/services/utils/misc');

      vi.mocked(getRegex).mockReturnValue(/^\d{10}$/);

      const result = validateFields('currentValues');

      expect(result.valid).toBe(false);
      expect(result.validities.en.phone).toMatchObject({
        patternMismatch: true,
      });
      expect(result.validities.en.phone.valid).toBe(false);
    });

    it('should skip validation for non-editable i18n fields', () => {
      mockEntryDraft.currentLocales = { en: true, ja: true };
      mockEntryDraft.currentValues = {
        en: { title: 'Test' },
        ja: { title: '' },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'title',
        widget: 'string',
        i18n: 'duplicate',
        required: true,
      });

      vi.mocked(isFieldRequired).mockReturnValue(false);

      const result = validateFields('currentValues');

      // Japanese locale should not be validated
      expect(result.validities.ja.title).toBeUndefined();
    });
  });

  describe('validateEntry', () => {
    it('should validate entire entry and update draft', () => {
      const mockUpdate = vi.fn((fn) => fn(mockEntryDraft));

      vi.mocked(entryDraft).update = mockUpdate;

      mockEntryDraft.currentValues = {
        en: {
          title: 'Test Post',
        },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'title',
        widget: 'string',
      });

      const result = validateEntry();

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should return false when validation fails', () => {
      const mockUpdate = vi.fn((fn) => fn(mockEntryDraft));

      vi.mocked(entryDraft).update = mockUpdate;

      mockEntryDraft.currentValues = {
        en: {
          title: '',
        },
      };

      vi.mocked(getField).mockReturnValue({
        name: 'title',
        widget: 'string',
        required: true,
      });

      vi.mocked(isFieldRequired).mockReturnValue(true);

      const result = validateEntry();

      expect(result).toBe(false);
    });

    it('should validate slugs when slug editor is shown', () => {
      const mockUpdate = vi.fn((fn) => fn(mockEntryDraft));

      vi.mocked(entryDraft).update = mockUpdate;

      mockEntryDraft.currentSlugs = { en: '' };
      mockEntryDraft.slugEditor = { en: true };
      mockEntryDraft.currentValues = { en: {} };

      vi.mocked(getField).mockReturnValue(undefined);

      const result = validateEntry();

      expect(result).toBe(false);
    });

    it('should not validate slug when slug editor is hidden', () => {
      const mockUpdate = vi.fn((fn) => fn(mockEntryDraft));

      vi.mocked(entryDraft).update = mockUpdate;

      mockEntryDraft.currentSlugs = { en: '' };
      mockEntryDraft.slugEditor = { en: false };
      mockEntryDraft.currentValues = { en: {} };

      vi.mocked(getField).mockReturnValue(undefined);

      const result = validateEntry();

      expect(result).toBe(true);
    });

    it('should validate both currentValues and extraValues', () => {
      const mockUpdate = vi.fn((fn) => fn(mockEntryDraft));

      vi.mocked(entryDraft).update = mockUpdate;

      mockEntryDraft.currentValues = {
        en: { title: 'Test' },
      };

      mockEntryDraft.extraValues = {
        en: { extra: '' },
      };

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
  });
});
