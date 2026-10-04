import { describe, expect, test, vi } from 'vitest';

import { validateNumberField } from './validate';

/**
 * @import { NumberField } from '$lib/types/public';
 */

vi.mock('$lib/services/contents/entry/fields', () => ({
  isFieldRequired: vi.fn(({ fieldConfig }) => fieldConfig.required !== false),
}));

/** @type {Pick<NumberField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'number',
  name: 'test_number',
};

describe('validateNumberField()', () => {
  describe('rangeUnderflow', () => {
    test('should return rangeUnderflow=true when value is below min', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        min: 10,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: 5 });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: true,
          rangeOverflow: false,
          typeMismatch: false,
        },
      });
    });

    test('should return rangeUnderflow=false when value equals min', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        min: 10,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: 10 });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: false,
        },
      });
    });

    test('should return rangeUnderflow=false when value is above min', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        min: 10,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: 15 });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: false,
        },
      });
    });

    test('should return rangeUnderflow=false when value is null', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        min: 10,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: null });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: true,
        },
      });
    });

    test('should return rangeUnderflow=false when min is not set', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: -1000 });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: false,
        },
      });
    });

    test('should handle negative min values', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        min: -100,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: -101 });

      expect(result.validity.rangeUnderflow).toBe(true);
    });

    test('should handle float values below min', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'float',
        min: 1.5,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: 1.4 });

      expect(result.validity.rangeUnderflow).toBe(true);
    });
  });

  describe('rangeOverflow', () => {
    test('should return rangeOverflow=true when value is above max', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        max: 100,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: 150 });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: true,
          typeMismatch: false,
        },
      });
    });

    test('should return rangeOverflow=false when value equals max', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        max: 100,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: 100 });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: false,
        },
      });
    });

    test('should return rangeOverflow=false when value is below max', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        max: 100,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: 50 });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: false,
        },
      });
    });

    test('should return rangeOverflow=false when value is null', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        max: 100,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: null });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: true,
        },
      });
    });

    test('should return rangeOverflow=false when max is not set', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: 999999 });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: false,
        },
      });
    });

    test('should not set rangeOverflow if rangeUnderflow is already true', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        min: 10,
        max: 100,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: 5 });

      expect(result.validity.rangeUnderflow).toBe(true);
      expect(result.validity.rangeOverflow).toBe(false);
    });

    test('should handle negative max values', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        max: -50,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: -49 });

      expect(result.validity.rangeOverflow).toBe(true);
    });

    test('should handle float values above max', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'float',
        max: 2.5,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: 2.6 });

      expect(result.validity.rangeOverflow).toBe(true);
    });
  });

  describe('empty string value', () => {
    test.each(['int/string', 'float/string'])(
      'should not flag an empty %s value as out of range',
      (valueType) => {
        /** @type {NumberField} */
        const overflowConfig = {
          ...baseFieldConfig,
          required: false,
          value_type: /** @type {any} */ (valueType),
          max: -1,
        };

        /** @type {NumberField} */
        const underflowConfig = { ...overflowConfig, max: undefined, min: 1 };

        ['', '  '].forEach((value) => {
          expect(
            validateNumberField({ fieldConfig: overflowConfig, locale: 'en', value }).validity,
          ).toEqual({ rangeUnderflow: false, rangeOverflow: false, typeMismatch: false });
          expect(
            validateNumberField({ fieldConfig: underflowConfig, locale: 'en', value }).validity,
          ).toEqual({ rangeUnderflow: false, rangeOverflow: false, typeMismatch: false });
        });
      },
    );

    test('should still check a numeric string value against the range', () => {
      /** @type {NumberField} */
      const fieldConfig = { ...baseFieldConfig, value_type: 'int/string', min: 0, max: 10 };

      expect(validateNumberField({ fieldConfig, locale: 'en', value: '11' }).validity).toEqual({
        rangeUnderflow: false,
        rangeOverflow: true,
        typeMismatch: false,
      });
      expect(validateNumberField({ fieldConfig, locale: 'en', value: '-1' }).validity).toEqual({
        rangeUnderflow: true,
        rangeOverflow: false,
        typeMismatch: false,
      });
    });
  });

  describe('typeMismatch', () => {
    test('should return typeMismatch=true for required int field with null value', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        required: true,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: null });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: true,
        },
      });
    });

    test('should return typeMismatch=true for required float field with null value', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'float',
        required: true,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: null });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: true,
        },
      });
    });

    test('should return typeMismatch=false for optional int field with null value', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        required: false,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: null });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: false,
        },
      });
    });

    test('should return typeMismatch=false for optional float field with null value', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'float',
        required: false,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: null });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: false,
        },
      });
    });

    test('should return typeMismatch=false for required field with zero value', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        required: true,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: 0 });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: false,
        },
      });
    });

    test('should not check typeMismatch when value_type is int/string', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int/string',
        required: true,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: null });

      // Should not trigger typeMismatch for 'int/string' type
      expect(result.validity.typeMismatch).toBe(false);
    });

    test('should not check typeMismatch when value_type is float/string', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'float/string',
        required: true,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: null });

      // Should not trigger typeMismatch for 'float/string' type
      expect(result.validity.typeMismatch).toBe(false);
    });

    test('should use default value_type of int when not specified', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        // value_type not specified, defaults to 'int'
        required: true,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: null });

      // Should trigger typeMismatch since default value_type is 'int'
      expect(result.validity.typeMismatch).toBe(true);
    });
  });

  describe('combination of constraints', () => {
    test('should check all constraints for required field with min/max', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        required: true,
        min: 0,
        max: 100,
      };

      const resultValid = validateNumberField({ fieldConfig, locale: 'en', value: 50 });

      expect(resultValid).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: false,
        },
      });
    });

    test('should return multiple violations when both rangeUnderflow and other constraints fail', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        required: true,
        min: 10,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: -5 });

      expect(result.validity.rangeUnderflow).toBe(true);
      expect(result.validity.typeMismatch).toBe(false);
      expect(result.validity.rangeOverflow).toBe(false);
    });
  });

  describe('value_type handling', () => {
    test('should return valid for optional field with no value_type specified', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        required: false,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: null });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: false,
        },
      });
    });

    test('should process int type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        required: true,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: null });

      expect(result.validity.typeMismatch).toBe(true);
    });

    test('should process float type', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'float',
        required: true,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: null });

      expect(result.validity.typeMismatch).toBe(true);
    });
  });

  describe('number conversion', () => {
    test('should convert string number to number for min comparison', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        min: 10,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: '5' });

      expect(result.validity.rangeUnderflow).toBe(true);
    });

    test('should convert string number to number for max comparison', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        max: 100,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: '150' });

      expect(result.validity.rangeOverflow).toBe(true);
    });

    test('should handle float string values', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'float',
        min: 1.5,
        max: 2.5,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: '2.0' });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: false,
        },
      });
    });

    test('should handle negative string numbers', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        min: -100,
        max: 100,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: '-50' });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: false,
        },
      });
    });
  });

  describe('edge cases', () => {
    test('should handle zero value with min/max constraints', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        min: -10,
        max: 10,
      };

      const result = validateNumberField({ fieldConfig, locale: 'en', value: 0 });

      expect(result).toEqual({
        validity: {
          rangeUnderflow: false,
          rangeOverflow: false,
          typeMismatch: false,
        },
      });
    });

    test('should handle very large numbers', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'float',
        max: Number.MAX_SAFE_INTEGER,
      };

      const result = validateNumberField({
        fieldConfig,
        locale: 'en',
        value: Number.MAX_SAFE_INTEGER - 1,
      });

      expect(result.validity.rangeOverflow).toBe(false);
    });

    test('should handle very small numbers', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'float',
        min: Number.MIN_SAFE_INTEGER,
      };

      const result = validateNumberField({
        fieldConfig,
        locale: 'en',
        value: Number.MIN_SAFE_INTEGER + 1,
      });

      expect(result.validity.rangeUnderflow).toBe(false);
    });

    test('should handle symmetric min/max values', () => {
      /** @type {NumberField} */
      const fieldConfig = {
        ...baseFieldConfig,
        value_type: 'int',
        min: -50,
        max: 50,
      };

      const resultLow = validateNumberField({ fieldConfig, locale: 'en', value: -50 });
      const resultHigh = validateNumberField({ fieldConfig, locale: 'en', value: 50 });
      const resultMid = validateNumberField({ fieldConfig, locale: 'en', value: 0 });

      expect(resultLow.validity.rangeUnderflow).toBe(false);
      expect(resultHigh.validity.rangeOverflow).toBe(false);
      expect(resultMid.validity.rangeUnderflow).toBe(false);
      expect(resultMid.validity.rangeOverflow).toBe(false);
    });
  });
});
