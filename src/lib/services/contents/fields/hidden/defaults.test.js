import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { user } from '$lib/services/user';

import { getDefaultValueMap } from './defaults';

/**
 * @import { HiddenField } from '$lib/types/public';
 */

// Mock the crypto utils
vi.mock('@sveltia/utils/crypto', () => ({
  generateUUID: vi.fn((type) => {
    if (type === 'short') return 'short-uuid-123';
    if (type === 'shorter') return 'shorter-uuid';
    return 'full-uuid-1234-5678-90ab-cdef';
  }),
}));

// Mock user store with default empty values
vi.mock('$lib/services/user', async () => {
  const { writable } = await import('svelte/store');

  return {
    user: writable({
      backendName: 'github',
      login: '',
      name: '',
      email: '',
    }),
  };
});

/** @type {Pick<HiddenField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'hidden',
  name: 'test_hidden',
};

describe('Test getDefaultValueMap()', () => {
  // Mock Date to have consistent datetime values
  const mockDate = new Date('2023-06-15T10:30:00.000Z');

  beforeEach(() => {
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should return non-string default value as-is', () => {
    /** @type {HiddenField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: 42,
    };

    const keyPath = 'count';
    const locale = '_default';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

    expect(result).toEqual({ count: 42 });
  });

  test('should return boolean default value as-is', () => {
    /** @type {HiddenField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: true,
    };

    const keyPath = 'enabled';
    const locale = '_default';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

    expect(result).toEqual({ enabled: true });
  });

  test('should return object default value as-is', () => {
    /** @type {HiddenField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: { key: 'value' },
    };

    const keyPath = 'config';
    const locale = '_default';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

    expect(result).toEqual({ config: { key: 'value' } });
  });

  test('should replace {{locale}} placeholder with locale value', () => {
    /** @type {HiddenField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: 'prefix-{{locale}}-suffix',
    };

    const keyPath = 'identifier';
    const locale = 'en';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

    expect(result).toEqual({ identifier: 'prefix-en-suffix' });
  });

  test('should replace {{datetime}} placeholder with formatted datetime', () => {
    /** @type {HiddenField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: 'created-{{datetime}}',
    };

    const keyPath = 'timestamp';
    const locale = '_default';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

    expect(result).toEqual({ timestamp: 'created-2023-06-15T10:30:00.000Z' });
  });

  test('should replace {{uuid}} placeholder with full UUID', () => {
    /** @type {HiddenField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: 'id-{{uuid}}',
    };

    const keyPath = 'identifier';
    const locale = '_default';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

    expect(result).toEqual({ identifier: 'id-full-uuid-1234-5678-90ab-cdef' });
  });

  test('should replace {{uuid_short}} placeholder with short UUID', () => {
    /** @type {HiddenField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: 'id-{{uuid_short}}',
    };

    const keyPath = 'identifier';
    const locale = '_default';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

    expect(result).toEqual({ identifier: 'id-short-uuid-123' });
  });

  test('should replace {{uuid_shorter}} placeholder with shorter UUID', () => {
    /** @type {HiddenField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: 'id-{{uuid_shorter}}',
    };

    const keyPath = 'identifier';
    const locale = '_default';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

    expect(result).toEqual({ identifier: 'id-shorter-uuid' });
  });

  test('should replace multiple placeholders in single string', () => {
    /** @type {HiddenField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: '{{locale}}-{{datetime}}-{{uuid_short}}',
    };

    const keyPath = 'composite';
    const locale = 'fr';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

    expect(result).toEqual({
      composite: 'fr-2023-06-15T10:30:00.000Z-short-uuid-123',
    });
  });

  test('should replace unknown placeholders with empty string', () => {
    /** @type {HiddenField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: 'prefix-{{unknown}}-suffix',
    };

    const keyPath = 'test';
    const locale = '_default';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

    expect(result).toEqual({ test: 'prefix--suffix' });
  });

  test('should handle string with no placeholders', () => {
    /** @type {HiddenField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: 'static-value',
    };

    const keyPath = 'static';
    const locale = '_default';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

    expect(result).toEqual({ static: 'static-value' });
  });

  test('should handle empty string default', () => {
    /** @type {HiddenField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: '',
    };

    const keyPath = 'empty';
    const locale = '_default';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

    expect(result).toEqual({ empty: '' });
  });

  test('should handle undefined default value', () => {
    /** @type {HiddenField} */
    const fieldConfig = {
      ...baseFieldConfig,
    };

    const keyPath = 'undefined';
    const locale = '_default';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

    expect(result).toEqual({ undefined });
  });

  test('should handle nested key paths', () => {
    /** @type {HiddenField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: '{{locale}}-value',
    };

    const keyPath = 'meta.hidden.id';
    const locale = 'ja';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

    expect(result).toEqual({ 'meta.hidden.id': 'ja-value' });
  });

  describe('with dynamicValue', () => {
    test('should prioritize dynamicValue over default', () => {
      /** @type {HiddenField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'default-value',
      };

      const keyPath = 'test_hidden';
      const locale = '_default';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale,
        defaultLocale: locale,
        dynamicValue: 'dynamic-value',
      });

      expect(result).toEqual({ test_hidden: 'dynamic-value' });
    });

    test('should process template tags in dynamicValue', () => {
      /** @type {HiddenField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'default-{{datetime}}',
      };

      const keyPath = 'test_hidden';
      const locale = '_default';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale,
        defaultLocale: locale,
        dynamicValue: 'created-{{datetime}}-{{locale}}',
      });

      expect(result).toEqual({
        test_hidden: 'created-2023-06-15T10:30:00.000Z-_default',
      });
    });
    test('should handle undefined dynamicValue', () => {
      /** @type {HiddenField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'default',
      };

      const keyPath = 'test_hidden';
      const locale = 'ja';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale,
        defaultLocale: locale,
        dynamicValue: '{{locale}}-{{datetime}}-{{uuid}}-{{uuid_short}}-{{uuid_shorter}}',
      });

      expect(result).toEqual({
        test_hidden:
          'ja-2023-06-15T10:30:00.000Z-full-uuid-1234-5678-90ab-cdef-short-uuid-123-shorter-uuid',
      });
    });
    test('should handle undefined dynamicValue', () => {
      /** @type {HiddenField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'default-value',
      };

      const keyPath = 'test_hidden';
      const locale = '_default';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale,
        defaultLocale: locale,
        dynamicValue: '',
      });

      expect(result).toEqual({ test_hidden: '' });
    });
  });

  describe('author placeholders', () => {
    test('should replace {{author-login}} placeholder with value', () => {
      user.set({ backendName: 'github', login: 'johndoe', name: '', email: '' });

      /** @type {HiddenField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'user-{{author-login}}',
      };

      const keyPath = 'author_login';
      const locale = '_default';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

      expect(result).toEqual({ author_login: 'user-johndoe' });
    });

    test('should replace {{author-name}} placeholder with value', () => {
      user.set({ backendName: 'github', login: '', name: 'John Doe', email: '' });

      /** @type {HiddenField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'author-{{author-name}}',
      };

      const keyPath = 'author_name';
      const locale = '_default';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

      expect(result).toEqual({ author_name: 'author-John Doe' });
    });

    test('should replace {{author-email}} placeholder with value', () => {
      user.set({ backendName: 'github', login: '', name: '', email: 'john@example.com' });

      /** @type {HiddenField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'email-{{author-email}}',
      };

      const keyPath = 'author_email';
      const locale = '_default';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

      expect(result).toEqual({ author_email: 'email-john@example.com' });
    });

    test('should replace all author placeholders in single string', () => {
      user.set({
        backendName: 'github',
        login: 'johndoe',
        name: 'John Doe',
        email: 'john@example.com',
      });

      /** @type {HiddenField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'by {{author-name}} ({{author-login}}) <{{author-email}}>',
      };

      const keyPath = 'author_info';
      const locale = '_default';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

      expect(result).toEqual({
        author_info: 'by John Doe (johndoe) <john@example.com>',
      });
    });

    test('should handle author placeholders with other placeholders', () => {
      user.set({
        backendName: 'github',
        login: 'johndoe',
        name: 'John Doe',
        email: 'john@example.com',
      });

      /** @type {HiddenField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default:
          '{{locale}}-{{author-name}}-{{datetime}}-{{author-login}}-{{uuid_short}}-{{author-email}}',
      };

      const keyPath = 'composite';
      const locale = 'en';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale, defaultLocale: locale });

      expect(result.composite).toBe(
        'en-John Doe-2023-06-15T10:30:00.000Z-johndoe-short-uuid-123-john@example.com',
      );
    });
  });
});
