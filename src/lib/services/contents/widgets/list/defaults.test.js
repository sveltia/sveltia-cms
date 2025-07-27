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
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

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
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

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
      dynamicValue: undefined,
    });

    expect(result).toEqual({
      items: ['default1', 'default2'],
      'items.0': 'default1',
      'items.1': 'default2',
    });
  });
});
