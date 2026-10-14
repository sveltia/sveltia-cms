import dayjs from 'dayjs';
import dayjsTimeZone from 'dayjs/plugin/timezone';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { customStringTransformationRegistry } from '$lib/services/api/registries';
import {
  applyCustomTransformation,
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
import { getDate } from '$lib/services/contents/fields/date-time/parse';

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

  test('does not split at a pipe within a quoted argument', () => {
    expect(
      parseTransformations(
        "title | default('Untitled | Draft') | ternary('A | B', 'C|D') | truncate(5, '|')",
      ),
    ).toEqual({
      value: 'title',
      transformations: [
        { method: 'default', args: { defaultValue: 'Untitled | Draft' } },
        { method: 'ternary', args: { truthyValue: 'A | B', falsyValue: 'C|D' } },
        { method: 'truncate', args: { max: '5', ellipsis: '|' } },
      ],
    });
  });

  test('does not treat an apostrophe within an argument as a closing quote', () => {
    expect(parseTransformations("title | default('Don't | Stop') | upper")).toEqual({
      value: 'title',
      transformations: [
        { method: 'default', args: { defaultValue: "Don't | Stop" } },
        { method: 'upper', args: {} },
      ],
    });
  });
});

describe('Test parseTransformations() with transformations that are not built-in', () => {
  test('parses a transformation without arguments', () => {
    expect(parseTransformations('title | reverse | shout()')).toEqual({
      value: 'title',
      transformations: [
        { method: 'reverse', args: {} },
        { method: 'shout', args: {}, customArgs: [] },
      ],
    });
  });

  test('parses string and numeric arguments', () => {
    expect(
      parseTransformations("title | wrap('[', ']') | pad(10, '-1', -2.5,'x') | quote('')"),
    ).toEqual({
      value: 'title',
      transformations: [
        { method: 'wrap', args: {}, customArgs: ['[', ']'] },
        { method: 'pad', args: {}, customArgs: [10, '-1', -2.5, 'x'] },
        { method: 'quote', args: {}, customArgs: [''] },
      ],
    });
  });

  test('keeps a pipe, comma, parenthesis, apostrophe or nested tag within a string argument', () => {
    expect(
      parseTransformations("title | join('a | b', 'c, d)', 'Don't', '{{fields.title}}')"),
    ).toEqual({
      value: 'title',
      transformations: [
        {
          method: 'join',
          args: {},
          customArgs: ['a | b', 'c, d)', "Don't", '{{fields.title}}'],
        },
      ],
    });
  });

  test('leaves a transformation with invalid arguments unparsed', () => {
    ['wrap(foo)', "wrap('a',)", "wrap(,'a')", "wrap('a)", 'wrap(1.)', 'wrap(1)(2)'].forEach(
      (transformation) => {
        expect(parseTransformations(`title | ${transformation}`).transformations).toEqual([
          { method: transformation, args: {} },
        ]);
      },
    );
  });

  test('leaves a transformation with an invalid name unparsed', () => {
    expect(parseTransformations("title | 1wrap('a') | my-wrap").transformations).toEqual([
      { method: "1wrap('a')", args: {} },
      { method: 'my-wrap', args: {} },
    ]);
  });

  test('leaves a built-in transformation with invalid arguments unparsed', () => {
    expect(parseTransformations("title | truncate('a') | upper(1)").transformations).toEqual([
      { method: "truncate('a')", args: {} },
      { method: 'upper(1)', args: {} },
    ]);
  });

  test('freezes the parsed arguments', () => {
    const [transformation] = parseTransformations("title | wrap('frozen')").transformations;

    expect(Object.isFrozen(transformation.customArgs)).toBe(true);
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

  test('slugify returns an empty string instead of a random UUID for an empty value', () => {
    // A random fallback would make a Compute field recompute forever
    // @see https://github.com/sveltia/sveltia-cms/issues/946
    /**
     * Apply the `slugify` transformation to the given value.
     * @param {string} value Original value.
     * @returns {string} Transformed value.
     */
    const slugifyValue = (value) =>
      applyTransformation({ value, transformation: { method: 'slugify', args: {} } });

    expect(['', '  ', '!!!'].map(slugifyValue)).toEqual(['', '', '']);
    // The result must be stable across calls
    expect(slugifyValue('')).toBe(slugifyValue(''));
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

describe('Test custom transformations', () => {
  afterEach(() => {
    customStringTransformationRegistry.clear();
  });

  test('applies a registered transformation with its arguments and locale', () => {
    const transform = vi.fn((value, { args: [before, after] }) => `${before}${value}${after}`);

    customStringTransformationRegistry.set('wrap', transform);

    expect(
      applyTransformation({
        value: 'Hello',
        transformation: { method: 'wrap', args: {}, customArgs: Object.freeze(['[', ']']) },
        locale: 'en',
      }),
    ).toBe('[Hello]');
    expect(transform).toHaveBeenCalledWith('Hello', { args: ['[', ']'], locale: 'en' });
  });

  test('passes the value as is, an empty argument list and no default locale', () => {
    const transform = vi.fn((value) => (value ? 'yes' : 'no'));

    customStringTransformationRegistry.set('yesno', transform);

    expect(
      applyTransformation({
        value: false,
        transformation: { method: 'yesno', args: {} },
        locale: '_default',
      }),
    ).toBe('no');
    expect(transform).toHaveBeenCalledWith(false, { args: [], locale: undefined });
  });

  test('gives each call its own copy of the arguments', () => {
    const customArgs = Object.freeze(['a']);

    customStringTransformationRegistry.set('mutate', (value, { args }) => {
      args.push('b');

      return args.join();
    });

    const transformation = { method: 'mutate', args: {}, customArgs };

    expect(applyTransformation({ value: '', transformation })).toBe('a,b');
    expect(applyTransformation({ value: '', transformation })).toBe('a,b');
  });

  test('converts the return value to a string', () => {
    customStringTransformationRegistry.set('count', (value) => String(value).length);
    customStringTransformationRegistry.set('nothing', () => undefined);
    customStringTransformationRegistry.set('nil', () => null);

    expect(
      ['count', 'nothing', 'nil'].map((method) =>
        applyTransformation({ value: 'abc', transformation: { method, args: {} } }),
      ),
    ).toEqual(['3', '', '']);
  });

  test('chains with built-in transformations', () => {
    customStringTransformationRegistry.set('reverse', (value) =>
      [...String(value)].reverse().join(''),
    );

    expect(
      applyTransformations({
        value: 'Hello',
        transformations: parseTransformations('title | reverse | upper | truncate(3)')
          .transformations,
      }),
    ).toBe('OLL…');
  });

  test('does not override a built-in transformation', () => {
    customStringTransformationRegistry.set('upper', () => 'custom');

    expect(applyTransformation({ value: 'a', transformation: { method: 'upper', args: {} } })).toBe(
      'A',
    );
  });

  test('logs an error and returns the value if the transformation throws', () => {
    const error = new Error('Boom');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const broken = vi.fn(() => {
      throw error;
    });

    customStringTransformationRegistry.set('broken', broken);

    expect(applyTransformation({ value: 42, transformation: { method: 'broken', args: {} } })).toBe(
      '42',
    );
    expect(
      applyTransformation({ value: undefined, transformation: { method: 'broken', args: {} } }),
    ).toBe('');
    // The error is logged only once for the function
    expect(consoleError).toHaveBeenCalledOnce();

    // The same function registered under another name is logged for that name too
    customStringTransformationRegistry.set('alias', broken);

    expect(applyTransformation({ value: 1, transformation: { method: 'alias', args: {} } })).toBe(
      '1',
    );
    expect(consoleError).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenLastCalledWith(
      'The custom \u201Calias\u201D string transformation failed. Further errors are not logged:',
      error,
    );
    expect(consoleError).toHaveBeenCalledWith(
      'The custom \u201Cbroken\u201D string transformation failed. Further errors are not logged:',
      error,
    );

    consoleError.mockRestore();
  });

  test('logs an error and returns the value if the transformation returns a Promise', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const promise = Promise.reject(new Error('Rejected'));

    expect(
      applyCustomTransformation({
        method: 'async',
        transform: vi.fn(() => promise),
        value: 'value',
      }),
    ).toBe('value');
    expect(consoleError).toHaveBeenCalledWith(
      'The custom \u201Casync\u201D string transformation failed. Further errors are not logged:',
      expect.objectContaining({ name: 'TypeError' }),
    );
    // The rejection is handled
    await expect(promise.catch(() => 'handled')).resolves.toBe('handled');

    consoleError.mockRestore();
  });

  test('treats a thenable other than a Promise as an async result', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const then = vi.fn();

    expect(
      applyCustomTransformation({
        method: 'thenable',
        transform: vi.fn(() => ({ then })),
        value: 'value',
      }),
    ).toBe('value');
    expect(then).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledOnce();

    consoleError.mockRestore();
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
    ).toBe('long title…');
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

    test('should parse a value in the field’s own format', () => {
      /** @type {import('$lib/types/public').DateTimeField} */
      const fieldConfig = { name: 'date', widget: 'datetime', format: 'DD/MM/YYYY' };

      expect(applyDateTransformation('25/12/2024', { format: 'YYYY' }, fieldConfig)).toBe('2024');
      // Not read as May 12
      expect(applyDateTransformation('05/12/2024', { format: 'YYYY-MM-DD' }, fieldConfig)).toBe(
        '2024-12-05',
      );
      // In UTC if the field says so
      expect(
        applyDateTransformation(
          '05/12/2024 23:30',
          { format: 'YYYY-MM-DD HH:mm' },
          { ...fieldConfig, format: 'DD/MM/YYYY HH:mm', picker_utc: true },
        ),
      ).toBe('2024-12-05 23:30');
    });

    test('should parse a number in the field’s own format', () => {
      /** @type {import('$lib/types/public').DateTimeField} */
      const fieldConfig = { name: 'date', widget: 'datetime', format: 'X', picker_utc: true };

      // A Unix timestamp, which the front matter parser reads as a number
      expect(applyDateTransformation(1700000000, { format: 'YYYY-MM-DD' }, fieldConfig)).toBe(
        '2023-11-14',
      );
    });

    describe('in a field with a custom time zone', () => {
      /** @type {import('$lib/types/public').DateTimeField} */
      const fieldConfig = {
        name: 'date',
        widget: 'datetime',
        format: 'YYYY-MM-DD HH:mm',
        input_timezone: 'Asia/Tokyo',
      };

      /**
       * Run a function in the given browser time zone, like `parse.test.js` does. Node reads
       * `process.env.TZ` again when it’s set, so the local time of a `Date` follows it.
       * @param {string} timeZone IANA time zone name.
       * @param {() => void} fn Function to run.
       */
      const withTimeZone = (timeZone, fn) => {
        const { TZ } = process.env;

        process.env.TZ = timeZone;

        try {
          fn();
        } finally {
          process.env.TZ = TZ;
        }
      };

      // The stored value is a wall-clock time in the field’s time zone, and it’s formatted as such,
      // so a slug or path made with `{{date | date('YYYY-MM-DD')}}` doesn’t depend on where the
      // editor is. `getDate()` must not be used here: it converts the value to an instant, whose
      // local date in the browser can be a day off, e.g. 23:30 in Tokyo is already the next day
      // on Kiritimati (UTC+14), and 08:30 in Tokyo is still the previous day in Los Angeles
      test.each([
        ['Pacific/Kiritimati', '2024-12-05 23:30', 6],
        ['America/Los_Angeles', '2024-12-05 08:30', 4],
        ['UTC', '2024-12-05 23:30', 5],
      ])(
        'should keep the stored wall-clock date in the browser time zone %s',
        (timeZone, value, localDayOfInstant) => {
          withTimeZone(timeZone, () => {
            // The browser time zone is in effect: the instant falls on another day there
            expect(getDate(value, fieldConfig)?.getDate()).toBe(localDayOfInstant);
            expect(applyDateTransformation(value, { format: 'YYYY-MM-DD' }, fieldConfig)).toBe(
              '2024-12-05',
            );
            expect(
              applyDateTransformation(value, { format: 'YYYY-MM-DD HH:mm' }, fieldConfig),
            ).toBe(value);
            expect(
              applyTransformations({
                fieldConfig,
                value,
                transformations: [{ method: 'date', args: { format: 'YYYY-MM-DD' } }],
              }),
            ).toBe('2024-12-05');
          });
        },
      );
    });

    test('should fall back to the default parsing if the value doesn’t match the format', () => {
      /** @type {import('$lib/types/public').DateTimeField} */
      const fieldConfig = { name: 'date', widget: 'datetime', format: 'DD/MM/YYYY' };

      expect(applyDateTransformation('2024-01-23', { format: 'YYYY-MM-DD' }, fieldConfig)).toBe(
        '2024-01-23',
      );
      // A value that isn’t a string, like a `Date` parsed from front matter
      expect(
        applyDateTransformation(
          new Date('2024-01-23T12:00:00Z'),
          { format: 'YYYY-MM-DD', timeZone: 'utc' },
          fieldConfig,
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
