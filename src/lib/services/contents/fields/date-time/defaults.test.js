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

    const result = getDefaultValueMap({
      fieldConfig,
      keyPath,
      locale: '_default',
      defaultLocale: '_default',
    });

    expect(result).toEqual({ 'test.field': '' });
  });

  test('should return default value map with string default', () => {
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
      defaultLocale: '_default',
    });

    expect(result).toEqual({ 'test.field': '2023-12-25' });
  });

  test('should handle {{now}} default value', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: '{{now}}',
    };

    const keyPath = 'test.field';

    const result = getDefaultValueMap({
      fieldConfig,
      keyPath,
      locale: '_default',
      defaultLocale: '_default',
    });

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

    const result = getDefaultValueMap({
      fieldConfig,
      keyPath,
      locale: '_default',
      defaultLocale: '_default',
    });

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
        defaultLocale: '_default',
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
        defaultLocale: '_default',
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
        defaultLocale: '_default',
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
        defaultLocale: '_default',
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
        defaultLocale: '_default',
        dynamicValue: '2024-01-01T10:30:00.000Z',
      });

      expect(result).toEqual({ 'test.field': '2024-01-01T10:30:00.000Z' });
    });

    test('should handle {{now}} with UTC input timezone', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '2023-12-25',
        input_timezone: 'utc',
      };

      const keyPath = 'test.field';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: '{{now}}',
      });

      expect(result['test.field']).toBeDefined();
      expect(typeof result['test.field']).toBe('string');
      expect(result['test.field']).not.toBe('{{now}}');
    });

    test('should handle {{now}} with custom timezone in input_timezone', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '2023-12-25',
        input_timezone: 'America/New_York',
      };

      const keyPath = 'test.field';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: '{{now}}',
      });

      expect(result['test.field']).toBeDefined();
      expect(typeof result['test.field']).toBe('string');
      expect(result['test.field']).not.toBe('{{now}}');
    });

    test('should handle {{now}} with Europe/London timezone in input_timezone', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '2023-12-25',
        input_timezone: 'Europe/London',
      };

      const keyPath = 'test.field';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: '{{now}}',
      });

      expect(result['test.field']).toBeDefined();
      expect(typeof result['test.field']).toBe('string');
      expect(result['test.field']).not.toBe('{{now}}');
    });

    test('should handle {{now}} with the local timezone fallback', () => {
      // The local fallback keeps the browser timezone semantics without a custom timezone list.
      // This test just verifies the behavior does not crash with edge case values.
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '2023-12-25',
        input_timezone: 'local', // Use 'local' which is the standard fallback
      };

      const keyPath = 'test.field';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: '{{now}}',
      });

      expect(result['test.field']).toBeDefined();
      expect(typeof result['test.field']).toBe('string');
      expect(result['test.field']).not.toBe('{{now}}');
    });
  });
});
