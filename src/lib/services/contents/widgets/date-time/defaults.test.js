import { describe, expect, test } from 'vitest';

import { getDefaultValueMap } from './defaults';

/**
 * @import { DateTimeField } from '$lib/types/public';
 */

/** @type {Pick<DateTimeField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'datetime',
  name: 'test_datetime',
};

describe('getDefaultValueMap', () => {
  test('should return default value map with empty string', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
    };

    const keyPath = 'test.field';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ 'test.field': '' });
  });

  test('should return default value map with string default', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: '2023-12-25',
    };

    const keyPath = 'test.field';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ 'test.field': '2023-12-25' });
  });

  test('should handle {{now}} default value', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: '{{now}}',
    };

    const keyPath = 'test.field';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result['test.field']).toBeDefined();
    expect(typeof result['test.field']).toBe('string');
    expect(result['test.field']).not.toBe('{{now}}');
  });

  test('should handle non-string default value', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      widget: 'datetime',
      name: 'test_datetime',
      // @ts-expect-error - Testing invalid type
      default: 123,
    };

    const keyPath = 'test.field';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ 'test.field': '' });
  });

  describe('with dynamicValue', () => {
    test('should prioritize dynamicValue over default', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '2023-12-25',
      };

      const keyPath = 'test.field';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: '2024-01-01',
      });

      expect(result).toEqual({ 'test.field': '2024-01-01' });
    });

    test('should handle {{now}} in dynamicValue', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '2023-12-25',
      };

      const keyPath = 'test.field';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: '{{now}}',
      });

      expect(result['test.field']).toBeDefined();
      expect(typeof result['test.field']).toBe('string');
      expect(result['test.field']).not.toBe('{{now}}');
    });

    test('should handle empty string dynamicValue', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '2023-12-25',
      };

      const keyPath = 'test.field';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: '',
      });

      expect(result).toEqual({ 'test.field': '' });
    });

    test('should handle undefined dynamicValue', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '2023-12-25',
      };

      const keyPath = 'test.field';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: undefined,
      });

      expect(result).toEqual({ 'test.field': '2023-12-25' });
    });

    test('should handle ISO datetime string in dynamicValue', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '2023-12-25',
      };

      const keyPath = 'test.field';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: '2024-01-01T10:30:00.000Z',
      });

      expect(result).toEqual({ 'test.field': '2024-01-01T10:30:00.000Z' });
    });
  });
});
