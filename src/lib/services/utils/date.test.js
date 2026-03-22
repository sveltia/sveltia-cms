import { describe, expect, test } from 'vitest';

import {
  DATE_FORMAT_OPTIONS,
  DATE_REGEX,
  DATE_TIME_FORMAT_OPTIONS,
  formatDate,
  TIME_FORMAT_OPTIONS,
  TIME_SUFFIX_REGEX,
} from './date';

describe('Date utility regexes', () => {
  describe('DATE_REGEX', () => {
    test('should match valid date formats', () => {
      const validDates = [
        '2023-01-01',
        '2023-12-31',
        '2000-02-29', // Leap year
        '1999-02-28',
      ];

      validDates.forEach((date) => {
        expect(DATE_REGEX.test(date)).toBe(true);
      });
    });

    test('should not match invalid date formats', () => {
      const invalidDates = [
        '2023-1-1', // Single digit month/day
        '23-01-01', // Two-digit year
        '2023/01/01', // Wrong separator
        '2023-01-01T00:00:00Z', // Date with time
        'invalid-date',
        '',
      ];

      invalidDates.forEach((date) => {
        expect(DATE_REGEX.test(date)).toBe(false);
      });
    });
  });

  describe('TIME_SUFFIX_REGEX', () => {
    test('should match midnight time suffixes', () => {
      const validSuffixes = ['T00:00Z', 'T00:00:00Z', 'T00:00:00.000Z'];

      validSuffixes.forEach((suffix) => {
        expect(TIME_SUFFIX_REGEX.test(suffix)).toBe(true);
      });
    });

    test('should not match non-midnight time suffixes', () => {
      const invalidSuffixes = [
        'T01:00Z',
        'T00:01Z',
        'T00:00:01Z',
        'T00:00:00.001Z',
        'T00:00+01:00',
        '',
      ];

      invalidSuffixes.forEach((suffix) => {
        expect(TIME_SUFFIX_REGEX.test(suffix)).toBe(false);
      });
    });
  });
});

describe('Date format options', () => {
  test('DATE_FORMAT_OPTIONS should have correct properties', () => {
    expect(DATE_FORMAT_OPTIONS).toEqual({
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  });

  test('TIME_FORMAT_OPTIONS should have correct properties', () => {
    expect(TIME_FORMAT_OPTIONS).toEqual({
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    });
  });

  test('DATE_TIME_FORMAT_OPTIONS should combine date and time options', () => {
    expect(DATE_TIME_FORMAT_OPTIONS).toEqual({
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    });
  });
});

describe('formatDate', () => {
  test('formats date using DATE_TIME_FORMAT_OPTIONS with given locale', () => {
    const date = new Date('2024-06-15T14:30:00Z');

    expect(formatDate(date, 'en-US')).toBe(date.toLocaleString('en-US', DATE_TIME_FORMAT_OPTIONS));
  });

  test('uses the provided locale for formatting', () => {
    const date = new Date('2024-01-01T09:05:00Z');
    const enUS = formatDate(date, 'en-US');
    const jaJP = formatDate(date, 'ja-JP');

    expect(enUS).not.toBe(jaJP);
    expect(enUS).toBe(date.toLocaleString('en-US', DATE_TIME_FORMAT_OPTIONS));
    expect(jaJP).toBe(date.toLocaleString('ja-JP', DATE_TIME_FORMAT_OPTIONS));
  });

  test('formats a date at midnight', () => {
    const date = new Date('2023-12-31T00:00:00Z');

    expect(formatDate(date, 'en-US')).toBe(date.toLocaleString('en-US', DATE_TIME_FORMAT_OPTIONS));
  });

  test('formats a date at end of day', () => {
    const date = new Date('2023-12-31T23:59:59Z');

    expect(formatDate(date, 'en-US')).toBe(date.toLocaleString('en-US', DATE_TIME_FORMAT_OPTIONS));
  });

  test('returns a non-empty string', () => {
    const date = new Date('2024-03-22T10:00:00Z');

    expect(typeof formatDate(date, 'en-US')).toBe('string');
    expect(formatDate(date, 'en-US').length).toBeGreaterThan(0);
  });

  test('treats null locale the same as undefined', () => {
    const date = new Date('2024-06-15T14:30:00Z');

    expect(formatDate(date, null)).toBe(date.toLocaleString(undefined, DATE_TIME_FORMAT_OPTIONS));
  });

  test('returns a non-empty string when locale is null', () => {
    const date = new Date('2024-03-22T10:00:00Z');

    expect(typeof formatDate(date, null)).toBe('string');
    expect(formatDate(date, null).length).toBeGreaterThan(0);
  });
});
