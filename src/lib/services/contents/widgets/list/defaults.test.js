import { describe, expect, test } from 'vitest';

import { getDefaultValueMap } from './defaults';

/**
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
      items: ['item1', 'item2'],
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
      items: ['dynamic1', 'dynamic2', 'dynamic3'],
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
      items: ['item1', 'item2', 'item3'],
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
      items: ['new1', 'new2'],
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
      items: ['default1', 'default2'],
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
      items: [
        { title: 'Title 1', description: 'Desc 1' },
        { title: 'Title 2', description: 'Desc 2' },
      ],
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
      items: [{ name: 'Item 1' }, { name: 'Item 2' }],
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
      items: ['tag1', 'tag2', 'tag3'],
      'items.0': 'tag1',
      'items.1': 'tag2',
      'items.2': 'tag3',
    });
  });

  test('should skip object values in simple list (no fields/types)', () => {
    /** @type {ListField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: ['string1', { name: 'object' }, 'string2'],
    };

    const keyPath = 'items';

    const result = getDefaultValueMap({
      fieldConfig,
      keyPath,
      locale: '_default',
      defaultLocale: '_default',
    });

    expect(result).toEqual({
      items: ['string1', { name: 'object' }, 'string2'],
      'items.0': 'string1',
      'items.2': 'string2',
    });
  });
});
