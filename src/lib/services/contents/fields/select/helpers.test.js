import { describe, expect, test } from 'vitest';

import { getOptionLabel, getPreviewLabels } from './helpers';

/**
 * @import { SelectField } from '$lib/types/public';
 */

/** @type {Pick<SelectField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'select',
  name: 'category',
};

/** @type {Pick<SelectField, 'widget' | 'name'>} */
const baseMultipleFieldConfig = {
  widget: 'select',
  name: 'tags',
};

describe('Test getOptionLabel()', () => {
  test('should return value for single select without labels', () => {
    /** @type {SelectField} */
    const fieldConfig = {
      ...baseFieldConfig,
      multiple: false,
      options: ['option1', 'option2', 'option3'],
    };

    const valueMap = { category: 'option2' };
    const keyPath = 'category';
    const result = getOptionLabel({ fieldConfig, valueMap, keyPath });

    expect(result).toBe('option2');
  });

  test('should return label for single select with labels', () => {
    /** @type {SelectField} */
    const fieldConfig = {
      ...baseFieldConfig,
      multiple: false,
      options: [
        { label: 'First Option', value: 'option1' },
        { label: 'Second Option', value: 'option2' },
        { label: 'Third Option', value: 'option3' },
      ],
    };

    const valueMap = { category: 'option2' };
    const keyPath = 'category';
    const result = getOptionLabel({ fieldConfig, valueMap, keyPath });

    expect(result).toBe('Second Option');
  });

  test('should return value if label not found', () => {
    /** @type {SelectField} */
    const fieldConfig = {
      ...baseFieldConfig,
      multiple: false,
      options: [
        { label: 'First Option', value: 'option1' },
        { label: 'Second Option', value: 'option2' },
      ],
    };

    const valueMap = { category: 'option3' };
    const keyPath = 'category';
    const result = getOptionLabel({ fieldConfig, valueMap, keyPath });

    expect(result).toBe('option3');
  });

  test('should return values array for multiple select without labels', () => {
    /** @type {SelectField} */
    const fieldConfig = {
      ...baseMultipleFieldConfig,
      multiple: true,
      options: ['option1', 'option2', 'option3'],
    };

    const valueMap = {
      'tags.0': 'option1',
      'tags.1': 'option3',
    };

    const keyPath = 'tags';
    const result = getOptionLabel({ fieldConfig, valueMap, keyPath });

    expect(result).toEqual(['option1', 'option3']);
  });

  test('should return labels array for multiple select with labels', () => {
    /** @type {SelectField} */
    const fieldConfig = {
      ...baseMultipleFieldConfig,
      multiple: true,
      options: [
        { label: 'First Option', value: 'option1' },
        { label: 'Second Option', value: 'option2' },
        { label: 'Third Option', value: 'option3' },
      ],
    };

    const valueMap = {
      'tags.0': 'option1',
      'tags.1': 'option3',
    };

    const keyPath = 'tags';
    const result = getOptionLabel({ fieldConfig, valueMap, keyPath });

    expect(result).toEqual(['First Option', 'Third Option']);
  });

  test('should return empty array for multiple select with no values', () => {
    /** @type {SelectField} */
    const fieldConfig = {
      ...baseMultipleFieldConfig,
      multiple: true,
      options: ['option1', 'option2', 'option3'],
    };

    const valueMap = {};
    const keyPath = 'tags';
    const result = getOptionLabel({ fieldConfig, valueMap, keyPath });

    expect(result).toEqual([]);
  });

  test('should return cached result on subsequent calls', () => {
    /** @type {SelectField} */
    const fieldConfig = {
      ...baseFieldConfig,
      multiple: false,
      options: [
        { label: 'First Option', value: 'option1' },
        { label: 'Second Option', value: 'option2' },
      ],
    };

    const valueMap = { category: 'option1' };
    const keyPath = 'category';
    // First call - should compute and cache
    const result1 = getOptionLabel({ fieldConfig, valueMap, keyPath });

    expect(result1).toBe('First Option');

    // Second call with same params - should return cached result
    const result2 = getOptionLabel({ fieldConfig, valueMap, keyPath });

    expect(result2).toBe('First Option');
    expect(result1).toBe(result2); // Same reference from cache
  });
});

describe('Test getPreviewLabels()', () => {
  /** @type {SelectField} */
  const plainFieldConfig = {
    ...baseFieldConfig,
    options: ['apple', 'banana', 'cherry'],
  };

  /** @type {SelectField} */
  const labeledFieldConfig = {
    ...baseFieldConfig,
    options: [
      { label: 'Apple', value: 'apple' },
      { label: 'Banana', value: 'banana' },
      { label: 'Zero', value: 0 },
    ],
  };

  test('should return nothing when there is no value', () => {
    expect(getPreviewLabels({ fieldConfig: plainFieldConfig, currentValue: undefined })).toEqual(
      [],
    );
    expect(
      getPreviewLabels({
        fieldConfig: { ...plainFieldConfig, multiple: true },
        currentValue: undefined,
      }),
    ).toEqual([]);
    expect(
      getPreviewLabels({ fieldConfig: { ...plainFieldConfig, multiple: true }, currentValue: [] }),
    ).toEqual([]);
  });

  test('should show a value as is when the options have no labels', () => {
    expect(getPreviewLabels({ fieldConfig: plainFieldConfig, currentValue: 'banana' })).toEqual([
      'banana',
    ]);
    expect(getPreviewLabels({ fieldConfig: plainFieldConfig, currentValue: 42 })).toEqual(['42']);
    expect(getPreviewLabels({ fieldConfig: plainFieldConfig, currentValue: null })).toEqual([
      'null',
    ]);
  });

  test('should show the label of a value when the options have labels', () => {
    expect(getPreviewLabels({ fieldConfig: labeledFieldConfig, currentValue: 'banana' })).toEqual([
      'Banana',
    ]);
    expect(getPreviewLabels({ fieldConfig: labeledFieldConfig, currentValue: 0 })).toEqual([
      'Zero',
    ]);
  });

  test('should show a value as is when it is not found in the labeled options', () => {
    expect(getPreviewLabels({ fieldConfig: labeledFieldConfig, currentValue: 'cherry' })).toEqual([
      'cherry',
    ]);
  });

  test('should sort the labels of multiple values', () => {
    expect(
      getPreviewLabels({
        fieldConfig: { ...labeledFieldConfig, multiple: true },
        currentValue: ['banana', 'cherry', 'apple'],
      }),
    ).toEqual(['Apple', 'Banana', 'cherry']);
    expect(
      getPreviewLabels({
        fieldConfig: { ...plainFieldConfig, multiple: true },
        currentValue: ['cherry', 'apple'],
      }),
    ).toEqual(['apple', 'cherry']);
  });

  test('should ignore a non-array value for a multiple field', () => {
    expect(
      getPreviewLabels({
        fieldConfig: { ...plainFieldConfig, multiple: true },
        currentValue: 'apple',
      }),
    ).toEqual([]);
  });
});
