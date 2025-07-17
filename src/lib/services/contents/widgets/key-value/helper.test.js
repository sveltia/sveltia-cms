import { writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';
import { getPairs, savePairs, validatePairs } from './helper';

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

describe('Test getPairs()', () => {
  test('should extract key-value pairs from entry draft', () => {
    const entryDraft = writable({
      currentValues: {
        _default: {
          'metadata.key1': 'value1',
          'metadata.key2': 'value2',
          'other.key': 'otherValue',
        },
      },
    });

    const keyPath = 'metadata';
    const locale = '_default';
    // @ts-expect-error - Using minimal mock for testing
    const result = getPairs({ entryDraft, keyPath, locale });

    expect(result).toEqual([
      ['key1', 'value1'],
      ['key2', 'value2'],
    ]);
  });

  test('should return empty array when no matching keys', () => {
    const entryDraft = writable({
      currentValues: {
        _default: {
          'other.key': 'value',
        },
      },
    });

    const keyPath = 'metadata';
    const locale = '_default';
    // @ts-expect-error - Using minimal mock for testing
    const result = getPairs({ entryDraft, keyPath, locale });

    expect(result).toEqual([]);
  });

  test('should handle different locales', () => {
    const entryDraft = writable({
      currentValues: {
        en: {
          'metadata.key1': 'english value',
        },
      },
    });

    const keyPath = 'metadata';
    const locale = 'en';
    // @ts-expect-error - Using minimal mock for testing
    const result = getPairs({ entryDraft, keyPath, locale });

    expect(result).toEqual([['key1', 'english value']]);
  });
});

describe('Test validatePairs()', () => {
  test('should return valid pairs as-is', () => {
    /** @type {[string, string][]} */
    const pairs = [
      ['key1', 'value1'],
      ['key2', 'value2'],
    ];

    const edited = [false, false];
    const result = validatePairs({ pairs, edited });

    expect(result).toEqual([undefined, undefined]);
  });

  test('should filter out invalid pairs', () => {
    /** @type {[string, string][]} */
    const pairs = [
      ['key1', 'value1'],
      ['', 'empty key'],
      ['valid key', ''],
    ];

    const edited = [false, true, false];
    const result = validatePairs({ pairs, edited });

    expect(result).toEqual([undefined, 'empty', undefined]);
  });

  test('should handle empty pairs array', () => {
    /** @type {[string, string][]} */
    const pairs = [];
    /** @type {boolean[]} */
    const edited = [];
    const result = validatePairs({ pairs, edited });

    expect(result).toEqual([]);
  });

  test('should handle edited state', () => {
    /** @type {[string, string][]} */
    const pairs = [['key1', 'value1']];
    const edited = [true];
    const result = validatePairs({ pairs, edited });

    expect(result).toEqual([undefined]);
  });

  test('should filter pairs with empty keys or values', () => {
    /** @type {[string, string][]} */
    const pairs = [
      ['', ''],
      ['key1', ''],
      ['', 'value1'],
    ];

    const edited = [true, false, true];
    const result = validatePairs({ pairs, edited });

    expect(result).toEqual(['empty', undefined, 'empty']);
  });

  test('should preserve valid pairs when some are invalid', () => {
    /** @type {[string, string][]} */
    const pairs = [
      ['validKey', 'validValue'],
      ['', 'emptyKey'],
      ['emptyValue', ''],
      ['anotherValid', 'anotherValue'],
    ];

    const edited = [false, true, false, false];
    const result = validatePairs({ pairs, edited });

    expect(result).toEqual([undefined, 'empty', undefined, undefined]);
  });
});

describe('Test savePairs()', () => {
  test('should save pairs to entry draft', () => {
    const entryDraft = writable({
      currentValues: {
        _default: {
          'metadata.oldKey': 'oldValue',
          'other.key': 'otherValue',
        },
      },
    });

    /** @type {KeyValueField} */
    const fieldConfig = {
      ...baseFieldConfig,
      i18n: undefined,
    };

    const keyPath = 'metadata';
    const locale = '_default';

    /** @type {[string, string][]} */
    const pairs = [
      ['newkey1', 'newValue1'],
      ['newkey2', 'newValue2'],
    ];

    // @ts-expect-error - Using minimal mock for testing
    savePairs({ entryDraft, fieldConfig, keyPath, locale, pairs });

    const draft = entryDraft;

    if (draft && typeof draft.subscribe === 'function') {
      draft.subscribe((value) => {
        expect(value.currentValues._default).toEqual({
          'metadata.newkey1': 'newValue1',
          'metadata.newkey2': 'newValue2',
          'other.key': 'otherValue',
        });
      })();
    }
  });

  test('should handle i18n locales', () => {
    const entryDraft = writable({
      currentValues: {
        _default: {
          'metadata.oldKey': 'defaultValue',
        },
        en: {
          'metadata.oldKey': 'englishValue',
        },
        fr: {
          'metadata.oldKey': 'frenchValue',
        },
      },
    });

    /** @type {KeyValueField} */
    const fieldConfig = {
      ...baseFieldConfig,
      i18n: 'translate',
    };

    const keyPath = 'metadata';
    const locale = 'en';
    /** @type {[string, string][]} */
    const pairs = [['newkey', 'englishNewValue']];

    // @ts-expect-error - Using minimal mock for testing
    savePairs({ entryDraft, fieldConfig, keyPath, locale, pairs });

    const draft = entryDraft;

    if (draft && typeof draft.subscribe === 'function') {
      draft.subscribe((value) => {
        expect(value.currentValues._default).toEqual({
          'metadata.oldKey': 'defaultValue',
        });
        expect(value.currentValues.en).toEqual({
          'metadata.newkey': 'englishNewValue',
        });
        expect(value.currentValues.fr).toEqual({
          'metadata.oldKey': 'frenchValue',
        });
      })();
    }
  });

  test('should handle duplicate i18n setting', () => {
    const entryDraft = writable({
      currentValues: {
        _default: {
          'metadata.oldKey': 'defaultValue',
        },
        en: {
          'metadata.oldKey': 'englishValue',
        },
      },
    });

    /** @type {KeyValueField} */
    const fieldConfig = {
      ...baseFieldConfig,
      i18n: 'duplicate',
    };

    const keyPath = 'metadata';
    const locale = 'en';
    /** @type {[string, string][]} */
    const pairs = [['newkey', 'newValue']];

    // @ts-expect-error - Using minimal mock for testing
    savePairs({ entryDraft, fieldConfig, keyPath, locale, pairs });

    const draft = entryDraft;

    if (draft && typeof draft.subscribe === 'function') {
      draft.subscribe((value) => {
        expect(value.currentValues._default).toEqual({
          'metadata.newkey': 'newValue',
        });
        expect(value.currentValues.en).toEqual({
          'metadata.newkey': 'newValue',
        });
      })();
    }
  });
});
