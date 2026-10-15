import { describe, expect, test, vi } from 'vitest';

import {
  getAllSubFields,
  getTypeSubFields,
  getValueSubFields,
  someSubField,
} from '$lib/services/contents/fields/list/subfields';

/** @type {any[]} */
const types = [
  { name: 'a', widget: 'object', fields: [{ name: 'title' }] },
  { name: 'b', widget: 'object' },
];

describe('getTypeSubFields', () => {
  test('returns the subfields of the type', () => {
    expect(getTypeSubFields(types, 'a')).toEqual([{ name: 'title' }]);
  });

  test('returns an empty array for a type without subfields', () => {
    expect(getTypeSubFields(types, 'b')).toEqual([]);
  });

  test('returns undefined for an unknown type', () => {
    expect(getTypeSubFields(types, 'c')).toBeUndefined();
    expect(getTypeSubFields(types, undefined)).toBeUndefined();
  });
});

describe('getValueSubFields', () => {
  test('returns the subfields if given', () => {
    expect(getValueSubFields({ value: {}, fields: [{ name: 'x' }], types })).toEqual([
      { name: 'x' },
    ]);
  });

  test('resolves the variable type with the default and custom type keys', () => {
    expect(getValueSubFields({ value: { type: 'a' }, types })).toEqual([{ name: 'title' }]);
    expect(getValueSubFields({ value: { kind: 'a' }, types, typeKey: 'kind' })).toEqual([
      { name: 'title' },
    ]);
  });

  test('returns an empty array without fields, types or a matching type', () => {
    expect(getValueSubFields({ value: {} })).toEqual([]);
    expect(getValueSubFields({ value: { type: 'c' }, types })).toEqual([]);
    expect(getValueSubFields({ value: undefined, types })).toEqual([]);
  });
});

describe('getAllSubFields', () => {
  test('collects the field, fields and type fields', () => {
    expect(getAllSubFields({ name: 'x', widget: 'list', field: { name: 'f' } })).toEqual([
      { name: 'f' },
    ]);
    expect(getAllSubFields({ name: 'x', widget: 'object', fields: [{ name: 'g' }] })).toEqual([
      { name: 'g' },
    ]);
    expect(getAllSubFields({ name: 'x', widget: 'list', types })).toEqual([{ name: 'title' }]);
    expect(getAllSubFields({ name: 'x' })).toEqual([]);
  });
});

describe('someSubField', () => {
  const field = { name: 'x', widget: 'list', types };
  /**
   * Check whether the field is named `title`.
   * @param {any} f Field.
   * @returns {boolean} Result.
   */
  const isTitle = (f) => f.name === 'title';

  test('checks the field itself and the nested subfields', () => {
    expect(someSubField(field, isTitle)).toBe(true);
    expect(someSubField({ name: 'title' }, isTitle)).toBe(true);
    expect(someSubField(field, (f) => f.name === 'none')).toBe(false);
  });

  test('caches the result per field', () => {
    /** @type {WeakMap<any, boolean>} */
    const cache = new WeakMap();
    const predicate = vi.fn(isTitle);

    expect(someSubField(field, predicate, cache)).toBe(true);
    expect(cache.get(field)).toBe(true);
    predicate.mockClear();
    expect(someSubField(field, predicate, cache)).toBe(true);
    expect(predicate).not.toHaveBeenCalled();
  });
});
