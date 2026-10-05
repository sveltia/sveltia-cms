import { describe, expect, test, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';
import { copyProperty, serializeContent } from '$lib/services/contents/draft/save/serialize';

vi.mock('$lib/services/assets');
vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: {} },
}));
vi.mock('$lib/services/contents/draft/save/key-path', () => ({
  createKeyPathList: vi.fn((fields) => fields.map((/** @type {any} */ f) => f.name)),
}));

const { isFieldRequired, getField } = vi.hoisted(() => ({
  isFieldRequired: vi.fn(),
  getField: vi.fn((args) => {
    const { keyPath } = args;

    return { name: keyPath, widget: 'string' };
  }),
}));

const { getFieldKind } = vi.hoisted(() => ({
  // Field types named `custom-*` stand for the ones registered with `CMS.registerFieldType()`
  getFieldKind: vi.fn((field) => (field.widget?.startsWith('custom-') ? 'custom' : 'builtin')),
}));

const { hasRootField } = vi.hoisted(() => ({
  hasRootField: vi.fn(
    (fields, fieldType) =>
      fields.length === 1 &&
      fields[0].widget === fieldType &&
      'root' in fields[0] &&
      fields[0].root === true,
  ),
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
  getFieldKind,
  hasRootField,
}));

vi.mock('$lib/services/contents/fields/date-time/config', () => ({
  parseDateTimeConfig,
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

  test('skips internal original key path tracking added to list items', () => {
    /** @type {FlattenedEntryContent} */
    const sortedMap = {};

    /** @type {FlattenedEntryContent} */
    const unsortedMap = {
      title: 'My Post',
      'organizers.0.__sc_item_original_key_path': 'organizers.1',
      'organizers.0.name': 'Jane Smith',
      'organizers.1.__sc_item_original_key_path': 'organizers.0',
      'organizers.1.name': 'John Doe',
    };

    const args = {
      locale: 'en',
      unsortedMap,
      sortedMap,
      isTomlOutput: false,
      omitEmptyOptionalFields: false,
    };

    copyProperty({ ...args, key: 'title' });
    copyProperty({ ...args, key: 'organizers.0.name' });
    copyProperty({ ...args, key: 'organizers.1.name' });
    copyProperty({ ...args, key: 'organizers.0.__sc_item_original_key_path' });
    copyProperty({ ...args, key: 'organizers.1.__sc_item_original_key_path' });

    expect(sortedMap).toEqual({
      title: 'My Post',
      'organizers.0.name': 'Jane Smith',
      'organizers.1.name': 'John Doe',
    });

    expect(unsortedMap).not.toHaveProperty('organizers.0.__sc_item_original_key_path');
    expect(unsortedMap).not.toHaveProperty('organizers.1.__sc_item_original_key_path');
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

    test('omits optional object with only empty children (typed list item scenario)', () => {
      isFieldRequired.mockReturnValue(false);

      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        'list.0.optionalObject': null,
        'list.0.optionalObject.foo': '',
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
        key: 'list.0.optionalObject',
        field: { name: 'optionalObject', widget: 'object', required: false },
      });

      // Parent and its empty children should all be omitted
      expect(sortedMap).toEqual({});
      // Children should also be removed from unsortedMap
      expect(unsortedMap).not.toHaveProperty('list.0.optionalObject.foo');
    });

    test('preserves optional object when at least one child is non-empty', () => {
      isFieldRequired.mockReturnValue(false);

      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        'list.0.optionalObject': null,
        'list.0.optionalObject.foo': 'has value',
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
        key: 'list.0.optionalObject',
        field: { name: 'optionalObject', widget: 'object', required: false },
      });

      // Parent should be preserved because child has a non-empty value
      expect(sortedMap).toEqual({
        'list.0.optionalObject': null,
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

    test('keeps an optional date when empty optional fields are omitted', async () => {
      const { TomlDate: TomlDateClass } = await vi.importActual('smol-toml');
      /** @type {FlattenedEntryContent} */
      const sortedMap = {};

      /** @type {FlattenedEntryContent} */
      const unsortedMap = {
        publishDate: '2024-01-15T10:30:00Z',
      };

      isFieldRequired.mockReturnValue(false);

      copyProperty({
        locale: 'en',
        unsortedMap,
        sortedMap,
        isTomlOutput: true,
        omitEmptyOptionalFields: true,
        key: 'publishDate',
        field: { name: 'publishDate', widget: 'datetime', required: false },
      });

      // A `TomlDate` is an object without any keys, but it’s not empty
      expect(sortedMap.publishDate).toBeInstanceOf(TomlDateClass);
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

    test('sets invalid date to undefined when string does not match date format', () => {
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

      // Invalid date strings result in undefined to prevent serialization errors
      expect(sortedMap.title).toBeUndefined();
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
         * @throws {Error} Always throws an error to simulate invalid date format.
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

  test('places the order field right after the canonical slug', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        reorder: true,
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: 'translationKey' },
        },
      },
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'body', widget: 'markdown' },
      ],
      isIndexFile: false,
    };

    const valueMap = {
      title: 'Test',
      body: 'Body',
      translationKey: 'abc',
      order: 3,
    };

    const result = serializeContent({ draft, locale: 'en', valueMap });

    // The output property order should be: canonical slug, then order, then declared fields.
    expect(Object.keys(result)).toEqual(['translationKey', 'order', 'title', 'body']);
    expect(result.order).toBe(3);
  });

  test('places the aliases between the canonical slug and the order field', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _type: 'entry',
        reorder: true,
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: 'translationKey' },
        },
      },
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'body', widget: 'markdown' },
      ],
      isIndexFile: false,
    };

    const valueMap = {
      title: 'Test',
      body: 'Body',
      translationKey: 'abc',
      order: 3,
      'aliases.1': '/posts/older',
      'aliases.0': '/posts/old',
    };

    const result = serializeContent({ draft, locale: 'en', valueMap });

    expect(Object.keys(result)).toEqual(['translationKey', 'aliases', 'order', 'title', 'body']);
    expect(result.aliases).toEqual(['/posts/old', '/posts/older']);
  });

  test('places the aliases stored under the `aliases_field` property name', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _type: 'entry',
        aliases_field: 'redirect_from',
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: '' },
        },
      },
      fields: [{ name: 'title', widget: 'string' }],
      isIndexFile: false,
    };

    const valueMap = { title: 'Test', 'redirect_from.0': '/posts/old' };
    const result = serializeContent({ draft, locale: 'en', valueMap });

    expect(Object.keys(result)).toEqual(['redirect_from', 'title']);
  });

  test('places a non-list alias value as is', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _type: 'entry',
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: '' },
        },
      },
      fields: [{ name: 'title', widget: 'string' }],
      isIndexFile: false,
    };

    const valueMap = { title: 'Test', aliases: '/posts/old' };
    const result = serializeContent({ draft, locale: 'en', valueMap });

    expect(Object.keys(result)).toEqual(['aliases', 'title']);
    expect(result.aliases).toBe('/posts/old');
  });

  test('leaves the aliases in place when a field with the same name is configured', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _type: 'entry',
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: '' },
        },
      },
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'aliases', widget: 'list' },
      ],
      isIndexFile: false,
    };

    const valueMap = { title: 'Test', 'aliases.0': '/posts/old' };
    const result = serializeContent({ draft, locale: 'en', valueMap });

    // The field keeps its configured position instead of being hoisted to the top
    expect(Object.keys(result)).toEqual(['title', 'aliases']);
  });

  test('leaves the aliases in place when the `aliases_field` option is `false`', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _type: 'entry',
        aliases_field: false,
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: '' },
        },
      },
      fields: [{ name: 'title', widget: 'string' }],
      isIndexFile: false,
    };

    const valueMap = { title: 'Test', 'aliases.0': '/posts/old' };
    const result = serializeContent({ draft, locale: 'en', valueMap });

    // Unconfigured properties are moved to the end of the output
    expect(Object.keys(result)).toEqual(['title', 'aliases']);
  });

  test('omits the order field when the value is missing', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        reorder: true,
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: 'translationKey' },
        },
      },
      fields: [{ name: 'title', widget: 'string' }],
      isIndexFile: false,
    };

    const valueMap = { title: 'Test', translationKey: 'abc' };
    const result = serializeContent({ draft, locale: 'en', valueMap });

    expect(Object.keys(result)).toEqual(['translationKey', 'title']);
    expect('order' in result).toBe(false);
  });

  test('uses the configured custom order key', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        reorder: { key: 'priority' },
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: '' },
        },
      },
      fields: [{ name: 'title', widget: 'string' }],
      isIndexFile: false,
    };

    const valueMap = { title: 'Test', priority: 7 };
    const result = serializeContent({ draft, locale: 'en', valueMap });

    expect(Object.keys(result)).toEqual(['priority', 'title']);
    expect(result.priority).toBe(7);
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
          root: true,
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
          root: true,
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

  describe('custom field', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: '' },
        },
      },
      fields: [],
      isIndexFile: false,
    };

    test('keeps an object value in place and in the order the control gave the properties', async () => {
      const { createKeyPathList } = await import('$lib/services/contents/draft/save/key-path');

      vi.mocked(createKeyPathList).mockReturnValueOnce(['title', 'photo', 'body']);
      getField.mockImplementation(({ keyPath }) => ({
        name: keyPath,
        widget: keyPath === 'photo' ? 'custom-photo' : 'string',
      }));

      const result = serializeContent({
        draft,
        locale: 'en',
        valueMap: {
          body: 'Text',
          title: 'Title',
          'photo.original': '/a.jpg',
          'photo.thumbnail': '/a-thumb.webp',
          'photo.aspectRatio': 1.5,
        },
      });

      expect(JSON.stringify(result)).toBe(
        JSON.stringify({
          title: 'Title',
          photo: { original: '/a.jpg', thumbnail: '/a-thumb.webp', aspectRatio: 1.5 },
          body: 'Text',
        }),
      );
    });

    test('keeps a primitive or array value in place', async () => {
      const { createKeyPathList } = await import('$lib/services/contents/draft/save/key-path');

      vi.mocked(createKeyPathList).mockReturnValueOnce(['color', 'tags', 'body']);
      getField.mockImplementation(({ keyPath }) => ({
        name: keyPath,
        widget: keyPath === 'body' ? 'string' : 'custom-field',
      }));

      const result = serializeContent({
        draft,
        locale: 'en',
        valueMap: { body: 'Text', 'tags.0': 'b', 'tags.1': 'a', color: '#fff' },
      });

      expect(JSON.stringify(result)).toBe(
        JSON.stringify({ color: '#fff', tags: ['b', 'a'], body: 'Text' }),
      );
    });

    test('keeps an object value of a field in a list item in place', async () => {
      const { createKeyPathList } = await import('$lib/services/contents/draft/save/key-path');

      vi.mocked(createKeyPathList).mockReturnValueOnce([
        'items',
        'items.*.photo',
        'items.*.caption',
      ]);
      getField.mockImplementation(({ keyPath }) => ({
        name: keyPath,
        widget: keyPath.endsWith('.photo') ? 'custom-photo' : 'string',
      }));

      const result = serializeContent({
        draft,
        locale: 'en',
        valueMap: {
          'items.0.caption': 'First',
          'items.0.photo.src': '/a.jpg',
          'items.0.photo.alt': 'A',
          'items.1.caption': 'Second',
        },
      });

      expect(JSON.stringify(result)).toBe(
        JSON.stringify({
          items: [{ photo: { src: '/a.jpg', alt: 'A' }, caption: 'First' }, { caption: 'Second' }],
        }),
      );
    });
  });

  describe('hidden field', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: '' },
        },
      },
      fields: [],
      isIndexFile: false,
    };

    test('keeps a list value read from a file in place', async () => {
      const { createKeyPathList } = await import('$lib/services/contents/draft/save/key-path');

      vi.mocked(createKeyPathList).mockReturnValueOnce(['title', 'tags', 'body']);
      getField.mockImplementation(({ keyPath }) => ({
        name: keyPath,
        widget: keyPath === 'tags' ? 'hidden' : 'string',
      }));

      const result = serializeContent({
        draft,
        locale: 'en',
        valueMap: { title: 'Title', 'tags.0': 'b', 'tags.1': 'a', body: 'Text' },
      });

      expect(JSON.stringify(result)).toBe(
        JSON.stringify({ title: 'Title', tags: ['b', 'a'], body: 'Text' }),
      );
    });

    test('keeps an object value of a field in a list item in place', async () => {
      const { createKeyPathList } = await import('$lib/services/contents/draft/save/key-path');

      vi.mocked(createKeyPathList).mockReturnValueOnce(['items', 'items.*.meta', 'items.*.name']);
      getField.mockImplementation(({ keyPath }) => ({
        name: keyPath,
        widget: keyPath.endsWith('.meta') ? 'hidden' : 'string',
      }));

      const result = serializeContent({
        draft,
        locale: 'en',
        valueMap: { 'items.0.name': 'First', 'items.0.meta.id': 1, 'items.0.meta.kind': 'a' },
      });

      expect(JSON.stringify(result)).toBe(
        JSON.stringify({ items: [{ meta: { id: 1, kind: 'a' }, name: 'First' }] }),
      );
    });
  });

  describe('code field', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: '' },
        },
      },
      fields: [],
      isIndexFile: false,
    };

    test('keeps the code and the language in the order of the custom keys', async () => {
      const { createKeyPathList } = await import('$lib/services/contents/draft/save/key-path');

      vi.mocked(createKeyPathList).mockReturnValueOnce(['script', 'body']);
      getField.mockImplementation(({ keyPath }) => ({
        name: keyPath,
        widget: keyPath === 'script' ? 'code' : 'string',
      }));

      const result = serializeContent({
        draft,
        locale: 'en',
        valueMap: {
          body: 'Text',
          'script.source': 'print(1)',
          'script.language': 'python',
          script: {},
        },
      });

      expect(JSON.stringify(result)).toBe(
        JSON.stringify({ script: { source: 'print(1)', language: 'python' }, body: 'Text' }),
      );
    });
  });

  describe('keyvalue field in list field', () => {
    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _file: { format: 'json' },
        _i18n: {
          canonicalSlug: { key: '' },
        },
      },
      fields: [{ name: 'test_list', widget: 'list' }],
      isIndexFile: false,
    };

    test('serializes list with `fields` containing a keyvalue subfield as array', async () => {
      const { createKeyPathList } = await import('$lib/services/contents/draft/save/key-path');

      vi.mocked(createKeyPathList).mockReturnValueOnce([
        'test_list',
        'test_list.*.title',
        'test_list.*.pairs',
      ]);

      getField.mockImplementation(({ keyPath }) =>
        keyPath === 'test_list.*.pairs'
          ? { name: 'pairs', widget: 'keyvalue' }
          : { name: keyPath, widget: 'string' },
      );

      const valueMap = {
        'test_list.0.title': 'First',
        'test_list.0.pairs.foo': 'bar',
        'test_list.1.title': 'Second',
        'test_list.1.pairs.0': 'zero',
        'test_list.1.pairs.1': 'one',
        'test_list.1.pairs.': 'empty',
        'test_list.2.title': 'Third',
        'test_list.2.pairs': {},
      };

      const result = serializeContent({ draft, locale: 'en', valueMap });

      expect(result).toEqual({
        test_list: [
          { title: 'First', pairs: { foo: 'bar' } },
          { title: 'Second', pairs: { 0: 'zero', 1: 'one', '': 'empty' } },
          { title: 'Third', pairs: {} },
        ],
      });
      expect(Array.isArray(result.test_list)).toBe(true);
      expect(Array.isArray(result.test_list[1].pairs)).toBe(false);
      expect(JSON.stringify(result)).not.toContain('*');
    });

    test('saves a field without pairs as an empty object, whether it holds the placeholder', async () => {
      const { createKeyPathList } = await import('$lib/services/contents/draft/save/key-path');

      vi.mocked(createKeyPathList).mockReturnValueOnce(['shown', 'unrendered']);
      getField.mockImplementation(({ keyPath }) => ({ name: keyPath, widget: 'keyvalue' }));

      // The editor stores the placeholder once it has been shown, which the other one never was
      expect(serializeContent({ draft, locale: 'en', valueMap: { shown: null } })).toEqual({
        shown: {},
        unrendered: {},
      });

      // A value the file holds where an object is expected is left alone
      vi.mocked(createKeyPathList).mockReturnValueOnce(['shown']);
      expect(serializeContent({ draft, locale: 'en', valueMap: { shown: 'text' } })).toEqual({
        shown: 'text',
      });
    });

    test('leaves out a blank pair, keeping a pair with an empty key and a value', async () => {
      const { createKeyPathList } = await import('$lib/services/contents/draft/save/key-path');

      vi.mocked(createKeyPathList).mockReturnValueOnce(['blank', 'labelled']);
      getField.mockImplementation(({ keyPath }) => ({ name: keyPath, widget: 'keyvalue' }));

      const result = serializeContent({
        draft,
        locale: 'en',
        // The blank pair of a required field’s default value, next to the one a file can hold
        valueMap: { 'blank.': '', 'labelled.': 'value', 'labelled.a': '1' },
      });

      expect(result).toEqual({ blank: {}, labelled: { '': 'value', a: '1' } });
    });

    test('serializes list with a keyvalue `field` as array', async () => {
      const { createKeyPathList } = await import('$lib/services/contents/draft/save/key-path');

      vi.mocked(createKeyPathList).mockReturnValueOnce(['test_list', 'test_list.*']);

      getField.mockImplementation(({ keyPath }) =>
        keyPath === 'test_list.*'
          ? { name: 'test_keyvalue', widget: 'keyvalue' }
          : { name: keyPath, widget: 'string' },
      );

      const valueMap = {
        'test_list.0.foo': 'bar',
        'test_list.1.0': 'zero',
      };

      const result = serializeContent({ draft, locale: 'en', valueMap });

      expect(result).toEqual({ test_list: [{ foo: 'bar' }, { 0: 'zero' }] });
      expect(Array.isArray(result.test_list)).toBe(true);
      expect(Array.isArray(result.test_list[1])).toBe(false);
    });

    test('serializes keyvalue subfields of a list with variable types as objects', async () => {
      const { createKeyPathList } = await import('$lib/services/contents/draft/save/key-path');

      vi.mocked(createKeyPathList).mockReturnValueOnce([
        'test_list',
        'test_list.*.type',
        'test_list.*.pairs',
      ]);

      // The wildcard key path can’t be resolved without knowing the item type, so the field is
      // only found with a concrete key path
      getField.mockImplementation(({ keyPath }) => {
        if (keyPath === 'test_list.0.pairs') {
          return { name: 'pairs', widget: 'keyvalue' };
        }

        if (keyPath === 'test_list.1.pairs') {
          return { name: 'pairs', widget: 'string' };
        }

        return keyPath === 'test_list.*.pairs'
          ? /** @type {any} */ (undefined)
          : { name: keyPath, widget: 'string' };
      });

      const valueMap = {
        'test_list.0.type': 'a',
        'test_list.0.pairs.0': 'zero',
        'test_list.0.pairs.1': 'one',
        'test_list.1.type': 'b',
        'test_list.1.pairs': 'text',
      };

      const result = serializeContent({ draft, locale: 'en', valueMap });

      expect(result).toEqual({
        test_list: [
          { type: 'a', pairs: { 0: 'zero', 1: 'one' } },
          { type: 'b', pairs: 'text' },
        ],
      });
      expect(Array.isArray(result.test_list[0].pairs)).toBe(false);
    });

    test('handles an empty keyvalue subfield like a top-level keyvalue field', async () => {
      const { createKeyPathList } = await import('$lib/services/contents/draft/save/key-path');
      /** @type {any} */
      const config = cmsConfig;

      getField.mockImplementation(({ keyPath }) =>
        keyPath === 'test_list.*.pairs'
          ? { name: 'pairs', widget: 'keyvalue', required: false }
          : { name: keyPath, widget: 'string' },
      );
      isFieldRequired.mockImplementation(({ fieldConfig }) => fieldConfig.required !== false);

      // The editor stores `null` at the field’s own key path while it holds no pairs
      const valueMap = {
        'test_list.0.title': 'First',
        'test_list.0.pairs': null,
        'test_list.1.title': 'Second',
        'test_list.1.pairs.foo': 'bar',
      };

      vi.mocked(createKeyPathList).mockReturnValueOnce([
        'test_list',
        'test_list.*.title',
        'test_list.*.pairs',
      ]);

      expect(serializeContent({ draft, locale: 'en', valueMap: { ...valueMap } })).toEqual({
        // The placeholder is saved as an empty object, like a field without one
        test_list: [
          { title: 'First', pairs: {} },
          { title: 'Second', pairs: { foo: 'bar' } },
        ],
      });

      vi.mocked(createKeyPathList).mockReturnValueOnce([
        'test_list',
        'test_list.*.title',
        'test_list.*.pairs',
      ]);

      config.current = { output: { omit_empty_optional_fields: true } };

      try {
        expect(serializeContent({ draft, locale: 'en', valueMap: { ...valueMap } })).toEqual({
          test_list: [{ title: 'First' }, { title: 'Second', pairs: { foo: 'bar' } }],
        });
      } finally {
        config.current = {};
        isFieldRequired.mockReset();
      }
    });

    test('serializes empty list with a keyvalue subfield without wildcard keys', async () => {
      const { createKeyPathList } = await import('$lib/services/contents/draft/save/key-path');

      vi.mocked(createKeyPathList).mockReturnValueOnce(['test_list', 'test_list.*.pairs']);

      getField.mockImplementation(({ keyPath }) =>
        keyPath === 'test_list.*.pairs'
          ? { name: 'pairs', widget: 'keyvalue' }
          : { name: keyPath, widget: 'list' },
      );

      const result = serializeContent({ draft, locale: 'en', valueMap: { test_list: [] } });

      expect(result).toEqual({ test_list: [] });
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
            root: true,
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
            root: true,
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
            root: true,
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
            root: true,
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

  describe('root keyvalue field with TOML handling', () => {
    test('returns root keyvalue field object when hasRootKeyValueField is true', () => {
      /** @type {any} */
      const draft = {
        collectionName: 'pages',
        collection: {
          _file: { format: 'json' },
          _i18n: {
            canonicalSlug: { key: '' },
          },
        },
        fields: [
          {
            name: 'pairs',
            widget: 'keyvalue',
            root: true,
          },
        ],
        isIndexFile: false,
      };

      const valueMap = {
        'pairs.key1': 'value1',
        'pairs.key2': 'value2',
      };

      const result = serializeContent({ draft, locale: 'en', valueMap });

      // With root keyvalue field, should return the object directly
      expect(result).toEqual({
        key1: 'value1',
        key2: 'value2',
      });
    });

    test('returns root keyvalue field object with empty fallback when object is undefined', () => {
      /** @type {any} */
      const draft = {
        collectionName: 'pages',
        collection: {
          _file: { format: 'json' },
          _i18n: {
            canonicalSlug: { key: '' },
          },
        },
        fields: [
          {
            name: 'pairs',
            widget: 'keyvalue',
            root: true,
          },
        ],
        isIndexFile: false,
      };

      const valueMap = {};
      const result = serializeContent({ draft, locale: 'en', valueMap });

      // Should return empty object for root keyvalue field with no content
      expect(result).toEqual({});
    });
  });

  test('omits empty optional object fields inside typed list items', async () => {
    cmsConfig.current = /** @type {any} */ ({
      output: { omit_empty_optional_fields: true },
    });

    const { createKeyPathList } = await import('$lib/services/contents/draft/save/key-path');

    vi.mocked(createKeyPathList).mockReturnValueOnce([
      'list',
      'list.*.type',
      'list.*.title',
      'list.*.optionalObject',
      'list.*.optionalObject.foo',
    ]);

    // Simulate real getField behavior: wildcard paths into typed lists return undefined because
    // the type cannot be resolved from valueMap when the index is `*`.
    const optionalObjectField = {
      name: 'optionalObject',
      widget: 'object',
      required: false,
      fields: [{ name: 'foo', widget: 'string' }],
    };

    getField.mockImplementation(
      // @ts-ignore — mock intentionally returns undefined for wildcard paths
      (/** @type {any} */ { keyPath }) => {
        if (keyPath === 'list') {
          return { name: 'list', widget: 'list' };
        }

        // Wildcard paths cannot resolve the type → return undefined (matches real behavior)
        if (keyPath.includes('*')) {
          return undefined;
        }

        // Concrete paths resolve fine
        if (/^list\.\d+\.type$/.test(keyPath)) {
          return { name: 'type', widget: 'string' };
        }

        if (/^list\.\d+\.title$/.test(keyPath)) {
          return { name: 'title', widget: 'string' };
        }

        if (/^list\.\d+\.optionalObject\.foo$/.test(keyPath)) {
          return { name: 'foo', widget: 'string' };
        }

        if (/^list\.\d+\.optionalObject$/.test(keyPath)) {
          return optionalObjectField;
        }

        return { name: keyPath, widget: 'string' };
      },
    );

    isFieldRequired.mockImplementation(
      (/** @type {any} */ { fieldConfig }) => fieldConfig.required !== false,
    );

    /** @type {any} */
    const draft = {
      collectionName: 'posts',
      collection: {
        _file: { format: 'json' },
        _i18n: { canonicalSlug: { key: '' } },
      },
      fields: [
        {
          name: 'list',
          widget: 'list',
          types: [
            {
              name: 'my-type',
              fields: [{ name: 'title', widget: 'string' }, optionalObjectField],
            },
          ],
        },
      ],
      isIndexFile: false,
    };

    const valueMap = {
      'list.0.type': 'my-type',
      'list.0.title': 'Item without optional object',
      'list.0.optionalObject': null,
      'list.0.optionalObject.foo': '',
    };

    const result = serializeContent({ draft, locale: 'en', valueMap });

    // The empty optional object and its empty children should be omitted
    expect(result).toEqual({
      list: [{ type: 'my-type', title: 'Item without optional object' }],
    });
  });
});

describe('wildcardKeyPathRegexCache (within serializeContent)', () => {
  test('should produce consistent ordering across two serialize calls for the same wildcard field', () => {
    // serializeContent calls finalizeContent which builds and caches the wildcard regex.
    // Running it twice exercises the cache-hit path.
    const draft = /** @type {any} */ ({
      collection: {
        _file: { format: 'yaml-frontmatter' },
        _i18n: { canonicalSlug: { key: 'slug' } },
      },
      collectionName: 'blog',
      collectionFile: null,
      fields: [
        // A list field whose keyPath ends up containing a wildcard after createKeyPathList
        // expansion
        { name: 'tags.*', widget: 'string' },
      ],
      isIndexFile: false,
    });

    const valueMap = { 'tags.0': 'js', 'tags.1': 'svelte' };
    const result1 = serializeContent({ draft, locale: 'en', valueMap: { ...valueMap } });
    const result2 = serializeContent({ draft, locale: 'en', valueMap: { ...valueMap } });

    expect(result1).toEqual(result2);
  });
});
