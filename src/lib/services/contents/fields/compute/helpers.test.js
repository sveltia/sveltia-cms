import { describe, expect, test, vi } from 'vitest';

import { getFieldDisplayValue } from '$lib/services/contents/entry/fields';
import { getComputedValue, getListIndex } from '$lib/services/contents/fields/compute/helpers';

vi.mock('$lib/services/contents/entry/fields', () => ({
  getFieldDisplayValue: vi.fn(),
}));

/**
 * Get the arguments shared by the {@link getComputedValue} tests.
 * @param {string} value Value template.
 * @param {string} keyPath Key path of the field.
 * @returns {any} Arguments.
 */
const getArgs = (value, keyPath = 'slug') => ({
  fieldConfig: { name: 'slug', widget: 'compute', value },
  keyPath,
  locale: 'en',
  valueMap: {},
  collectionName: 'posts',
});

describe('getListIndex()', () => {
  test('should read the index from a list item key path', () => {
    expect(getListIndex('authors.0.slug')).toBe(0);
    expect(getListIndex('authors.12.slug')).toBe(12);
    expect(getListIndex('sections.1.authors.3.slug')).toBe(3);
  });

  test('should return undefined outside a list item', () => {
    expect(getListIndex('slug')).toBeUndefined();
    expect(getListIndex('author.slug')).toBeUndefined();
  });
});

describe('getComputedValue()', () => {
  test('should return the index itself for a lone index template', () => {
    expect(getComputedValue(getArgs('{{index}}', 'authors.2.slug'))).toBe(2);
  });

  test('should return an empty string for a lone index template outside a list', () => {
    expect(getComputedValue(getArgs('{{index}}'))).toBe('');
  });

  test('should embed the index in a larger template', () => {
    expect(getComputedValue(getArgs('item-{{index}}', 'authors.2.slug'))).toBe('item-2');
    expect(getComputedValue(getArgs('item-{{index}}'))).toBe('item-');
  });

  test('should resolve a field tag', () => {
    vi.mocked(getFieldDisplayValue).mockReturnValue('Hello World');

    expect(getComputedValue(getArgs('posts-{{fields.title}}'))).toBe('posts-Hello World');

    expect(vi.mocked(getFieldDisplayValue)).toHaveBeenCalledWith(
      expect.objectContaining({ keyPath: 'title', collectionName: 'posts', locale: 'en' }),
    );
  });

  test('should format a list value', () => {
    vi.mocked(getFieldDisplayValue).mockReturnValue(/** @type {any} */ (['a', 'b']));

    expect(getComputedValue(getArgs('{{fields.tags}}'))).toBe('a, b');
  });

  test('should apply transformations', () => {
    vi.mocked(getFieldDisplayValue).mockReturnValue('Hello World');

    expect(getComputedValue(getArgs('{{fields.title | upper}}'))).toBe('HELLO WORLD');
  });

  test('should return a stable empty slug for an empty source field', () => {
    // A random fallback would make the field recompute forever
    // @see https://github.com/sveltia/sveltia-cms/issues/946
    vi.mocked(getFieldDisplayValue).mockReturnValue('');

    expect(getComputedValue(getArgs('{{fields.title | slugify}}'))).toBe('');
    expect(getComputedValue(getArgs('{{fields.title | slugify}}'))).toBe('');
  });

  test('should ignore an unknown tag', () => {
    expect(getComputedValue(getArgs('a-{{unknown}}-b'))).toBe('a--b');
  });

  test('should return an empty string for a missing template', () => {
    expect(
      getComputedValue({ ...getArgs(''), fieldConfig: { name: 'slug', widget: 'compute' } }),
    ).toBe('');
  });
});
