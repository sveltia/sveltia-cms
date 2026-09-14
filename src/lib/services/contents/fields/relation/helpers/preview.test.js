import { describe, expect, test } from 'vitest';

import { getPreviewLabels } from '$lib/services/contents/fields/relation/helpers/preview';

/**
 * @import { RelationOption } from '$lib/types/private';
 * @import { RelationField } from '$lib/types/public';
 */

/** @type {RelationField} */
const fieldConfig = {
  name: 'author',
  widget: 'relation',
  collection: 'members',
};

/** @type {RelationOption[]} */
const options = [
  { label: 'Melvin Lucas', value: 'melvin-lucas', searchValue: 'Melvin Lucas' },
  { label: 'Elsie Dean', value: 'elsie-dean', searchValue: 'Elsie Dean' },
  { label: 'unlabeled', value: 'unlabeled', searchValue: 'unlabeled' },
];

describe('getPreviewLabels()', () => {
  test('returns nothing when there is no value', () => {
    expect(getPreviewLabels({ fieldConfig, currentValue: undefined, options })).toEqual([]);
    expect(
      getPreviewLabels({
        fieldConfig: { ...fieldConfig, multiple: true },
        currentValue: undefined,
        options,
      }),
    ).toEqual([]);
    expect(
      getPreviewLabels({
        fieldConfig: { ...fieldConfig, multiple: true },
        currentValue: [],
        options,
      }),
    ).toEqual([]);
  });

  test('shows the label of a value that is the entry slug', () => {
    expect(getPreviewLabels({ fieldConfig, currentValue: 'melvin-lucas', options })).toEqual([
      'Melvin Lucas',
    ]);
    expect(
      getPreviewLabels({
        fieldConfig: { ...fieldConfig, value_field: 'slug' },
        currentValue: 'melvin-lucas',
        options,
      }),
    ).toEqual(['Melvin Lucas']);
    expect(
      getPreviewLabels({
        fieldConfig: { ...fieldConfig, value_field: '{{fields.slug}}' },
        currentValue: 'melvin-lucas',
        options,
      }),
    ).toEqual(['Melvin Lucas']);
  });

  test('shows the label and the value when the value is another field', () => {
    expect(
      getPreviewLabels({
        fieldConfig: { ...fieldConfig, value_field: 'email' },
        currentValue: 'melvin-lucas',
        options,
      }),
    ).toEqual(['Melvin Lucas (melvin-lucas)']);
  });

  test('shows the value as is when it has no distinct label', () => {
    expect(getPreviewLabels({ fieldConfig, currentValue: 'unlabeled', options })).toEqual([
      'unlabeled',
    ]);
    expect(getPreviewLabels({ fieldConfig, currentValue: 'deleted-entry', options })).toEqual([
      'deleted-entry',
    ]);
  });

  test('keeps the stored order of multiple values', () => {
    expect(
      getPreviewLabels({
        fieldConfig: { ...fieldConfig, multiple: true },
        currentValue: ['elsie-dean', 'melvin-lucas', 'deleted-entry'],
        options,
      }),
    ).toEqual(['Elsie Dean', 'Melvin Lucas', 'deleted-entry']);
  });
});
