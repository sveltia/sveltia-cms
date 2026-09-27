/* eslint-disable jsdoc/require-param-description */
/* eslint-disable jsdoc/require-returns-description */

import { describe, expect, it, vi } from 'vitest';

import { getField } from '$lib/services/contents/entry/fields';
import { parseDateTimeConfig } from '$lib/services/contents/fields/date-time/config';

import {
  getFieldValidationMessages,
  getInvalidFields,
  getPathValidationMessages,
} from './messages';

/** @type {(key: string, opts?: any) => string} */
const t = vi.hoisted(
  () => (key, opts) => (opts?.values ? `${key}(${JSON.stringify(opts.values)})` : key),
);

vi.mock('@sveltia/i18n', () => ({
  _: t,
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(),
  isFieldMultiple: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/fields/date-time/config', () => ({
  parseDateTimeConfig: vi.fn(),
}));

vi.mock('$lib/services/contents/fields/date-time/validate', () => ({
  getFormattedDateTime: vi.fn((type, value) => `formatted:${type}:${value}`),
}));

describe('getFieldValidationMessages', () => {
  /**
   * Build default args with all required fields, overridable per test.
   * @param {Partial<Parameters<typeof getFieldValidationMessages>[0]>} overrides
   * @returns {Parameters<typeof getFieldValidationMessages>[0]}
   */
  const args = (overrides = {}) => ({
    validity: {},
    fieldConfig: { name: 'field', widget: 'string' },
    ...overrides,
  });

  it('returns an empty array when all validity flags are false/absent', () => {
    expect(getFieldValidationMessages(args())).toEqual([]);
  });

  describe('valueMissing', () => {
    it('returns value_missing message', () => {
      expect(getFieldValidationMessages(args({ validity: { valueMissing: true } }))).toEqual([
        'validation.value_missing',
      ]);
    });
  });

  describe('tooShort', () => {
    it('returns singular message when minlength is 1', () => {
      const messages = getFieldValidationMessages(
        args({
          validity: { tooShort: true },
          fieldConfig: { name: 'f', widget: 'string', minlength: 1 },
        }),
      );

      expect(messages).toEqual(['validation.too_short({"min":1})']);
    });

    it('returns plural message when minlength > 1', () => {
      const messages = getFieldValidationMessages(
        args({
          validity: { tooShort: true },
          fieldConfig: { name: 'f', widget: 'string', minlength: 5 },
        }),
      );

      expect(messages).toEqual(['validation.too_short({"min":5})']);
    });
  });

  describe('tooLong', () => {
    it('returns singular message when maxlength is 1', () => {
      const messages = getFieldValidationMessages(
        args({
          validity: { tooLong: true },
          fieldConfig: { name: 'f', widget: 'string', maxlength: 1 },
        }),
      );

      expect(messages).toEqual(['validation.too_long({"max":1})']);
    });

    it('returns plural message when maxlength > 1', () => {
      const messages = getFieldValidationMessages(
        args({
          validity: { tooLong: true },
          fieldConfig: { name: 'f', widget: 'string', maxlength: 100 },
        }),
      );

      expect(messages).toEqual(['validation.too_long({"max":100})']);
    });
  });

  describe('rangeUnderflow', () => {
    it('formats datetime min value via getFormattedDateTime', () => {
      vi.mocked(parseDateTimeConfig).mockReturnValueOnce(
        /** @type {any} */ ({ type: 'date', min: '2024-01-01', max: undefined }),
      );

      const messages = getFieldValidationMessages(
        args({
          validity: { rangeUnderflow: true },
          fieldConfig: { name: 'f', widget: 'datetime' },
        }),
      );

      expect(messages).toEqual([
        'validation.range_underflow.date({"min":"formatted:date:2024-01-01"})',
      ]);
    });

    it('returns number message for number fields', () => {
      const messages = getFieldValidationMessages(
        args({
          validity: { rangeUnderflow: true },
          fieldConfig: { name: 'f', widget: 'number', min: 5 },
        }),
      );

      expect(messages).toEqual(['validation.range_underflow.number({"min":5})']);
    });

    it('returns add_many message when canAddMultiValue and min != 1', () => {
      const messages = getFieldValidationMessages(
        args({
          validity: { rangeUnderflow: true },
          fieldConfig: { name: 'f', widget: 'list', min: 2 },
        }),
      );

      expect(messages).toEqual(['validation.range_underflow.add({"min":2})']);
    });

    it('returns add_one message when canAddMultiValue and min === 1', () => {
      const messages = getFieldValidationMessages(
        args({
          validity: { rangeUnderflow: true },
          fieldConfig: { name: 'f', widget: 'list', min: 1 },
        }),
      );

      expect(messages).toEqual(['validation.range_underflow.add({"min":1})']);
    });

    it('returns select_many message when !canAddMultiValue and min != 1', () => {
      const messages = getFieldValidationMessages(
        args({
          validity: { rangeUnderflow: true },
          fieldConfig: { name: 'f', widget: 'select', min: 3 },
        }),
      );

      expect(messages).toEqual(['validation.range_underflow.select({"min":3})']);
    });

    it('returns select_one message when !canAddMultiValue and min === 1', () => {
      const messages = getFieldValidationMessages(
        args({
          validity: { rangeUnderflow: true },
          fieldConfig: { name: 'f', widget: 'select', min: 1 },
        }),
      );

      expect(messages).toEqual(['validation.range_underflow.select({"min":1})']);
    });
  });

  describe('rangeOverflow', () => {
    it('formats datetime max value via getFormattedDateTime', () => {
      vi.mocked(parseDateTimeConfig).mockReturnValueOnce(
        /** @type {any} */ ({ type: 'datetime-local', min: undefined, max: '2024-12-31T23:59' }),
      );

      const messages = getFieldValidationMessages(
        args({
          validity: { rangeOverflow: true },
          fieldConfig: { name: 'f', widget: 'datetime' },
        }),
      );

      expect(messages).toEqual([
        'validation.range_overflow.datetime-local({"max":"formatted:datetime-local:2024-12-31T23:59"})',
      ]);
    });

    it('returns number message for number fields', () => {
      const messages = getFieldValidationMessages(
        args({
          validity: { rangeOverflow: true },
          fieldConfig: { name: 'f', widget: 'number', max: 10 },
        }),
      );

      expect(messages).toEqual(['validation.range_overflow.number({"max":10})']);
    });

    it('returns add_many message when canAddMultiValue and max != 1', () => {
      const messages = getFieldValidationMessages(
        args({
          validity: { rangeOverflow: true },
          fieldConfig: { name: 'f', widget: 'list', max: 5 },
        }),
      );

      expect(messages).toEqual(['validation.range_overflow.add({"max":5})']);
    });

    it('returns select_one message when !canAddMultiValue and max === 1', () => {
      const messages = getFieldValidationMessages(
        args({
          validity: { rangeOverflow: true },
          fieldConfig: { name: 'f', widget: 'select', max: 1 },
        }),
      );

      expect(messages).toEqual(['validation.range_overflow.select({"max":1})']);
    });
  });

  describe('patternMismatch', () => {
    it('returns the user-facing pattern error (pattern[1])', () => {
      const messages = getFieldValidationMessages(
        args({
          validity: { patternMismatch: true },
          fieldConfig: { name: 'f', widget: 'string', pattern: ['^\\d+$', 'Must be a number'] },
        }),
      );

      expect(messages).toEqual(['Must be a number']);
    });
  });

  describe('typeMismatch', () => {
    it('returns type_mismatch message with the derived type', () => {
      const messages = getFieldValidationMessages(
        args({
          validity: { typeMismatch: true },
          fieldConfig: { name: 'f', widget: 'string', type: 'url' },
        }),
      );

      expect(messages).toEqual(['validation.type_mismatch.url']);
    });
  });

  describe('customError', () => {
    it('falls back to the default custom error message when no custom message is provided', () => {
      const messages = getFieldValidationMessages(
        args({
          validity: { customError: true },
          fieldConfig: { name: 'f', widget: 'string' },
        }),
      );

      expect(messages).toEqual(['validation.invalid_value']);
    });
  });

  describe('multiple errors', () => {
    it('collects messages for all violated constraints in order', () => {
      const messages = getFieldValidationMessages(
        args({
          validity: { valueMissing: true, typeMismatch: true },
          fieldConfig: { name: 'f', widget: 'string', type: 'email' },
        }),
      );

      expect(messages).toEqual(['validation.value_missing', 'validation.type_mismatch.email']);
    });
  });
});

describe('getPathValidationMessages', () => {
  it('returns nothing without an error', () => {
    expect(getPathValidationMessages(undefined)).toEqual([]);
    expect(getPathValidationMessages({ valid: true })).toEqual([]);
  });

  it('returns a message for each error', () => {
    expect(getPathValidationMessages({ valid: false, patternMismatch: true })).toEqual([
      'edit_path_error.invalid',
    ]);
    expect(getPathValidationMessages({ valid: false, customError: true })).toEqual([
      'edit_path_error.recursive',
    ]);
    expect(
      getPathValidationMessages({ valid: false, customError: true, duplicateError: true }),
    ).toEqual(['edit_path_error.recursive', 'edit_path_error.duplicate']);
  });
});

describe('getInvalidFields', () => {
  /**
   * Build a draft with the given values and validation messages.
   * @param {Record<string, any>} overrides
   * @returns {any}
   */
  const createDraft = (overrides = {}) => ({
    collectionName: 'posts',
    fileName: undefined,
    isIndexFile: false,
    currentValues: {},
    extraValues: {},
    validationMessages: {},
    ...overrides,
  });

  it('lists the fields with messages in order, skipping the valid ones', () => {
    vi.mocked(getField).mockImplementation(
      ({ keyPath }) =>
        /** @type {any} */ ({
          title: { name: 'title', widget: 'string', label: 'Title' },
          tags: { name: 'tags', widget: 'list' },
        })[keyPath.split('.')[0]],
    );

    const currentValues = { en: { title: '', 'tags.0': 'a', 'tags.1': 'b', note: '' } };

    const draft = createDraft({
      currentValues,
      validationMessages: {
        en: {
          title: ['Required'],
          // List-level validity is keyed by the list, whose values are stored as items
          tags: ['Too many'],
          'tags.0': [],
          'tags.1': ['Too long'],
          note: [],
        },
      },
    });

    expect(getInvalidFields({ draft, locale: 'en' })).toEqual([
      { keyPath: 'title', label: 'Title', messages: ['Required'] },
      { keyPath: 'tags', label: 'tags', messages: ['Too many'] },
      { keyPath: 'tags.1', label: 'tags', messages: ['Too long'] },
    ]);
    expect(getField).toHaveBeenCalledWith({
      collectionName: 'posts',
      fileName: undefined,
      isIndexFile: false,
      componentName: undefined,
      keyPath: 'tags',
      valueMap: currentValues.en,
    });
  });

  it('looks up a rich text editor component field in the component definition', () => {
    vi.mocked(getField).mockImplementation(({ componentName, keyPath }) =>
      componentName === 'youtube' && keyPath === 'id'
        ? /** @type {any} */ ({ name: 'id', widget: 'string', label: 'Video ID' })
        : undefined,
    );

    const extraValues = { en: { 'body:c40:__sc_component_name': 'youtube', 'body:c40:id': '' } };

    const draft = createDraft({
      fileName: 'about',
      isIndexFile: true,
      currentValues: { en: { body: '' } },
      extraValues,
      validationMessages: { en: { body: [], 'body:c40:id': ['Required'] } },
    });

    expect(getInvalidFields({ draft, locale: 'en' })).toEqual([
      { keyPath: 'body:c40:id', label: 'Video ID', messages: ['Required'] },
    ]);
    expect(getField).toHaveBeenCalledExactlyOnceWith({
      collectionName: 'posts',
      fileName: 'about',
      isIndexFile: true,
      componentName: 'youtube',
      keyPath: 'id',
      valueMap: extraValues.en,
    });
  });

  it('gives an empty label to a field that cannot be found', () => {
    vi.mocked(getField).mockReturnValue(undefined);

    const draft = createDraft({
      currentValues: { en: { stray: 'x' } },
      extraValues: { en: { 'body:c1:x': '' } },
      validationMessages: { en: { stray: ['Invalid'], 'body:c1:x': ['Invalid'] } },
    });

    expect(getInvalidFields({ draft, locale: 'en' })).toEqual([
      { keyPath: 'stray', label: '', messages: ['Invalid'] },
      { keyPath: 'body:c1:x', label: '', messages: ['Invalid'] },
    ]);
    // The component name is missing
    expect(getField).toHaveBeenLastCalledWith(
      expect.objectContaining({ componentName: undefined, keyPath: 'x' }),
    );
  });

  it('skips a field removed since the validation', () => {
    vi.mocked(getField).mockReturnValue({ name: 'f', widget: 'string' });

    const draft = createDraft({
      // A list item and a rich text editor component have been removed
      currentValues: { en: { 'tags.0': 'a' } },
      validationMessages: {
        en: { tags: ['Too few'], 'tags.1': ['Invalid'], 'body:c1:src': ['Required'] },
      },
    });

    expect(getInvalidFields({ draft, locale: 'en' })).toEqual([
      { keyPath: 'tags', label: 'f', messages: ['Too few'] },
    ]);
  });

  it('returns nothing for a locale without messages', () => {
    expect(getInvalidFields({ draft: createDraft(), locale: 'fr' })).toEqual([]);
  });
});
