import { describe, expect, test, vi } from 'vitest';

import { getDefaultValueMap } from './defaults';

/**
 * @import { KeyValueField } from '$lib/types/public';
 */

// Mock dependencies
vi.mock('$lib/services/contents/draft', () => ({
  i18nAutoDupEnabled: {
    set: vi.fn(),
  },
}));

/** @type {Pick<KeyValueField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'keyvalue',
  name: 'metadata',
};

describe('Test getDefaultValueMap()', () => {
  test('should return default key-value pairs when default is an object', () => {
    /** @type {KeyValueField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: {
        key1: 'value1',
        key2: 'value2',
      },
    };

    const keyPath = 'metadata';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({
      'metadata.key1': 'value1',
      'metadata.key2': 'value2',
    });
  });

  test('should return empty key-value pair when required is true and no default', () => {
    /** @type {KeyValueField} */
    const fieldConfig = {
      ...baseFieldConfig,
      required: true,
    };

    const keyPath = 'metadata';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({
      'metadata.': '',
    });
  });

  test('should return empty object when required is false and no default', () => {
    /** @type {KeyValueField} */
    const fieldConfig = {
      ...baseFieldConfig,
      required: false,
    };

    const keyPath = 'metadata';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({});
  });

  test('should return empty object when no default and no required field', () => {
    /** @type {KeyValueField} */
    const fieldConfig = {
      ...baseFieldConfig,
    };

    const keyPath = 'metadata';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ 'metadata.': '' });
  });

  test('should handle default values with different data types', () => {
    /** @type {KeyValueField} */
    const fieldConfig = {
      name: 'config',
      widget: 'keyvalue',
      default: {
        count: '42',
        enabled: 'true',
        ratio: '3.14',
      },
    };

    const keyPath = 'config';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({
      'config.count': '42',
      'config.enabled': 'true',
      'config.ratio': '3.14',
    });
  });

  describe('with dynamicValue', () => {
    test('should prioritize dynamicValue over default when valid JSON', () => {
      /** @type {KeyValueField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: {
          key1: 'default1',
          key2: 'default2',
        },
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: '{"key1": "dynamic1", "key3": "dynamic3"}',
      });

      expect(result).toEqual({
        'metadata.key1': 'dynamic1',
        'metadata.key3': 'dynamic3',
      });
    });

    test('should ignore invalid JSON dynamicValue and use default', () => {
      /** @type {KeyValueField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: {
          key1: 'default1',
        },
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: 'invalid-json',
      });

      expect(result).toEqual({
        'metadata.key1': 'default1',
      });
    });

    test('should ignore non-object JSON dynamicValue and use default', () => {
      /** @type {KeyValueField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: {
          key1: 'default1',
        },
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: '"string-value"',
      });

      expect(result).toEqual({
        'metadata.key1': 'default1',
      });
    });

    test('should ignore array JSON dynamicValue and use default', () => {
      /** @type {KeyValueField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: {
          key1: 'default1',
        },
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: '["array", "value"]',
      });

      expect(result).toEqual({
        'metadata.key1': 'default1',
      });
    });

    test('should filter out non-string values from dynamicValue', () => {
      /** @type {KeyValueField} */
      const fieldConfig = {
        ...baseFieldConfig,
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: '{"str": "value", "num": 42, "bool": true, "null": null}',
      });

      expect(result).toEqual({
        'metadata.str': 'value',
      });
    });

    test('should handle empty object dynamicValue', () => {
      /** @type {KeyValueField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: true,
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: '{}',
      });

      expect(result).toEqual({});
    });

    test('should handle dynamicValue when no default exists', () => {
      /** @type {KeyValueField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: false,
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: '{"key1": "value1", "key2": "value2"}',
      });

      expect(result).toEqual({
        'metadata.key1': 'value1',
        'metadata.key2': 'value2',
      });
    });

    test('should handle undefined dynamicValue', () => {
      /** @type {KeyValueField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: {
          key1: 'default1',
        },
      };

      const keyPath = 'metadata';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: undefined,
      });

      expect(result).toEqual({
        'metadata.key1': 'default1',
      });
    });
  });
});
