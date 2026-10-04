import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getDate } from '$lib/services/contents/fields/date-time/parse';
import {
  getCurrentDateTime,
  getCurrentStorableValue,
  getCurrentValue,
  getInputValue,
  shouldUpdateValue,
} from '$lib/services/contents/fields/date-time/value';

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
    // UTC - should return an ISO 8601 UTC string
    const utcResult = getCurrentDateTime({
      ...baseFieldConfig,
      picker_utc: true,
    });

    expect(utcResult).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);

    // Local timezone (TZ=UTC in test env) - same instant, no Z suffix
    const localResult = getCurrentDateTime(baseFieldConfig);

    expect(localResult).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe('getCurrentValue', () => {
  test('should return empty string for empty input', () => {
    const result = getCurrentValue({
      inputValue: '',
      currentValue: 'current',
      fieldConfig: baseFieldConfig,
    });

    expect(result).toBe('');
  });

  test('should return undefined for null input', () => {
    const result = getCurrentValue({
      inputValue: undefined,
      currentValue: 'current',
      fieldConfig: { widget: 'datetime', name: 'test_datetime' },
    });

    expect(result).toBeUndefined();
  });

  test('should format with custom format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DD HH:mm',
    };

    const result = getCurrentValue({
      inputValue: '2023-12-25T14:30',
      currentValue: 'current',
      fieldConfig,
    });

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  test('should handle date only', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      time_format: false,
    };

    const result = getCurrentValue({
      inputValue: '2023-12-25',
      currentValue: 'current',
      fieldConfig,
    });

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  test('should handle UTC format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      picker_utc: true,
    };

    const result = getCurrentValue({
      inputValue: '2023-12-25T14:30',
      currentValue: 'current',
      fieldConfig,
    });

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25T14:30/);
  });

  test('should append seconds when the input omits them', () => {
    const result = getCurrentValue({
      inputValue: '2023-12-25T14:30',
      currentValue: '2023-12-25T14:30:00',
      fieldConfig: baseFieldConfig,
    });

    // The input element omits seconds with the default `step` of 60
    expect(result).toBe('2023-12-25T14:30:00');
  });

  test('should append seconds and milliseconds when the stored value has milliseconds', () => {
    const result = getCurrentValue({
      inputValue: '2023-12-25T14:30',
      currentValue: '2023-12-25T14:30:00.000',
      fieldConfig: baseFieldConfig,
    });

    expect(result).toBe('2023-12-25T14:30:00.000');
  });

  test('should handle invalid input gracefully in getCurrentValue', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DD',
      picker_utc: true,
    };

    // Use completely invalid input that dayjs cannot parse
    const result = getCurrentValue({
      inputValue: 'not-a-valid-date-at-all',
      currentValue: '',
      fieldConfig,
    });

    expect(result).toBe('');
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should use HH:mm inputFormat for timeOnly field', () => {
    // With a custom format and timeOnly, should parse using HH:mm
    /** @type {DateTimeField} */
    const fieldConfigWithFormat = {
      ...baseFieldConfig,
      date_format: false,
      format: 'HH:mm',
    };

    const result = getCurrentValue({
      inputValue: '14:30',
      currentValue: undefined,
      fieldConfig: fieldConfigWithFormat,
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('14:30');
  });

  test('should succeed with fallback parse when inputValue not in inputFormat (line 193 false)', () => {
    // First parse attempt with inputFormat ('YYYY-MM-DDTHH:mm') fails for a date-only string.
    // Fallback parse (no format) succeeds → the `if (!parsed.isValid())` false branch is taken.
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'MMMM Do, YYYY', // A custom output format
      // No dateOnly/timeOnly — inputFormat = 'YYYY-MM-DDTHH:mm'
    };

    // '2023-12-25' cannot be parsed as 'YYYY-MM-DDTHH:mm' (missing time),
    // but dayjs can parse it generically → fallback succeeds.
    const result = getCurrentValue({ inputValue: '2023-12-25', currentValue: '', fieldConfig });

    // The fallback parse succeeded, so we get a formatted output (not '')
    expect(typeof result).toBe('string');
    expect(result).not.toBe('');
  });

  test('should apply timezone transformation when timeZone parameter provided', () => {
    // Test WITHOUT format to hit the timeZone conversion at lines 220-224
    // When format is not specified, parseDateTimeConfig returns format=undefined
    // Then we enter the else block and check the timezone condition
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'America/New_York',
      // No format - should use default datetime format without explicit format
      date_format: true,
      time_format: true,
    };

    const result = getCurrentValue({
      inputValue: '2023-12-25T14:30',
      currentValue: '2023-12-25T14:00:00',
      fieldConfig,
      timeZone: 'America/New_York',
    });

    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]/);
  });

  test('should apply timeZone conversion in format block (line 209)', () => {
    // Test WITH format to hit the timeZone conversion at line 209
    // This ensures both timeZone branches are covered
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DD HH:mm:ssZ', // Explicit format
    };

    const result = getCurrentValue({
      inputValue: '2023-12-25T14:30',
      currentValue: '',
      fieldConfig,
      timeZone: 'America/New_York',
    });

    expect(typeof result).toBe('string');
    expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]/);
  });

  test('should convert timezone with dayjs.utc().tz() when no format (lines 220-224)', () => {
    // Minimal test to explicitly trigger the no-format timezone block
    // Using only required properties to ensure no format is set
    /** @type {DateTimeField} */
    const fieldConfig = {
      widget: 'datetime',
      name: 'tz_test',
      input_timezone: 'UTC',
      // No format, no date_format, no time_format
    };

    const result = getCurrentValue({
      inputValue: '2023-12-25T14:30:00',
      currentValue: '',
      fieldConfig,
      timeZone: 'UTC',
    });

    // Result should be formatted with timezone offset
    expect(typeof result).toBe('string');
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]00:00/);
  });

  test('should handle dayjs.utc().tz() with non-UTC timezone', () => {
    // Test with a non-UTC timezone to ensure tz() method works
    /** @type {DateTimeField} */
    const fieldConfig = {
      widget: 'datetime',
      name: 'tz_test_ny',
    };

    const result = getCurrentValue({
      inputValue: '2023-12-25T14:30:00',
      currentValue: '',
      fieldConfig,
      timeZone: 'America/New_York',
    });

    expect(typeof result).toBe('string');
    // Should return a formatted string with timezone offset
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('should preserve local wall-clock values when output_utc is false', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'local',
      output_utc: false,
    };

    const result = getCurrentValue({
      inputValue: '2026-06-12T11:11:00',
      currentValue: '',
      fieldConfig,
      timeZone: 'America/New_York',
    });

    expect(result).toBe('2026-06-12T11:11:00');
  });

  test('should preserve UTC Z suffix when input_timezone is utc and output_utc is false', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'utc',
      output_utc: false,
    };

    const result = getCurrentValue({
      inputValue: '2026-06-12T11:11:00',
      currentValue: '',
      fieldConfig,
    });

    expect(result).toBe('2026-06-12T11:11:00Z');
  });

  test('should compute the custom timezone fallback path when no explicit timeZone is passed', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'Asia/Tokyo',
      output_utc: false,
    };

    const result = getCurrentValue({
      inputValue: '2026-06-12T11:11:00',
      currentValue: '',
      fieldConfig,
    });

    expect(result).toBe('2026-06-12T11:11:00');
  });

  test('should handle getCurrentValue with outputUTC parameter', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      // No picker_utc, so outputUTC defaults to false
    };

    const result = getCurrentValue({
      inputValue: '2023-12-25T14:30',
      currentValue: '',
      fieldConfig,
      outputUTC: true,
    });

    expect(typeof result).toBe('string');
    // When outputUTC is true, should include Z or +00:00
    expect(result).toMatch(/T.*[+Z]/);
  });

  test('should return input when already ends with seconds format', () => {
    const result = getCurrentValue({
      inputValue: '2023-12-25T14:30:45',
      currentValue: '2023-12-25T14:30:00',
      fieldConfig: baseFieldConfig,
    });

    // Input already has :MM:SS format, should return as-is
    expect(result).toBe('2023-12-25T14:30:45');
  });

  test('should append seconds to a new value with no stored value', () => {
    const result = getCurrentValue({
      inputValue: '2023-12-25T14:30',
      currentValue: undefined,
      fieldConfig: baseFieldConfig, // No format, not dateOnly, not timeOnly
    });

    expect(result).toBe('2023-12-25T14:30:00');
  });

  test('should preserve the stored wall-clock value for a configured custom timezone', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'America/New_York',
    };

    const currentValue = '2026-06-12T14:13:00-04:00';

    const inputValue = getInputValue({
      currentValue,
      fieldConfig,
      timeZone: 'America/New_York',
    });

    expect(inputValue).toBe('2026-06-12T14:13');
  });

  test('should handle timeZone with custom timezone for getInputValue', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'America/Los_Angeles',
    };

    const result = getInputValue({
      currentValue: '2023-12-25T14:30:00',
      fieldConfig,
      timeZone: 'America/Los_Angeles',
    });

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  test('round-trip stability: output_utc + format + custom timeZone (no drift)', () => {
    // Regression: without the dayjs(str, format).tz(tz, true) fix, getInputValue() would return a
    // shifted time on non-local-timezone machines, causing getCurrentValue() to produce a different
    // stored value each iteration (infinite update loop).
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DD HH:mm',
      input_timezone: 'local',
      output_utc: true,
    };

    // Simulate a stored UTC value
    const stored = '2023-06-15 13:55';

    // getInputValue must decode back to the input form…
    const inputValue = getInputValue({
      currentValue: stored,
      fieldConfig,
      timeZone: 'America/New_York',
    });

    expect(typeof inputValue).toBe('string');
    expect(inputValue).toBeTruthy();

    // …and getCurrentValue must encode back to exactly the same stored form (no drift).
    const roundTripped = getCurrentValue({
      inputValue,
      currentValue: stored,
      fieldConfig,
      timeZone: 'America/New_York',
    });

    expect(roundTripped).toBe(stored);
  });

  test('round-trip stability: output_utc + format + no custom timeZone (regression: infinite loop)', () => {
    // The primary reported bug: output_utc: true with no input_timezone causes an infinite loop
    // because getDate() parsed the stored UTC value as local time.
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DD HH:mm',
      output_utc: true, // no input_timezone → defaults to 'local'
    };

    const stored = '2026-06-21 02:03';
    const inputValue = getInputValue({ currentValue: stored, fieldConfig });

    expect(typeof inputValue).toBe('string');
    expect(inputValue).toBeTruthy();

    const roundTripped = getCurrentValue({
      inputValue,
      currentValue: stored,
      fieldConfig,
    });

    expect(roundTripped).toBe(stored);
  });

  test('should use the valid custom-timezone parsing path for format + timeZone input', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DD HH:mm',
      input_timezone: 'America/New_York',
    };

    const result = getInputValue({
      currentValue: '2023-06-15 13:55',
      fieldConfig,
      timeZone: 'America/New_York',
    });

    expect(result).toBe('2023-06-15T13:55');
  });

  test('should fall back gracefully when format + timeZone parsing fails', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DD HH:mm',
      input_timezone: 'local',
    };

    // Value that does not match the format at all — branch falls back to getDate → invalid → ''
    const result = getInputValue({
      currentValue: 'not-a-date',
      fieldConfig,
      timeZone: 'America/New_York',
    });

    expect(result).toBe('');
  });

  test('should handle getDate with UTC when format parsing fails', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'DD/MM/YYYY',
      picker_utc: true,
    };

    // ISO format that doesn't match DD/MM/YYYY but can be parsed with fallback
    const result = getDate('2023-12-25', fieldConfig);

    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2023);
    consoleSpy.mockRestore();
  });

  test('should append seconds to a timeOnly input that omits them', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      widget: 'datetime',
      name: 'time_test',
      date_format: false, // This makes timeOnly = true
      // No format specified - so it takes the timeOnly path, not the format path
    };

    const result = getCurrentValue({
      inputValue: '14:30',
      currentValue: undefined,
      fieldConfig,
    });

    expect(result).toBe('14:30:00');
  });

  test('should return a timeOnly input as-is when it already has seconds', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      widget: 'datetime',
      name: 'time_test',
      date_format: false, // This makes timeOnly = true
      // No format specified
    };

    const result = getCurrentValue({
      inputValue: '14:30:45',
      currentValue: '14:00:00',
      fieldConfig,
    });

    expect(result).toBe('14:30:45');
  });

  test('should append a Z suffix to a timeOnly input when the input timezone is UTC', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      widget: 'datetime',
      name: 'time_test',
      date_format: false, // This makes timeOnly = true
      picker_utc: true,
    };

    expect(getCurrentValue({ inputValue: '14:30', currentValue: undefined, fieldConfig })).toBe(
      '14:30:00Z',
    );

    // An input that already has seconds keeps them
    expect(
      getCurrentValue({ inputValue: '14:30:45', currentValue: '14:00:00Z', fieldConfig }),
    ).toBe('14:30:45Z');
  });

  test('should round-trip a UTC timeOnly value through the input', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      widget: 'datetime',
      name: 'time_test',
      date_format: false, // This makes timeOnly = true
      picker_utc: true,
    };

    const currentValue = '14:30:00Z';
    const inputValue = getInputValue({ currentValue, fieldConfig });

    expect(inputValue).toBe('14:30');
    expect(getCurrentValue({ inputValue, currentValue, fieldConfig })).toBe(currentValue);
  });

  test('should convert to UTC when format + timeZone + outputUTC are all set (line 261)', () => {
    // Covers: format branch → timeZone block → _outputUTC branch (parsed = parsed.utc())
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DDTHH:mm:ssZ',
      output_utc: true,
    };

    const result = getCurrentValue({
      inputValue: '2023-06-15T10:30',
      currentValue: '',
      fieldConfig,
      timeZone: 'America/New_York', // UTC-4 in June
      outputUTC: true,
    });

    // Input 10:30 in New York (UTC-4) → stored as 14:30 UTC
    expect(typeof result).toBe('string');
    expect(result).toMatch(/14:30:00\+00:00|14:30:00Z/);
  });

  test('should convert local input to UTC when format + outputUTC set but no timeZone (line 265)', () => {
    // Covers: format branch → else if (_outputUTC && inputTimeZone !== 'utc') branch
    // (parsed = parsed.utc())
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DDTHH:mm:ssZ',
      // No input_timezone set → defaults to 'local'
      output_utc: true,
    };

    const result = getCurrentValue({
      inputValue: '2023-06-15T10:30',
      currentValue: '',
      fieldConfig,
      // No timeZone parameter → hits the else if branch
      outputUTC: true,
    });

    // Input treated as local time, output converted to UTC with Z/offset
    expect(typeof result).toBe('string');
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[Z+]/);
  });

  test('should convert IANA-timezone input to UTC when no format, timeZone + outputUTC set (line 292)', () => {
    // Covers: no-format path → timeZone block → _outputUTC true branch (date.utc().format())
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      // No format → goes to no-format path
      output_utc: true,
    };

    const result = getCurrentValue({
      inputValue: '2023-06-15T10:30',
      currentValue: '',
      fieldConfig,
      timeZone: 'America/New_York', // UTC-4 in June
      outputUTC: true,
    });

    // Input 10:30 in New York (UTC-4) → stored as 14:30 UTC with Z suffix
    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-06-15T14:30:00(\.000)?Z/);
  });

  test('should store a date in a custom format as is with output_utc east of UTC', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      time_format: false,
      format: 'YYYY/MM/DD',
      output_utc: true,
    };

    expect(
      getCurrentValue({
        inputValue: '2026-10-03',
        currentValue: '2026/10/03',
        fieldConfig,
        timeZone: 'Asia/Tokyo',
      }),
    ).toBe('2026/10/03');
    expect(
      getCurrentStorableValue(
        { ...fieldConfig, input_timezone: 'Asia/Tokyo' },
        { date: new Date('2026-10-03T03:00:00Z') },
      ),
    ).toBe('2026/10/03');
  });
});

describe('getInputValue', () => {
  test('should return empty string for no current value', () => {
    const result = getInputValue({
      currentValue: undefined,
      fieldConfig: baseFieldConfig,
      timeZone: undefined,
    });

    expect(result).toBe('');
  });

  test('should return date for standard date format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      time_format: false,
    };

    const result = getInputValue({
      currentValue: '2023-12-25',
      fieldConfig,
      timeZone: undefined,
    });

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  test('should return time for standard time format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      date_format: false,
    };

    const result = getInputValue({
      currentValue: '14:30',
      fieldConfig,
      timeZone: undefined,
    });

    expect(typeof result).toBe('string');
    expect(result).toMatch(/14:30/);
  });

  test('should parse and format date-time', () => {
    const result = getInputValue({
      currentValue: '2023-12-25T14:30:00',
      fieldConfig: baseFieldConfig,
      timeZone: undefined,
    });

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  test('should handle date only configuration', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      time_format: false,
    };

    const result = getInputValue({
      currentValue: '2023-12-25T14:30:00',
      fieldConfig,
      timeZone: undefined,
    });

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  test('should handle time only configuration', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      date_format: false,
    };

    const result = getInputValue({
      currentValue: '2023-12-25T14:30:00',
      fieldConfig,
      timeZone: undefined,
    });

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

    const result = getInputValue({
      currentValue: '2023-12-25T14:30:00Z',
      fieldConfig,
      timeZone: undefined,
    });

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  test('should handle parsing errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = getInputValue({
      currentValue: 'invalid-date',
      fieldConfig: baseFieldConfig,
      timeZone: undefined,
    });

    expect(result).toBe('');
    consoleSpy.mockRestore();
  });

  test('should handle UTC timezone correctly in getInputValue', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      picker_utc: true,
    };

    const result = getInputValue({
      currentValue: '2023-12-25T14:30:00Z',
      fieldConfig,
      timeZone: undefined,
    });

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
    const result1 = getInputValue({
      currentValue: '2023-12-25T14:30:00',
      fieldConfig,
      timeZone: undefined,
    });

    expect(result1).toBe('14:30');

    // Test extracting time from standalone time string
    const result2 = getInputValue({
      currentValue: '09:15',
      fieldConfig,
      timeZone: undefined,
    });

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
    const result = getInputValue({
      currentValue: 'not-a-valid-date-at-all',
      fieldConfig,
      timeZone: undefined,
    });

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
    const result = getInputValue({
      currentValue: 'this-is-totally-invalid',
      fieldConfig,
      timeZone: undefined,
    });

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
    const result = getInputValue({
      currentValue: 'totally-invalid-date-string',
      fieldConfig,
      timeZone: undefined,
    });

    expect(result).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith('Invalid Date', 'totally-invalid-date-string');
    consoleSpy.mockRestore();
  });

  test('should read a date in a custom format as is in a time zone west of UTC', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      time_format: false,
      format: 'YYYY/MM/DD',
      output_utc: true,
    };

    expect(
      getInputValue({ currentValue: '2026/10/03', fieldConfig, timeZone: 'America/New_York' }),
    ).toBe('2026-10-03');
    expect(getInputValue({ currentValue: 'not a date', fieldConfig })).toBe('');
  });
});

describe('shouldUpdateValue', () => {
  /** @type {DateTimeField} */
  const fieldConfig = { ...baseFieldConfig };

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('should not update when there is no new value', () => {
    expect(
      shouldUpdateValue({ newValue: undefined, currentValue: '2024-01-15T10:30', fieldConfig }),
    ).toBe(false);
  });

  test('should not update when the values are identical', () => {
    expect(
      shouldUpdateValue({
        newValue: '2024-01-15T10:30',
        currentValue: '2024-01-15T10:30',
        fieldConfig,
      }),
    ).toBe(false);
  });

  test('should not update when the values resolve to the same instant', () => {
    expect(
      shouldUpdateValue({
        newValue: '2024-01-15T10:30:00.000Z',
        currentValue: '2024-01-15T19:30:00.000+09:00',
        fieldConfig,
      }),
    ).toBe(false);
  });

  test('should update when the values resolve to different instants', () => {
    expect(
      shouldUpdateValue({
        newValue: '2024-01-15T10:30:00.000Z',
        currentValue: '2024-01-15T10:31:00.000Z',
        fieldConfig,
      }),
    ).toBe(true);
  });

  test('should update when only one of the values resolves to a date', () => {
    expect(
      shouldUpdateValue({ newValue: '2024-01-15T10:30', currentValue: undefined, fieldConfig }),
    ).toBe(true);
    expect(
      shouldUpdateValue({ newValue: 'invalid', currentValue: '2024-01-15T10:30', fieldConfig }),
    ).toBe(true);
  });

  test('should update when clearing the field', () => {
    expect(shouldUpdateValue({ newValue: '', currentValue: 'invalid', fieldConfig })).toBe(true);
    expect(shouldUpdateValue({ newValue: '', currentValue: undefined, fieldConfig })).toBe(true);
  });

  test('should not update when neither value resolves to a date', () => {
    expect(shouldUpdateValue({ newValue: 'invalid', currentValue: 'garbage', fieldConfig })).toBe(
      false,
    );
    expect(shouldUpdateValue({ newValue: 'invalid', currentValue: undefined, fieldConfig })).toBe(
      false,
    );
  });
});

describe('Test getInputValue() with a 12-hour time-only format', () => {
  /** @type {DateTimeField} */
  const fieldConfig = { ...baseFieldConfig, date_format: false, time_format: 'hh:mm A' };

  test('should parse a PM time with the format rather than reading its digits as is', () => {
    expect(getInputValue({ currentValue: '02:30 PM', fieldConfig })).toBe('14:30');
  });

  test('should keep a stored PM time when the input value is written back', () => {
    const currentValue = '02:30 PM';
    const inputValue = getInputValue({ currentValue, fieldConfig });
    const newValue = getCurrentValue({ inputValue, currentValue, fieldConfig });

    expect(shouldUpdateValue({ newValue, currentValue, fieldConfig })).toBe(false);
  });

  test('should still read the time of a value in the standard format', () => {
    expect(getInputValue({ currentValue: '14:30', fieldConfig })).toBe('14:30');
  });
});
