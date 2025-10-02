import dayjs from 'dayjs';
import dayjsTimeZone from 'dayjs/plugin/timezone';
import { describe, expect, test } from 'vitest';

import {
  applyDateTransformation,
  applyDefaultTransformation,
  applyLowerCaseTransformation,
  applyTransformation,
  applyTruncateTransformation,
  applyUpperCaseTransformation,
  ternaryTransformation,
} from '$lib/services/common/transformations';

dayjs.extend(dayjsTimeZone);
dayjs.tz.setDefault('America/New_York');

describe('Test applyTransformation()', () => {
  test('upper/lower', () => {
    expect(
      applyTransformation({
        value: 'Hello',
        transformation: 'upper',
      }),
    ).toBe('HELLO');
    expect(
      applyTransformation({
        value: 'Hello',
        transformation: 'lower',
      }),
    ).toBe('hello');
  });

  test('default', () => {
    expect(
      applyTransformation({
        value: '',
        transformation: "default('Undefined')",
      }),
    ).toBe('Undefined');
    expect(
      applyTransformation({
        value: 'Description',
        transformation: "default('Undefined')",
      }),
    ).toBe('Description');
  });

  test('ternary', () => {
    expect(
      applyTransformation({
        value: true,
        transformation: "ternary('Published', 'Draft')",
      }),
    ).toBe('Published');
    expect(
      applyTransformation({
        value: false,
        transformation: "ternary('Published', 'Draft')",
      }),
    ).toBe('Draft');
    expect(
      applyTransformation({
        value: true,
        transformation: "ternary('', 'Draft')",
      }),
    ).toBe('');
    expect(
      applyTransformation({
        value: false,
        transformation: "ternary('Published', '')",
      }),
    ).toBe('');
  });

  test('truncate', () => {
    const title =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam pulvinar scelerisque';

    expect(
      applyTransformation({
        value: title,
        transformation: 'truncate(40)',
      }),
    ).toBe('Lorem ipsum dolor sit amet, consectetur…');
    expect(
      applyTransformation({
        value: title,
        transformation: "truncate(50, '***')",
      }),
    ).toBe('Lorem ipsum dolor sit amet, consectetur adipiscing***');
    expect(
      applyTransformation({
        value: title,
        transformation: 'truncate(-10)',
      }),
    ).toBe(title);
  });

  test('date', () => {
    expect(
      applyTransformation({
        value: '2024-01-23',
        transformation: "date('LL')",
      }),
    ).toBe('January 23, 2024');
    expect(
      applyTransformation({
        value: '2024-01-23T01:23:45',
        transformation: "date('LLL')",
      }),
    ).toBe('January 23, 2024 1:23 AM');
    // Test basic date formatting without timezone complications
    expect(
      applyTransformation({
        value: '2024-01-23T06:23:45',
        transformation: "date('YYYY-MM-DD-HH-mm')",
      }),
    ).toBe('2024-01-23-06-23');
    expect(
      applyTransformation({
        value: '2024-01-23T01:23:45-05:00',
        transformation: "date('YYYY-MM-DD-HH-mm', 'utc')",
      }),
    ).toBe('2024-01-23-06-23');
    expect(
      applyTransformation({
        value: '2024-01-23T01:23:45Z',
        transformation: "date('YYYY-MM-DD-HH-mm')",
        fieldConfig: { name: 'date', widget: 'datetime', picker_utc: true },
      }),
    ).toBe('2024-01-23-01-23');
    expect(
      applyTransformation({
        value: '2024-01-23',
        transformation: "date('LLL')",
        fieldConfig: { name: 'date', widget: 'datetime', time_format: false },
      }),
    ).toBe('January 23, 2024 12:00 AM');
    // Invalid date
    expect(
      applyTransformation({
        value: '',
        transformation: "date('LL')",
      }),
    ).toBe('');
  });
});

describe('Test individual transformation functions', () => {
  describe('applyUpperCaseTransformation()', () => {
    test('should convert string to uppercase', () => {
      expect(applyUpperCaseTransformation('hello world')).toBe('HELLO WORLD');
      expect(applyUpperCaseTransformation('Test123')).toBe('TEST123');
      expect(applyUpperCaseTransformation('')).toBe('');
    });

    test('should convert non-string values to uppercase', () => {
      expect(applyUpperCaseTransformation(123)).toBe('123');
      expect(applyUpperCaseTransformation(true)).toBe('TRUE');
      expect(applyUpperCaseTransformation(null)).toBe('NULL');
    });
  });

  describe('applyLowerCaseTransformation()', () => {
    test('should convert string to lowercase', () => {
      expect(applyLowerCaseTransformation('HELLO WORLD')).toBe('hello world');
      expect(applyLowerCaseTransformation('Test123')).toBe('test123');
      expect(applyLowerCaseTransformation('')).toBe('');
    });

    test('should convert non-string values to lowercase', () => {
      expect(applyLowerCaseTransformation(123)).toBe('123');
      expect(applyLowerCaseTransformation(true)).toBe('true');
      expect(applyLowerCaseTransformation(null)).toBe('null');
    });
  });

  describe('applyDateTransformation()', () => {
    test('should format dates correctly', () => {
      expect(
        applyDateTransformation(
          '2024-01-23',
          { format: 'LL' },
          { name: 'date', widget: 'datetime' },
        ),
      ).toBe('January 23, 2024');

      expect(
        applyDateTransformation(
          '2024-01-23',
          { format: 'YYYY-MM-DD' },
          { name: 'date', widget: 'datetime' },
        ),
      ).toBe('2024-01-23');
    });

    test('should handle UTC time zone', () => {
      expect(
        applyDateTransformation(
          '2024-01-23T01:23:45-05:00',
          { format: 'YYYY-MM-DD-HH-mm', timeZone: 'utc' },
          { name: 'datetime', widget: 'datetime' },
        ),
      ).toBe('2024-01-23-06-23');
    });

    test('should handle date-only fields', () => {
      expect(
        applyDateTransformation(
          '2024-01-23',
          { format: 'YYYY-MM-DD' },
          { name: 'date', widget: 'datetime', time_format: false },
        ),
      ).toBe('2024-01-23');
    });

    test('should return empty string for invalid dates', () => {
      expect(
        applyDateTransformation('invalid', { format: 'LL' }, { name: 'date', widget: 'datetime' }),
      ).toBe('');
      expect(
        applyDateTransformation('', { format: 'LL' }, { name: 'date', widget: 'datetime' }),
      ).toBe('');
    });

    test('should handle picker_utc option', () => {
      expect(
        applyDateTransformation(
          '2024-01-23T01:23:45Z',
          { format: 'YYYY-MM-DD-HH-mm' },
          { name: 'datetime', widget: 'datetime', picker_utc: true },
        ),
      ).toBe('2024-01-23-01-23');
    });
  });

  describe('applyDefaultTransformation()', () => {
    test('should return value when truthy', () => {
      expect(applyDefaultTransformation('Content', { defaultValue: 'Default' })).toBe('Content');
      expect(applyDefaultTransformation(123, { defaultValue: 'Default' })).toBe('123');
      expect(applyDefaultTransformation(true, { defaultValue: 'Default' })).toBe('true');
    });

    test('should return default value when falsy', () => {
      expect(applyDefaultTransformation('', { defaultValue: 'Default' })).toBe('Default');
      expect(applyDefaultTransformation(0, { defaultValue: 'Default' })).toBe('Default');
      expect(applyDefaultTransformation(false, { defaultValue: 'Default' })).toBe('Default');
      expect(applyDefaultTransformation(null, { defaultValue: 'Default' })).toBe('Default');
      expect(applyDefaultTransformation(undefined, { defaultValue: 'Default' })).toBe('Default');
    });
  });

  describe('ternaryTransformation()', () => {
    test('should return truthy value when condition is true', () => {
      expect(ternaryTransformation(true, { truthyValue: 'Yes', falsyValue: 'No' })).toBe('Yes');
      expect(ternaryTransformation(1, { truthyValue: 'Yes', falsyValue: 'No' })).toBe('Yes');
      expect(ternaryTransformation('text', { truthyValue: 'Yes', falsyValue: 'No' })).toBe('Yes');
    });

    test('should return falsy value when condition is false', () => {
      expect(ternaryTransformation(false, { truthyValue: 'Yes', falsyValue: 'No' })).toBe('No');
      expect(ternaryTransformation(0, { truthyValue: 'Yes', falsyValue: 'No' })).toBe('No');
      expect(ternaryTransformation('', { truthyValue: 'Yes', falsyValue: 'No' })).toBe('No');
      expect(ternaryTransformation(null, { truthyValue: 'Yes', falsyValue: 'No' })).toBe('No');
    });

    test('should handle empty strings as values', () => {
      expect(ternaryTransformation(true, { truthyValue: '', falsyValue: 'No' })).toBe('');
      expect(ternaryTransformation(false, { truthyValue: 'Yes', falsyValue: '' })).toBe('');
    });
  });

  describe('applyTruncateTransformation()', () => {
    test('should truncate string to max length', () => {
      const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

      expect(applyTruncateTransformation(longText, { max: '20' })).toBe('Lorem ipsum dolor si…');
      expect(applyTruncateTransformation(longText, { max: '10' })).toBe('Lorem ipsu…');
    });

    test('should use custom ellipsis', () => {
      const longText = 'Lorem ipsum dolor sit amet';

      expect(applyTruncateTransformation(longText, { max: '15', ellipsis: '...' })).toBe(
        'Lorem ipsum dol...',
      );
      expect(applyTruncateTransformation(longText, { max: '15', ellipsis: '***' })).toBe(
        'Lorem ipsum dol***',
      );
    });

    test('should not truncate if text is shorter than max', () => {
      expect(applyTruncateTransformation('Short', { max: '100' })).toBe('Short');
    });

    test('should handle non-string values', () => {
      expect(applyTruncateTransformation(12345678, { max: '5' })).toBe('12345…');
      expect(applyTruncateTransformation(true, { max: '3' })).toBe('tru…');
    });

    test('should handle zero or very small max values', () => {
      expect(applyTruncateTransformation('Some text', { max: '0' })).toBe('…');
      expect(applyTruncateTransformation('Some text', { max: '1' })).toBe('S…');
    });
  });
});
