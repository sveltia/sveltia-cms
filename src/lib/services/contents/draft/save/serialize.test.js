import { describe, expect, test, vi } from 'vitest';

import {
  copyProperty,
  isValueEmpty,
  serializeContent,
} from '$lib/services/contents/draft/save/serialize';

vi.mock('$lib/services/assets');
vi.mock('$lib/services/config', () => ({
  cmsConfig: { subscribe: vi.fn((callback) => callback({})) },
}));
vi.mock('$lib/services/contents/draft/save/key-path', () => ({
  createKeyPathList: vi.fn((fields) => fields.map((/** @type {any} */ f) => f.name)),
}));
vi.mock('$lib/services/contents/fields/list/helper', () => ({
  hasRootListField: vi.fn((fields) => fields.length === 1 && fields[0].widget === 'list'),
}));
vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return {
    ...actual,
    get: vi.fn(() => ({})),
  };
});

const { isFieldRequired, getField } = vi.hoisted(() => ({
  isFieldRequired: vi.fn(),
  getField: vi.fn((args) => {
    const { keyPath } = args;

    return { name: keyPath, widget: 'string' };
  }),
}));

const { parseDateTimeConfig } = vi.hoisted(() => ({
  parseDateTimeConfig: vi.fn(
    /**
     * Mock parseDateTimeConfig that returns format config.
     * @returns {any} Config object with format property.
     */
    () => ({ format: null }),
  ),
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  isFieldRequired,
  getField,
}));

vi.mock('$lib/services/contents/fields/date-time/helper', () => ({
  parseDateTimeConfig,
}));

vi.mock('$lib/services/utils/date', () => ({
  FULL_DATE_TIME_REGEX: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
}));

/**
 * @import { FlattenedEntryContent } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

describe('Test copyProperty()', () => {
  /** @type {Field[]} */
  const fields = [
    { name: 'title', widget: 'string', required: true },
    { name: 'description', widget: 'string', required: false },
    { name: 'image', widget: 'image', required: false },
    { name: 'hidden', widget: 'boolean', required: false },
    { name: 'threshold', widget: 'number', required: false },
    { name: 'organizers', widget: 'list', required: false },
    { name: 'program', widget: 'object', required: false },
    { name: 'address', widget: 'object', required: false },
    { name: 'variables', widget: 'keyvalue', required: false },
  ];

  /** @type {FlattenedEntryContent} */
  const content = {
    title: 'My Post',
    description: '',
    image: '',
    hidden: false,
    threshold: null,
    organizers: [],
    program: null,
    address: {},
    variables: {},
  };

  /**
   * Wrapper for {@link copyProperty}.
   * @param {boolean} [omitEmptyOptionalFields] The omit option.
   * @returns {FlattenedEntryContent} Copied content. Note: It’s not sorted here because sorting is
   * done in `finalizeContent`.
   */
  const copy = (omitEmptyOptionalFields = false) => {
    // Setup mock for existing tests - fields with required: true should return true, others false
    isFieldRequired.mockImplementation(({ fieldConfig }) => fieldConfig.required === true);

    /** @type {FlattenedEntryContent} */
    const sortedMap = {};

    /** @type {FlattenedEntryContent} */
    const unsortedMap = {
      ...structuredClone(content),
      'variables.foo': 'foo',
      'variables.bar': 'bar',
    };

    const args = {
      locale: 'en',
      unsortedMap,
      sortedMap,
      isTomlOutput: false,
      omitEmptyOptionalFields,
    };

    fields.forEach((field) => {
      copyProperty({ ...args, key: field.name, field });
    });

    return sortedMap;
  };

  test('omit option unspecified', () => {
    expect(copy()).toEqual(content);
  });

  test('omit option disabled', () => {
    expect(copy(false)).toEqual(content);
  });

  test('omit option enabled', () => {
    // Here `variables.X` are not included but that’s fine; it’s done is `finalizeContent`
    // Note: false and 0 are preserved as valid values, empty strings, null, undefined, [], {} are
    // omitted
    expect(copy(true)).toEqual({ title: 'My Post', hidden: false, variables: {} });
  });

  test('skips internal UUIDs added to list items', () => {
    /** @type {FlattenedEntryContent} */
    const sortedMap = {};

    /** @type {FlattenedEntryContent} */
    const unsortedMap = {
      title: 'My Post',
      'organizers.0.__sc_item_id': 'uuid-123',
      'organizers.0.name': 'John Doe',
      'organizers.1.__sc_item_id': 'uuid-456',
      'organizers.1.name': 'Jane Smith',
      'program.speakers.0.__sc_item_id': 'uuid-789',
      'program.speakers.0.bio': 'Speaker bio',
    };

    const args = {
      locale: 'en',
      unsortedMap,
      sortedMap,
      isTomlOutput: false,
      omitEmptyOptionalFields: false,
    };

    // Test copying properties that should be kept
    copyProperty({ ...args, key: 'title' });
    copyProperty({ ...args, key: 'organizers.0.name' });
    copyProperty({ ...args, key: 'organizers.1.name' });
    copyProperty({ ...args, key: 'program.speakers.0.bio' });

    // Test copying properties that should be skipped (internal UUIDs)
    copyProperty({ ...args, key: 'organizers.0.__sc_item_id' });
    copyProperty({ ...args, key: 'organizers.1.__sc_item_id' });
    copyProperty({ ...args, key: 'program.speakers.0.__sc_item_id' });

    // Check that UUID keys are not in the sorted map
    expect(sortedMap).toEqual({
      title: 'My Post',
      'organizers.0.name': 'John Doe',
      'organizers.1.name': 'Jane Smith',
      'program.speakers.0.bio': 'Speaker bio',
    });

    // Check that UUID keys are removed from the unsorted map
    expect(unsortedMap).not.toHaveProperty('organizers.0.__sc_item_id');
    expect(unsortedMap).not.toHaveProperty('organizers.1.__sc_item_id');
    expect(unsortedMap).not.toHaveProperty('program.speakers.0.__sc_item_id');

    // Check that non-UUID keys are still removed from unsorted map after copying
    expect(unsortedMap).not.toHaveProperty('title');
    expect(unsortedMap).not.toHaveProperty('organizers.0.name');
    expect(unsortedMap).not.toHaveProperty('organizers.1.name');
    expect(unsortedMap).not.toHaveProperty('program.speakers.0.bio');
  });

  describe('empty value handling with omitEmptyOptionalFields', () => {
    test('preserves valid falsy values (false and 0) even when omitEmptyOptionalFields is true', () => {
      // Mock isFieldRequired to return false for optional fields
      isFieldRequired.mockReturnValue(false);

      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        booleanFalse: false,
        numberZero: 0,
      };

      const args = {
        locale: 'en',
        unsortedMap,
        sortedMap,
        isTomlOutput: false,
        omitEmptyOptionalFields: true,
      };

      copyProperty({
        ...args,
        key: 'booleanFalse',
        field: { name: 'booleanFalse', widget: 'boolean', required: false },
      });

      copyProperty({
        ...args,
        key: 'numberZero',
        field: { name: 'numberZero', widget: 'number', required: false },
      });

      // Both false and 0 should be preserved as they are valid values
      expect(sortedMap).toEqual({
        booleanFalse: false,
        numberZero: 0,
      });
    });

    test('omits undefined values for optional fields when omitEmptyOptionalFields is true', () => {
      isFieldRequired.mockReturnValue(false);

      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        undefinedValue: undefined,
      };

      const args = {
        locale: 'en',
        unsortedMap,
        sortedMap,
        isTomlOutput: false,
        omitEmptyOptionalFields: true,
      };

      copyProperty({
        ...args,
        key: 'undefinedValue',
        field: { name: 'undefinedValue', widget: 'string', required: false },
      });

      // undefined should be omitted
      expect(sortedMap).toEqual({});
    });

    test('omits null values for optional fields when omitEmptyOptionalFields is true', () => {
      isFieldRequired.mockReturnValue(false);

      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        nullValue: null,
      };

      const args = {
        locale: 'en',
        unsortedMap,
        sortedMap,
        isTomlOutput: false,
        omitEmptyOptionalFields: true,
      };

      copyProperty({
        ...args,
        key: 'nullValue',
        field: { name: 'nullValue', widget: 'string', required: false },
      });

      // null should be omitted
      expect(sortedMap).toEqual({});
    });

    test('omits empty strings for optional fields when omitEmptyOptionalFields is true', () => {
      isFieldRequired.mockReturnValue(false);

      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        emptyString: '',
      };

      const args = {
        locale: 'en',
        unsortedMap,
        sortedMap,
        isTomlOutput: false,
        omitEmptyOptionalFields: true,
      };

      copyProperty({
        ...args,
        key: 'emptyString',
        field: { name: 'emptyString', widget: 'string', required: false },
      });

      // empty string should be omitted
      expect(sortedMap).toEqual({});
    });

    test('omits empty arrays for optional fields when omitEmptyOptionalFields is true', () => {
      isFieldRequired.mockReturnValue(false);

      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        emptyArray: [],
      };

      const args = {
        locale: 'en',
        unsortedMap,
        sortedMap,
        isTomlOutput: false,
        omitEmptyOptionalFields: true,
      };

      copyProperty({
        ...args,
        key: 'emptyArray',
        field: { name: 'emptyArray', widget: 'list', required: false },
      });

      // empty array should be omitted
      expect(sortedMap).toEqual({});
    });

    test('omits empty objects for optional fields when omitEmptyOptionalFields is true', () => {
      isFieldRequired.mockReturnValue(false);

      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        emptyObject: {},
      };

      const args = {
        locale: 'en',
        unsortedMap,
        sortedMap,
        isTomlOutput: false,
        omitEmptyOptionalFields: true,
      };

      copyProperty({
        ...args,
        key: 'emptyObject',
        field: { name: 'emptyObject', widget: 'object', required: false },
      });

      // empty object should be omitted
      expect(sortedMap).toEqual({});
    });

    test('preserves empty values for required fields even when omitEmptyOptionalFields is true', () => {
      // Mock isFieldRequired to return true for required fields
      isFieldRequired.mockReturnValue(true);

      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        requiredEmpty: '',
        requiredNull: null,
        requiredUndefined: undefined,
        requiredEmptyArray: [],
        requiredEmptyObject: {},
      };

      const args = {
        locale: 'en',
        unsortedMap,
        sortedMap,
        isTomlOutput: false,
        omitEmptyOptionalFields: true,
      };

      copyProperty({
        ...args,
        key: 'requiredEmpty',
        field: { name: 'requiredEmpty', widget: 'string', required: true },
      });

      copyProperty({
        ...args,
        key: 'requiredNull',
        field: { name: 'requiredNull', widget: 'string', required: true },
      });

      copyProperty({
        ...args,
        key: 'requiredUndefined',
        field: { name: 'requiredUndefined', widget: 'string', required: true },
      });

      copyProperty({
        ...args,
        key: 'requiredEmptyArray',
        field: { name: 'requiredEmptyArray', widget: 'list', required: true },
      });

      copyProperty({
        ...args,
        key: 'requiredEmptyObject',
        field: { name: 'requiredEmptyObject', widget: 'object', required: true },
      });

      // All values should be preserved for required fields
      expect(sortedMap).toEqual({
        requiredEmpty: '',
        requiredNull: null,
        requiredUndefined: undefined,
        requiredEmptyArray: [],
        requiredEmptyObject: {},
      });
    });

    test('preserves empty values when omitEmptyOptionalFields is false', () => {
      isFieldRequired.mockReturnValue(false);

      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        emptyString: '',
        nullValue: null,
        undefinedValue: undefined,
        emptyArray: [],
        emptyObject: {},
        booleanFalse: false,
        numberZero: 0,
      };

      const args = {
        locale: 'en',
        unsortedMap,
        sortedMap,
        isTomlOutput: false,
        omitEmptyOptionalFields: false,
      };

      Object.keys(unsortedMap).forEach((key) => {
        copyProperty({
          ...args,
          key,
          field: { name: key, widget: 'string', required: false },
        });
      });

      // All values should be preserved when omitEmptyOptionalFields is false
      expect(sortedMap).toEqual({
        emptyString: '',
        nullValue: null,
        undefinedValue: undefined,
        emptyArray: [],
        emptyObject: {},
        booleanFalse: false,
        numberZero: 0,
      });
    });

    test('does not omit fields that have nested properties', () => {
      isFieldRequired.mockReturnValue(false);

      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        parent: {},
        'parent.child': 'value',
      };

      const args = {
        locale: 'en',
        unsortedMap,
        sortedMap,
        isTomlOutput: false,
        omitEmptyOptionalFields: true,
      };

      copyProperty({
        ...args,
        key: 'parent',
        field: { name: 'parent', widget: 'object', required: false },
      });

      // Even though parent is empty object, it should be preserved because it has nested properties
      expect(sortedMap).toEqual({
        parent: {},
      });
    });
  });

  describe('TOML date conversion', () => {
    test('converts ISO 8601 datetime string to TomlDate when isTomlOutput is true and field type is datetime with no format', async () => {
      const { TomlDate: TomlDateClass } = await vi.importActual('smol-toml');
      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        publishDate: '2024-01-15T10:30:00Z',
      };

      const args = {
        locale: 'en',
        unsortedMap,
        sortedMap,
        isTomlOutput: true,
        omitEmptyOptionalFields: false,
      };

      copyProperty({
        ...args,
        key: 'publishDate',
        field: { name: 'publishDate', widget: 'datetime', required: false },
      });

      // The date should be converted to a TomlDate object
      expect(sortedMap.publishDate).toBeInstanceOf(TomlDateClass);
      expect(sortedMap).toHaveProperty('publishDate');
    });

    test('does not convert date when isTomlOutput is false even if field is datetime', () => {
      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        publishDate: '2024-01-15T10:30:00Z',
      };

      const args = {
        locale: 'en',
        unsortedMap,
        sortedMap,
        isTomlOutput: false,
        omitEmptyOptionalFields: false,
      };

      copyProperty({
        ...args,
        key: 'publishDate',
        field: { name: 'publishDate', widget: 'datetime', required: false },
      });

      // The date should remain as a string
      expect(sortedMap.publishDate).toBe('2024-01-15T10:30:00Z');
      expect(typeof sortedMap.publishDate).toBe('string');
    });

    test('does not convert non-datetime value to TomlDate even if isTomlOutput is true', () => {
      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        publishDate: '2024-01-15T10:30:00Z',
      };

      const args = {
        locale: 'en',
        unsortedMap,
        sortedMap,
        isTomlOutput: true,
        omitEmptyOptionalFields: false,
      };

      copyProperty({
        ...args,
        key: 'publishDate',
        field: { name: 'publishDate', widget: 'string', required: false },
      });

      // The date should remain as a string because field type is not 'datetime'
      expect(sortedMap.publishDate).toBe('2024-01-15T10:30:00Z');
      expect(typeof sortedMap.publishDate).toBe('string');
    });

    test('does not convert string that does not match date regex to TomlDate', () => {
      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        title: 'Some random string',
      };

      const args = {
        locale: 'en',
        unsortedMap,
        sortedMap,
        isTomlOutput: true,
        omitEmptyOptionalFields: false,
      };

      copyProperty({
        ...args,
        key: 'title',
        field: { name: 'title', widget: 'datetime', required: false },
      });

      // The string should remain as-is because it does not match the date regex
      expect(sortedMap.title).toBe('Some random string');
      expect(typeof sortedMap.title).toBe('string');
    });

    test('does not convert date when datetime format is configured', () => {
      // Reset mock to return a format object
      /** @type {any} */
      parseDateTimeConfig.mockReturnValueOnce({ format: 'YYYY-MM-DD' });

      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        publishDate: '2024-01-15T10:30:00Z',
      };

      const args = {
        locale: 'en',
        unsortedMap,
        sortedMap,
        isTomlOutput: true,
        omitEmptyOptionalFields: false,
      };

      copyProperty({
        ...args,
        key: 'publishDate',
        field: { name: 'publishDate', widget: 'datetime', required: false },
      });

      // The date should remain as a string because a custom format is defined
      expect(sortedMap.publishDate).toBe('2024-01-15T10:30:00Z');
      expect(typeof sortedMap.publishDate).toBe('string');

      // Reset the mock for other tests
      parseDateTimeConfig.mockReturnValueOnce({ format: null });
    });

    test('handles exception when TomlDate constructor throws', async () => {
      // eslint-disable-next-line no-unused-vars
      const _tomlDateModule = await vi.importActual('smol-toml');

      // Mock TomlDate to throw an error
      /**
       * Mock TomlDate class that throws an error.
       */
      class MockTomlDateThrows {
        /**
         * Constructor that throws.
         */
        constructor() {
          throw new Error('Invalid date format');
        }
      }

      vi.stubGlobal('TomlDate', MockTomlDateThrows);

      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        publishDate: '2024-01-15T10:30:00Z',
      };

      const args = {
        locale: 'en',
        unsortedMap,
        sortedMap,
        isTomlOutput: true,
        omitEmptyOptionalFields: false,
      };

      // This should not throw and instead keep the original value
      copyProperty({
        ...args,
        key: 'publishDate',
        field: { name: 'publishDate', widget: 'datetime', required: false },
      });

      // The catch block should prevent the error from propagating
      // and the value should be stored in sortedMap
      expect(sortedMap).toHaveProperty('publishDate');
      // The copy function does not throw when TomlDate constructor fails
      // The value will be stored as whatever the original type was
      expect(sortedMap.publishDate).toBeDefined();

      // Restore the original TomlDate
      vi.unstubAllGlobals();
    });
  });
});

describe('Test isValueEmpty()', () => {
  test('returns true for undefined', () => {
    expect(isValueEmpty(undefined)).toBe(true);
  });

  test('returns true for null', () => {
    expect(isValueEmpty(null)).toBe(true);
  });

  test('returns true for empty string', () => {
    expect(isValueEmpty('')).toBe(true);
  });

  test('returns true for empty array', () => {
    expect(isValueEmpty([])).toBe(true);
  });

  test('returns true for empty object', () => {
    expect(isValueEmpty({})).toBe(true);
  });

  test('returns false for boolean false (valid falsy value)', () => {
    expect(isValueEmpty(false)).toBe(false);
  });

  test('returns false for number zero (valid falsy value)', () => {
    expect(isValueEmpty(0)).toBe(false);
  });

  test('returns false for boolean true', () => {
    expect(isValueEmpty(true)).toBe(false);
  });

  test('returns false for positive numbers', () => {
    expect(isValueEmpty(1)).toBe(false);
    expect(isValueEmpty(42)).toBe(false);
    expect(isValueEmpty(3.14)).toBe(false);
  });

  test('returns false for negative numbers', () => {
    expect(isValueEmpty(-1)).toBe(false);
    expect(isValueEmpty(-42)).toBe(false);
    expect(isValueEmpty(-3.14)).toBe(false);
  });

  test('returns false for non-empty strings', () => {
    expect(isValueEmpty('hello')).toBe(false);
    expect(isValueEmpty(' ')).toBe(false); // space is not empty
    expect(isValueEmpty('0')).toBe(false); // string '0' is not empty
    expect(isValueEmpty('false')).toBe(false); // string 'false' is not empty
  });

  test('returns false for arrays with elements', () => {
    expect(isValueEmpty([1])).toBe(false);
    expect(isValueEmpty([''])).toBe(false); // array with empty string is not empty
    expect(isValueEmpty([null])).toBe(false); // array with null is not empty
    expect(isValueEmpty([undefined])).toBe(false); // array with undefined is not empty
    expect(isValueEmpty([1, 2, 3])).toBe(false);
  });

  test('returns false for objects with properties', () => {
    expect(isValueEmpty({ a: 1 })).toBe(false);
    expect(isValueEmpty({ key: '' })).toBe(false); // object with empty string value is not empty
    expect(isValueEmpty({ key: null })).toBe(false); // object with null value is not empty
    // object with undefined value is not empty
    expect(isValueEmpty({ key: undefined })).toBe(false);
    expect(isValueEmpty({ a: 1, b: 2 })).toBe(false);
  });

  test('returns false for functions', () => {
    expect(isValueEmpty(() => {})).toBe(false);
  });

  test('returns true for Date objects (treated as objects with no enumerable keys)', () => {
    expect(isValueEmpty(new Date())).toBe(true);
  });

  test('returns true for RegExp objects (treated as objects with no enumerable keys)', () => {
    expect(isValueEmpty(/test/)).toBe(true);
  });

  test('returns true for Set objects (treated as objects with no enumerable keys)', () => {
    expect(isValueEmpty(new Set())).toBe(true);
    expect(isValueEmpty(new Set([1, 2, 3]))).toBe(true);
  });

  test('returns true for Map objects (treated as objects with no enumerable keys)', () => {
    expect(isValueEmpty(new Map())).toBe(true);
    expect(isValueEmpty(new Map([['key', 'value']]))).toBe(true);
  });

  test('handles edge cases with nested empty structures', () => {
    // Arrays containing only empty values are still not empty
    expect(isValueEmpty([{}])).toBe(false);
    expect(isValueEmpty([[]])).toBe(false);
    expect(isValueEmpty([''])).toBe(false);

    // Objects with empty values are still not empty
    expect(isValueEmpty({ nested: {} })).toBe(false);
    expect(isValueEmpty({ arr: [] })).toBe(false);
    expect(isValueEmpty({ str: '' })).toBe(false);
  });

  test('handles special number values', () => {
    expect(isValueEmpty(NaN)).toBe(false); // NaN is not considered empty
    expect(isValueEmpty(Infinity)).toBe(false);
    expect(isValueEmpty(-Infinity)).toBe(false);
  });

  test('handles bigint values', () => {
    expect(isValueEmpty(0n)).toBe(false); // BigInt 0 is not considered empty
    expect(isValueEmpty(1n)).toBe(false);
  });

  test('handles symbol values', () => {
    expect(isValueEmpty(Symbol('test'))).toBe(false);
    expect(isValueEmpty(Symbol.iterator)).toBe(false);
  });

  test('handles objects with non-enumerable properties', () => {
    const obj = {};

    Object.defineProperty(obj, 'hidden', {
      value: 'test',
      enumerable: false,
    });

    // Object.keys() only returns enumerable properties, so this is empty
    expect(isValueEmpty(obj)).toBe(true);
  });

  test('comprehensive validation of the specific empty values mentioned in comments', () => {
    // These are the specific values mentioned in the JSDoc comment
    expect(isValueEmpty(undefined)).toBe(true);
    expect(isValueEmpty(null)).toBe(true);
    expect(isValueEmpty('')).toBe(true);
    expect(isValueEmpty([])).toBe(true);
    expect(isValueEmpty({})).toBe(true);

    // And confirming that false and 0 are NOT empty (as mentioned in the comment)
    expect(isValueEmpty(false)).toBe(false);
    expect(isValueEmpty(0)).toBe(false);
  });
});

describe('Test serializeContent()', () => {
  test('serializes content with standard fields', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: 'slug' },
        },
      },
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'body', widget: 'markdown' },
      ],
      isIndexFile: false,
    };

    const valueMap = {
      title: 'Test Post',
      body: 'Content here',
    };

    const result = serializeContent({ draft, locale: 'en', valueMap });

    expect(result).toEqual({
      title: 'Test Post',
      body: 'Content here',
    });
  });

  test('serializes content with root list field', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'tags',
      collection: {
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: '' },
        },
      },
      fields: [
        {
          name: 'tags',
          widget: 'list',
          fields: [{ name: 'name', widget: 'string' }],
        },
      ],
      isIndexFile: false,
    };

    const valueMap = {
      'tags.0.name': 'JavaScript',
      'tags.1.name': 'TypeScript',
    };

    const result = serializeContent({ draft, locale: 'en', valueMap });

    // When there's a root list field, should return the array directly
    expect(result).toEqual([{ name: 'JavaScript' }, { name: 'TypeScript' }]);
  });

  test('serializes content with TOML format', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _file: { format: 'toml' },
        _i18n: {
          canonicalSlug: { key: 'slug' },
        },
      },
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'date', widget: 'datetime' },
      ],
      isIndexFile: false,
    };

    const valueMap = {
      title: 'Test Post',
      date: '2023-01-15T10:30:00Z',
    };

    const result = serializeContent({ draft, locale: 'en', valueMap });

    expect(result).toHaveProperty('title', 'Test Post');
    expect(result).toHaveProperty('date');
  });

  test('serializes content with collectionFile', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'settings',
      collectionFile: {
        name: 'general',
        _file: { format: 'yaml' },
        _i18n: {
          canonicalSlug: { key: '' },
        },
      },
      fields: [
        { name: 'siteName', widget: 'string' },
        { name: 'description', widget: 'text' },
      ],
      isIndexFile: false,
    };

    const valueMap = {
      siteName: 'My Site',
      description: 'A great website',
    };

    const result = serializeContent({ draft, locale: 'en', valueMap });

    expect(result).toEqual({
      siteName: 'My Site',
      description: 'A great website',
    });
  });

  test('serializes content with index file', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _file: { format: 'yaml' },
        _i18n: {
          canonicalSlug: { key: 'slug' },
        },
      },
      fields: [{ name: 'title', widget: 'string' }],
      isIndexFile: true,
    };

    const valueMap = {
      title: 'Index Post',
    };

    const result = serializeContent({ draft, locale: 'en', valueMap });

    expect(result).toEqual({
      title: 'Index Post',
    });
  });

  test('handles empty root list field', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'tags',
      collection: {
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: '' },
        },
      },
      fields: [
        {
          name: 'tags',
          widget: 'list',
          fields: [{ name: 'name', widget: 'string' }],
        },
      ],
      isIndexFile: false,
    };

    const valueMap = {};
    const result = serializeContent({ draft, locale: 'en', valueMap });

    // Should return empty array for root list field with no content
    expect(result).toEqual([]);
  });

  test('serializes content with nested objects', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: 'slug' },
        },
      },
      fields: [
        { name: 'title', widget: 'string' },
        {
          name: 'author',
          widget: 'object',
          fields: [
            { name: 'name', widget: 'string' },
            { name: 'email', widget: 'string' },
          ],
        },
      ],
      isIndexFile: false,
    };

    const valueMap = {
      title: 'Test Post',
      'author.name': 'John Doe',
      'author.email': 'john@example.com',
    };

    const result = serializeContent({ draft, locale: 'en', valueMap });

    expect(result).toEqual({
      title: 'Test Post',
      author: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    });
  });

  test('serializes content with canonical slug key present', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: 'slug' },
        },
      },
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'slug', widget: 'string' },
        { name: 'body', widget: 'markdown' },
      ],
      isIndexFile: false,
    };

    const valueMap = {
      title: 'Test Post',
      slug: 'test-post-slug',
      body: 'Content here',
    };

    const result = serializeContent({ draft, locale: 'en', valueMap });

    // The slug should be present in the result
    expect(result).toEqual({
      title: 'Test Post',
      slug: 'test-post-slug',
      body: 'Content here',
    });
  });

  test('serializes content with keyvalue field', () => {
    getField.mockImplementation((args) => {
      const { keyPath } = args;

      if (keyPath === 'metadata') {
        return { name: 'metadata', widget: 'keyvalue' };
      }

      return { name: keyPath, widget: 'string' };
    });

    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: '' },
        },
      },
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'metadata', widget: 'keyvalue' },
      ],
      isIndexFile: false,
    };

    const valueMap = {
      title: 'Test Post',
      'metadata.author': 'John Doe',
      'metadata.version': '1.0',
      'metadata.category': 'tech',
    };

    const result = serializeContent({ draft, locale: 'en', valueMap });

    expect(result).toEqual({
      title: 'Test Post',
      metadata: {
        author: 'John Doe',
        version: '1.0',
        category: 'tech',
      },
    });
  });

  test('serializes content with remainder properties not in field list', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: '' },
        },
      },
      fields: [{ name: 'title', widget: 'string' }],
      isIndexFile: false,
    };

    // Use flattened format since that's what the function expects
    const valueMap = {
      title: 'Test Post',
      customField1: 'value1',
      customField2: 'value2',
      'nested.prop': 'value',
    };

    const result = serializeContent({ draft, locale: 'en', valueMap });

    // All properties should be present, including those not in the field list
    expect(result).toEqual({
      title: 'Test Post',
      customField1: 'value1',
      customField2: 'value2',
      nested: { prop: 'value' },
    });
  });

  test('serializes content with list field using wildcard pattern matching', async () => {
    // Mock createKeyPathList to return a wildcard pattern for list items
    const { createKeyPathList } = await import('$lib/services/contents/draft/save/key-path');

    vi.mocked(createKeyPathList).mockReturnValueOnce(['title', 'items.*']);

    getField.mockImplementation((args) => {
      const { keyPath } = args;

      if (keyPath === 'items.*') {
        return { name: 'items', widget: 'list' };
      }

      return { name: keyPath, widget: 'string' };
    });

    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: '' },
        },
      },
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'items', widget: 'list' },
      ],
      isIndexFile: false,
    };

    const valueMap = {
      title: 'Test Post',
      'items.0': 'First',
      'items.1': 'Second',
      'items.2': 'Third',
    };

    const result = serializeContent({ draft, locale: 'en', valueMap });

    expect(result).toEqual({
      title: 'Test Post',
      items: ['First', 'Second', 'Third'],
    });
  });

  describe('root list field with TOML handling (lines 215-218)', () => {
    test('returns root list field array when isTomlOutput is false and hasRootListField is true', () => {
      /** @type {any} */
      const draft = {
        collectionName: 'items',
        collection: {
          _file: { format: 'json' },
          _i18n: {
            canonicalSlug: { key: '' },
          },
        },
        fields: [
          {
            name: 'items',
            widget: 'list',
            fields: [{ name: 'title', widget: 'string' }],
          },
        ],
        isIndexFile: false,
      };

      const valueMap = {
        'items.0.title': 'Item 1',
        'items.1.title': 'Item 2',
      };

      const result = serializeContent({ draft, locale: 'en', valueMap });

      // With non-TOML format and root list field, should return the array directly (lines 215-218)
      expect(result).toEqual([{ title: 'Item 1' }, { title: 'Item 2' }]);
    });

    test('returns root list field array with empty fallback when array is undefined', () => {
      /** @type {any} */
      const draft = {
        collectionName: 'items',
        collection: {
          _file: { format: 'json' },
          _i18n: {
            canonicalSlug: { key: '' },
          },
        },
        fields: [
          {
            name: 'items',
            widget: 'list',
            fields: [{ name: 'title', widget: 'string' }],
          },
        ],
        isIndexFile: false,
      };

      const valueMap = {};
      const result = serializeContent({ draft, locale: 'en', valueMap });

      // With no content, should return empty array via the ?? [] fallback
      expect(result).toEqual([]);
    });

    test('returns full object when isTomlOutput is true even if hasRootListField is true', () => {
      /** @type {any} */
      const draft = {
        collectionName: 'items',
        collection: {
          _file: { format: 'toml' },
          _i18n: {
            canonicalSlug: { key: '' },
          },
        },
        fields: [
          {
            name: 'items',
            widget: 'list',
            fields: [{ name: 'title', widget: 'string' }],
          },
        ],
        isIndexFile: false,
      };

      const valueMap = {
        'items.0.title': 'Item 1',
        'items.1.title': 'Item 2',
      };

      const result = serializeContent({ draft, locale: 'en', valueMap });

      // With TOML format, should not apply the root list field special case (line 217 condition)
      // Instead, should return the full object structure
      expect(Array.isArray(result)).toBe(false);
      expect(result).toEqual({
        items: [{ title: 'Item 1' }, { title: 'Item 2' }],
      });
    });

    test('returns full object when isTomlOutput is true with toml-frontmatter format and root list field', () => {
      /** @type {any} */
      const draft = {
        collectionName: 'items',
        collection: {
          _file: { format: 'toml-frontmatter' },
          _i18n: {
            canonicalSlug: { key: '' },
          },
        },
        fields: [
          {
            name: 'items',
            widget: 'list',
            fields: [{ name: 'title', widget: 'string' }],
          },
        ],
        isIndexFile: false,
      };

      const valueMap = {
        'items.0.title': 'Item 1',
        'items.1.title': 'Item 2',
      };

      const result = serializeContent({ draft, locale: 'en', valueMap });

      // With TOML-frontmatter format, should not apply the root list field special case
      // because TOML doesn't support top-level arrays (see comment on lines 216-217)
      expect(Array.isArray(result)).toBe(false);
      expect(result).toEqual({
        items: [{ title: 'Item 1' }, { title: 'Item 2' }],
      });
    });

    test('applies special root list handling only for non-TOML formats', () => {
      /** @type {any} */
      const draft = {
        collectionName: 'tags',
        collection: {
          _file: { format: 'yaml' },
          _i18n: {
            canonicalSlug: { key: '' },
          },
        },
        fields: [
          {
            name: 'tags',
            widget: 'list',
            fields: [{ name: 'name', widget: 'string' }],
          },
        ],
        isIndexFile: false,
      };

      const valueMap = {
        'tags.0.name': 'yaml-tag',
        'tags.1.name': 'another-tag',
      };

      const result = serializeContent({ draft, locale: 'en', valueMap });

      // YAML is not TOML, so the special case should apply
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([{ name: 'yaml-tag' }, { name: 'another-tag' }]);
    });

    test('respects root list field when content has first field value undefined but with nested items', () => {
      /** @type {any} */
      const draft = {
        collectionName: 'items',
        collection: {
          _file: { format: 'json' },
          _i18n: {
            canonicalSlug: { key: '' },
          },
        },
        fields: [
          {
            name: 'items',
            widget: 'list',
            fields: [{ name: 'title', widget: 'string' }],
          },
        ],
        isIndexFile: false,
      };

      const valueMap = {
        'items.0.title': 'Item 1',
      };

      const result = serializeContent({ draft, locale: 'en', valueMap });

      // Should return array extracted from first field (items) due to root list special case
      expect(result).toEqual([{ title: 'Item 1' }]);
    });
  });
});
