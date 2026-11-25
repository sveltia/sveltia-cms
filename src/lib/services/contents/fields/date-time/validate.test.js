/* eslint-disable jsdoc/require-jsdoc */

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { formatTime, getFormattedDateTime, validateDateTimeField } from './validate';

/**
 * @import { DateTimeField } from '$lib/types/public';
 */

vi.mock('$lib/services/contents/i18n', () => ({
  getCanonicalLocale: vi.fn((locale) => locale),
}));

vi.mock('@sveltia/utils/datetime', () => ({
  getDateTimeParts: vi.fn(({ date, timeZone } = {}) => {
    const testDate = date || new Date('2023-12-25T14:30:00.000Z');

    if (timeZone === 'UTC') {
      return {
        year: testDate.getUTCFullYear().toString(),
        month: (testDate.getUTCMonth() + 1).toString().padStart(2, '0'),
        day: testDate.getUTCDate().toString().padStart(2, '0'),
        hour: testDate.getUTCHours().toString().padStart(2, '0'),
        minute: testDate.getUTCMinutes().toString().padStart(2, '0'),
      };
    }

    return {
      year: testDate.getUTCFullYear().toString(),
      month: (testDate.getUTCMonth() + 1).toString().padStart(2, '0'),
      day: testDate.getUTCDate().toString().padStart(2, '0'),
      hour: testDate.getUTCHours().toString().padStart(2, '0'),
      minute: testDate.getUTCMinutes().toString().padStart(2, '0'),
    };
  }),
}));

vi.mock('$lib/services/utils/date', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  DATE_FORMAT_OPTIONS: { year: 'numeric', month: '2-digit', day: '2-digit' },
  DATE_REGEX: /^\d{4}-\d{2}-\d{2}$/,
  TIME_FORMAT_OPTIONS: { hour: '2-digit', minute: '2-digit' },
  TIME_SUFFIX_REGEX: /[+-]\d{2}:\d{2}$/,
}));

/**
 * Create a mock input element for date/time/datetime-local range validation.
 * For these input types the browser compares values lexicographically, which we replicate here.
 * @param {'date' | 'time' | 'datetime-local'} type Input type.
 * @returns {object} Mock input element.
 */
beforeEach(() => {
  /**
   * Mock document.createElement('input') to simulate native date/time range validation.
   * For date, time and datetime-local inputs the browser compares values lexicographically,
   * which we replicate here so tests run without a real DOM.
   */
  vi.stubGlobal('document', {
    createElement: (/** @type {string} */ tagName) => {
      if (tagName !== 'input') return {};

      let inputType = 'datetime-local';
      let min = '';
      let max = '';
      let value = '';

      return new Proxy(
        {},
        {
          get: (_t, prop) => {
            if (prop === 'validity') {
              if (!value) return { rangeUnderflow: false, rangeOverflow: false };

              return {
                rangeUnderflow: !!min && value < min,
                rangeOverflow: !!max && value > max,
              };
            }

            if (prop === 'type') return inputType;
            if (prop === 'min') return min;
            if (prop === 'max') return max;
            if (prop === 'value') return value;

            return undefined;
          },
          set: (_t, prop, val) => {
            if (prop === 'type') inputType = val;
            else if (prop === 'min') min = val;
            else if (prop === 'max') max = val;
            else if (prop === 'value') value = val;

            return true;
          },
        },
      );
    },
  });
});

/** @type {Pick<DateTimeField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'datetime',
  name: 'test_datetime',
};

describe('validateDateTimeField()', () => {
  describe('no min/max constraints', () => {
    // Use type:'time' — datetime and date always inject a default max ('9999-12-31T23:59' /
    // '9999-12-31') to prevent 6-digit year issues in browsers, so hasMax would be true for
    // those types even without an explicit config. time-only has no default max/min.
    test('should return no constraints and valid result when no min/max set', () => {
      /** @type {DateTimeField} */
      const fieldConfig = { ...baseFieldConfig, type: 'time' };

      expect(validateDateTimeField({ fieldConfig, locale: 'en', value: '12:30' })).toEqual({
        validity: { rangeUnderflow: false, rangeOverflow: false },
        detail: { hasMin: false, hasMax: false, invalid: false },
      });
    });

    test('should return valid result for undefined value with no constraints', () => {
      /** @type {DateTimeField} */
      const fieldConfig = { ...baseFieldConfig, type: 'time' };

      expect(validateDateTimeField({ fieldConfig, locale: 'en', value: undefined })).toEqual({
        validity: { rangeUnderflow: false, rangeOverflow: false },
        detail: { hasMin: false, hasMax: false, invalid: false },
      });
    });

    test('should return valid result for empty string value with no constraints', () => {
      /** @type {DateTimeField} */
      const fieldConfig = { ...baseFieldConfig, type: 'time' };

      expect(validateDateTimeField({ fieldConfig, locale: 'en', value: '' })).toEqual({
        validity: { rangeUnderflow: false, rangeOverflow: false },
        detail: { hasMin: false, hasMax: false, invalid: false },
      });
    });
  });

  describe('datetime-local (default)', () => {
    // Use picker_utc: true and UTC-suffixed stored values (e.g. '...Z') throughout this block.
    // getInputValue() for datetime-local goes through getDate() + getDateTimeParts(), which is
    // local-timezone-sensitive. With picker_utc the UTC path is always taken, so the
    // round-trip is deterministic regardless of the host machine's timezone.
    test('should return valid result for value within min/max', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        picker_utc: true,
        min: '2023-01-01T00:00',
        max: '2023-12-31T23:59',
      };

      expect(
        validateDateTimeField({ fieldConfig, locale: 'en', value: '2023-06-15T10:30:00.000Z' }),
      ).toEqual({
        validity: { rangeUnderflow: false, rangeOverflow: false },
        detail: { hasMin: true, hasMax: true, invalid: false },
      });
    });

    test('should return rangeUnderflow=true for value below min', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        picker_utc: true,
        min: '2023-06-01T00:00',
        max: '2023-12-31T23:59',
      };

      const result = validateDateTimeField({
        fieldConfig,
        locale: 'en',
        value: '2023-01-01T10:30:00.000Z',
      });

      expect(result.detail.invalid).toBe(true);
      expect(result.validity.rangeUnderflow).toBe(true);
      expect(result.validity.rangeOverflow).toBe(false);
    });

    test('should return rangeOverflow=true for value above max', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        picker_utc: true,
        min: '2023-01-01T00:00',
        max: '2023-06-30T23:59',
      };

      const result = validateDateTimeField({
        fieldConfig,
        locale: 'en',
        value: '2023-12-25T10:30:00.000Z',
      });

      expect(result.detail.invalid).toBe(true);
      expect(result.validity.rangeUnderflow).toBe(false);
      expect(result.validity.rangeOverflow).toBe(true);
    });

    test('should return valid result for value equal to min', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        picker_utc: true,
        min: '2023-06-15T10:30',
        max: '2023-12-31T23:59',
      };

      const result = validateDateTimeField({
        fieldConfig,
        locale: 'en',
        value: '2023-06-15T10:30:00.000Z',
      });

      expect(result.detail.invalid).toBe(false);
      expect(result.validity.rangeUnderflow).toBe(false);
    });

    test('should return valid result for value equal to max', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        picker_utc: true,
        min: '2023-01-01T00:00',
        max: '2023-06-15T10:30',
      };

      const result = validateDateTimeField({
        fieldConfig,
        locale: 'en',
        value: '2023-06-15T10:30:00.000Z',
      });

      expect(result.detail.invalid).toBe(false);
      expect(result.validity.rangeOverflow).toBe(false);
    });

    test('should skip range check for undefined value even with min/max set', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        picker_utc: true,
        min: '2023-01-01T00:00',
        max: '2023-12-31T23:59',
      };

      expect(validateDateTimeField({ fieldConfig, locale: 'en', value: undefined })).toEqual({
        validity: { rangeUnderflow: false, rangeOverflow: false },
        detail: { hasMin: true, hasMax: true, invalid: false },
      });
    });

    test('should skip range check for empty string value even with min/max set', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        picker_utc: true,
        min: '2023-01-01T00:00',
        max: '2023-12-31T23:59',
      };

      expect(validateDateTimeField({ fieldConfig, locale: 'en', value: '' })).toEqual({
        validity: { rangeUnderflow: false, rangeOverflow: false },
        detail: { hasMin: true, hasMax: true, invalid: false },
      });
    });
  });

  describe('date-only (type: date)', () => {
    test('should return valid result for date within min/max', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        type: 'date',
        min: '2023-01-01',
        max: '2023-12-31',
      };

      expect(validateDateTimeField({ fieldConfig, locale: 'en', value: '2023-06-15' })).toEqual({
        validity: { rangeUnderflow: false, rangeOverflow: false },
        detail: { hasMin: true, hasMax: true, invalid: false },
      });
    });

    test('should return rangeUnderflow=true for date below min', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        type: 'date',
        min: '2023-06-01',
        max: '2023-12-31',
      };

      const result = validateDateTimeField({ fieldConfig, locale: 'en', value: '2023-01-01' });

      expect(result.detail.invalid).toBe(true);
      expect(result.validity.rangeUnderflow).toBe(true);
      expect(result.validity.rangeOverflow).toBe(false);
    });

    test('should return rangeOverflow=true for date above max', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        type: 'date',
        min: '2023-01-01',
        max: '2023-06-30',
      };

      const result = validateDateTimeField({ fieldConfig, locale: 'en', value: '2023-12-25' });

      expect(result.detail.invalid).toBe(true);
      expect(result.validity.rangeUnderflow).toBe(false);
      expect(result.validity.rangeOverflow).toBe(true);
    });
    test('should report hasMin=true and hasMax=true (default) when only min set', () => {
      // parseDateTimeConfig injects a default max of '9999-12-31' for date-only fields to
      // prevent browsers from accepting 6-digit years, so hasMax is always true.
      /** @type {DateTimeField} */
      const fieldConfig = { ...baseFieldConfig, type: 'date', min: '2023-01-01' };
      const result = validateDateTimeField({ fieldConfig, locale: 'en', value: '2022-12-01' });

      expect(result.detail.hasMin).toBe(true);
      expect(result.detail.hasMax).toBe(true); // default max '9999-12-31'
      expect(result.validity.rangeUnderflow).toBe(true);
      expect(result.validity.rangeOverflow).toBe(false); // '2022-12-01' < '9999-12-31'
    });

    test('should report hasMin=false and hasMax=true when only max set', () => {
      /** @type {DateTimeField} */
      const fieldConfig = { ...baseFieldConfig, type: 'date', max: '2023-06-30' };
      const result = validateDateTimeField({ fieldConfig, locale: 'en', value: '2023-12-25' });

      expect(result.detail.hasMin).toBe(false);
      expect(result.detail.hasMax).toBe(true);
      expect(result.validity.rangeUnderflow).toBe(false);
      expect(result.validity.rangeOverflow).toBe(true);
    });
  });

  describe('time-only (type: time)', () => {
    test('should skip range check when getInputValue returns empty string (unparseable value)', () => {
      // Covers the false branch of `if (inputValue)` on line 35: value is truthy and hasMin is
      // true, but getInputValue cannot parse the stored value and returns '', so the
      // document.createElement path is skipped entirely.
      /** @type {DateTimeField} */
      const fieldConfig = { ...baseFieldConfig, type: 'time', min: '08:00' };

      const result = validateDateTimeField({
        fieldConfig,
        locale: 'en',
        value: 'not-a-valid-time',
      });

      expect(result.detail.hasMin).toBe(true);
      expect(result.detail.invalid).toBe(false);
      expect(result.validity).toEqual({ rangeUnderflow: false, rangeOverflow: false });
    });

    test('should validate correctly when only min is set (no max)', () => {
      // Covers the false branch of `if (hasMax) inputElement.max = max` on line 40: time fields
      // have no default max, so hasMax is false when max is not configured.
      /** @type {DateTimeField} */
      const fieldConfig = { ...baseFieldConfig, type: 'time', min: '08:00' };

      expect(validateDateTimeField({ fieldConfig, locale: 'en', value: '06:00' })).toMatchObject({
        validity: { rangeUnderflow: true, rangeOverflow: false },
        detail: { hasMin: true, hasMax: false, invalid: true },
      });
      expect(validateDateTimeField({ fieldConfig, locale: 'en', value: '10:00' })).toMatchObject({
        validity: { rangeUnderflow: false, rangeOverflow: false },
        detail: { hasMin: true, hasMax: false, invalid: false },
      });
    });

    test('should return valid result for time within min/max', () => {
      /** @type {DateTimeField} */
      const fieldConfig = { ...baseFieldConfig, type: 'time', min: '08:00', max: '18:00' };

      expect(validateDateTimeField({ fieldConfig, locale: 'en', value: '12:30' })).toEqual({
        validity: { rangeUnderflow: false, rangeOverflow: false },
        detail: { hasMin: true, hasMax: true, invalid: false },
      });
    });
    test('should return rangeUnderflow=true for time below min', () => {
      /** @type {DateTimeField} */
      const fieldConfig = { ...baseFieldConfig, type: 'time', min: '08:00', max: '18:00' };
      const result = validateDateTimeField({ fieldConfig, locale: 'en', value: '06:30' });

      expect(result.detail.invalid).toBe(true);
      expect(result.validity.rangeUnderflow).toBe(true);
      expect(result.validity.rangeOverflow).toBe(false);
    });
    test('should return rangeOverflow=true for time above max', () => {
      /** @type {DateTimeField} */
      const fieldConfig = { ...baseFieldConfig, type: 'time', min: '08:00', max: '18:00' };
      const result = validateDateTimeField({ fieldConfig, locale: 'en', value: '20:00' });

      expect(result.detail.invalid).toBe(true);
      expect(result.validity.rangeUnderflow).toBe(false);
      expect(result.validity.rangeOverflow).toBe(true);
    });

    test('should return valid result for time stored with seconds suffix', () => {
      /** @type {DateTimeField} */
      const fieldConfig = { ...baseFieldConfig, type: 'time', min: '08:00', max: '18:00' };
      // Values can be stored with seconds, e.g. '12:30:00'
      const result = validateDateTimeField({ fieldConfig, locale: 'en', value: '12:30:00' });

      expect(result.detail.invalid).toBe(false);
      expect(result.validity.rangeUnderflow).toBe(false);
      expect(result.validity.rangeOverflow).toBe(false);
    });
  });

  describe('custom format', () => {
    test('should convert custom-formatted value before range check', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'DD/MM/YYYY HH:mm',
        min: '2023-01-01T00:00',
        max: '2023-12-31T23:59',
      };

      // Stored as custom format '15/06/2023 10:30', which is within range
      const result = validateDateTimeField({
        fieldConfig,
        locale: 'en',
        value: '15/06/2023 10:30',
      });

      expect(result.detail.hasMin).toBe(true);
      expect(result.detail.hasMax).toBe(true);
      expect(result.detail.invalid).toBe(false);
    });
  });
});

describe('formatTime()', () => {
  test('should format time in 24-hour format to 12-hour format with AM', () => {
    expect(formatTime('09:30')).toBe('09:30 AM');
  });

  test('should format time at midnight', () => {
    expect(formatTime('00:00')).toBe('12:00 AM');
  });

  test('should format time at noon', () => {
    expect(formatTime('12:00')).toBe('12:00 PM');
  });

  test('should format afternoon time to PM', () => {
    expect(formatTime('14:30')).toBe('02:30 PM');
  });

  test('should format time at 23:59', () => {
    expect(formatTime('23:59')).toBe('11:59 PM');
  });

  test('should format time with leading zero in hour', () => {
    expect(formatTime('01:00')).toBe('01:00 AM');
  });

  test('should format time with leading zero in minute', () => {
    expect(formatTime('10:05')).toBe('10:05 AM');
  });

  test('should format time in UTC timezone', () => {
    // The function uses UTC timezone for consistent formatting
    const result = formatTime('12:00');

    expect(result).toBe('12:00 PM');
  });
});

describe('getFormattedDateTime()', () => {
  describe('date-only (type: "date") returns date value as-is', () => {
    test('should return date value as-is for date type', () => {
      expect(getFormattedDateTime('date', '2023-06-15')).toBe('2023-06-15');
    });

    test('should return date part from stored format', () => {
      expect(getFormattedDateTime('date', '2023-06-15T14:30:00')).toBe('2023-06-15T14:30:00');
    });

    test('should handle ISO date format', () => {
      expect(getFormattedDateTime('date', '2023-12-25')).toBe('2023-12-25');
    });
  });

  describe('time-only (type: "time")', () => {
    test('should format time in 12-hour format for time type', () => {
      expect(getFormattedDateTime('time', '14:30')).toBe('02:30 PM');
    });

    test('should format midnight correctly', () => {
      expect(getFormattedDateTime('time', '00:00')).toBe('12:00 AM');
    });

    test('should format noon correctly', () => {
      expect(getFormattedDateTime('time', '12:00')).toBe('12:00 PM');
    });

    test('should format time with seconds', () => {
      expect(getFormattedDateTime('time', '09:45:30')).toBe('09:45 AM');
    });
  });

  describe('datetime-local (type: "datetime-local")', () => {
    test('should format datetime with both date and time parts', () => {
      expect(getFormattedDateTime('datetime-local', '2023-06-15T14:30')).toBe(
        '2023-06-15, 02:30 PM',
      );
    });

    test('should format datetime with ISO format', () => {
      const result = getFormattedDateTime('datetime-local', '2023-12-25T09:15:00');

      expect(result).toBe('2023-12-25, 09:15 AM');
    });

    test('should format datetime at midnight', () => {
      expect(getFormattedDateTime('datetime-local', '2023-06-15T00:00')).toBe(
        '2023-06-15, 12:00 AM',
      );
    });

    test('should format datetime at noon', () => {
      expect(getFormattedDateTime('datetime-local', '2023-06-15T12:00')).toBe(
        '2023-06-15, 12:00 PM',
      );
    });

    test('should handle datetime at end of day', () => {
      expect(getFormattedDateTime('datetime-local', '2023-06-15T23:59')).toBe(
        '2023-06-15, 11:59 PM',
      );
    });

    test('should preserve date format while formatting time', () => {
      expect(getFormattedDateTime('datetime-local', '2023-01-01T08:30')).toBe(
        '2023-01-01, 08:30 AM',
      );
    });
  });

  describe('edge cases', () => {
    test('should handle leap day date', () => {
      expect(getFormattedDateTime('date', '2020-02-29')).toBe('2020-02-29');
    });

    test('should handle early morning time in datetime-local', () => {
      expect(getFormattedDateTime('datetime-local', '2023-06-15T04:15')).toBe(
        '2023-06-15, 04:15 AM',
      );
    });

    test('should handle late evening time in datetime-local', () => {
      expect(getFormattedDateTime('datetime-local', '2023-06-15T22:45')).toBe(
        '2023-06-15, 10:45 PM',
      );
    });

    test('should handle datetime-local string without seconds', () => {
      expect(getFormattedDateTime('datetime-local', '2023-06-15T14:30')).toBe(
        '2023-06-15, 02:30 PM',
      );
    });

    test('should handle datetime-local string with milliseconds', () => {
      expect(getFormattedDateTime('datetime-local', '2023-06-15T14:30:00.000')).toBe(
        '2023-06-15, 02:30 PM',
      );
    });
  });
});
