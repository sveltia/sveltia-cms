import { describe, expect, test } from 'vitest';
import { validateStringField } from './helper.js';

/**
 * @import { StringField } from '$lib/types/public';
 */

/** @type {Pick<StringField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'string',
  name: 'test',
};

describe('Test validateStringField()', () => {
  test('should return valid result for value within limits', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 5,
      maxlength: 10,
    };

    const value = 'hello';
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 5,
      hasMin: true,
      hasMax: true,
      tooShort: false,
      tooLong: false,
      invalid: false,
    });
  });

  test('should return tooShort=true for value below minimum length', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 5,
      maxlength: 10,
    };

    const value = 'hi';
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 2,
      hasMin: true,
      hasMax: true,
      tooShort: true,
      tooLong: false,
      invalid: true,
    });
  });

  test('should return tooLong=true for value above maximum length', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 5,
      maxlength: 10,
    };

    const value = 'this is a very long string';
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 26,
      hasMin: true,
      hasMax: true,
      tooShort: false,
      tooLong: true,
      invalid: true,
    });
  });

  test('should handle undefined value as empty string', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 1,
      maxlength: 10,
    };

    const value = undefined;
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 0,
      hasMin: true,
      hasMax: true,
      tooShort: true,
      tooLong: false,
      invalid: true,
    });
  });

  test('should handle empty string', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 1,
      maxlength: 10,
    };

    const value = '';
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 0,
      hasMin: true,
      hasMax: true,
      tooShort: true,
      tooLong: false,
      invalid: true,
    });
  });

  test('should trim whitespace when counting characters', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 3,
      maxlength: 10,
    };

    const value = '  hello  ';
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 5,
      hasMin: true,
      hasMax: true,
      tooShort: false,
      tooLong: false,
      invalid: false,
    });
  });

  test('should handle no minimum length constraint', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      maxlength: 10,
    };

    const value = 'hi';
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 2,
      hasMin: false,
      hasMax: true,
      tooShort: false,
      tooLong: false,
      invalid: false,
    });
  });

  test('should handle no maximum length constraint', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 3,
    };

    const value = 'hello world';
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 11,
      hasMin: true,
      hasMax: false,
      tooShort: false,
      tooLong: false,
      invalid: false,
    });
  });

  test('should handle no length constraints', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
    };

    const value = 'any length string';
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 17,
      hasMin: false,
      hasMax: false,
      tooShort: false,
      tooLong: false,
      invalid: false,
    });
  });

  test('should handle invalid minlength/maxlength configuration', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 10,
      maxlength: 5, // max < min
    };

    const value = 'hello';
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 5,
      hasMin: false, // invalid constraint
      hasMax: false, // invalid constraint
      tooShort: false,
      tooLong: false,
      invalid: false,
    });
  });

  test('should count Unicode characters correctly', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 3,
      maxlength: 10,
    };

    const value = '🚀🌟✨'; // 3 emoji characters
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 3,
      hasMin: true,
      hasMax: true,
      tooShort: false,
      tooLong: false,
      invalid: false,
    });
  });
});
