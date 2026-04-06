/* eslint-disable jsdoc/require-param-description */
/* eslint-disable jsdoc/require-returns-description */

import { describe, expect, it, vi } from 'vitest';

import { parseDateTimeConfig } from '$lib/services/contents/fields/date-time/helper';

import { getFieldValidationMessages } from './messages';

/** @type {(key: string, opts?: any) => string} */
const t = vi.hoisted(
  () => (key, opts) => (opts?.values ? `${key}(${JSON.stringify(opts.values)})` : key),
);

vi.mock('@sveltia/i18n', () => ({
  _: t,
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  isFieldMultiple: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/fields/date-time/helper', () => ({
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
