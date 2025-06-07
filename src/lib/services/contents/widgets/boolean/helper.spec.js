import { describe, expect, test } from 'vitest';
import { getBooleanFieldDefaultValueMap } from './helper.js';

/**
 * @import { BooleanField } from '$lib/types/public';
 */

/** @type {Pick<BooleanField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'boolean',
  name: 'isEnabled',
};

describe('Test getBooleanFieldDefaultValueMap()', () => {
  test('should return true when default value is true', () => {
    /** @type {BooleanField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: true,
    };

    const keyPath = 'isEnabled';
    const result = getBooleanFieldDefaultValueMap({ fieldConfig, keyPath });

    expect(result).toEqual({ isEnabled: true });
  });

  test('should return false when default value is false', () => {
    /** @type {BooleanField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: false,
    };

    const keyPath = 'isEnabled';
    const result = getBooleanFieldDefaultValueMap({ fieldConfig, keyPath });

    expect(result).toEqual({ isEnabled: false });
  });

  test('should return false when default value is undefined', () => {
    /** @type {BooleanField} */
    const fieldConfig = {
      ...baseFieldConfig,
    };

    const keyPath = 'isEnabled';
    const result = getBooleanFieldDefaultValueMap({ fieldConfig, keyPath });

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
    const result = getBooleanFieldDefaultValueMap({ fieldConfig, keyPath });

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
    const result = getBooleanFieldDefaultValueMap({ fieldConfig, keyPath });

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
    const result = getBooleanFieldDefaultValueMap({ fieldConfig, keyPath });

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
    const result = getBooleanFieldDefaultValueMap({ fieldConfig, keyPath });

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
    const result = getBooleanFieldDefaultValueMap({ fieldConfig, keyPath });

    expect(result).toEqual({ 'settings.notifications.email': true });
  });
});
