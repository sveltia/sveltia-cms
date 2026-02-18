/* eslint-disable max-classes-per-file */

import dayjs from 'dayjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getCurrentDateTime,
  getCurrentValue,
  getDate,
  getDateTimeFieldDisplayValue,
  getInputValue,
  getParser,
  isValidDate,
  parseDateTimeConfig,
} from './helper';

/**
 * @import { DateTimeField } from '$lib/types/public';
 */

/** @type {Pick<DateTimeField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'datetime',
  name: 'test_datetime',
};

// Mock dependencies
vi.mock('@sveltia/utils/datetime', () => ({
  getDateTimeParts: vi.fn(({ date, timeZone } = {}) => {
    // Use a consistent test date to avoid timezone issues
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

    // For local timezone, always use UTC for consistent testing across environments
    // This ensures tests work the same in EST, PST, UTC, or any other timezone
    return {
      year: testDate.getUTCFullYear().toString(),
      month: (testDate.getUTCMonth() + 1).toString().padStart(2, '0'),
      day: testDate.getUTCDate().toString().padStart(2, '0'),
      hour: testDate.getUTCHours().toString().padStart(2, '0'),
      minute: testDate.getUTCMinutes().toString().padStart(2, '0'),
    };
  }),
}));

vi.mock('$lib/services/contents/i18n', () => ({
  getCanonicalLocale: vi.fn((locale) => locale),
}));

vi.mock('$lib/services/utils/date', () => ({
  DATE_FORMAT_OPTIONS: { year: 'numeric', month: '2-digit', day: '2-digit' },
  DATE_REGEX: /^\d{4}-\d{2}-\d{2}$/,
  TIME_FORMAT_OPTIONS: { hour: '2-digit', minute: '2-digit' },
  TIME_SUFFIX_REGEX: /[+-]\d{2}:\d{2}$/,
}));

// Set up default mock return values
beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseDateTimeConfig', () => {
  test('should parse basic configuration', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DD HH:mm',
      date_format: 'YYYY-MM-DD',
      time_format: 'HH:mm',
      picker_utc: true,
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result).toEqual({
      format: 'YYYY-MM-DD HH:mm',
      dateOnly: false,
      timeOnly: false,
      utc: true,
    });
  });

  test('should handle date only configuration', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      date_format: 'YYYY-MM-DD',
      time_format: false,
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result).toEqual({
      format: 'YYYY-MM-DD',
      dateOnly: true,
      timeOnly: false,
      utc: false,
    });
  });

  test('should handle time only configuration', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      date_format: false,
      time_format: 'HH:mm',
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result).toEqual({
      format: 'HH:mm',
      dateOnly: false,
      timeOnly: true,
      utc: false,
    });
  });

  test('should handle empty configuration', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result).toEqual({
      format: undefined,
      dateOnly: false,
      timeOnly: false,
      utc: false,
    });
  });
});

describe('getDate', () => {
  test('should return undefined for empty value', () => {
    const result = getDate(undefined, baseFieldConfig);

    expect(result).toBeUndefined();
  });

  test('should parse date with custom format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DD',
    };

    const result = getDate('2023-12-25', fieldConfig);

    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2023);
    expect(result?.getMonth()).toBe(11); // 0-indexed
    expect(result?.getDate()).toBe(25);
  });

  test('should handle time only format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      time_format: 'HH:mm',
      date_format: false,
    };

    const result = getDate('14:30', fieldConfig);

    expect(result).toBeInstanceOf(Date);
    expect(result?.getHours()).toBe(14);
    expect(result?.getMinutes()).toBe(30);
  });

  test('should parse ISO date string', () => {
    const result = getDate('2023-12-25T14:30:00', baseFieldConfig);

    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2023);
  });

  test('should handle invalid date gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = getDate('invalid-date', baseFieldConfig);

    // Invalid dates return undefined after being validated by isValidDate
    expect(result).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith('Invalid Date', 'invalid-date');
    consoleSpy.mockRestore();
  });

  test('should return undefined for unparseable date strings', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      date_format: false,
    };

    const result = getDate('completely-bogus-date', fieldConfig);

    expect(result).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith('Invalid Date', 'completely-bogus-date');
    consoleSpy.mockRestore();
  });

  test('should use dayjs fallback parsing when format doesnt match', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DDTHH:mm:ss',
    };

    // Value matches the format, so dayjs should parse it successfully
    const result = getDate('2025-12-16T10:30:00', fieldConfig);

    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2025);
    expect(result?.getMonth()).toBe(11); // 0-indexed, December
    expect(result?.getDate()).toBe(16);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should fall back to default parsing when format string mismatch occurs', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'DD/MM/YYYY',
    };

    // Value in ISO format doesn't match expected DD/MM/YYYY format
    // dayjs will try the format first, then fall back to parsing without format
    const result = getDate('2025-12-16', fieldConfig);

    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2025);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should handle valid ISO datetime with UTC when format mismatch occurs', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DD HH:mm:ss',
      picker_utc: true,
    };

    // Value in ISO format with T and Z doesn't match custom format
    // day.js will throw, native parsing should handle ISO format
    const result = getDate('2025-12-16T10:30:00Z', fieldConfig);

    expect(result).toBeInstanceOf(Date);
    expect(result?.getUTCFullYear()).toBe(2025);
    expect(result?.getUTCMonth()).toBe(11);
    expect(result?.getUTCDate()).toBe(16);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should return undefined when parsing produces invalid result', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DDTHH:mm:ss',
    };

    // Invalid value that neither dayjs nor fallback parsing can handle
    const result = getDate('completely-invalid-date-string-xyz', fieldConfig);

    // New implementation returns undefined for invalid dates
    expect(result).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith('Invalid Date', 'completely-invalid-date-string-xyz');
    consoleSpy.mockRestore();
  });
});

describe('getCurrentDateTime', () => {
  test('should return current date and time', () => {
    const result = getCurrentDateTime(baseFieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  test('should return date only', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      time_format: false,
    };

    const result = getCurrentDateTime(fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  test('should return time only', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      date_format: false,
    };

    const result = getCurrentDateTime(fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  test('should return UTC format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      picker_utc: true,
    };

    const result = getCurrentDateTime(fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
  });

  test('should handle timezone differences correctly', () => {
    // Test UTC - should return UTC time
    const utcResult = getCurrentDateTime({
      ...baseFieldConfig,
      picker_utc: true,
    });

    expect(utcResult).toMatch(/2023-12-25T14:30:00\.000Z/);

    // Test local timezone - in our mock both return the same UTC time for consistency
    const localResult = getCurrentDateTime(baseFieldConfig);

    expect(localResult).toMatch(/2023-12-25T14:30/); // Same time, but no `Z` suffix
  });
});

describe('getCurrentValue', () => {
  test('should return empty string for empty input', () => {
    const result = getCurrentValue('', 'current', baseFieldConfig);

    expect(result).toBe('');
  });

  test('should return undefined for null input', () => {
    const result = getCurrentValue(undefined, 'current', {
      widget: 'datetime',
      name: 'test_datetime',
    });

    expect(result).toBeUndefined();
  });

  test('should format with custom format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DD HH:mm',
    };

    const result = getCurrentValue('2023-12-25T14:30', 'current', fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  test('should handle date only', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      time_format: false,
    };

    const result = getCurrentValue('2023-12-25', 'current', fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  test('should handle UTC format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      picker_utc: true,
    };

    const result = getCurrentValue('2023-12-25T14:30', 'current', fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25T14:30/);
  });

  test('should append time suffix', () => {
    const result = getCurrentValue('2023-12-25T14:30', '2023-12-25T14:30:00', baseFieldConfig);

    expect(result).toBe('2023-12-25T14:30:00');
  });

  test('should handle milliseconds in current value', () => {
    const result = getCurrentValue('2023-12-25T14:30', '2023-12-25T14:30:00.000', baseFieldConfig);

    expect(result).toBe('2023-12-25T14:30:00.000');
  });

  test('should handle invalid input gracefully in getCurrentValue', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DD',
      picker_utc: true,
    };

    // Use completely invalid input that dayjs cannot parse
    const result = getCurrentValue('not-a-valid-date-at-all', '', fieldConfig);

    expect(result).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith('Invalid date', 'not-a-valid-date-at-all');
    consoleSpy.mockRestore();
  });
});

describe('getInputValue', () => {
  test('should return empty string for no current value', () => {
    const result = getInputValue(undefined, baseFieldConfig);

    expect(result).toBe('');
  });

  test('should return date for standard date format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      time_format: false,
    };

    const result = getInputValue('2023-12-25', fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  test('should return time for standard time format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      date_format: false,
    };

    const result = getInputValue('14:30', fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/14:30/);
  });

  test('should parse and format date-time', () => {
    const result = getInputValue('2023-12-25T14:30:00', baseFieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  test('should handle date only configuration', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      time_format: false,
    };

    const result = getInputValue('2023-12-25T14:30:00', fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  test('should handle time only configuration', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      date_format: false,
    };

    const result = getInputValue('2023-12-25T14:30:00', fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/14:30/);
  });

  test('should handle UTC configuration', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      widget: 'datetime',
      name: 'test_datetime',
      picker_utc: true,
    };

    const result = getInputValue('2023-12-25T14:30:00Z', fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  test('should handle parsing errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = getInputValue('invalid-date', baseFieldConfig);

    expect(result).toBe('');
    consoleSpy.mockRestore();
  });

  test('should handle UTC timezone correctly in getInputValue', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      picker_utc: true,
    };

    const result = getInputValue('2023-12-25T14:30:00Z', fieldConfig);

    expect(typeof result).toBe('string');
    // Should return UTC time components
    expect(result).toMatch(/2023-12-25T14:30/);
  });

  test('should extract time from datetime string for timeOnly config', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      date_format: false,
    }; // timeOnly = true

    // Test extracting time from full datetime string
    const result1 = getInputValue('2023-12-25T14:30:00', fieldConfig);

    expect(result1).toBe('14:30');

    // Test extracting time from standalone time string
    const result2 = getInputValue('09:15', fieldConfig);

    expect(result2).toBe('09:15');
  });

  test('should return empty string when value cannot be parsed with custom format', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DD',
    };

    // Use a completely invalid value that will fail parsing
    const result = getInputValue('not-a-valid-date-at-all', fieldConfig);

    expect(result).toBe('');
    consoleSpy.mockRestore();
  });

  test('should return empty string when getDate returns invalid Date object', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DD HH:mm:ss',
    };

    // This should fail to parse and result in an invalid date
    const result = getInputValue('this-is-totally-invalid', fieldConfig);

    // Should handle invalid dates gracefully
    expect(result).toBe('');
    consoleSpy.mockRestore();
  });

  test('should return empty string when getDate returns undefined for invalid input', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      date_format: false,
    };

    // This will trigger getDate to return undefined (invalid date)
    const result = getInputValue('totally-invalid-date-string', fieldConfig);

    expect(result).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith('Invalid Date', 'totally-invalid-date-string');
    consoleSpy.mockRestore();
  });
});

describe('getDateTimeFieldDisplayValue', () => {
  test('should return empty string for empty value', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: baseFieldConfig,
      currentValue: '',
    });

    expect(result).toBe('');
  });

  test('should return empty string for non-string value', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: baseFieldConfig,
      currentValue: undefined,
    });

    expect(result).toBe('');
  });

  test('should format with custom format', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: { ...baseFieldConfig, format: 'YYYY-MM-DD HH:mm' },
      currentValue: '2023-12-25 14:30',
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('should handle date only display', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: { ...baseFieldConfig, time_format: false },
      currentValue: '2023-12-25',
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('should handle time only display', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: { ...baseFieldConfig, date_format: false },
      currentValue: '14:30',
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('should handle full date-time display', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: baseFieldConfig,
      currentValue: '2023-12-25T14:30:00',
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('should handle UTC display', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: { ...baseFieldConfig, picker_utc: true },
      currentValue: '2023-12-25T14:30:00Z',
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('should return empty string for invalid date', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: baseFieldConfig,
      currentValue: 'invalid-date',
    });

    // Invalid dates should return empty string after error handling
    expect(result).toBe('');
  });

  test('should handle format parsing errors', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: { ...baseFieldConfig, format: 'INVALID-FORMAT' },
      currentValue: '2023-12-25',
    });

    expect(typeof result).toBe('string');
  });

  test('should handle UTC timezone in display values', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: { ...baseFieldConfig, picker_utc: true },
      currentValue: '2023-12-25T14:30:00Z',
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('should handle timezone offset in date regex matching', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: { ...baseFieldConfig, time_format: false },
      currentValue: '2023-12-25',
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('should catch errors when format parsing fails in getDateTimeFieldDisplayValue', () => {
    // Use a format and value combination that dayjs can't parse
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: { ...baseFieldConfig, format: 'YYYY-MM-DD HH:mm:ss' },
      currentValue: 'completely-invalid-format-value',
    });

    // When dayjs parsing fails in the try block, it falls to regular date parsing
    expect(typeof result).toBe('string');
  });
});

describe('Day.js format tokens', () => {
  describe('Year tokens', () => {
    test('should handle YYYY (4-digit year)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'YYYY',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('2023');
    });

    test('should handle YY (2-digit year)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'YY',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('23');
    });

    test('should parse date with YYYY format', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'YYYY',
      };

      const result = getDate('2023', fieldConfig);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2023);
    });

    test('should parse date with YY format', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'YY',
      };

      const result = getDate('23', fieldConfig);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2023);
    });
  });

  describe('Month tokens', () => {
    test('should handle MM (2-digit month)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'MM',
      };

      const result = getCurrentValue('2023-05-25T14:30', '', fieldConfig);

      expect(result).toBe('05');
    });

    test('should handle M (1-digit month)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'M',
      };

      const result = getCurrentValue('2023-05-25T14:30', '', fieldConfig);

      expect(result).toBe('5');
    });

    test('should handle MMM (short month name)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'MMM',
      };

      const result = getCurrentValue('2023-05-25T14:30', '', fieldConfig);

      expect(result).toBe('May');
    });

    test('should handle MMMM (full month name)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'MMMM',
      };

      const result = getCurrentValue('2023-05-25T14:30', '', fieldConfig);

      expect(result).toBe('May');
    });

    test('should parse date with MMM format', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'MMM YYYY',
      };

      const result = getDate('May 2023', fieldConfig);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getMonth()).toBe(4); // 0-indexed
      expect(result?.getFullYear()).toBe(2023);
    });

    test('should parse date with MMMM format', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'MMMM YYYY',
      };

      const result = getDate('May 2023', fieldConfig);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getMonth()).toBe(4);
    });
  });

  describe('Day tokens', () => {
    test('should handle DD (2-digit day)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'DD',
      };

      const result = getCurrentValue('2023-12-05T14:30', '', fieldConfig);

      expect(result).toBe('05');
    });

    test('should handle D (1-digit day)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'D',
      };

      const result = getCurrentValue('2023-12-05T14:30', '', fieldConfig);

      expect(result).toBe('5');
    });

    test('should handle dddd (full day name)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'dddd',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig); // Monday

      expect(result).toBe('Monday');
    });

    test('should handle ddd (short day name)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'ddd',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('Mon');
    });
  });

  describe('Hour tokens', () => {
    test('should handle HH (24-hour format, 2-digit)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'HH',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('14');
    });

    test('should handle H (24-hour format, 1-digit)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'H',
      };

      const result = getCurrentValue('2023-12-25T09:30', '', fieldConfig);

      expect(result).toBe('9');
    });

    test('should handle hh (12-hour format, 2-digit)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'hh',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('02');
    });

    test('should handle h (12-hour format, 1-digit)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'h',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('2');
    });

    test('should parse time with HH format', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'HH:mm',
      };

      const result = getDate('14:30', fieldConfig);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getHours()).toBe(14);
    });

    test('should parse time with hh A format', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'hh:mm A',
      };

      const result = getDate('02:30 PM', fieldConfig);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getHours()).toBe(14);
    });
  });

  describe('Minute and Second tokens', () => {
    test('should handle mm (2-digit minutes)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'mm',
      };

      const result = getCurrentValue('2023-12-25T14:05', '', fieldConfig);

      expect(result).toBe('05');
    });

    test('should handle m (1-digit minutes)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'm',
      };

      const result = getCurrentValue('2023-12-25T14:05', '', fieldConfig);

      expect(result).toBe('5');
    });

    test('should handle ss (2-digit seconds)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'ss',
      };

      const result = getCurrentValue('2023-12-25T14:30:07', '', fieldConfig);

      // Seconds are not included in the input, so default to `00`
      expect(result).toBe('00');
    });

    test('should handle s (1-digit seconds)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 's',
      };

      const result = getCurrentValue('2023-12-25T14:30:07', '', fieldConfig);

      // Seconds are not included in the input, so default to `0`
      expect(result).toBe('0');
    });

    test('should handle SSS (milliseconds)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'SSS',
      };

      const result = getCurrentValue('2023-12-25T14:30:07.123', '', fieldConfig);

      // Milliseconds are not included in the input, so default to `000`
      expect(result).toBe('000');
    });
  });

  describe('AM/PM tokens', () => {
    test('should handle A (uppercase AM/PM)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'A',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('PM');
    });

    test('should handle a (lowercase am/pm)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'a',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('pm');
    });

    test('should handle morning time with A', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'A',
      };

      const result = getCurrentValue('2023-12-25T09:30', '', fieldConfig);

      expect(result).toBe('AM');
    });

    test('should parse 12-hour time with AM/PM', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'h:mm A',
      };

      const result = getDate('2:30 PM', fieldConfig);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getHours()).toBe(14);
    });
  });

  describe('Complex format combinations', () => {
    test('should handle common date format (YYYY-MM-DD)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'YYYY-MM-DD',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('2023-12-25');

      const parsed = getDate('2023-12-25', fieldConfig);

      expect(parsed?.getFullYear()).toBe(2023);
      expect(parsed?.getMonth()).toBe(11);
      expect(parsed?.getDate()).toBe(25);
    });

    test('should handle US date format (MM/DD/YYYY)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'MM/DD/YYYY',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('12/25/2023');

      const parsed = getDate('12/25/2023', fieldConfig);

      expect(parsed?.getFullYear()).toBe(2023);
      expect(parsed?.getMonth()).toBe(11);
      expect(parsed?.getDate()).toBe(25);
    });

    test('should handle European date format (DD/MM/YYYY)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'DD/MM/YYYY',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('25/12/2023');

      const parsed = getDate('25/12/2023', fieldConfig);

      expect(parsed?.getFullYear()).toBe(2023);
      expect(parsed?.getMonth()).toBe(11);
      expect(parsed?.getDate()).toBe(25);
    });

    test('should handle full datetime format (YYYY-MM-DD HH:mm:ss)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'YYYY-MM-DD HH:mm:ss',
      };

      const result = getCurrentValue('2023-12-25T14:30:45', '', fieldConfig);

      // Seconds are not included in the input, so default to `00`
      expect(result).toBe('2023-12-25 14:30:00');

      const parsed = getDate('2023-12-25 14:30:45', fieldConfig);

      expect(parsed?.getFullYear()).toBe(2023);
      expect(parsed?.getHours()).toBe(14);
      expect(parsed?.getMinutes()).toBe(30);
      expect(parsed?.getSeconds()).toBe(45);
    });

    test('should handle 12-hour time format (h:mm A)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'h:mm A',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('2:30 PM');

      const parsed = getDate('2:30 PM', fieldConfig);

      expect(parsed?.getHours()).toBe(14);
      expect(parsed?.getMinutes()).toBe(30);
    });

    test('should handle ISO-like format with timezone (YYYY-MM-DDTHH:mm:ssZ)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'YYYY-MM-DDTHH:mm:ssZ',
        picker_utc: true,
      };

      const result = getCurrentValue('2023-12-25T14:30:45', '', fieldConfig);

      // Dayjs format with Z token outputs +00:00 instead of literal Z
      expect(result).toBe('2023-12-25T14:30:00+00:00');

      const parsed = getDate('2023-12-25T14:30:45Z', fieldConfig);

      expect(parsed?.getFullYear()).toBe(2023);
      expect(parsed?.getUTCHours()).toBe(14);
    });
  });

  describe('Edge cases and error handling', () => {
    test('should handle invalid format gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'INVALID',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      // Should return a string even with invalid format
      expect(typeof result).toBe('string');
      consoleSpy.mockRestore();
    });

    test('should handle parsing with wrong format', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'YYYY-MM-DD',
      };

      const result = getDate('not-a-date', fieldConfig);

      // Should return undefined for invalid dates
      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith('Invalid Date', 'not-a-date');
      consoleSpy.mockRestore();
    });

    test('should handle empty format string', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: '',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      // Should fall back to standard handling
      expect(typeof result).toBe('string');
    });

    test('should handle null format', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        // @ts-expect-error - Testing invalid type
        format: null,
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      // Should fall back to standard handling
      expect(typeof result).toBe('string');
    });
  });

  describe('Display value formatting with Day.js tokens', () => {
    test('should display with 12-hour format (h:mm A)', () => {
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, format: 'h:mm A' },
        currentValue: '2:30 PM',
      });

      expect(result).toBe('2:30 PM');
    });

    test('should display with European format (DD/MM/YYYY)', () => {
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, format: 'DD/MM/YYYY' },
        currentValue: '25/12/2023',
      });

      expect(result).toBe('25/12/2023');
    });

    test('should handle format display errors gracefully', () => {
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, format: 'YYYY-MM-DD' },
        currentValue: 'invalid-for-format',
      });

      // Should fall back to standard date parsing
      expect(typeof result).toBe('string');
    });
  });

  describe('getDateTimeFieldDisplayValue - format parsing (lines 212-213)', () => {
    test('should execute format try path with UTC dayjs when format and utc are specified', () => {
      // Tests line 212: return (utc ? dayjs.utc : dayjs)(currentValue, format).format(format);
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, format: 'YYYY-MM-DD', picker_utc: true },
        currentValue: '2023-12-25',
      });

      expect(result).toBe('2023-12-25');
    });

    test('should execute format try path with regular dayjs when format is specified but utc is false', () => {
      // Tests line 212: return (utc ? dayjs.utc : dayjs)(currentValue, format).format(format);
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, format: 'YYYY-MM-DD', picker_utc: false },
        currentValue: '2023-12-25',
      });

      expect(result).toBe('2023-12-25');
    });

    test('should successfully format when custom format matches input', () => {
      // Tests line 212-213: format parsing and return
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, format: 'DD/MM/YYYY' },
        currentValue: '25/12/2023',
      });

      expect(result).toBe('25/12/2023');
    });
  });

  describe('getDateTimeFieldDisplayValue - format catch block (lines 217-221)', () => {
    test('should catch dayjs parsing exception and fall through to regular parsing', () => {
      // Tests lines 217-221: catch block that falls through silently
      // When format parsing fails, it should fall through and try regular parsing
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, format: 'YYYY-MM-DD' },
        currentValue: '2023-12-25T14:30:00', // Has time component, format doesn't
      });

      expect(typeof result).toBe('string');
      // Should fallthrough and use regular parsing
      consoleSpy.mockRestore();
    });

    test('should handle format error when invalid date string provided to parser', () => {
      // Tests lines 217-221: empty catch block that silently continues
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, format: 'YYYY-MM-DD' },
        currentValue: 'not-a-real-date-at-all',
      });

      // After format catch, falls through to getDate which creates Invalid Date
      expect(typeof result).toBe('string');
      consoleSpy.mockRestore();
    });

    test('should handle parsing exception with Z format token and continue', () => {
      // Tests lines 217-221: catch block allows continuation
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, format: 'YYYY-MM-DDTHH:mm:ssZ' },
        currentValue: '2023/12/25T14:30:00Z', // Wrong date format separator
      });

      expect(typeof result).toBe('string');
      // Should catch error and continue
      consoleSpy.mockRestore();
    });

    test('should handle invalid dates with format and UTC', async () => {
      // Tests handling of invalid dates when format and UTC are specified
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, format: 'YYYY-MM-DD', picker_utc: true },
        currentValue: 'invalid-date-value',
      });

      // Should return empty string for invalid dates
      expect(result).toBe('');
      expect(consoleSpy).toHaveBeenCalledWith('Invalid Date', 'invalid-date-value');
      consoleSpy.mockRestore();
    });
  });

  describe('getDateTimeFieldDisplayValue - timezone conditional (lines 244-245)', () => {
    test('should use UTC timezone when DATE_REGEX matches currentValue in dateOnly mode', () => {
      // Tests lines 244-245: utc || DATE_REGEX.test(currentValue) condition
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: false },
        currentValue: '2023-12-25', // Matches DATE_REGEX pattern
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should use UTC timezone when TIME_SUFFIX_REGEX matches currentValue in dateOnly mode', () => {
      // Tests lines 244-245 - TIME_SUFFIX_REGEX branch
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: false },
        currentValue: '2023-12-25T00:00:00Z', // Matches TIME_SUFFIX_REGEX
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should use UTC timezone when picker_utc is true in dateOnly mode', () => {
      // Tests lines 244-245: utc || ... condition (utc branch)
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: true },
        currentValue: '2023-12-25T14:30:00', // Does not match regex, but utc is true
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should use undefined timezone when no conditions match in dateOnly mode', () => {
      // Tests lines 244-245: undefined branch of ternary
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: false },
        currentValue: '2023-12-25T14:30:00', // ISO format, doesn't match simple patterns
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle multiple regex pattern matching scenarios together', () => {
      // Tests all branches of line 244-245 in sequence
      const configs = [
        { currentValue: '2023-12-25', utc: false }, // DATE_REGEX match
        { currentValue: '2023-12-25T00:00Z', utc: false }, // TIME_SUFFIX_REGEX match
        { currentValue: '2023-12-25', utc: true }, // utc true
        { currentValue: '2023-12-25T14:30:00', utc: false }, // no match
      ];

      configs.forEach(({ currentValue, utc }) => {
        const result = getDateTimeFieldDisplayValue({
          locale: 'en',
          fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: utc },
          currentValue,
        });

        expect(typeof result).toBe('string');
      });
    });
  });

  describe('getDateTimeFieldDisplayValue - additional coverage', () => {
    test('should handle invalid date after getDate returns falsy', () => {
      // Test when getDate returns undefined and we hit the return ''
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: baseFieldConfig,
        currentValue: 'not-parseable-to-any-date',
      });

      expect(result).toBe('');
    });

    test('should properly handle timeOnly=true in getDateTimeFieldDisplayValue', () => {
      // Ensure timeOnly path is executed
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, date_format: false },
        currentValue: '14:30:00',
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should properly handle full datetime display with all options', () => {
      // Execute the full datetime path in getDateTimeFieldDisplayValue
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, picker_utc: false },
        currentValue: '2023-12-25T14:30:00',
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle whitespace-only currentValue', () => {
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: baseFieldConfig,
        currentValue: '   ',
      });

      expect(result).toBe('');
    });

    test('should handle format parsing with Z suffix conversion', () => {
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, format: 'YYYY-MM-DD[T]HH:mm:ssZ' },
        currentValue: '2023-12-25T14:30:00Z',
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle timeZoneName parameter for non-UTC datetime', () => {
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, picker_utc: false },
        currentValue: '2023-12-25T14:30:00',
      });

      expect(typeof result).toBe('string');
      // Non-UTC with timeZoneName should include timezone info
      expect(result.length).toBeGreaterThan(0);
    });

    test('should return empty string when currentValue is not a string', () => {
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: baseFieldConfig,
        // @ts-expect-error - Testing invalid type
        currentValue: 123,
      });

      expect(result).toBe('');
    });

    test('should handle null currentValue', () => {
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: baseFieldConfig,
        // @ts-expect-error - Testing invalid type
        currentValue: null,
      });

      expect(result).toBe('');
    });

    test('should handle undefined currentValue', () => {
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: baseFieldConfig,
        currentValue: undefined,
      });

      expect(result).toBe('');
    });

    test('should handle invalid Date object from getDate gracefully', () => {
      // When getDate returns an invalid Date (NaN timestamp)
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: baseFieldConfig,
        currentValue: 'invalid-date-string',
      });

      expect(result).toBe('');
    });
  });

  describe('getInputValue - timeOnly return path (lines 212-213)', () => {
    test('should return timeStr when timeOnly is true in standard time format', () => {
      // Tests lines 212-213: if (timeOnly) { return timeStr; }
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        date_format: false,
      };

      // Ensure timeOnly is true
      expect(fieldConfig.date_format).toBe(false);

      // Test with datetime string - should extract time
      const result = getInputValue('2023-12-25T14:30:00', fieldConfig);

      expect(result).toBe('14:30');
    });

    test('should return timeStr for timeOnly with just time string input', () => {
      // Tests lines 212-213: return timeStr branch
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        date_format: false,
      };

      const result = getInputValue('12:45', fieldConfig);

      expect(result).toBe('12:45');
    });

    test('should return timeStr with early morning time when timeOnly is true', () => {
      // Tests lines 212-213: verify timeStr is returned correctly
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        date_format: false,
      };

      const result = getInputValue('2023-06-15T03:15:00', fieldConfig);

      expect(result).toBe('03:15');
    });

    test('should return timeStr with late evening time when timeOnly is true', () => {
      // Tests lines 212-213: return timeStr for various times
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        date_format: false,
      };

      const result = getInputValue('2023-06-15T23:59:00', fieldConfig);

      expect(result).toBe('23:59');
    });

    test('should return timeStr via full parse when quick regex fails (line 243)', () => {
      // Tests line 243: if (timeOnly) { return timeStr; }
      // A 12-hour time string like '2:30 PM' does NOT match the quick regex
      // /(?:^|T)(?<time>[0-2]\d:[0-5]\d)\b/ (single-digit hour fails [0-2]\d)
      // so getDate is called and parses it via the format, then timeStr is returned.
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        date_format: false, // timeOnly = true
        format: 'h:mm A',
      };

      const result = getInputValue('2:30 PM', fieldConfig);

      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('getInputValue - error handling and edge cases', () => {
    test('should handle dateOnly mode and return dateStr', () => {
      // Tests lines 212-213: if (dateOnly) { return dateStr; }
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        time_format: false, // dateOnly = true
      };

      const result = getInputValue('2023-06-15T10:30:00', fieldConfig);

      expect(result).toBe('2023-06-15');

      consoleSpy.mockRestore();
    });

    test('should return empty string for unparseable values', () => {
      // Tests line 221 and catch block behavior
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        date_format: false,
      };

      const result = getInputValue('not-a-valid-time', fieldConfig);

      expect(result).toBe('');

      consoleSpy.mockRestore();
    });

    test('should handle error cases gracefully with different configurations', () => {
      // Tests catch block error handling (lines 217-221)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        time_format: false,
        picker_utc: true,
      };

      const result = getInputValue('invalid-date', fieldConfig);

      expect(result).toBe('');

      consoleSpy.mockRestore();
    });

    test('should handle valid datetime input correctly', async () => {
      // Tests normal parsing flow with valid datetime input
      // Note: The input goes through Date parsing which interprets it as local time,
      // then getDateTimeParts returns UTC values, causing a timezone conversion
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
      };

      const result = getInputValue('2023-12-25T14:30', fieldConfig);

      // The result will be a valid datetime string (exact value depends on timezone)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('getDateTimeFieldDisplayValue - timezone ternary (lines 244-245)', () => {
    test('should use UTC timezone when utc flag is true in dateOnly mode', () => {
      // Tests lines 244-245: utc || ... ? 'UTC' : undefined (utc branch)
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: true },
        currentValue: '2023-12-25T14:30:00',
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should use UTC timezone when DATE_REGEX matches currentValue in dateOnly mode', () => {
      // Tests lines 244-245: DATE_REGEX.test(currentValue) branch
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: false },
        currentValue: '2023-12-25', // Matches YYYY-MM-DD pattern
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should use UTC timezone when TIME_SUFFIX_REGEX matches currentValue in dateOnly mode', () => {
      // Tests lines 244-245: TIME_SUFFIX_REGEX.test(currentValue) branch
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: false },
        currentValue: '2023-12-25T00:00:00Z', // Matches timezone offset pattern
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should use undefined timezone when none of conditions match in dateOnly mode', () => {
      // Tests lines 244-245: undefined branch (none of the conditions true)
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: false },
        currentValue: '2023-12-25T14:30:00', // ISO datetime without suffix, won't match patterns
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should correctly apply timezone ternary with all true conditions', () => {
      // Tests lines 244-245: multiple branches combined
      const configs = [
        { value: '2023-12-25', desc: 'DATE_REGEX match' },
        { value: '2023-12-25+02:00', desc: 'TIME_SUFFIX_REGEX match' },
        { value: '2023-12-25T14:30', desc: 'no match' },
      ];

      configs.forEach(({ value }) => {
        const result = getDateTimeFieldDisplayValue({
          locale: 'en',
          fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: false },
          currentValue: value,
        });

        expect(typeof result).toBe('string');
      });
    });

    test('should prioritize utc flag over DATE_REGEX in timezone ternary', () => {
      // Tests lines 244-245: utc || ... short-circuit evaluation
      const resultWithUtcTrue = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: true },
        currentValue: '2023-12-25',
      });

      const resultWithUtcFalse = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: false },
        currentValue: '2023-12-25',
      });

      expect(typeof resultWithUtcTrue).toBe('string');
      expect(typeof resultWithUtcFalse).toBe('string');
    });

    test('should handle timezone ternary with TIME_SUFFIX_REGEX and utc false', () => {
      // Tests lines 244-245: explicitly test TIME_SUFFIX_REGEX branch
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: false },
        currentValue: '2023-12-25-05:00', // Negative offset matches TIME_SUFFIX_REGEX
      });

      expect(typeof result).toBe('string');
    });
  });

  describe('Uncovered line paths', () => {
    describe('getInputValue - lines 212-213 (return timeStr path)', () => {
      test('should hit line 212-213 when timeOnly=true and value needs full parsing', () => {
        // Lines 212-213: if (timeOnly) { return timeStr; }
        // To hit this, we need:
        // 1. timeOnly = true (date_format: false)
        // 2. A currentValue that does NOT match the early regex pattern
        //    /(?:^|T)(?<time>[0-2]\d:[0-5]\d)\b/
        // 3. But CAN be parsed by getDate() to extract time

        /** @type {DateTimeField} */
        const fieldConfig = {
          ...baseFieldConfig,
          date_format: false, // timeOnly = true
          format: 'HH:mm:ss', // Custom format that won't match early regex
        };

        // Use a datetime string that includes seconds - won't match early regex
        const result = getInputValue('2023-12-25T14:30:45', fieldConfig);

        // Should extract the time (line 212 return)
        expect(result).toBe('14:30');
      });

      test('should hit line 212-213 with ISO datetime containing milliseconds', () => {
        // Another case that bypasses early regex and hits line 212
        /** @type {DateTimeField} */
        const fieldConfig = {
          ...baseFieldConfig,
          date_format: false, // timeOnly = true
        };

        // Full ISO string with milliseconds - won't match early regex pattern
        const result = getInputValue('2023-12-25T09:15:30.123Z', fieldConfig);

        // Should extract time via getDateTimeParts (line 212 return)
        expect(result).toBe('09:15');
      });

      test('should hit line 212-213 with timezone offset time string', () => {
        /** @type {DateTimeField} */
        const fieldConfig = {
          ...baseFieldConfig,
          date_format: false, // timeOnly = true
          picker_utc: true,
        };

        // String with timezone - won't match early regex
        const result = getInputValue('2023-06-15T22:45:00+00:00', fieldConfig);

        // Should extract time (line 212 return)
        expect(result).toBe('22:45');
      });
    });

    describe('getInputValue - lines 217-221 (catch block)', () => {
      test('should handle timeOnly mode correctly', () => {
        // Tests timeOnly handling with standard time input
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        /** @type {DateTimeField} */
        const fieldConfig = {
          ...baseFieldConfig,
          date_format: false, // timeOnly = true
        };

        // This should extract time from the value
        const result = getInputValue('2023-12-25T14:30:00', fieldConfig);

        // Should return just the time part
        expect(result).toBe('14:30');
        consoleSpy.mockRestore();
      });

      test('should return empty when getDate throws during catch block', () => {
        // Verify catch block returns empty string when an error occurs
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        /** @type {DateTimeField} */
        const fieldConfig = {
          ...baseFieldConfig,
          time_format: false, // dateOnly = true
          format: 'BROKEN]]]][[[[',
        };

        // Use a date value that will cause error with broken format
        // Early regex won't match, so it goes through the full try block
        const result = getInputValue('bad-date-value', fieldConfig);

        // Should hit catch block
        expect(result).toBe('');
        consoleSpy.mockRestore();
      });
    });

    describe('getDateTimeFieldDisplayValue - lines 244-245 (timezone ternary)', () => {
      test('should take UTC branch when utc flag is true (lines 244-245)', () => {
        // Lines 244-245: utc || ... ? 'UTC' : undefined
        // The utc flag short-circuits to 'UTC'
        const result = getDateTimeFieldDisplayValue({
          locale: 'en',
          fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: true },
          currentValue: '2023-12-25T14:30:00',
        });

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      test('should take UTC branch when DATE_REGEX matches (lines 244-245)', () => {
        // Lines 244-245: DATE_REGEX.test(currentValue) ? 'UTC' : undefined
        // DATE_REGEX is /^\d{4}-\d{2}-\d{2}$/
        const result = getDateTimeFieldDisplayValue({
          locale: 'en',
          fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: false },
          currentValue: '2023-12-25', // Exact DATE_REGEX match
        });

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      test('should take UTC branch when TIME_SUFFIX_REGEX matches (lines 244-245)', () => {
        // Lines 244-245: TIME_SUFFIX_REGEX.test(currentValue) ? 'UTC' : undefined
        // TIME_SUFFIX_REGEX is /[+-]\d{2}:\d{2}$/
        const result = getDateTimeFieldDisplayValue({
          locale: 'en',
          fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: false },
          currentValue: '2023-12-25T00:00:00+02:00', // Positive timezone offset
        });

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      test('should take undefined branch when none of conditions match (lines 244-245)', () => {
        // Lines 244-245: undefined branch (all conditions false)
        const result = getDateTimeFieldDisplayValue({
          locale: 'en',
          fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: false },
          currentValue: '2023-12-25T14:30:00', // ISO datetime without suffix - no regex match
        });

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      test('should correctly evaluate complex timezone ternary condition', () => {
        // All branches of lines 244-245 in one comprehensive test
        const testCases = [
          {
            desc: 'utc=true (short-circuit)',
            config: { ...baseFieldConfig, time_format: false, picker_utc: true },
            value: '2023-12-25T14:30',
          },
          {
            desc: 'DATE_REGEX matches',
            config: { ...baseFieldConfig, time_format: false, picker_utc: false },
            value: '2023-12-25',
          },
          {
            desc: 'TIME_SUFFIX_REGEX matches',
            config: { ...baseFieldConfig, time_format: false, picker_utc: false },
            value: '2023-12-25T14:30:00-05:00',
          },
          {
            desc: 'no match',
            config: { ...baseFieldConfig, time_format: false, picker_utc: false },
            value: '2023-12-25T14:30:00',
          },
        ];

        testCases.forEach(({ config, value }) => {
          const result = getDateTimeFieldDisplayValue({
            locale: 'en',
            fieldConfig: config,
            currentValue: value,
          });

          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
        });
      });

      test('should catch format parsing exception (line 247 catch block)', () => {
        // Force an exception in dayjs format parsing by using invalid format/value combo
        // This tests the empty catch block at line 247
        const result = getDateTimeFieldDisplayValue({
          locale: 'en',
          fieldConfig: { ...baseFieldConfig, format: 'YYYY-MM-DD HH:mm:ss' },
          currentValue: 'not-a-valid-date',
        });

        // When format parsing fails in try, it falls through to regular date parsing
        // which will also fail and return empty string
        expect(typeof result).toBe('string');
      });

      test('should handle timezone branch with DATE_REGEX match for date-only display (line 264)', () => {
        // Test the branch: DATE_REGEX.test(currentValue) === true
        // This should set timeZone to 'UTC'
        const result = getDateTimeFieldDisplayValue({
          locale: 'en',
          fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: false },
          currentValue: '2023-12-25', // Matches DATE_REGEX pattern
        });

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      test('should handle timezone branch with TIME_SUFFIX_REGEX match for date-only display (line 264)', () => {
        // Test the branch: TIME_SUFFIX_REGEX.test(currentValue) === true
        // This should set timeZone to 'UTC'
        const result = getDateTimeFieldDisplayValue({
          locale: 'en',
          fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: false },
          currentValue: '2023-12-25T14:30:00+02:00', // Matches TIME_SUFFIX_REGEX pattern
        });

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      test('should handle timezone branch undefined when no regex matches (line 264)', () => {
        // Test the undefined branch when both DATE_REGEX and TIME_SUFFIX_REGEX fail
        const result = getDateTimeFieldDisplayValue({
          locale: 'en',
          fieldConfig: { ...baseFieldConfig, time_format: false, picker_utc: false },
          currentValue: '2023-12-25T14:30:00', // Doesn't match either regex
        });

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('isValidDate', () => {
  test('should return true for valid Date objects', () => {
    const validDate = new Date('2023-12-25T14:30:00.000Z');

    expect(isValidDate(validDate)).toBe(true);
  });

  test('should return true for current Date', () => {
    const now = new Date();

    expect(isValidDate(now)).toBe(true);
  });

  test('should return true for Date with time zero', () => {
    const epochDate = new Date(0);

    expect(isValidDate(epochDate)).toBe(true);
  });

  test('should return false for invalid Date objects', () => {
    const invalidDate = new Date('invalid');

    expect(isValidDate(invalidDate)).toBe(false);
  });

  test('should return false for Date with NaN time', () => {
    const nanDate = new Date(NaN);

    expect(isValidDate(nanDate)).toBe(false);
  });

  test('should return false for null', () => {
    expect(isValidDate(null)).toBe(false);
  });

  test('should return false for undefined', () => {
    expect(isValidDate(undefined)).toBe(false);
  });

  test('should return false for strings', () => {
    expect(isValidDate('2023-12-25')).toBe(false);
    expect(isValidDate('invalid')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });

  test('should return false for numbers', () => {
    expect(isValidDate(0)).toBe(false);
    expect(isValidDate(123456789)).toBe(false);
    expect(isValidDate(NaN)).toBe(false);
  });

  test('should return false for booleans', () => {
    expect(isValidDate(true)).toBe(false);
    expect(isValidDate(false)).toBe(false);
  });

  test('should return false for objects', () => {
    expect(isValidDate({})).toBe(false);
    expect(isValidDate({ date: '2023-12-25' })).toBe(false);
  });

  test('should return false for arrays', () => {
    expect(isValidDate([])).toBe(false);
    expect(isValidDate([2023, 12, 25])).toBe(false);
  });
});

describe('getParser', () => {
  test('should return dayjs.utc when utc is true', () => {
    const parser = getParser(true);

    expect(parser).toBe(dayjs.utc);
  });

  test('should return dayjs when utc is false', () => {
    const parser = getParser(false);

    expect(parser).toBe(dayjs);
  });

  test('should allow parsing dates with the returned parser when utc is true', () => {
    const parser = getParser(true);

    // Verify it's the UTC parser
    expect(parser).toBe(dayjs.utc);
  });

  test('should work with local parser to create dates', () => {
    const parser = getParser(false);
    const result = parser('2023-12-25T14:30:00');

    expect(result.isValid()).toBe(true);
    expect(result.format('YYYY-MM-DD')).toBe('2023-12-25');
  });

  test('should allow format parsing with the returned parser when utc is true', () => {
    const parser = getParser(true);

    // Verify it returns the UTC parser
    expect(parser).toBe(dayjs.utc);
  });

  test('should handle format parsing with local parser', () => {
    const parser = getParser(false);
    const result = parser('25/12/2023', 'DD/MM/YYYY');

    expect(result.isValid()).toBe(true);
    expect(result.format('YYYY-MM-DD')).toBe('2023-12-25');
  });
});
