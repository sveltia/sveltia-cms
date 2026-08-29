import { unflatten } from 'flat';
import { describe, expect, test } from 'vitest';

import { unflattenMap } from '$lib/services/utils/object';

describe('unflattenMap()', () => {
  test('keeps the children of a placeholder written after them', () => {
    // A Code field appends the empty object at its own key path once the editor has written the
    // sub-values, so the placeholder trails its children in the value map
    const content = {
      'code.lang': 'js',
      'code.code': 'hello',
      __sc_component_name: 'custom-code',
      code: {},
    };

    // The `flat` library alone drops them
    expect(unflatten(content)).toEqual({ code: {}, __sc_component_name: 'custom-code' });

    expect(unflattenMap(content)).toEqual({
      code: { lang: 'js', code: 'hello' },
      __sc_component_name: 'custom-code',
    });
  });

  test('keeps the children of a placeholder written before them', () => {
    expect(unflattenMap({ code: {}, 'code.lang': 'js', 'code.code': 'hello' })).toEqual({
      code: { lang: 'js', code: 'hello' },
    });
  });

  test('keeps List field items at their own indexes', () => {
    const content = {
      'items.10.name': 'k',
      'items.2.name': 'c',
      'items.0.name': 'a',
      items: [],
    };

    const { items } = unflattenMap(content);

    expect(items[0]).toEqual({ name: 'a' });
    expect(items[2]).toEqual({ name: 'c' });
    expect(items[10]).toEqual({ name: 'k' });
  });

  test('handles nested placeholders', () => {
    const content = {
      'obj.snippet.lang': 'css',
      'obj.snippet.code': 'a{}',
      'obj.snippet': {},
      obj: {},
    };

    expect(unflattenMap(content)).toEqual({
      obj: { snippet: { lang: 'css', code: 'a{}' } },
    });
  });

  test('returns an empty object for empty content', () => {
    expect(unflattenMap({})).toEqual({});
  });

  test('passes nullish content through, like the `flat` library does', () => {
    expect(unflattenMap(undefined)).toBeUndefined();
    expect(unflattenMap(null)).toBeNull();
  });
});
