import { describe, expect, test } from 'vitest';

import { parseDateTimeConfig } from './config';

/**
 * @import { DateTimeField } from '$lib/types/public';
 */

/** @type {Pick<DateTimeField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'datetime',
  name: 'test_datetime',
};

describe('parseDateTimeConfig', () => {
  test('should cache parsed configuration by field config reference', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      format: 'YYYY-MM-DD HH:mm',
    };

    const firstResult = parseDateTimeConfig(fieldConfig);
    const secondResult = parseDateTimeConfig(fieldConfig);

    expect(firstResult).toBe(secondResult);
  });

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
      type: 'datetime-local',
      min: undefined,
      max: '9999-12-31T23:59',
      step: undefined,
      format: 'YYYY-MM-DD HH:mm',
      dateOnly: false,
      timeOnly: false,
      inputTimeZone: 'utc',
      outputUTC: true,
      utc: true,
      singleCustomTimeZone: undefined,
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
      type: 'date',
      min: undefined,
      max: '9999-12-31',
      step: undefined,
      format: 'YYYY-MM-DD',
      dateOnly: true,
      timeOnly: false,
      inputTimeZone: 'local',
      outputUTC: false,
      utc: false,
      singleCustomTimeZone: undefined,
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
      type: 'time',
      min: undefined,
      max: undefined,
      step: undefined,
      format: 'HH:mm',
      dateOnly: false,
      timeOnly: true,
      inputTimeZone: 'local',
      outputUTC: false,
      utc: false,
      singleCustomTimeZone: undefined,
    });
  });

  test('should handle empty configuration', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result).toEqual({
      type: 'datetime-local',
      min: undefined,
      max: '9999-12-31T23:59',
      step: undefined,
      format: undefined,
      dateOnly: false,
      timeOnly: false,
      inputTimeZone: 'local',
      outputUTC: false,
      utc: false,
      singleCustomTimeZone: undefined,
    });
  });

  test('should handle new type option for date', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      type: 'date',
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result).toEqual({
      type: 'date',
      min: undefined,
      max: '9999-12-31',
      step: undefined,
      format: undefined,
      dateOnly: true,
      timeOnly: false,
      inputTimeZone: 'local',
      outputUTC: false,
      utc: false,
      singleCustomTimeZone: undefined,
    });
  });

  test('should handle new type option for time', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      type: 'time',
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result).toEqual({
      type: 'time',
      min: undefined,
      max: undefined,
      step: undefined,
      format: undefined,
      dateOnly: false,
      timeOnly: true,
      inputTimeZone: 'local',
      outputUTC: false,
      utc: false,
      singleCustomTimeZone: undefined,
    });
  });

  test('should parse min, max, and step attributes', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      min: '2023-01-01T10:00',
      max: '2024-12-31T20:00',
      step: 300,
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result).toEqual({
      type: 'datetime-local',
      min: '2023-01-01T10:00',
      max: '2024-12-31T20:00',
      step: 300,
      format: undefined,
      dateOnly: false,
      timeOnly: false,
      inputTimeZone: 'local',
      outputUTC: false,
      utc: false,
      singleCustomTimeZone: undefined,
    });
  });

  test('should handle step as "any"', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      step: 'any',
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result).toEqual({
      type: 'datetime-local',
      min: undefined,
      max: '9999-12-31T23:59',
      step: 'any',
      format: undefined,
      dateOnly: false,
      timeOnly: false,
      inputTimeZone: 'local',
      outputUTC: false,
      utc: false,
      singleCustomTimeZone: undefined,
    });
  });

  test('should ignore invalid step values', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      step: -5,
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result.step).toBeUndefined();
  });

  test('should ignore empty min/max strings', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      min: '',
      max: '',
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result.min).toBeUndefined();
    expect(result.max).toBe('9999-12-31T23:59');
  });

  test('should prefer type option over date_format and time_format', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      type: 'date',
      date_format: 'YYYY-MM-DD',
      time_format: 'HH:mm',
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result.type).toBe('date');
    expect(result.dateOnly).toBe(true);
    expect(result.timeOnly).toBe(false);
    expect(result.inputTimeZone).toBe('local');
    expect(result.outputUTC).toBe(false);
  });

  test('should have input_timezone supersede picker_utc when both are set', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      picker_utc: true,
      input_timezone: 'America/New_York',
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result.inputTimeZone).toBe('America/New_York');
    expect(result.outputUTC).toBe(true);
    expect(result.utc).toBe(false);
    expect(result.singleCustomTimeZone).toBe('America/New_York');
  });

  test('should have output_utc supersede picker_utc when both are set', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      picker_utc: true,
      output_utc: false,
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result.inputTimeZone).toBe('utc');
    expect(result.outputUTC).toBe(false);
    expect(result.utc).toBe(true);
    expect(result.singleCustomTimeZone).toBeUndefined();
  });

  test('should have both new options supersede picker_utc when all are set', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      picker_utc: true,
      input_timezone: 'Europe/London',
      output_utc: false,
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result.inputTimeZone).toBe('Europe/London');
    expect(result.outputUTC).toBe(false);
    expect(result.utc).toBe(false);
    expect(result.singleCustomTimeZone).toBe('Europe/London');
  });

  test('should use picker_utc as fallback when new options not set', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      picker_utc: true,
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result.inputTimeZone).toBe('utc');
    expect(result.outputUTC).toBe(true);
    expect(result.utc).toBe(true);
  });
});

describe('parseDateTimeConfig - singleCustomTimeZone', () => {
  test('should set singleCustomTimeZone for custom timezone string', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'America/New_York',
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result.singleCustomTimeZone).toBe('America/New_York');
    expect(result.inputTimeZone).toBe('America/New_York');
  });

  test('should set singleCustomTimeZone for dateOnly configuration', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      type: 'date',
      input_timezone: 'America/New_York',
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result.singleCustomTimeZone).toBe('America/New_York');
  });

  test('should set singleCustomTimeZone for timeOnly configuration', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      type: 'time',
      input_timezone: 'America/New_York',
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result.singleCustomTimeZone).toBe('America/New_York');
  });

  test('should not set singleCustomTimeZone when inputTimeZone is "local"', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'local',
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result.singleCustomTimeZone).toBeUndefined();
  });

  test('should not set singleCustomTimeZone when inputTimeZone is "utc"', () => {
    /** @type {DateTimeField} */
    const fieldConfig = {
      ...baseFieldConfig,
      input_timezone: 'utc',
    };

    const result = parseDateTimeConfig(fieldConfig);

    expect(result.singleCustomTimeZone).toBeUndefined();
  });
});
