import { describe, expect, test, vi } from 'vitest';

import { copyProperty, isValueEmpty } from '$lib/services/contents/draft/save/serialize';

vi.mock('$lib/services/assets');

const { isFieldRequired } = vi.hoisted(() => ({
  isFieldRequired: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  isFieldRequired,
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
