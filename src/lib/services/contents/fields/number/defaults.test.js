import { describe, expect, test } from 'vitest';

import { getDefaultValueMap } from './defaults';

/**
 * @import { NumberField } from '$lib/types/public';
 */

/** @type {Pick<NumberField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'number',
  name: 'test_number',
};

describe('Test getDefaultValueMap()', () => {
  describe('without dynamicValue', () => {
    test('should return integer default value for int type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 42,
        value_type: 'int',
      };

      const keyPath = 'count';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ count: 42 });
    });

    test('should return float default value for float type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 3.14,
        value_type: 'float',
      };

      const keyPath = 'ratio';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ ratio: 3.14 });
    });

    test('should parse string integer for int type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '25',
        value_type: 'int',
      };

      const keyPath = 'age';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ age: 25 });
    });

    test('should parse string float for float type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '2.71828',
        value_type: 'float',
      };

      const keyPath = 'e';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ e: 2.71828 });
    });

    test('should return null when default is undefined for int type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
      };

      const keyPath = 'count';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ count: null });
    });

    test('should return null when default is undefined for float type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'float',
      };

      const keyPath = 'ratio';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ ratio: null });
    });

    test('should return empty string when default is undefined for int/string type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int/string',
      };

      const keyPath = 'value';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ value: '' });
    });

    test('should return empty string when default is undefined for float/string type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'float/string',
      };

      const keyPath = 'ratio';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ ratio: '' });
    });

    test('should return null when default is undefined and no value_type specified (defaults to int)', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        // No value_type specified, defaults to 'int'
        // No default value specified
      };

      const keyPath = 'value';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ value: null });
    });

    test('should return empty object when int parsing fails', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'not-a-number',
        value_type: 'int',
      };

      const keyPath = 'count';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({});
    });

    test('should return empty object when float parsing fails', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'not-a-number',
        value_type: 'float',
      };

      const keyPath = 'ratio';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({});
    });

    test('should parse string as integer when no value_type specified (defaults to int)', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '42', // String that can be parsed as int
      };

      const keyPath = 'value';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ value: 42 });
    });

    test('should default to int type when value_type not specified', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 42,
      };

      const keyPath = 'count';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ count: 42 });
    });
  });

  describe('with dynamicValue', () => {
    test('should prioritize dynamicValue over default for int type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 42,
        value_type: 'int',
      };

      const keyPath = 'count';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: '100',
      });

      expect(result).toEqual({ count: 100 });
    });

    test('should prioritize dynamicValue over default for float type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 3.14,
        value_type: 'float',
      };

      const keyPath = 'ratio';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: '2.5',
      });

      expect(result).toEqual({ ratio: 2.5 });
    });

    test('should handle dynamicValue when no default exists', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
      };

      const keyPath = 'count';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: '50',
      });

      expect(result).toEqual({ count: 50 });
    });

    test('should return empty object when dynamicValue is invalid for int type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 42,
        value_type: 'int',
      };

      const keyPath = 'count';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: 'invalid-number',
      });

      expect(result).toEqual({});
    });

    test('should return empty object when dynamicValue is invalid for float type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 3.14,
        value_type: 'float',
      };

      const keyPath = 'ratio';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: 'invalid-number',
      });

      expect(result).toEqual({});
    });

    test('should parse string dynamicValue as integer when no value_type specified (defaults to int)', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'default-value',
      };

      const keyPath = 'value';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: '123', // String that can be parsed as int
      });

      expect(result).toEqual({ value: 123 });
    });

    test('should parse string as integer for int/string type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '42',
        value_type: 'int/string',
      };

      const keyPath = 'value';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ value: 42 });
    });

    test('should parse string as float for float/string type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '3.14',
        value_type: 'float/string',
      };

      const keyPath = 'value';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ value: 3.14 });
    });

    test('should parse string dynamicValue as integer for int/string type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '10',
        value_type: 'int/string',
      };

      const keyPath = 'value';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: '50',
      });

      expect(result).toEqual({ value: 50 });
    });

    test('should parse string dynamicValue as float for float/string type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '2.5',
        value_type: 'float/string',
      };

      const keyPath = 'value';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: '3.5',
      });

      expect(result).toEqual({ value: 3.5 });
    });

    test('should return null when dynamicValue is undefined and no default exists for int type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        // No default value
        value_type: 'int',
      };

      const keyPath = 'count';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: undefined, // Explicitly undefined
      });

      expect(result).toEqual({ count: null });
    });

    test('should return null when dynamicValue is undefined and no default exists for float type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        // No default value
        value_type: 'float',
      };

      const keyPath = 'ratio';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: undefined, // Explicitly undefined
      });

      expect(result).toEqual({ ratio: null });
    });

    test('should return empty object when dynamicValue is undefined and no default exists (non-numeric type)', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        // No default value
        value_type: 'int/string',
      };

      const keyPath = 'value';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: undefined, // Explicitly undefined
      });

      // Falls through to return empty string because value is undefined
      // and value_type is not 'int' or 'float'
      expect(result).toEqual({ value: '' });
    });

    test('should handle invalid string for int/string type', () => {
      // Test when string cannot be parsed as integer
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'not-a-number',
        value_type: 'int/string',
      };

      const keyPath = 'field';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      // Returns empty object when parsing fails
      expect(result).toEqual({});
    });

    test('should handle invalid string for float/string type', () => {
      // Test when string cannot be parsed as float
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'not-a-number',
        value_type: 'float/string',
      };

      const keyPath = 'field';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      // Returns empty object when parsing fails
      expect(result).toEqual({});
    });

    test('should handle all valid value_type variants', () => {
      /**
       * @typedef {object} TestCase
       * @property {'int' | 'int/string' | 'float' | 'float/string'} valueType
       * The value type.
       * @property {number | string} input
       * The input value.
       * @property {number} expected
       * The expected result.
       */
      /** @type {TestCase[]} */
      const testCases = [
        { valueType: 'int', input: 42, expected: 42 },
        { valueType: 'int/string', input: '42', expected: 42 },
        { valueType: 'float', input: 3.14, expected: 3.14 },
        { valueType: 'float/string', input: '3.14', expected: 3.14 },
      ];

      testCases.forEach(({ valueType, input, expected }) => {
        /** @type {NumberField} */
        const fieldConfig = {
          ...baseFieldConfig,
          default: input,
          value_type: valueType,
        };

        const keyPath = 'field';

        const result = getDefaultValueMap({
          fieldConfig,
          keyPath,
          locale: '_default',
          defaultLocale: '_default',
        });

        expect(result).toEqual({ field: expected });
      });
    });
  });
});
