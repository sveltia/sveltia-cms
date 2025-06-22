import { describe, expect, test } from 'vitest';
import { getDefaultValueMap } from './helper.js';

/**
 * @import { BooleanField } from '$lib/types/public';
 */

/** @type {Pick<BooleanField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'boolean',
  name: 'isEnabled',
};

describe('Test getDefaultValueMap()', () => {
  test('should return true when default value is true', () => {
    /** @type {BooleanField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: true,
    };

    const keyPath = 'isEnabled';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ isEnabled: true });
  });

  test('should return false when default value is false', () => {
    /** @type {BooleanField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: false,
    };

    const keyPath = 'isEnabled';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ isEnabled: false });
  });

  test('should return false when default value is undefined', () => {
    /** @type {BooleanField} */
    const fieldConfig = {
      ...baseFieldConfig,
    };

    const keyPath = 'isEnabled';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ isEnabled: false });
  });

  test('should return false when default value is not a boolean', () => {
    /** @type {BooleanField} */
    const fieldConfig = {
      ...baseFieldConfig,
      // @ts-expect-error - Testing invalid type
      default: 'true', // string, not boolean
    };

    const keyPath = 'isEnabled';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ isEnabled: false });
  });

  test('should return false when default value is null', () => {
    /** @type {BooleanField} */
    const fieldConfig = {
      ...baseFieldConfig,
      // @ts-expect-error - Testing invalid type
      default: null,
    };

    const keyPath = 'isEnabled';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ isEnabled: false });
  });

  test('should return false when default value is 0', () => {
    /** @type {BooleanField} */
    const fieldConfig = {
      ...baseFieldConfig,
      // @ts-expect-error - Testing invalid type
      default: 0,
    };

    const keyPath = 'isEnabled';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ isEnabled: false });
  });

  test('should return false when default value is 1', () => {
    /** @type {BooleanField} */
    const fieldConfig = {
      ...baseFieldConfig,
      // @ts-expect-error - Testing invalid type
      default: 1,
    };

    const keyPath = 'isEnabled';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ isEnabled: false });
  });

  test('should handle different key paths', () => {
    /** @type {BooleanField} */
    const fieldConfig = {
      name: 'email',
      widget: 'boolean',
      default: true,
    };

    const keyPath = 'settings.notifications.email';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ 'settings.notifications.email': true });
  });

  describe('with dynamicValue', () => {
    test('should return true when dynamicValue is "true"', () => {
      /** @type {BooleanField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: false,
      };

      const keyPath = 'isEnabled';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: 'true',
      });

      expect(result).toEqual({ isEnabled: true });
    });

    test('should return false when dynamicValue is "false"', () => {
      /** @type {BooleanField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: true,
      };

      const keyPath = 'isEnabled';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: 'false',
      });

      expect(result).toEqual({ isEnabled: false });
    });

    test('should return false when dynamicValue is any other string', () => {
      /** @type {BooleanField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: true,
      };

      const keyPath = 'isEnabled';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: 'something-else',
      });

      expect(result).toEqual({ isEnabled: false });
    });

    test('should prioritize dynamicValue over default', () => {
      /** @type {BooleanField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: false,
      };

      const keyPath = 'isEnabled';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: 'true',
      });

      expect(result).toEqual({ isEnabled: true });
    });

    test('should handle dynamicValue when no default exists', () => {
      /** @type {BooleanField} */
      const fieldConfig = {
        ...baseFieldConfig,
      };

      const keyPath = 'isEnabled';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: 'true',
      });

      expect(result).toEqual({ isEnabled: true });
    });

    test('should handle empty dynamicValue', () => {
      /** @type {BooleanField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: true,
      };

      const keyPath = 'isEnabled';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: '',
      });

      expect(result).toEqual({ isEnabled: false });
    });

    test('should handle undefined dynamicValue', () => {
      /** @type {BooleanField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: true,
      };

      const keyPath = 'isEnabled';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: undefined,
      });

      expect(result).toEqual({ isEnabled: true });
    });
  });
});
