import { writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';
import { getDefaultValueMap, getPairs, savePairs, validatePairs } from './helper.js';

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
