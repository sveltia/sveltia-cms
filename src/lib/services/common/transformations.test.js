import dayjs from 'dayjs';
import dayjsTimeZone from 'dayjs/plugin/timezone';
import { describe, expect, test } from 'vitest';

import {
  applyDateTransformation,
  applyDefaultTransformation,
  applyLowerCaseTransformation,
  applyTransformation,
  applyTransformations,
  applyTruncateTransformation,
  applyUpperCaseTransformation,
  parseTransformations,
  ternaryTransformation,
} from '$lib/services/common/transformations';

dayjs.extend(dayjsTimeZone);
dayjs.tz.setDefault('America/New_York');

describe('Test parseTransformations()', () => {
  test('splits a tag and transformations and parses each transformation', () => {
    expect(parseTransformations('fields.title | upper | lower | truncate(10)')).toEqual({
      value: 'fields.title',
      transformations: [
        { method: 'upper', args: {} },
        { method: 'lower', args: {} },
        { method: 'truncate', args: { max: '10' } },
      ],
    });
  });

  test('returns an empty transformation list for a plain value', () => {
    expect(parseTransformations('slugify')).toEqual({ value: 'slugify', transformations: [] });
  });

  test('parses transformation arguments for date and default transforms', () => {
    expect(
      parseTransformations("publish_date | date('YYYY-MM-DD', 'utc') | default('Untitled')"),
    ).toEqual({
      value: 'publish_date',
      transformations: [
        { method: 'date', args: { format: 'YYYY-MM-DD', timeZone: 'utc' } },
        { method: 'default', args: { defaultValue: 'Untitled' } },
      ],
    });
  });
});

describe('Test applyTransformation()', () => {
  test('upper/lower', () => {
    expect(
      applyTransformation({
        value: 'Hello',
        transformation: { method: 'upper', args: {} },
      }),
    ).toBe('HELLO');
    expect(
      applyTransformation({
        value: 'Hello',
        transformation: { method: 'lower', args: {} },
      }),
    ).toBe('hello');
  });

  test('default', () => {
    expect(
      applyTransformation({
        value: '',
        transformation: { method: 'default', args: { defaultValue: 'Undefined' } },
      }),
    ).toBe('Undefined');
    expect(
      applyTransformation({
        value: 'Description',
        transformation: { method: 'default', args: { defaultValue: 'Undefined' } },
      }),
    ).toBe('Description');
  });

  test('ternary', () => {
    expect(
      applyTransformation({
        value: true,
        transformation: {
          method: 'ternary',
          args: { truthyValue: 'Published', falsyValue: 'Draft' },
        },
      }),
    ).toBe('Published');
    expect(
      applyTransformation({
        value: false,
        transformation: {
          method: 'ternary',
          args: { truthyValue: 'Published', falsyValue: 'Draft' },
        },
      }),
    ).toBe('Draft');
    expect(
      applyTransformation({
        value: true,
        transformation: { method: 'ternary', args: { truthyValue: '', falsyValue: 'Draft' } },
      }),
    ).toBe('');
    expect(
      applyTransformation({
        value: false,
        transformation: { method: 'ternary', args: { truthyValue: 'Published', falsyValue: '' } },
      }),
    ).toBe('');
  });

  test('truncate', () => {
    const title =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam pulvinar scelerisque';

    expect(
      applyTransformation({
        value: title,
        transformation: { method: 'truncate', args: { max: '40' } },
      }),
    ).toBe('Lorem ipsum dolor sit amet, consectetur…');
    expect(
      applyTransformation({
        value: title,
        transformation: { method: 'truncate', args: { max: '50', ellipsis: '***' } },
      }),
    ).toBe('Lorem ipsum dolor sit amet, consectetur adipiscing***');
  });

  test('date', () => {
    expect(
      applyTransformation({
        value: '2024-01-23',
        transformation: { method: 'date', args: { format: 'LL' } },
      }),
    ).toBe('January 23, 2024');
    expect(
      applyTransformation({
        value: '2024-01-23T01:23:45',
        transformation: { method: 'date', args: { format: 'LLL' } },
      }),
    ).toBe('January 23, 2024 1:23 AM');
    // Test basic date formatting without timezone complications
    expect(
      applyTransformation({
        value: '2024-01-23T06:23:45',
        transformation: { method: 'date', args: { format: 'YYYY-MM-DD-HH-mm' } },
      }),
    ).toBe('2024-01-23-06-23');
    expect(
      applyTransformation({
        value: '2024-01-23T01:23:45-05:00',
        transformation: { method: 'date', args: { format: 'YYYY-MM-DD-HH-mm', timeZone: 'utc' } },
      }),
    ).toBe('2024-01-23-06-23');
    expect(
      applyTransformation({
        value: '2024-01-23T01:23:45Z',
        transformation: { method: 'date', args: { format: 'YYYY-MM-DD-HH-mm' } },
        fieldConfig: { name: 'date', widget: 'datetime', picker_utc: true },
      }),
    ).toBe('2024-01-23-01-23');
    expect(
      applyTransformation({
        value: '2024-01-23',
        transformation: { method: 'date', args: { format: 'LLL' } },
        fieldConfig: { name: 'date', widget: 'datetime', time_format: false },
      }),
    ).toBe('January 23, 2024 12:00 AM');
    // Invalid date
    expect(
      applyTransformation({
        value: '',
        transformation: { method: 'date', args: { format: 'LL' } },
      }),
    ).toBe('');
  });

  test('slugify', () => {
    expect(
      applyTransformation({
        value: 'Hello World',
        transformation: { method: 'slugify', args: {} },
      }),
    ).toBe('hello-world');
    expect(
      applyTransformation({
        value: 'My Post Title! 2024',
        transformation: { method: 'slugify', args: {} },
      }),
    ).toBe('my-post-title-2024');
    expect(
      applyTransformation({
        value: 'already-slugified',
        transformation: { method: 'slugify', args: {} },
      }),
    ).toBe('already-slugified');
    // locale is forwarded to slugify (no visible effect here since clean_accents defaults to false)
    expect(
      applyTransformation({
        value: 'Hello World',
        transformation: { method: 'slugify', args: {} },
        locale: 'de',
      }),
    ).toBe('hello-world');
  });

  test('unknown transformation returns string value', () => {
    expect(
      applyTransformation({
        value: 42,
        transformation: { method: 'nonexistent', args: {} },
      }),
    ).toBe('42');
    expect(
      applyTransformation({
        value: 'unchanged',
        transformation: { method: 'unknown_transform', args: {} },
      }),
    ).toBe('unchanged');
  });
});

describe('Test applyTransformations()', () => {
  test('applies multiple transformations in sequence', () => {
    expect(
      applyTransformations({
        value: 'Hello World',
        transformations: [
          { method: 'lower', args: {} },
          { method: 'slugify', args: {} },
        ],
      }),
    ).toBe('hello-world');
    expect(
      applyTransformations({
        value: '  Long title that needs truncating  ',
        transformations: [
          { method: 'lower', args: {} },
          { method: 'truncate', args: { max: '10' } },
        ],
      }),
    ).toBe('long tit…');
  });

  test('applies a single transformation', () => {
    expect(
      applyTransformations({
        value: 'hello',
        transformations: [{ method: 'upper', args: {} }],
      }),
    ).toBe('HELLO');
  });

  test('applies no transformations returns string value', () => {
    expect(
      applyTransformations({
        value: 'unchanged',
        transformations: [],
      }),
    ).toBe('unchanged');
  });

  test('passes fieldConfig to date transformations', () => {
    expect(
      applyTransformations({
        value: '2024-01-23T01:23:45Z',
        transformations: [{ method: 'date', args: { format: 'YYYY-MM-DD-HH-mm' } }],
        fieldConfig: { name: 'date', widget: 'datetime', picker_utc: true },
      }),
    ).toBe('2024-01-23-01-23');
  });

  test('passes locale to slugify transformation', () => {
    // locale is forwarded to slugify (no visible effect here since clean_accents defaults to false)
    expect(
      applyTransformations({
        value: 'Hello World',
        transformations: [{ method: 'slugify', args: {} }],
        locale: 'de',
      }),
    ).toBe('hello-world');
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

    test('should use UTC parsing for date-only field with Z-suffixed datetime value', () => {
      // Covers the (dateOnly && !!sValue.match(/T\d{2}:\d{2}...Z$/)) branch
      expect(
        applyDateTransformation(
          '2024-01-23T06:00:00Z',
          { format: 'YYYY-MM-DD' },
          { name: 'date', widget: 'datetime', time_format: false },
        ),
      ).toBe('2024-01-23');
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
