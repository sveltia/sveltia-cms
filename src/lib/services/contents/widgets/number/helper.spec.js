import { describe, expect, test } from 'vitest';
import { getDefaultValueMap } from './helper.js';

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
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

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
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

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
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

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
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({ e: 2.71828 });
    });

    test('should return empty object when default is undefined', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
      };

      const keyPath = 'count';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({});
    });

    test('should return empty object when int parsing fails', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'not-a-number',
        value_type: 'int',
      };

      const keyPath = 'count';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

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
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({});
    });

    test('should parse string as integer when no value_type specified (defaults to int)', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '42', // String that can be parsed as int
      };

      const keyPath = 'value';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({ value: 42 });
    });

    test('should default to int type when value_type not specified', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 42,
      };

      const keyPath = 'count';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

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
        dynamicValue: '123', // String that can be parsed as int
      });

      expect(result).toEqual({ value: 123 });
    });

    test('should handle string values with custom value_type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'string-value',
        value_type: 'custom', // Custom type, not 'int' or 'float'
      };

      const keyPath = 'value';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({ value: 'string-value' });
    });

    test('should handle string dynamicValue with custom value_type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'default-value',
        value_type: 'custom', // Custom type, not 'int' or 'float'
      };

      const keyPath = 'value';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: 'dynamic-value',
      });

      expect(result).toEqual({ value: 'dynamic-value' });
    });
  });
});
