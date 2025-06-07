import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCurrentDateTime,
  getCurrentValue,
  getDate,
  getDateTimeFieldDefaultValueMap,
  getDateTimeFieldDisplayValue,
  getInputValue,
  parseDateTimeConfig,
} from './helper.js';

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
  dateFormatOptions: { year: 'numeric', month: '2-digit', day: '2-digit' },
  dateRegex: /^\d{4}-\d{2}-\d{2}$/,
  timeFormatOptions: { hour: '2-digit', minute: '2-digit' },
  timeSuffixRegex: /[+-]\d{2}:\d{2}$/,
}));

// Set up default mock return values
beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseDateTimeConfig', () => {
  it('should parse basic configuration', () => {
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

  it('should handle date only configuration', () => {
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

  it('should handle time only configuration', () => {
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

  it('should handle empty configuration', () => {
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
  it('should return undefined for empty value', () => {
    const result = getDate(undefined, baseFieldConfig);

    expect(result).toBeUndefined();
  });

  it('should parse date with custom format', () => {
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

  it('should handle time only format', () => {
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

  it('should parse ISO date string', () => {
    const result = getDate('2023-12-25T14:30:00', baseFieldConfig);

    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2023);
  });

  it('should handle invalid date gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = getDate('invalid-date', baseFieldConfig);

    // Invalid dates return Invalid Date object, not undefined
    expect(result).toBeInstanceOf(Date);
    expect(Number.isNaN(result?.getTime())).toBe(true);
    consoleSpy.mockRestore();
  });
});

describe('getCurrentDateTime', () => {
  it('should return current date and time', () => {
    const result = getCurrentDateTime(baseFieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it('should return date only', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      time_format: false,
    };

    const result = getCurrentDateTime(fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('should return time only', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      date_format: false,
    };

    const result = getCurrentDateTime(fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it('should return UTC format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      picker_utc: true,
    };

    const result = getCurrentDateTime(fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
  });

  it('should handle timezone differences correctly', () => {
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
  it('should return empty string for empty input', () => {
    const result = getCurrentValue('', 'current', baseFieldConfig);

    expect(result).toBe('');
  });

  it('should return undefined for null input', () => {
    const result = getCurrentValue(undefined, 'current', {
      widget: 'datetime',
      name: 'test_datetime',
    });

    expect(result).toBeUndefined();
  });

  it('should format with custom format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DD HH:mm',
    };

    const result = getCurrentValue('2023-12-25T14:30', 'current', fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  it('should handle date only', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      time_format: false,
    };

    const result = getCurrentValue('2023-12-25', 'current', fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  it('should handle UTC format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      picker_utc: true,
    };

    const result = getCurrentValue('2023-12-25T14:30', 'current', fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25T14:30/);
  });

  it('should append time suffix', () => {
    const result = getCurrentValue('2023-12-25T14:30', '2023-12-25T14:30:00', baseFieldConfig);

    expect(result).toBe('2023-12-25T14:30:00');
  });

  it('should handle milliseconds in current value', () => {
    const result = getCurrentValue('2023-12-25T14:30', '2023-12-25T14:30:00.000', baseFieldConfig);

    expect(result).toBe('2023-12-25T14:30:00.000');
  });
});

describe('getDateTimeFieldDefaultValueMap', () => {
  it('should return default value map with empty string', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
    };

    const keyPath = 'test.field';
    const result = getDateTimeFieldDefaultValueMap({ fieldConfig, keyPath });

    expect(result).toEqual({ 'test.field': '' });
  });

  it('should return default value map with string default', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: '2023-12-25',
    };

    const keyPath = 'test.field';
    const result = getDateTimeFieldDefaultValueMap({ fieldConfig, keyPath });

    expect(result).toEqual({ 'test.field': '2023-12-25' });
  });

  it('should handle {{now}} default value', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: '{{now}}',
    };

    const keyPath = 'test.field';
    const result = getDateTimeFieldDefaultValueMap({ fieldConfig, keyPath });

    expect(result['test.field']).toBeDefined();
    expect(typeof result['test.field']).toBe('string');
    expect(result['test.field']).not.toBe('{{now}}');
  });

  it('should handle non-string default value', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      widget: 'datetime',
      name: 'test_datetime',
      // @ts-expect-error - Testing invalid type
      default: 123,
    };

    const keyPath = 'test.field';
    const result = getDateTimeFieldDefaultValueMap({ fieldConfig, keyPath });

    expect(result).toEqual({ 'test.field': '' });
  });
});

describe('getInputValue', () => {
  it('should return empty string for no current value', () => {
    const result = getInputValue(undefined, baseFieldConfig);

    expect(result).toBe('');
  });

  it('should return date for standard date format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      time_format: false,
    };

    const result = getInputValue('2023-12-25', fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  it('should return time for standard time format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      date_format: false,
    };

    const result = getInputValue('14:30', fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/14:30/);
  });

  it('should parse and format date-time', () => {
    const result = getInputValue('2023-12-25T14:30:00', baseFieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  it('should handle date only configuration', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      time_format: false,
    };

    const result = getInputValue('2023-12-25T14:30:00', fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/2023-12-25/);
  });

  it('should handle time only configuration', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      date_format: false,
    };

    const result = getInputValue('2023-12-25T14:30:00', fieldConfig);

    expect(typeof result).toBe('string');
    expect(result).toMatch(/14:30/);
  });

  it('should handle UTC configuration', () => {
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

  it('should handle parsing errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = getInputValue('invalid-date', baseFieldConfig);

    expect(result).toBe('');
    consoleSpy.mockRestore();
  });

  it('should handle UTC timezone correctly in getInputValue', () => {
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

  it('should extract time from datetime string for timeOnly config', () => {
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
});

describe('getDateTimeFieldDisplayValue', () => {
  it('should return empty string for empty value', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: baseFieldConfig,
      currentValue: '',
    });

    expect(result).toBe('');
  });

  it('should return empty string for non-string value', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: baseFieldConfig,
      currentValue: undefined,
    });

    expect(result).toBe('');
  });

  it('should format with custom format', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: { ...baseFieldConfig, format: 'YYYY-MM-DD HH:mm' },
      currentValue: '2023-12-25 14:30',
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle date only display', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: { ...baseFieldConfig, time_format: false },
      currentValue: '2023-12-25',
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle time only display', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: { ...baseFieldConfig, date_format: false },
      currentValue: '14:30',
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle full date-time display', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: baseFieldConfig,
      currentValue: '2023-12-25T14:30:00',
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle UTC display', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: { ...baseFieldConfig, picker_utc: true },
      currentValue: '2023-12-25T14:30:00Z',
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should return empty string for invalid date', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: baseFieldConfig,
      currentValue: 'invalid-date',
    });

    // Invalid dates should return empty string after error handling
    expect(result).toBe('');
  });

  it('should handle format parsing errors', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: { ...baseFieldConfig, format: 'INVALID-FORMAT' },
      currentValue: '2023-12-25',
    });

    expect(typeof result).toBe('string');
  });

  it('should handle UTC timezone in display values', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: { ...baseFieldConfig, picker_utc: true },
      currentValue: '2023-12-25T14:30:00Z',
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle timezone offset in date regex matching', () => {
    const result = getDateTimeFieldDisplayValue({
      locale: 'en',
      fieldConfig: { ...baseFieldConfig, time_format: false },
      currentValue: '2023-12-25',
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('moment.js format tokens', () => {
  // Note: These tests are designed to work with both `Moment.js` and `Day.js`
  // All tokens used here are supported by `Day.js` (some require plugins)
  // - Basic tokens (`YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`, `SSS`) are in `Day.js` core
  // - `Do`, `Q` require `AdvancedFormat` plugin
  // - `w`, `ww` require `WeekOfYear` plugin
  // - `dddd`, `ddd`, `A`, `a` are in `Day.js` core
  describe('Year tokens', () => {
    it('should handle YYYY (4-digit year)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'YYYY',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('2023');
    });

    it('should handle YY (2-digit year)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'YY',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('23');
    });

    it('should parse date with YYYY format', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'YYYY',
      };

      const result = getDate('2023', fieldConfig);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2023);
    });

    it('should parse date with YY format', () => {
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
    it('should handle MM (2-digit month)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'MM',
      };

      const result = getCurrentValue('2023-05-25T14:30', '', fieldConfig);

      expect(result).toBe('05');
    });

    it('should handle M (1-digit month)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'M',
      };

      const result = getCurrentValue('2023-05-25T14:30', '', fieldConfig);

      expect(result).toBe('5');
    });

    it('should handle MMM (short month name)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'MMM',
      };

      const result = getCurrentValue('2023-05-25T14:30', '', fieldConfig);

      expect(result).toBe('May');
    });

    it('should handle MMMM (full month name)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'MMMM',
      };

      const result = getCurrentValue('2023-05-25T14:30', '', fieldConfig);

      expect(result).toBe('May');
    });

    it('should parse date with MMM format', () => {
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

    it('should parse date with MMMM format', () => {
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
    it('should handle DD (2-digit day)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'DD',
      };

      const result = getCurrentValue('2023-12-05T14:30', '', fieldConfig);

      expect(result).toBe('05');
    });

    it('should handle D (1-digit day)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'D',
      };

      const result = getCurrentValue('2023-12-05T14:30', '', fieldConfig);

      expect(result).toBe('5');
    });

    it('should handle Do (ordinal day)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'Do',
      };

      const result = getCurrentValue('2023-12-05T14:30', '', fieldConfig);

      expect(result).toBe('5th');
    });

    it('should handle dddd (full day name)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'dddd',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig); // Monday

      expect(result).toBe('Monday');
    });

    it('should handle ddd (short day name)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'ddd',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('Mon');
    });

    it('should parse date with Do format', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'Do MMMM YYYY',
      };

      const result = getDate('5th December 2023', fieldConfig);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getDate()).toBe(5);
    });
  });

  describe('Hour tokens', () => {
    it('should handle HH (24-hour format, 2-digit)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'HH',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('14');
    });

    it('should handle H (24-hour format, 1-digit)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'H',
      };

      const result = getCurrentValue('2023-12-25T09:30', '', fieldConfig);

      expect(result).toBe('9');
    });

    it('should handle hh (12-hour format, 2-digit)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'hh',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('02');
    });

    it('should handle h (12-hour format, 1-digit)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'h',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('2');
    });

    it('should parse time with HH format', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'HH:mm',
      };

      const result = getDate('14:30', fieldConfig);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getHours()).toBe(14);
    });

    it('should parse time with hh A format', () => {
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
    it('should handle mm (2-digit minutes)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'mm',
      };

      const result = getCurrentValue('2023-12-25T14:05', '', fieldConfig);

      expect(result).toBe('05');
    });

    it('should handle m (1-digit minutes)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'm',
      };

      const result = getCurrentValue('2023-12-25T14:05', '', fieldConfig);

      expect(result).toBe('5');
    });

    it('should handle ss (2-digit seconds)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'ss',
      };

      const result = getCurrentValue('2023-12-25T14:30:07', '', fieldConfig);

      // Seconds are not included in the input, so default to `00`
      expect(result).toBe('00');
    });

    it('should handle s (1-digit seconds)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 's',
      };

      const result = getCurrentValue('2023-12-25T14:30:07', '', fieldConfig);

      // Seconds are not included in the input, so default to `0`
      expect(result).toBe('0');
    });

    it('should handle SSS (milliseconds)', () => {
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
    it('should handle A (uppercase AM/PM)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'A',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('PM');
    });

    it('should handle a (lowercase am/pm)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'a',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('pm');
    });

    it('should handle morning time with A', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'A',
      };

      const result = getCurrentValue('2023-12-25T09:30', '', fieldConfig);

      expect(result).toBe('AM');
    });

    it('should parse 12-hour time with AM/PM', () => {
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

  describe('Quarter tokens', () => {
    it('should handle Q (quarter)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'Q',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('4');
    });

    it('should handle first quarter', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'Q',
      };

      const result = getCurrentValue('2023-03-15T14:30', '', fieldConfig);

      expect(result).toBe('1');
    });
  });

  describe('Week tokens', () => {
    it('should handle w (week of year)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'w',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(typeof result).toBe('string');
      expect(Number.parseInt(result || '0', 10)).toBeGreaterThan(0);
    });

    it('should handle ww (2-digit week)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'ww',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toMatch(/\d{2}/);
    });
  });

  describe('Complex format combinations', () => {
    it('should handle common date format (YYYY-MM-DD)', () => {
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

    it('should handle US date format (MM/DD/YYYY)', () => {
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

    it('should handle European date format (DD/MM/YYYY)', () => {
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

    it('should handle full datetime format (YYYY-MM-DD HH:mm:ss)', () => {
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

    it('should handle human-readable format (MMMM Do, YYYY)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'MMMM Do, YYYY',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('December 25th, 2023');

      const parsed = getDate('December 25th, 2023', fieldConfig);

      expect(parsed?.getFullYear()).toBe(2023);
      expect(parsed?.getMonth()).toBe(11);
      expect(parsed?.getDate()).toBe(25);
    });

    it('should handle 12-hour time format (h:mm A)', () => {
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

    it('should handle day of week with date (dddd, MMMM Do YYYY)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'dddd, MMMM Do YYYY',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      expect(result).toBe('Monday, December 25th 2023');

      const parsed = getDate('Monday, December 25th 2023', fieldConfig);

      expect(parsed?.getFullYear()).toBe(2023);
      expect(parsed?.getMonth()).toBe(11);
      expect(parsed?.getDate()).toBe(25);
    });

    it('should handle ISO-like format with timezone (YYYY-MM-DDTHH:mm:ssZ)', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'YYYY-MM-DDTHH:mm:ssZ',
        picker_utc: true,
      };

      const result = getCurrentValue('2023-12-25T14:30:45', '', fieldConfig);

      // Seconds are not included in the input, so default to `00`
      expect(result).toBe('2023-12-25T14:30:00Z');

      const parsed = getDate('2023-12-25T14:30:45Z', fieldConfig);

      expect(parsed?.getFullYear()).toBe(2023);
      expect(parsed?.getUTCHours()).toBe(14);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle invalid format gracefully', () => {
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

    it('should handle parsing with wrong format', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: 'YYYY-MM-DD',
      };

      const result = getDate('not-a-date', fieldConfig);

      // Should return Invalid Date
      expect(result).toBeInstanceOf(Date);
      expect(Number.isNaN(result?.getTime())).toBe(true);
      consoleSpy.mockRestore();
    });

    it('should handle empty format string', () => {
      /** @type {DateTimeField} */
      const fieldConfig = {
        ...baseFieldConfig,
        format: '',
      };

      const result = getCurrentValue('2023-12-25T14:30', '', fieldConfig);

      // Should fall back to standard handling
      expect(typeof result).toBe('string');
    });

    it('should handle null format', () => {
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

  describe('Display value formatting with moment tokens', () => {
    it('should display with custom format (MMMM Do, YYYY)', () => {
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, format: 'MMMM Do, YYYY' },
        currentValue: 'December 25th, 2023',
      });

      expect(result).toBe('December 25th, 2023');
    });

    it('should display with 12-hour format (h:mm A)', () => {
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, format: 'h:mm A' },
        currentValue: '2:30 PM',
      });

      expect(result).toBe('2:30 PM');
    });

    it('should display with European format (DD/MM/YYYY)', () => {
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, format: 'DD/MM/YYYY' },
        currentValue: '25/12/2023',
      });

      expect(result).toBe('25/12/2023');
    });

    it('should handle format display errors gracefully', () => {
      const result = getDateTimeFieldDisplayValue({
        locale: 'en',
        fieldConfig: { ...baseFieldConfig, format: 'YYYY-MM-DD' },
        currentValue: 'invalid-for-format',
      });

      // Should fall back to standard date parsing
      expect(typeof result).toBe('string');
    });
  });
});
