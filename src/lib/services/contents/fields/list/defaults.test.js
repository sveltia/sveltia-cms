import { describe, expect, test, vi } from 'vitest';

import { getDefaultValueMap } from './defaults';

/**
 * @import { PopulateDefaultValueArgs } from '$lib/types/private';
 * @import { ListField } from '$lib/types/public';
 */

/** @type {Pick<ListField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'list',
  name: 'items',
};

describe('Test getDefaultValueMap()', () => {
  test('should return empty array when no default value', () => {
    /** @type {ListField} */
    const fieldConfig = {
      ...baseFieldConfig,
      fields: [{ name: 'title', widget: 'string' }],
    };

    const keyPath = 'items';

    const result = getDefaultValueMap({
      fieldConfig,
      keyPath,
      locale: '_default',
      defaultLocale: '_default',
    });

    expect(result).toEqual({ items: [] });
  });

  test('should return default array values', () => {
    /** @type {ListField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: ['item1', 'item2'],
      fields: [{ name: 'title', widget: 'string' }],
    };

    const keyPath = 'items';

    const result = getDefaultValueMap({
      fieldConfig,
      keyPath,
      locale: '_default',
      defaultLocale: '_default',
    });

    expect(result).toEqual({
      items: [],
      'items.0': 'item1',
      'items.1': 'item2',
    });
  });

  test('should handle dynamicValue over default', () => {
    /** @type {ListField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: ['default1', 'default2'],
      fields: [{ name: 'title', widget: 'string' }],
    };

    const keyPath = 'items';

    const result = getDefaultValueMap({
      fieldConfig,
      keyPath,
      locale: '_default',
      defaultLocale: '_default',
      dynamicValue: 'dynamic1, dynamic2, dynamic3',
    });

    expect(result).toEqual({
      items: [],
      'items.0': 'dynamic1',
      'items.1': 'dynamic2',
      'items.2': 'dynamic3',
    });
  });

  test('should handle empty dynamicValue', () => {
    /** @type {ListField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: ['default1'],
      fields: [{ name: 'title', widget: 'string' }],
    };

    const keyPath = 'items';

    const result = getDefaultValueMap({
      fieldConfig,
      keyPath,
      locale: '_default',
      defaultLocale: '_default',
      dynamicValue: '',
    });

    expect(result).toEqual({ items: [] });
  });

  test('should trim whitespace in comma-separated dynamicValue', () => {
    /** @type {ListField} */
    const fieldConfig = {
      ...baseFieldConfig,
      fields: [{ name: 'title', widget: 'string' }],
    };

    const keyPath = 'items';

    const result = getDefaultValueMap({
      fieldConfig,
      keyPath,
      locale: '_default',
      defaultLocale: '_default',
      dynamicValue: '  item1  ,   item2   ,item3  ',
    });

    expect(result).toEqual({
      items: [],
      'items.0': 'item1',
      'items.1': 'item2',
      'items.2': 'item3',
    });
  });

  test('should handle dynamicValue when no default exists', () => {
    /** @type {ListField} */
    const fieldConfig = {
      ...baseFieldConfig,
      fields: [{ name: 'title', widget: 'string' }],
    };

    const keyPath = 'items';

    const result = getDefaultValueMap({
      fieldConfig,
      keyPath,
      locale: '_default',
      defaultLocale: '_default',
      dynamicValue: 'new1, new2',
    });

    expect(result).toEqual({
      items: [],
      'items.0': 'new1',
      'items.1': 'new2',
    });
  });

  test('should handle undefined dynamicValue', () => {
    /** @type {ListField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: ['default1', 'default2'],
      fields: [{ name: 'title', widget: 'string' }],
    };

    const keyPath = 'items';

    const result = getDefaultValueMap({
      fieldConfig,
      keyPath,
      locale: '_default',
      defaultLocale: '_default',
      dynamicValue: undefined,
    });

    expect(result).toEqual({
      items: [],
      'items.0': 'default1',
      'items.1': 'default2',
    });
  });

  test('should handle object items with flattened structure (with fields)', () => {
    /** @type {ListField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: [
        { title: 'Title 1', description: 'Desc 1' },
        { title: 'Title 2', description: 'Desc 2' },
      ],
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'description', widget: 'string' },
      ],
    };

    const keyPath = 'items';

    const result = getDefaultValueMap({
      fieldConfig,
      keyPath,
      locale: '_default',
      defaultLocale: '_default',
    });

    expect(result).toEqual({
      items: [],
      'items.0.title': 'Title 1',
      'items.0.description': 'Desc 1',
      'items.1.title': 'Title 2',
      'items.1.description': 'Desc 2',
    });
  });

  test('should handle object items with types instead of fields', () => {
    /** @type {ListField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: [{ name: 'Item 1' }, { name: 'Item 2' }],
      types: [
        {
          name: 'type1',
          label: 'Type 1',
          fields: [{ name: 'name', widget: 'string' }],
        },
      ],
    };

    const keyPath = 'items';

    const result = getDefaultValueMap({
      fieldConfig,
      keyPath,
      locale: '_default',
      defaultLocale: '_default',
    });

    expect(result).toEqual({
      items: [],
      'items.0.name': 'Item 1',
      'items.1.name': 'Item 2',
    });
  });

  test('should handle simple list without fields or types (string array)', () => {
    /** @type {ListField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: ['tag1', 'tag2', 'tag3'],
    };

    const keyPath = 'items';

    const result = getDefaultValueMap({
      fieldConfig,
      keyPath,
      locale: '_default',
      defaultLocale: '_default',
    });

    expect(result).toEqual({
      items: [],
      'items.0': 'tag1',
      'items.1': 'tag2',
      'items.2': 'tag3',
    });
  });

  test('should keep object values in a list with a single Object field', () => {
    /** @type {ListField} */
    const fieldConfig = {
      ...baseFieldConfig,
      field: { name: 'author', widget: 'object', fields: [{ name: 'name', widget: 'string' }] },
      default: [{ name: 'Alice' }, { name: 'Bob' }],
    };

    const result = getDefaultValueMap({
      fieldConfig,
      keyPath: 'items',
      locale: '_default',
      defaultLocale: '_default',
    });

    expect(result).toEqual({
      items: [],
      'items.0.name': 'Alice',
      'items.1.name': 'Bob',
    });
  });

  test('should skip object values in simple list (no fields/types)', () => {
    // A mixed array is not a valid default, so it needs a cast
    const fieldConfig = /** @type {ListField} */ ({
      ...baseFieldConfig,
      default: ['string1', { name: 'object' }, 'string2'],
    });

    const keyPath = 'items';

    const result = getDefaultValueMap({
      fieldConfig,
      keyPath,
      locale: '_default',
      defaultLocale: '_default',
    });

    // The dropped object leaves no gap: the remaining items are renumbered, so the flat map
    // matches what every reader assembles from it
    expect(result).toEqual({
      items: [],
      'items.0': 'string1',
      'items.1': 'string2',
    });
  });

  describe('missing subfields of a default item', () => {
    /**
     * Stand-in for `populateDefaultValue()`, which writes the subfield’s own default or an empty
     * string, and an empty object for an Object subfield without a default.
     * @type {(args: PopulateDefaultValueArgs) => void}
     */
    const populateDefault = vi.fn(({ content, keyPath, fieldConfig }) => {
      // @ts-ignore `default` is not defined on every field type
      const { widget = 'string', default: defaultValue } = fieldConfig;

      content[keyPath] = widget === 'object' ? null : (defaultValue ?? '');
    });

    /**
     * Get the default value map with the stand-in.
     * @param {ListField} fieldConfig Field configuration.
     * @returns {Record<string, any>} Default value map.
     */
    const getMap = (fieldConfig) =>
      getDefaultValueMap({
        fieldConfig,
        keyPath: 'items',
        locale: '_default',
        defaultLocale: '_default',
        populateDefault,
      });

    test('should fill in the subfields a default item leaves out', () => {
      const result = getMap({
        ...baseFieldConfig,
        fields: [
          { name: 'label', widget: 'string' },
          { name: 'url', widget: 'string' },
          { name: 'external', widget: 'boolean', default: false },
        ],
        default: [
          { label: 'Home', url: '/' },
          { label: 'GitHub', url: 'https://github.com/', external: true },
        ],
      });

      expect(result).toEqual({
        items: [],
        'items.0.label': 'Home',
        'items.0.url': '/',
        'items.0.external': false,
        'items.1.label': 'GitHub',
        'items.1.url': 'https://github.com/',
        'items.1.external': true,
      });

      expect(populateDefault).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          keyPath: 'items.0.external',
          fieldConfig: { name: 'external', widget: 'boolean', default: false },
          locale: '_default',
          defaultLocale: '_default',
          dynamicValues: {},
        }),
      );
    });

    test('should leave an Object subfield given in the item alone', () => {
      const result = getMap({
        ...baseFieldConfig,
        fields: [
          { name: 'author', widget: 'object', fields: [{ name: 'name', widget: 'string' }] },
          { name: 'reviewer', widget: 'object', fields: [{ name: 'name', widget: 'string' }] },
        ],
        default: [{ author: { name: 'Alice' } }],
      });

      // The given object is held under its child key path, so it doesn’t count as missing
      expect(result).toEqual({
        items: [],
        'items.0.author.name': 'Alice',
        'items.0.reviewer': null,
      });
    });

    test('should fill in the subfields of the variable type a default item names', () => {
      const result = getMap({
        ...baseFieldConfig,
        typeKey: 'kind',
        types: [
          {
            name: 'heading',
            fields: [
              { name: 'text', widget: 'string' },
              { name: 'level', widget: 'number', default: 2 },
            ],
          },
          { name: 'paragraph', fields: [{ name: 'body', widget: 'text' }] },
          { name: 'divider' },
        ],
        default: [
          { kind: 'heading', text: 'Introduction' },
          { kind: 'paragraph' },
          { kind: 'divider' },
          { kind: 'unknown' },
        ],
      });

      expect(result).toEqual({
        items: [],
        'items.0.kind': 'heading',
        'items.0.text': 'Introduction',
        'items.0.level': 2,
        'items.1.kind': 'paragraph',
        'items.1.body': '',
        'items.2.kind': 'divider',
        'items.3.kind': 'unknown',
      });
    });

    test('should skip an item that is not an object', () => {
      const result = getMap({
        ...baseFieldConfig,
        fields: [{ name: 'label', widget: 'string' }],
        default: /** @type {any} */ (['Home']),
      });

      expect(result).toEqual({ items: [], 'items.0': 'Home' });
      expect(populateDefault).not.toHaveBeenCalled();
    });

    test('should not touch a simple list or a list with a single field', () => {
      expect(getMap({ ...baseFieldConfig, default: ['a'] })).toEqual({ items: [], 'items.0': 'a' });

      expect(
        getMap({
          ...baseFieldConfig,
          field: { name: 'meta', widget: 'keyvalue' },
          default: [{ k: 'v' }],
        }),
      ).toEqual({ items: [], 'items.0.k': 'v' });

      expect(populateDefault).not.toHaveBeenCalled();
    });

    test('should do nothing without the callback', () => {
      const result = getDefaultValueMap({
        fieldConfig: {
          ...baseFieldConfig,
          fields: [
            { name: 'label', widget: 'string' },
            { name: 'url', widget: 'string' },
          ],
          default: [{ label: 'Home' }],
        },
        keyPath: 'items',
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ items: [], 'items.0.label': 'Home' });
    });
  });
});
