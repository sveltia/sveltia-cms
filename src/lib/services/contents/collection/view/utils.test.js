import { describe, expect, test } from 'vitest';

import { parseViewOptions } from './utils';

describe('Test parseViewOptions()', () => {
  test('returns empty options for undefined input', () => {
    expect(parseViewOptions(undefined, 'items')).toEqual({ options: [] });
  });

  test('returns empty options for null input', () => {
    expect(parseViewOptions(/** @type {any} */ (null), 'items')).toEqual({ options: [] });
  });

  test('returns empty options for non-object, non-array input', () => {
    expect(parseViewOptions(/** @type {any} */ ('invalid'), 'items')).toEqual({ options: [] });
    expect(parseViewOptions(/** @type {any} */ (42), 'items')).toEqual({ options: [] });
  });

  test('returns array as options when input is an array', () => {
    const items = [{ name: 'a', field: 'f', pattern: 'p' }];

    expect(parseViewOptions(items, 'items')).toEqual({ options: items });
  });

  test('returns empty options for empty array input', () => {
    expect(parseViewOptions([], 'items')).toEqual({ options: [] });
  });

  test('extracts options from object using the given optionsKey', () => {
    const options = [{ name: 'x', field: 'f', pattern: 'p' }];

    expect(parseViewOptions({ items: options }, 'items')).toEqual({
      options,
      default: undefined,
    });
  });

  test('returns empty options when object is missing the optionsKey', () => {
    expect(parseViewOptions(/** @type {any} */ ({ default: 'x' }), 'items')).toEqual({
      options: [],
    });
  });

  test('returns empty options when object optionsKey value is not an array', () => {
    expect(parseViewOptions(/** @type {any} */ ({ items: 'not an array' }), 'items')).toEqual({
      options: [],
    });
  });

  test('returns default condition when default name matches an option', () => {
    const options = [
      { name: 'foo', field: 'status', pattern: 'published' },
      { name: 'bar', field: 'category', pattern: 'tech' },
    ];

    const result = parseViewOptions({ items: options, default: 'foo' }, 'items');

    expect(result).toEqual({
      options,
      default: { field: 'status', pattern: 'published' },
    });
  });

  test('returns undefined default when default name does not match any option', () => {
    const options = [{ name: 'foo', field: 'status', pattern: 'published' }];
    const result = parseViewOptions({ items: options, default: 'nonexistent' }, 'items');

    expect(result).toEqual({ options, default: undefined });
  });

  test('returns undefined default when no default name is supplied', () => {
    const options = [{ name: 'foo', field: 'status', pattern: 'published' }];
    const result = parseViewOptions({ items: options }, 'items');

    expect(result).toEqual({ options, default: undefined });
  });

  test('respects the optionsKey parameter — different keys are independent', () => {
    const options = [{ name: 'a', field: 'f', pattern: 'p' }];

    expect(parseViewOptions({ filters: options }, 'filters')).toEqual({
      options,
      default: undefined,
    });
    expect(parseViewOptions({ groups: options }, 'groups')).toEqual({
      options,
      default: undefined,
    });
    // Wrong key → no options
    expect(parseViewOptions({ filters: options }, 'groups')).toEqual({ options: [] });
  });

  test('projects only field and pattern into the default condition', () => {
    const options = [{ name: 'foo', field: 'status', pattern: 'published', label: 'Published' }];
    const result = parseViewOptions({ items: options, default: 'foo' }, 'items');

    // 'label' and 'name' should not appear in the default condition
    expect(result.default).toEqual({ field: 'status', pattern: 'published' });
    expect(result.default).not.toHaveProperty('label');
    expect(result.default).not.toHaveProperty('name');
  });
});
