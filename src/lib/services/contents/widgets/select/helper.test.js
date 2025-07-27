import { describe, expect, test } from 'vitest';

import { getOptionLabel } from './helper';

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
});
