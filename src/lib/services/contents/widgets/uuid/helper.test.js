import { describe, expect, test, vi } from 'vitest';
import { getInitialValue } from './helper';

/**
 * @import { UuidField } from '$lib/types/public';
 */

// Mock the crypto utils
vi.mock('@sveltia/utils/crypto', () => ({
  generateRandomId: vi.fn(() => 'mock-random-id'),
  generateUUID: vi.fn(() => 'mock-uuid-1234-5678'),
}));

/** @type {Pick<UuidField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'uuid',
  name: 'id',
};

describe('Test getInitialValue()', () => {
  test('should return UUID without prefix when use_b32_encoding is false', () => {
    /** @type {UuidField} */
    const fieldConfig = {
      ...baseFieldConfig,
      use_b32_encoding: false,
    };

    const result = getInitialValue(fieldConfig);

    expect(result).toBe('mock-uuid-1234-5678');
  });

  test('should return random ID when use_b32_encoding is true', () => {
    /** @type {UuidField} */
    const fieldConfig = {
      ...baseFieldConfig,
      use_b32_encoding: true,
    };

    const result = getInitialValue(fieldConfig);

    expect(result).toBe('mock-random-id');
  });

  test('should return UUID with prefix when prefix is provided and use_b32_encoding is false', () => {
    /** @type {UuidField} */
    const fieldConfig = {
      name: 'userId',
      widget: 'uuid',
      prefix: 'user-',
      use_b32_encoding: false,
    };

    const result = getInitialValue(fieldConfig);

    expect(result).toBe('user-mock-uuid-1234-5678');
  });

  test('should return random ID with prefix when prefix is provided and use_b32_encoding is true', () => {
    /** @type {UuidField} */
    const fieldConfig = {
      ...baseFieldConfig,
      prefix: 'id-',
      use_b32_encoding: true,
    };

    const result = getInitialValue(fieldConfig);

    expect(result).toBe('id-mock-random-id');
  });

  test('should handle empty prefix', () => {
    /** @type {UuidField} */
    const fieldConfig = {
      ...baseFieldConfig,
      prefix: '',
      use_b32_encoding: false,
    };

    const result = getInitialValue(fieldConfig);

    expect(result).toBe('mock-uuid-1234-5678');
  });
});
