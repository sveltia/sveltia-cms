import { describe, expect, test } from 'vitest';

import {
  DATE_FORMAT_OPTIONS,
  DATE_REGEX,
  DATE_TIME_FORMAT_OPTIONS,
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
