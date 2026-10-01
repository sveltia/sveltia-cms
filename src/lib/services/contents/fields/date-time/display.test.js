import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getDateTimeFieldDisplayValue } from '$lib/services/contents/fields/date-time/display';

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

describe('getDateTimeFieldDisplayValue', () => {
  test('should format the same way as the `Date` locale methods', () => {
    /** @type {Intl.DateTimeFormatOptions} */
    const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
    /** @type {Intl.DateTimeFormatOptions} */
    const timeOptions = { hour: '2-digit', minute: '2-digit' };

    expect(
      getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: baseFieldConfig,
        currentValue: '2023-12-25T14:30:00',
      }),
    ).toBe(
      new Date('2023-12-25T14:30:00').toLocaleString('en', { ...dateOptions, ...timeOptions }),
    );
    expect(
      getDateTimeFieldDisplayValue({
        locale: 'ja',
        fieldConfig: { ...baseFieldConfig, time_format: false },
        currentValue: '2023-12-25',
      }),
    ).toBe(new Date('2023-12-25').toLocaleDateString('ja', { ...dateOptions, timeZone: 'UTC' }));
    expect(
      getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, date_format: false, picker_utc: true },
        currentValue: '14:30',
      }),
    ).toBe(
      new Date(`${new Date().toJSON().split('T')[0]}T14:30`).toLocaleTimeString('en', {
        ...timeOptions,
        timeZone: 'UTC',
      }),
    );
  });

  test('should reuse the formatter for the same locale and options', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat');
    const args = { locale: 'fr', fieldConfig: { ...baseFieldConfig, picker_utc: true } };
    const first = getDateTimeFieldDisplayValue({ ...args, currentValue: '2023-12-25T14:30:00Z' });
    const second = getDateTimeFieldDisplayValue({ ...args, currentValue: '2024-01-02T03:04:00Z' });

    expect(first).not.toBe(second);
    expect(second).toBe(
      new Date('2024-01-02T03:04:00Z').toLocaleString('fr', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }),
    );
    // Created once for the first value, then reused
    expect(spy).toHaveBeenCalledTimes(1);
  });

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
