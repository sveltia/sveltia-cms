import { describe, expect, test } from 'vitest';

import {
  DATE_FORMAT_OPTIONS,
  DATE_REGEX,
  DATE_TIME_FORMAT_OPTIONS,
  FULL_DATE_TIME_REGEX,
  TIME_FORMAT_OPTIONS,
  TIME_SUFFIX_REGEX,
} from './date';

describe('Date utility regexes', () => {
  describe('FULL_DATE_TIME_REGEX', () => {
    test('should match complete ISO 8601 date-time formats', () => {
      const validFormats = [
        '2023-12-25T14:30:00.000Z',
        '2023-12-25T14:30:00Z',
        '2023-12-25T14:30:00.123Z',
        '2023-12-25T14:30:00+01:00',
        '2023-12-25T14:30:00-05:00',
        '2023-12-25T14:30',
        '2023-12-25',
        'T14:30:00',
        'T14:30',
      ];

      validFormats.forEach((format) => {
        expect(FULL_DATE_TIME_REGEX.test(format)).toBe(true);
      });
    });

    test('should not match invalid formats', () => {
      // Test completely invalid strings that don't match the ISO pattern at all
      expect(FULL_DATE_TIME_REGEX.test('invalid-date')).toBe(false);
      expect(FULL_DATE_TIME_REGEX.test('not-a-date-at-all')).toBe(false);
      expect(FULL_DATE_TIME_REGEX.test('2023/12/25')).toBe(false); // Wrong separators

      // Note: This regex is lenient and designed to match partial dates
      // It doesn't validate the actual validity of dates, just the format structure
      // Values like '2023-13-25' would still match the pattern structure
    });
  });

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
