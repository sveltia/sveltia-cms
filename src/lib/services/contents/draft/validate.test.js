// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entryDraft } from '$lib/services/contents/draft';
import { getField, isFieldMultiple, isFieldRequired } from '$lib/services/contents/entry/fields';
import { getPairs } from '$lib/services/contents/fields/key-value/helper';

import {
  DEFAULT_VALIDITY,
  LIST_KEY_PATH_REGEX,
  validateAnyField,
  validateEntry,
  validateField,
  validateFields,
  validateList,
  validateSlugs,
  validityProxyHandler,
} from './validate';

vi.mock('$lib/services/contents/entry/fields');
vi.mock('$lib/services/contents/draft');
vi.mock('$lib/services/contents/fields/key-value/helper');
vi.mock('$lib/services/contents/fields/list/helper');
vi.mock('$lib/services/contents/fields/rich-text');
vi.mock('$lib/services/contents/fields/string/validate');
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
    const { validateStringField } = await import('$lib/services/contents/fields/string/validate');
    const validateStringFieldMock = vi.mocked(validateStringField);

    validateStringFieldMock.mockReturnValue({
      tooShort: false,
      tooLong: false,
    });

    // Mock getListFieldInfo
    const { getListFieldInfo } = await import('$lib/services/contents/fields/list/helper');
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

    it('should skip validation for compute field', () => {
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

    it('should skip fields when getField returns undefined', () => {
      mockEntryDraft.currentValues = {
        en: {
          title: 'Test',
          unknown: 'value',
        },
      };

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'title') {
          return { name: 'title', widget: 'string' };
        }

        // Return undefined for unknown field
        return undefined;
      });

      const result = validateFields('currentValues');

      // Title should be validated
      expect(result.validities.en.title).toBeDefined();
      // Unknown field should be skipped (not in validities)
      expect(result.validities.en.unknown).toBeUndefined();
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

  describe('Internal helpers (exported for testing)', () => {
    describe('LIST_KEY_PATH_REGEX', () => {
      it('should match list key paths', () => {
        expect(LIST_KEY_PATH_REGEX.test('field.0')).toBe(true);
        expect(LIST_KEY_PATH_REGEX.test('field.1')).toBe(true);
        expect(LIST_KEY_PATH_REGEX.test('field.999')).toBe(true);
        expect(LIST_KEY_PATH_REGEX.test('nested.field.0')).toBe(true);
      });

      it('should not match non-list key paths', () => {
        expect(LIST_KEY_PATH_REGEX.test('field')).toBe(false);
        expect(LIST_KEY_PATH_REGEX.test('field.name')).toBe(false);
        expect(LIST_KEY_PATH_REGEX.test('field.0.subfield')).toBe(false);
      });
    });

    describe('DEFAULT_VALIDITY', () => {
      it('should have all validity flags set to false', () => {
        expect(DEFAULT_VALIDITY).toEqual({
          valueMissing: false,
          tooShort: false,
          tooLong: false,
          rangeUnderflow: false,
          rangeOverflow: false,
          patternMismatch: false,
          typeMismatch: false,
        });
      });

      it('should be a new object each time (not mutated)', () => {
        const copy1 = { ...DEFAULT_VALIDITY };
        const copy2 = { ...DEFAULT_VALIDITY };

        expect(copy1).toEqual(copy2);
        copy1.valueMissing = true;
        expect(copy2.valueMissing).toBe(false);
      });
    });

    describe('validityProxyHandler', () => {
      it('should add a valid property that reflects all other properties', () => {
        const validity1 = new Proxy({ ...DEFAULT_VALIDITY }, validityProxyHandler);

        expect(validity1.valid).toBe(true);

        const validity2 = new Proxy(
          { ...DEFAULT_VALIDITY, valueMissing: true },
          validityProxyHandler,
        );

        expect(validity2.valid).toBe(false);
      });

      it('should return false if any validity flag is true', () => {
        const validity = new Proxy(
          {
            valueMissing: false,
            tooShort: false,
            tooLong: true,
            rangeUnderflow: false,
            rangeOverflow: false,
            patternMismatch: false,
            typeMismatch: false,
          },
          validityProxyHandler,
        );

        expect(validity.valid).toBe(false);
      });

      it('should pass through other property accesses', () => {
        const validity = new Proxy(
          { ...DEFAULT_VALIDITY, valueMissing: true },
          validityProxyHandler,
        );

        expect(validity.valueMissing).toBe(true);
        expect(validity.tooShort).toBe(false);
      });
    });

    describe('validateField', () => {
      it('should validate field and update validities', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'title',
          valueMap: { title: 'Test' },
          value: 'Test',
        };

        vi.mocked(getField).mockReturnValue({ name: 'title', widget: 'string' });

        const valid = validateField(args);

        expect(valid).toBe(true);
        expect(validities.en.title).toBeDefined();
        expect(validities.en.title.valid).toBe(true);
      });

      it('should return false when field is invalid', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'title',
          valueMap: { title: '' },
          value: '',
        };

        vi.mocked(getField).mockReturnValue({ name: 'title', widget: 'string', required: true });
        vi.mocked(isFieldRequired).mockReturnValue(true);

        const valid = validateField(args);

        expect(valid).toBe(false);
        expect(validities.en.title.valueMissing).toBe(true);
      });
    });

    describe('validateList', () => {
      it('should validate simple list without validating items', async () => {
        const validities = { en: {} };
        const fieldConfig = { name: 'tags', widget: 'list', field: { widget: 'string' } };

        const validateArgs = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'tags',
          valueMap: { 'tags.0': 'tag1', 'tags.1': 'tag2' },
          value: '',
        };

        const { getListFieldInfo } = vi.mocked(
          await import('$lib/services/contents/fields/list/helper'),
        );

        getListFieldInfo.mockReturnValue({ hasSubFields: false });
        vi.mocked(getField).mockReturnValue(fieldConfig);

        const result = validateList({ fieldConfig, validateArgs });

        expect(result.validateItems).toBe(false);
        expect(result.valid).toBe(true);
      });

      it('should validate list with subfields and request item validation', async () => {
        const validities = { en: {} };

        const fieldConfig = {
          name: 'items',
          widget: 'list',
          fields: [{ name: 'title', widget: 'string' }],
        };

        const validateArgs = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'items',
          valueMap: { 'items.0.title': 'Item 1' },
          value: '',
        };

        const { getListFieldInfo } = vi.mocked(
          await import('$lib/services/contents/fields/list/helper'),
        );

        getListFieldInfo.mockReturnValue({ hasSubFields: true });
        vi.mocked(getField).mockReturnValue(fieldConfig);

        const result = validateList({ fieldConfig, validateArgs });

        expect(result.validateItems).toBe(true);
      });

      it('should handle multiple field without validating items', () => {
        const validities = { en: {} };
        const fieldConfig = { name: 'categories', widget: 'string', multiple: true };

        const validateArgs = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'categories',
          valueMap: { 'categories.0': 'cat1', 'categories.1': 'cat2' },
          value: '',
        };

        vi.mocked(getField).mockReturnValue(fieldConfig);
        vi.mocked(isFieldMultiple).mockReturnValue(true);

        const result = validateList({ fieldConfig, validateArgs });

        expect(result.validateItems).toBe(false);
      });
    });

    describe('validateSlugs', () => {
      it('should return valid when slug editors are not shown', () => {
        mockEntryDraft.currentSlugs = { en: 'test-post', fr: 'test-article' };
        mockEntryDraft.slugEditor = { en: false, fr: false };

        const result = validateSlugs();

        expect(result.valid).toBe(true);
        expect(result.validities.en._slug.valid).toBe(true);
        expect(result.validities.fr._slug.valid).toBe(true);
      });

      it('should return invalid when slug is empty and editor is shown', () => {
        mockEntryDraft.currentSlugs = { en: '', fr: 'test-article' };
        mockEntryDraft.slugEditor = { en: true, fr: false };

        const result = validateSlugs();

        expect(result.valid).toBe(false);
        expect(result.validities.en._slug.valid).toBe(false);
        expect(result.validities.en._slug.valueMissing).toBe(true);
        expect(result.validities.fr._slug.valid).toBe(true);
      });

      it('should trim slug before validation', () => {
        mockEntryDraft.currentSlugs = { en: '   ', fr: 'test' };
        mockEntryDraft.slugEditor = { en: true, fr: true };

        const result = validateSlugs();

        expect(result.valid).toBe(false);
        expect(result.validities.en._slug.valueMissing).toBe(true);
        expect(result.validities.fr._slug.valueMissing).toBe(false);
      });
    });

    describe('validateAnyField', () => {
      it('should skip validation for non-editable fields in non-default locales', () => {
        const validities = { fr: {} };

        const args = {
          draft: {
            ...mockEntryDraft,
            collection: {
              ...mockEntryDraft.collection,
              _i18n: { i18nEnabled: true, defaultLocale: 'en' },
            },
          },
          validities,
          locale: 'fr',
          keyPath: 'title',
          valueMap: { title: 'Test' },
          value: 'Test',
        };

        vi.mocked(getField).mockReturnValue({ name: 'title', widget: 'string', i18n: 'none' });

        const result = validateAnyField(args);

        expect(result).toBeUndefined();
      });

      it('should validate required string field', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'title',
          valueMap: { title: '' },
          value: '',
        };

        vi.mocked(getField).mockReturnValue({ name: 'title', widget: 'string', required: true });
        vi.mocked(isFieldRequired).mockReturnValue(true);

        const result = validateAnyField(args);

        expect(result).toBeDefined();
        expect(result.valueMissing).toBe(true);
        expect(result.valid).toBe(false);
      });

      it('should validate email field with type mismatch', async () => {
        // Override the beforeEach mock for this specific test
        const { validateStringField } =
          await import('$lib/services/contents/fields/string/validate');

        const validateStringFieldMock = vi.mocked(validateStringField);

        validateStringFieldMock.mockReturnValueOnce({
          count: 14,
          hasMin: undefined,
          hasMax: undefined,
          invalid: false,
          validity: {
            tooShort: false,
            tooLong: false,
            typeMismatch: true,
          },
        });

        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'email',
          valueMap: { email: 'invalid-email' },
          value: 'invalid-email',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'email',
          widget: 'string',
          type: 'email',
        });

        const result = validateAnyField(args);

        expect(result).toBeDefined();
        expect(result.typeMismatch).toBe(true);
      });

      it('should validate number field with range constraints', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'age',
          valueMap: { age: 5 },
          value: 5,
        };

        vi.mocked(getField).mockReturnValue({
          name: 'age',
          widget: 'number',
          min: 10,
          max: 100,
        });

        const result = validateAnyField(args);

        expect(result).toBeDefined();
        expect(result.rangeUnderflow).toBe(true);
      });

      it('should validate required number field (int) with null value', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'count',
          valueMap: { count: null },
          value: null,
        };

        vi.mocked(getField).mockReturnValue({
          name: 'count',
          widget: 'number',
          value_type: 'int',
        });

        vi.mocked(isFieldRequired).mockReturnValue(true);

        const result = validateAnyField(args);

        expect(result).toBeDefined();
        expect(result.typeMismatch).toBe(true);
      });

      it('should validate required number field (float) with null value', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'price',
          valueMap: { price: null },
          value: null,
        };

        vi.mocked(getField).mockReturnValue({
          name: 'price',
          widget: 'number',
          value_type: 'float',
        });

        vi.mocked(isFieldRequired).mockReturnValue(true);

        const result = validateAnyField(args);

        expect(result).toBeDefined();
        expect(result.typeMismatch).toBe(true);
      });

      it('should validate number field with range overflow', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'age',
          valueMap: { age: 150 },
          value: 150,
        };

        vi.mocked(getField).mockReturnValue({
          name: 'age',
          widget: 'number',
          min: 10,
          max: 100,
        });

        const result = validateAnyField(args);

        expect(result).toBeDefined();
        expect(result.rangeOverflow).toBe(true);
      });

      it('should validate code field with output_code_only true', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'code.code',
          valueMap: { 'code.code': 'console.log("test");', 'code.lang': 'javascript' },
          value: 'console.log("test");',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'code',
          widget: 'code',
          output_code_only: true,
          keys: { code: 'code', lang: 'lang' },
        });

        const result = validateAnyField(args);

        expect(result).toBeDefined();
      });

      it('should validate code field with custom output keys', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'editor.source',
          valueMap: { 'editor.source': 'code here', 'editor.language': 'python' },
          value: 'code here',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'editor',
          widget: 'code',
          keys: { code: 'source', lang: 'language' },
        });

        const result = validateAnyField(args);

        expect(result).toBeDefined();
      });

      it('should validate media field with blob URL', () => {
        const validities = { en: {} };

        mockEntryDraft.files = {
          'blob:http://localhost/123': {
            file: { name: 'image.jpg' },
            folder: undefined,
          },
        };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'image',
          valueMap: { image: 'blob:http://localhost/123' },
          value: 'blob:http://localhost/123',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'image',
          widget: 'image',
        });

        const result = validateAnyField(args);

        expect(result).toBeDefined();
      });

      it('should validate code field with custom output keys', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'editor.source',
          valueMap: { 'editor.source': 'code here', 'editor.language': 'python' },
          value: 'code here',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'editor',
          widget: 'code',
          keys: { code: 'source', lang: 'language' },
        });

        const result = validateAnyField(args);

        expect(result).toBeDefined();
      });

      it('should validate required string field without value', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'title',
          valueMap: { title: '' },
          value: '',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'title',
          widget: 'string',
        });

        vi.mocked(isFieldRequired).mockReturnValue(true);

        const result = validateAnyField(args);

        expect(result).toBeDefined();
        expect(result.valueMissing).toBe(true);
      });

      it('should skip validation when field is within rich text and not default locale', () => {
        mockEntryDraft.currentLocales = { en: true, ja: true };
        mockEntryDraft.collection._i18n.defaultLocale = 'en';

        const validities = { en: {}, ja: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'ja',
          keyPath: '_richtext_component.field',
          componentName: '_richtext_component',
          valueMap: { '_richtext_component.field': 'value' },
          value: 'value',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'field',
          widget: 'string',
          i18n: false,
        });

        const result = validateAnyField(args);

        // Component fields skip the i18n check, so result should be defined
        expect(result).toBeDefined();
      });

      it('should skip validation when field config is not found', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'unknown',
          valueMap: { unknown: 'value' },
          value: 'value',
        };

        vi.mocked(getField).mockReturnValue(undefined);

        const result = validateAnyField(args);

        expect(result).toBeUndefined();
      });

      it('should handle non-editable i18n fields without default locale', () => {
        mockEntryDraft.currentLocales = { en: true, ja: true };

        const validities = { en: {}, ja: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'ja',
          keyPath: 'title',
          valueMap: { title: '' },
          value: '',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'title',
          widget: 'string',
          i18n: false,
        });

        vi.mocked(isFieldRequired).mockReturnValue(false);

        const result = validateAnyField(args);

        expect(result).toBeUndefined();
      });

      it('should validate field inside rich text component', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: '_component_name.title',
          componentName: '_component_name',
          valueMap: { '_component_name.title': 'Component Title' },
          value: 'Component Title',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'title',
          widget: 'string',
          i18n: false,
        });

        vi.mocked(isFieldRequired).mockReturnValue(false);

        const result = validateAnyField(args);

        expect(result).toBeDefined();
      });

      it('should validate keyvalue field with required validation', () => {
        const validities = { en: {} };
        const pairs = [{ key: 'key1', value: 'value1' }];

        mockEntryDraft.currentValues = { en: { metadata: { key1: 'value1' } } };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'metadata.key1',
          valueMap: { 'metadata.key1': 'value1' },
          value: 'value1',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'metadata',
          widget: 'keyvalue',
          required: true,
        });

        vi.mocked(isFieldRequired).mockReturnValue(true);

        vi.mocked(getPairs).mockReturnValue(pairs);

        const result = validateAnyField(args);

        expect(result).toBeDefined();
        expect(result?.valueMissing).toBe(false);
      });

      it('should validate empty keyvalue field as required', () => {
        const validities = { en: {} };

        mockEntryDraft.currentValues = { en: { metadata: {} } };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'metadata.key1',
          valueMap: { 'metadata.key1': '' },
          value: '',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'metadata',
          widget: 'keyvalue',
          required: true,
        });

        vi.mocked(isFieldRequired).mockReturnValue(true);

        vi.mocked(getPairs).mockReturnValue([]);

        const result = validateAnyField(args);

        expect(result).toBeDefined();
        expect(result?.valueMissing).toBe(true);
      });

      it('should validate code field with output_code_only=true', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'snippet.code',
          valueMap: { 'snippet.code': 'const x = 1;', 'snippet.lang': 'javascript' },
          value: 'const x = 1;',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'snippet',
          widget: 'code',
          output_code_only: true,
          keys: { code: 'code', lang: 'lang' },
        });

        vi.mocked(isFieldRequired).mockReturnValue(false);

        const result = validateAnyField(args);

        expect(result).toBeDefined();
      });

      it('should validate code field with custom output keys', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'snippet.source',
          valueMap: { 'snippet.source': 'console.log("test");', 'snippet.language': 'javascript' },
          value: 'console.log("test");',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'snippet',
          widget: 'code',
          output_code_only: false,
          keys: { code: 'source', lang: 'language' },
        });

        vi.mocked(isFieldRequired).mockReturnValue(false);

        const result = validateAnyField(args);

        expect(result).toBeDefined();
      });

      it('should extract keypath correctly from keyvalue nested fields', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'settings.value1',
          valueMap: { 'settings.value1': 'test' },
          value: 'test',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'settings',
          widget: 'keyvalue',
        });

        vi.mocked(isFieldRequired).mockReturnValue(false);

        vi.mocked(getPairs).mockReturnValue([]);

        // This should skip early return when keyvalue path is already validated
        const result = validateAnyField(args);

        expect(result).toBeDefined();
      });

      it('should handle media field with blob URL for file name extraction', () => {
        const validities = { en: {} };

        mockEntryDraft.files = {
          'blob:http://localhost/image123': {
            file: new File(['image content'], 'test-image.jpg'),
            folder: undefined,
          },
        };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'image',
          valueMap: { image: 'blob:http://localhost/image123' },
          value: 'blob:http://localhost/image123',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'image',
          widget: 'image',
        });

        vi.mocked(isFieldRequired).mockReturnValue(false);

        const result = validateAnyField(args);

        expect(result).toBeDefined();
      });

      it('should return undefined for list field when keyPath is already in validities (line 138)', () => {
        // Pre-populate validities with the keyPath so the early-return fires
        const validities = { en: { tags: { rangeOverflow: false } } };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'tags',
          valueMap: { 'tags.0': 'a', 'tags.1': 'b' },
          value: '',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'tags',
          widget: 'list',
        });

        vi.mocked(isFieldRequired).mockReturnValue(false);

        const result = validateAnyField(args);

        expect(result).toBeUndefined();
      });

      it('should set valueMissing for required list field with no items (line 154)', () => {
        const validities = { en: {} };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'tags',
          valueMap: {},
          value: [],
        };

        vi.mocked(getField).mockReturnValue({
          name: 'tags',
          widget: 'list',
        });

        vi.mocked(isFieldRequired).mockReturnValue(true);

        const result = validateAnyField(args);

        expect(result).toBeDefined();
        expect(result?.valueMissing).toBe(true);
      });

      it('should return undefined for keyvalue field when keyPath already in validities (line 180)', () => {
        // Pre-populate with _keyPath so the early return at the keyvalue branch fires
        const validities = { en: { settings: {} } };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'settings.key1',
          valueMap: { 'settings.key1': 'val' },
          value: 'val',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'settings',
          widget: 'keyvalue',
        });

        vi.mocked(isFieldRequired).mockReturnValue(false);

        const result = validateAnyField(args);

        expect(result).toBeUndefined();
      });

      it('should return undefined for code field when keyPath already in validities (line 210)', () => {
        // Pre-populate with the parent keyPath so the early return in the code branch fires
        const validities = { en: { snippet: {} } };

        const args = {
          draft: mockEntryDraft,
          validities,
          locale: 'en',
          keyPath: 'snippet.code',
          valueMap: { 'snippet.code': 'const x = 1;', 'snippet.lang': 'js' },
          value: 'const x = 1;',
        };

        vi.mocked(getField).mockReturnValue({
          name: 'snippet',
          widget: 'code',
          output_code_only: true,
          keys: { code: 'code', lang: 'lang' },
        });

        vi.mocked(isFieldRequired).mockReturnValue(false);

        const result = validateAnyField(args);

        expect(result).toBeUndefined();
      });
    });
  });
});
