import dayjs from 'dayjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getDate, getParser, isValidDate } from '$lib/services/contents/fields/date-time/parse';

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
  getDateTimeParts: vi.fn(({ date = new Date(), timeZone = undefined } = {}) => {
    // Mirror the real implementation so tests get correct timezone-aware parts. With TZ=UTC set in
    // the test env (vite.config.js), the default (no timeZone) is also UTC, keeping all tests
    // deterministic across environments.
    /** @type {Intl.DateTimeFormatOptions} */
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'longOffset',
    };

    return Object.fromEntries(
      new Intl.DateTimeFormat('en-US', { ...options, hour12: false, timeZone })
        .formatToParts(date)
        .filter(({ type }) => type in options)
        .map(({ type, value }) => [type, type === 'hour' && value === '24' ? '00' : value]),
    );
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
  vi.restoreAllMocks();
  vi.clearAllMocks();
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
