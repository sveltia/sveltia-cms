import { describe, expect, test } from 'vitest';

import { getOrderFieldKey, getReorderGroupName } from './config';

describe('getOrderFieldKey()', () => {
  test('returns undefined when reorder is not configured', () => {
    expect(getOrderFieldKey({})).toBeUndefined();
    expect(getOrderFieldKey({ reorder: false })).toBeUndefined();
    expect(getOrderFieldKey(undefined)).toBeUndefined();
  });

  test('returns the default key when reorder is true', () => {
    expect(getOrderFieldKey({ reorder: true })).toBe('order');
  });

  test('returns the configured key when reorder.key is set', () => {
    expect(getOrderFieldKey({ reorder: { key: 'priority' } })).toBe('priority');
  });

  test('falls back to the default key when reorder.key is empty', () => {
    expect(getOrderFieldKey({ reorder: { key: '' } })).toBe('order');
  });
});

describe('getReorderGroupName()', () => {
  test('returns undefined when reorder is not configured', () => {
    expect(getReorderGroupName(undefined)).toBeUndefined();
    expect(getReorderGroupName({})).toBeUndefined();
    expect(getReorderGroupName({ reorder: false })).toBeUndefined();
  });

  test('returns undefined when reorder is enabled with the shorthand syntax', () => {
    expect(getReorderGroupName({ reorder: true })).toBeUndefined();
  });

  test('returns undefined when group is omitted', () => {
    expect(getReorderGroupName({ reorder: { key: 'weight' } })).toBeUndefined();
  });

  test('returns undefined for an empty or non-string group', () => {
    expect(getReorderGroupName({ reorder: { group: '' } })).toBeUndefined();
    expect(getReorderGroupName({ reorder: { group: true } })).toBeUndefined();
  });

  test('returns the configured group name', () => {
    expect(getReorderGroupName({ reorder: { group: 'categories' } })).toBe('categories');
    expect(getReorderGroupName({ reorder: { key: 'weight', group: 'categories' } })).toBe(
      'categories',
    );
  });
});
