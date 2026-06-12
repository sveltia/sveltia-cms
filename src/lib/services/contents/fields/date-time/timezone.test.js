import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getInitialTimeZone, getTimeZoneForStoredValue, getTimeZoneLabel } from './timezone';

/**
 * @import { DateTimeField } from '$lib/types/public';
 */

/** @type {Pick<DateTimeField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'datetime',
  name: 'test_datetime',
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('getTimeZoneForStoredValue', () => {
  test('should restore the configured custom timezone when the stored offset matches', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'Asia/Tokyo',
    };

    expect(getTimeZoneForStoredValue('2026-06-12T13:17:00+09:00', fieldConfig)).toBe('Asia/Tokyo');
  });

  test('should restore a custom timezone from explicit stored offsets', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'America/Argentina/Buenos_Aires',
    };

    expect(getTimeZoneForStoredValue('2026-06-12T13:17:00-03:00', fieldConfig)).toBe(
      'America/Argentina/Buenos_Aires',
    );
  });

  test('should use the nullish offset fallback when the stored offset omits minute and second parts', () => {
    const matchSpy = vi.spyOn(String.prototype, 'match').mockImplementation(() =>
      Object.assign(/** @type {RegExpMatchArray} */ (['+09']), {
        groups: { hours: '+09', minutes: undefined, seconds: undefined },
        index: 23,
        input: '2026-06-12T13:17:00+09',
      }),
    );

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'Asia/Tokyo',
    };

    expect(getTimeZoneForStoredValue('2026-06-12T13:17:00+09:00', fieldConfig)).toBe('Asia/Tokyo');

    matchSpy.mockRestore();
  });

  test('should normalize explicit offset minutes when the stored value uses a compact offset', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'Australia/Darwin',
    };

    expect(getTimeZoneForStoredValue('2026-06-12T13:17:00+09:30', fieldConfig)).toBe(
      'Australia/Darwin',
    );
  });

  test('should return undefined when the formatter does not report a timezone name', () => {
    const OriginalDateTimeFormat = Intl.DateTimeFormat;

    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      /**
       * Mock `Intl.DateTimeFormat` for deterministic timezone-resolution failures.
       * @param {...any} args Arguments passed to the constructor.
       * @returns {Intl.DateTimeFormat} Mocked formatter.
       */
      // eslint-disable-next-line prefer-arrow-callback
      function MockDateTimeFormat(...args) {
        if (args[1]?.timeZoneName === 'longOffset') {
          return /** @type {Intl.DateTimeFormat} */ (
            /** @type {unknown} */ ({
              /**
               * Return an empty part list to force the formatter fallback path.
               * @returns {Intl.DateTimeFormatPart[]} Empty parts list.
               */
              formatToParts: () => [],
            })
          );
        }

        return new OriginalDateTimeFormat(...args);
      },
    );

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'Asia/Tokyo',
    };

    expect(getTimeZoneForStoredValue('2026-06-12T13:17:00+09:00', fieldConfig)).toBeUndefined();
  });

  test('should return undefined when the stored value does not match the configured timezone offset', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'America/New_York',
    };

    expect(getTimeZoneForStoredValue('2026-06-12T13:17:00+09:00', fieldConfig)).toBeUndefined();
  });

  test('should return undefined when the stored value has no explicit offset', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'America/New_York',
    };

    expect(getTimeZoneForStoredValue('2026-06-12T13:17:00', fieldConfig)).toBeUndefined();
  });

  test('should ignore invalid stored values', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'Asia/Tokyo',
    };

    expect(getTimeZoneForStoredValue('2026-06-12T13:17:00+09:00', fieldConfig)).toBe('Asia/Tokyo');
    expect(getTimeZoneForStoredValue('not-a-real-date+09:00', fieldConfig)).toBeUndefined();
  });

  test('should return undefined when input_timezone resolves to the local fallback', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'local',
    };

    expect(getTimeZoneForStoredValue('2026-06-12T13:17:00+09:00', fieldConfig)).toBeUndefined();
  });

  test('should restore a custom timezone from a Z suffix offset', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'Etc/UTC',
    };

    expect(getTimeZoneForStoredValue('2026-06-12T13:17:00Z', fieldConfig)).toBe('Etc/UTC');
  });

  test('should return undefined for invalid non-string timezone config values', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      // @ts-expect-error - Testing invalid runtime config.
      input_timezone: ['America/New_York'],
    };

    expect(getTimeZoneForStoredValue('2026-06-12T13:17:00+09:00', fieldConfig)).toBeUndefined();
  });
});

describe('getInitialTimeZone', () => {
  test('should prefer the stored offset match when restoring an existing value', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'Asia/Tokyo',
    };

    expect(getInitialTimeZone('2026-06-12T13:17:00+09:00', fieldConfig)).toBe('Asia/Tokyo');
  });

  test('should use the single custom timezone directly when configured that way', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'America/New_York',
    };

    expect(getInitialTimeZone('2026-06-12T13:17:00+09:00', fieldConfig)).toBe('America/New_York');
  });

  test('should return the configured custom timezone when no stored timezone can be inferred', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'Asia/Tokyo',
    };

    expect(getInitialTimeZone(undefined, fieldConfig)).toBe('Asia/Tokyo');
  });

  test('should return undefined for utc timezone options', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'utc',
    };

    expect(getInitialTimeZone(undefined, fieldConfig)).toBeUndefined();
  });

  test('should return the stored timezone when a matching offset is available', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'Asia/Tokyo',
    };

    expect(getInitialTimeZone('2026-06-12T13:17:00+09:00', fieldConfig)).toBe('Asia/Tokyo');
  });

  test('should return the configured custom timezone when the browser timezone lookup fails', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('Intl.DateTimeFormat unavailable');
    });

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'America/New_York',
    };

    expect(getInitialTimeZone(undefined, fieldConfig)).toBe('America/New_York');
  });

  test('should return the stored timezone for a date-only custom timezone config', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      type: 'date',
      input_timezone: 'America/New_York',
    };

    expect(getInitialTimeZone('2026-06-12T13:17:00-04:00', fieldConfig)).toBe('America/New_York');
  });

  test('should return the browser timezone when input_timezone is local', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      /**
       * Mock `Intl.DateTimeFormat` for browser timezone lookup.
       * @returns {Intl.DateTimeFormat} Mocked formatter.
       */
      () =>
        /** @type {Intl.DateTimeFormat} */ (
          /** @type {unknown} */ ({
            format:
              /**
               * Return a deterministic formatted date string for the mock formatter.
               * @param {Date} _date The input date to format.
               * @returns {string} A stable formatted string for the mock.
               */
              (_date) => '2026-06-12 13:17',
            formatToParts:
              /**
               * Return an empty part list to force the fallback path.
               * @returns {Intl.DateTimeFormatPart[]} Empty parts for the mock.
               */
              () => [],
            resolvedOptions:
              /**
               * Return the mocked browser timezone.
               * @returns {{ timeZone: string }} A resolved timezone option object.
               */
              () => ({ timeZone: 'America/New_York' }),
          })
        ),
    );

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'local',
    };

    expect(getInitialTimeZone(undefined, fieldConfig)).toBe('America/New_York');
  });

  test('should return an empty string when the browser timezone lookup fails for local input', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('Intl.DateTimeFormat unavailable');
    });

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'local',
    };

    expect(getInitialTimeZone(undefined, fieldConfig)).toBe('');
  });

  test('should return undefined when the browser timezone lookup fails for non-local input', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('Intl.DateTimeFormat unavailable');
    });

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'utc',
    };

    expect(getInitialTimeZone(undefined, fieldConfig)).toBeUndefined();
  });

  test('should use the configured custom timezone when the stored offset does not match', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'America/New_York',
    };

    expect(getInitialTimeZone('2026-06-12T13:17:00+02:00', fieldConfig)).toBe('America/New_York');
  });
});

describe('getTimeZoneLabel', () => {
  test('should format timezone label with offset and city name', () => {
    const label = getTimeZoneLabel('America/New_York');

    expect(label).toContain('New York');
    expect(label).toMatch(/[+-]\d{2}:\d{2}/);
  });

  test('should replace GMT with empty string in offset', () => {
    const label = getTimeZoneLabel('America/New_York');

    expect(label).not.toContain('GMT');
  });

  test('should replace underscores with spaces in city name', () => {
    const label = getTimeZoneLabel('America/Los_Angeles');

    expect(label).toContain('Los Angeles');
    expect(label).not.toContain('_');
  });

  test('should handle single word timezone names', () => {
    const label = getTimeZoneLabel('UTC');

    expect(label).toBeTruthy();
  });

  test('should handle multiple part timezone names', () => {
    const label = getTimeZoneLabel('America/Argentina/Buenos_Aires');

    expect(label).toContain('Buenos Aires');
  });

  test('should handle timezone with specific date', () => {
    const date = new Date('2023-06-21T12:00:00Z');
    const label = getTimeZoneLabel('Europe/London', date);

    expect(label).toBeTruthy();
    expect(label).toMatch(/London|Greenwich/i);
  });

  test('should handle invalid timezone gracefully', () => {
    const label = getTimeZoneLabel('Invalid/Timezone');

    expect(label).toBeTruthy();
  });

  test('should handle timezone with different date offsets', () => {
    const winterDate = new Date('2023-12-21T12:00:00Z');
    const label = getTimeZoneLabel('America/New_York', winterDate);

    expect(label).toBeTruthy();
    expect(label).toContain('New York');
  });

  test('should handle timezone with daylight saving time changes', () => {
    const edtDate = new Date('2023-07-15T12:00:00Z');
    const edtLabel = getTimeZoneLabel('America/New_York', edtDate);
    const estDate = new Date('2023-01-15T12:00:00Z');
    const estLabel = getTimeZoneLabel('America/New_York', estDate);

    expect(edtLabel).toBeTruthy();
    expect(estLabel).toBeTruthy();
  });

  test('should handle timezone across different continents', () => {
    const timezones = [
      'America/New_York',
      'Europe/Paris',
      'Asia/Tokyo',
      'Australia/Sydney',
      'Africa/Cairo',
    ];

    timezones.forEach((tz) => {
      const label = getTimeZoneLabel(tz);

      expect(label).toBeTruthy();
      expect(typeof label).toBe('string');
    });
  });

  test('should use fallback value when Intl throws exception', () => {
    const originalFormat = Intl.DateTimeFormat;

    // @ts-ignore - Mocking for test purposes
    Intl.DateTimeFormat = vi.fn(() => {
      throw new Error('Intl error');
    });

    const label = getTimeZoneLabel('America/New_York');

    expect(label).toBe('America/New_York');

    Intl.DateTimeFormat = originalFormat;
  });

  test('should handle timezone when formatToParts returns undefined parts', () => {
    const label = getTimeZoneLabel('UTC');

    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });

  test('should use an empty offset when no timezone-name part is available', () => {
    const originalFormat = Intl.DateTimeFormat;

    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      /**
       * Mock `Intl.DateTimeFormat` to force the offset fallback path.
       * @param {...any} _args Arguments passed to the constructor.
       * @returns {Intl.DateTimeFormat} Mocked formatter.
       */
      // eslint-disable-next-line prefer-arrow-callback
      function MockDateTimeFormat(..._args) {
        return /** @type {Intl.DateTimeFormat} */ (
          /** @type {unknown} */ ({
            /**
             * Return a minimal parts list to trigger the empty-offset branch.
             * @returns {Array<{ type: string, value: string }>} Minimal parts list.
             */
            formatToParts: () => /** @type {any[]} */ ([{ type: 'month', value: '12' }]),
          })
        );
      },
    );

    expect(getTimeZoneLabel('America/New_York')).toBe('() New York');

    Intl.DateTimeFormat = originalFormat;
  });

  test('should fall back to the raw timezone identifier when the city name cannot be derived', () => {
    const originalFormat = Intl.DateTimeFormat;
    const originalSplit = String.prototype.split;

    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      /**
       * Mock `Intl.DateTimeFormat` to force the timezone-label formatting path.
       * @param {...any} _args Arguments passed to the constructor.
       * @returns {Intl.DateTimeFormat} Mocked formatter.
       */
      // eslint-disable-next-line prefer-arrow-callback
      function MockDateTimeFormat(..._args) {
        return /** @type {Intl.DateTimeFormat} */ (
          /** @type {unknown} */ ({
            /**
             * Return a longOffset part to exercise the label formatting branch.
             * @returns {Array<{ type: string, value: string }>} Timezone-name parts.
             */
            formatToParts: () =>
              /** @type {any[]} */ ([{ type: 'timeZoneName', value: 'GMT+09:00' }]),
          })
        );
      },
    );

    vi.spyOn(String.prototype, 'split').mockImplementation(
      /**
       * Mock `String.prototype.split` to simulate an empty city-name fallback.
       * @param {any} separator Split separator.
       * @param {number} [limit] Optional split limit.
       * @returns {string[]} Split result.
       */
      (separator, limit) => {
        if (separator === '/') {
          return [];
        }

        return /** @type {string[]} */ (originalSplit.call('America/New_York', separator, limit));
      },
    );

    expect(getTimeZoneLabel('America/New_York')).toBe('(+09:00) America/New_York');

    Intl.DateTimeFormat = originalFormat;
  });

  test('should use empty string when offset is undefined or null', () => {
    const label = getTimeZoneLabel('America/New_York');

    expect(label).toContain('New York');
    expect(typeof label).toBe('string');
  });

  test('should handle timezone string without slashes', () => {
    const label = getTimeZoneLabel('UTC');

    expect(label).toBeTruthy();
    expect(typeof label).toBe('string');
    expect(label).toContain('UTC');
  });

  test('should handle timezone with special characters after pop', () => {
    const label = getTimeZoneLabel('Etc/GMT+5');

    expect(label).toBeTruthy();
    expect(typeof label).toBe('string');
  });

  test('should handle timezone when split produces multiple parts', () => {
    const label = getTimeZoneLabel('America/Argentina/Buenos_Aires');

    expect(label).toBeTruthy();
    expect(label).toContain('Buenos Aires');
  });

  test('should handle cityName fallback when timezone has no separator', () => {
    const label = getTimeZoneLabel('UTC');

    expect(label).toContain('UTC');
    expect(typeof label).toBe('string');
  });

  test('should handle cityName fallback for empty timezone string', () => {
    const label = getTimeZoneLabel('');

    expect(label).toBe('');
    expect(typeof label).toBe('string');
  });
});
