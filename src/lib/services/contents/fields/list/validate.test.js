import { describe, expect, test } from 'vitest';

import { getListItems, validateListField } from './validate';

/**
 * @import { EntryValidityState } from '$lib/types/private';
 */

/**
 * Creates a fresh validity state with all flags set to false.
 * @returns {EntryValidityState} Default-false validity object.
 */
const freshValidity = () => ({
  valueMissing: false,
  tooShort: false,
  tooLong: false,
  rangeUnderflow: false,
  rangeOverflow: false,
  patternMismatch: false,
  typeMismatch: false,
});

describe('validateListField()', () => {
  test('skips when keyPath is already validated', () => {
    const validity = freshValidity();

    const result = validateListField({
      keyPath: 'tags',
      value: undefined,
      valueMap: {},
      validity,
      validities: { _default: { tags: validity } },
      locale: '_default',
      required: true,
      min: 0,
      max: Infinity,
    });

    expect(result).toEqual({ skip: true });
    expect(validity.valueMissing).toBe(false);
  });

  test('sets valueMissing when required and array is empty', () => {
    const validity = freshValidity();

    const result = validateListField({
      keyPath: 'tags',
      value: [],
      valueMap: {},
      validity,
      validities: { _default: {} },
      locale: '_default',
      required: true,
      min: 0,
      max: Infinity,
    });

    expect(result).toEqual({ skip: false, empty: true });
    expect(validity.valueMissing).toBe(true);
  });

  test('does not set valueMissing when not required and array is empty', () => {
    const validity = freshValidity();

    validateListField({
      keyPath: 'tags',
      value: [],
      valueMap: {},
      validity,
      validities: { _default: {} },
      locale: '_default',
      required: false,
      min: 0,
      max: Infinity,
    });

    expect(validity.valueMissing).toBe(false);
  });

  test('counts items from a non-empty array value', () => {
    const validity = freshValidity();

    validateListField({
      keyPath: 'tags',
      value: ['a', 'b', 'c'],
      valueMap: {},
      validity,
      validities: { _default: {} },
      locale: '_default',
      required: true,
      min: 0,
      max: Infinity,
    });

    expect(validity.valueMissing).toBe(false);
    expect(validity.rangeUnderflow).toBe(false);
  });

  test('counts items from flattened key paths when value is not an array', () => {
    const validity = freshValidity();
    const valueMap = { 'tags.0': 'a', 'tags.1': 'b', title: 'Hello' };

    validateListField({
      keyPath: 'tags',
      value: undefined,
      valueMap,
      validity,
      validities: { _default: {} },
      locale: '_default',
      required: true,
      min: 3,
      max: Infinity,
    });

    expect(validity.rangeUnderflow).toBe(true);
  });

  test('sets rangeUnderflow when size is below min', () => {
    const validity = freshValidity();

    validateListField({
      keyPath: 'items',
      value: ['a'],
      valueMap: {},
      validity,
      validities: { _default: {} },
      locale: '_default',
      required: false,
      min: 2,
      max: Infinity,
    });

    expect(validity.rangeUnderflow).toBe(true);
  });

  test('sets rangeOverflow when size exceeds max', () => {
    const validity = freshValidity();

    validateListField({
      keyPath: 'items',
      value: ['a', 'b', 'c'],
      valueMap: {},
      validity,
      validities: { _default: {} },
      locale: '_default',
      required: false,
      min: 0,
      max: 2,
    });

    expect(validity.rangeOverflow).toBe(true);
  });

  test('does not set rangeUnderflow when size equals min', () => {
    const validity = freshValidity();

    validateListField({
      keyPath: 'items',
      value: ['a', 'b'],
      valueMap: {},
      validity,
      validities: { _default: {} },
      locale: '_default',
      required: false,
      min: 2,
      max: Infinity,
    });

    expect(validity.rangeUnderflow).toBe(false);
  });

  test('does not set rangeOverflow when size equals max', () => {
    const validity = freshValidity();

    validateListField({
      keyPath: 'items',
      value: ['a', 'b'],
      valueMap: {},
      validity,
      validities: { _default: {} },
      locale: '_default',
      required: false,
      min: 0,
      max: 2,
    });

    expect(validity.rangeOverflow).toBe(false);
  });

  test('ignores string min/max (datetime-style)', () => {
    const validity = freshValidity();

    validateListField({
      keyPath: 'items',
      value: ['a'],
      valueMap: {},
      validity,
      validities: { _default: {} },
      locale: '_default',
      required: false,
      min: '2020-01-01',
      max: '2099-01-01',
    });

    // string min/max are not numbers, so typeof check prevents underflow/overflow
    expect(validity.rangeUnderflow).toBe(false);
    expect(validity.rangeOverflow).toBe(false);
  });

  test('deduplicates flattened keys when counting', () => {
    const validity = freshValidity();
    // Each unique `tags.N` prefix should count as one item, however many sub-keys it has
    const valueMap = { 'tags.0.name': 'a', 'tags.0.url': 'a', 'tags.1.name': 'b' };

    validateListField({
      keyPath: 'tags',
      value: undefined,
      valueMap,
      validity,
      validities: { _default: {} },
      locale: '_default',
      required: false,
      min: 3,
      max: Infinity,
    });

    expect(validity.rangeUnderflow).toBe(true);
  });

  test('counts only the items, not other keys under the list or keys of a sibling field', () => {
    const validity = freshValidity();

    const valueMap = {
      'tags.0': 'a',
      'tags.__sc_item_original_key_path': 'x',
      'tagline.0': 'b',
      'tags.1': 'c',
    };

    validateListField({
      keyPath: 'tags',
      value: undefined,
      valueMap,
      validity,
      validities: { _default: {} },
      locale: '_default',
      required: false,
      min: 0,
      max: 1,
    });

    expect(validity.rangeOverflow).toBe(true);

    const validity2 = freshValidity();

    validateListField({
      keyPath: 'tags',
      value: undefined,
      valueMap,
      validity: validity2,
      validities: { _default: {} },
      locale: '_default',
      required: false,
      min: 0,
      max: 2,
    });

    expect(validity2.rangeOverflow).toBe(false);
  });
});

describe('getListItems()', () => {
  test('returns the items stored under the list, in list order', () => {
    expect(
      getListItems({
        keyPath: 'tags',
        value: '',
        valueMap: {
          title: 'Title',
          'tags.1': 'b',
          'tags.0': 'a',
          'tags.10': 'k',
          'tags.2': 'c',
          'tags_other.0': 'x',
          'tags.3.name': 'y',
        },
      }),
    ).toEqual(['a', 'b', 'c', 'k']);
  });

  test('returns the value itself when the list holds its items in an array', () => {
    expect(
      getListItems({ keyPath: 'tags', value: ['a', 'b'], valueMap: { tags: ['a', 'b'] } }),
    ).toEqual(['a', 'b']);
  });

  test('returns an empty array when the list has no items', () => {
    expect(getListItems({ keyPath: 'tags', value: [], valueMap: { tags: [] } })).toEqual([]);
  });
});
