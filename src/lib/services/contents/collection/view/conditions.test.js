import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  matchesConditions,
  prepareConditions,
  resolveComparisonValue,
  usesCurrentTime,
} from './conditions';

/**
 * @import { DateTimeField } from '$lib/types/public';
 */

/**
 * A fixed “now” in local time, so that the resolved tags don’t depend on the time zone the tests
 * run in.
 */
const NOW = new Date(2026, 8, 16, 14, 5, 9); // 2026-09-16T14:05:09 local

/**
 * Check the conditions against a value.
 * @param {any} rawValue Field value.
 * @param {import('$lib/services/common/view').ViewConditions} conditions Conditions.
 * @param {object} [options] Options.
 * @param {DateTimeField} [options.dateFieldConfig] DateTime field configuration.
 * @param {any} [options.refValue] Referenced value.
 * @returns {boolean} Result.
 */
const matches = (rawValue, conditions, { dateFieldConfig, refValue = rawValue } = {}) =>
  matchesConditions({
    rawValue,
    refValue,
    conditions: prepareConditions(conditions, { dateFieldConfig, now: NOW }),
  });

describe('Test usesCurrentTime()', () => {
  test('detects a template tag in the pattern or a comparison value', () => {
    expect(usesCurrentTime(undefined)).toBe(false);
    expect(usesCurrentTime(null)).toBe(false);
    expect(usesCurrentTime({ field: 'date' })).toBe(false);
    expect(usesCurrentTime({ field: 'date', pattern: '\\d{4}' })).toBe(false);
    expect(usesCurrentTime({ field: 'date', pattern: /\d{4}/ })).toBe(false);
    expect(usesCurrentTime({ field: 'draft', pattern: true })).toBe(false);
    expect(usesCurrentTime({ field: 'n', gte: 100, in: ['a', 1] })).toBe(false);
    expect(usesCurrentTime({ field: 'date', pattern: '^{{year}}' })).toBe(true);
    expect(usesCurrentTime({ field: 'date', gte: '{{today}}' })).toBe(true);
    expect(usesCurrentTime({ field: 'date', lt: '{{now}}' })).toBe(true);
    expect(usesCurrentTime({ field: 'date', in: ['2024', '{{year}}'] })).toBe(true);
    // Any tag counts, as the value is resolved either way
    expect(usesCurrentTime({ field: 'date', eq: '{{slug}}' })).toBe(true);
  });
});

describe('Test resolveComparisonValue()', () => {
  test('returns a value without template tags as is', () => {
    expect(resolveComparisonValue('2024', NOW)).toBe('2024');
    expect(resolveComparisonValue('', NOW)).toBe('');
    expect(resolveComparisonValue(2024, NOW)).toBe(2024);
    expect(resolveComparisonValue(true, NOW)).toBe(true);
    expect(resolveComparisonValue(undefined, NOW)).toBeUndefined();
    expect(resolveComparisonValue(null, NOW)).toBeNull();
    expect(resolveComparisonValue(/\d{4}/, NOW)).toEqual(/\d{4}/);
  });

  test('resolves `{{now}}` on its own to the current date and time', () => {
    expect(resolveComparisonValue('{{now}}', NOW)).toBe(NOW);
  });

  test('resolves `{{now}}` within a string to the local date and time', () => {
    expect(resolveComparisonValue('^{{now}}', NOW)).toBe('^2026-09-16T14:05:09');
  });

  test('resolves `{{today}}` to the local date', () => {
    expect(resolveComparisonValue('{{today}}', NOW)).toBe('2026-09-16');
    expect(resolveComparisonValue('{{today}}T18:00', NOW)).toBe('2026-09-16T18:00');
  });

  test('resolves the date and time parts', () => {
    expect(resolveComparisonValue('{{year}}-{{month}}-{{day}}', NOW)).toBe('2026-09-16');
    expect(resolveComparisonValue('{{hour}}:{{minute}}:{{second}}', NOW)).toBe('14:05:09');
    expect(resolveComparisonValue('^{{year}}', NOW)).toBe('^2026');
  });

  test('leaves an unknown tag as is', () => {
    expect(resolveComparisonValue('{{slug}}-{{year}}', NOW)).toBe('{{slug}}-2026');
  });

  test('uses the current date and time by default', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    expect(resolveComparisonValue('{{now}}')).toEqual(NOW);
    expect(resolveComparisonValue('{{today}}')).toBe('2026-09-16');

    vi.useRealTimers();
  });
});

describe('Test prepareConditions()', () => {
  test('resolves the pattern and compiles it', () => {
    const prepared = prepareConditions({ field: 'date', pattern: '^{{year}}' }, { now: NOW });

    expect(prepared.pattern).toBe('^2026');
    expect(prepared.regex).toEqual(/^2026/);
    expect(prepared.comparisons).toEqual([]);
    expect(prepared.dateFieldConfig).toBeUndefined();
  });

  test('keeps a non-string pattern', () => {
    expect(prepareConditions({ field: 'draft', pattern: true }, { now: NOW })).toEqual({
      pattern: true,
      regex: undefined,
      comparisons: [],
      dateFieldConfig: undefined,
    });

    expect(prepareConditions({ field: 'draft' }, { now: NOW }).pattern).toBeUndefined();
  });

  test('lists the comparisons in a fixed order with the tags resolved', () => {
    const prepared = prepareConditions(
      { field: 'date', in: ['{{today}}', 2024], lt: '{{now}}', gte: '{{year}}-01-01' },
      { now: NOW },
    );

    expect(prepared.comparisons).toEqual([
      { operator: 'lt', target: NOW },
      { operator: 'gte', target: '2026-01-01' },
      { operator: 'in', target: ['2026-09-16', 2024] },
    ]);
  });

  test('wraps a single `in` or `not_in` value in an array', () => {
    expect(
      prepareConditions(/** @type {any} */ ({ field: 'tag', in: 'a', not_in: 'b' }), { now: NOW })
        .comparisons,
    ).toEqual([
      { operator: 'in', target: ['a'] },
      { operator: 'not_in', target: ['b'] },
    ]);
  });

  test('parses the target of an ordinal comparison on a DateTime field once', () => {
    /** @type {DateTimeField} */
    const dateFieldConfig = { name: 'date', widget: 'datetime', format: 'DD/MM/YYYY' };

    const prepared = prepareConditions(
      { field: 'date', gte: '01/01/2026', lt: '{{now}}', eq: '16/09/2026', in: ['16/09/2026'] },
      { dateFieldConfig, now: NOW },
    );

    expect(prepared.dateFieldConfig).toBe(dateFieldConfig);
    expect(prepared.comparisons).toEqual([
      // An equality check compares the strings
      { operator: 'eq', target: '16/09/2026' },
      { operator: 'lt', target: NOW },
      { operator: 'gte', target: new Date(2026, 0, 1) },
      { operator: 'in', target: ['16/09/2026'] },
    ]);
  });

  test('leaves the target of an ordinal comparison undefined if it’s not a date', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    /** @type {DateTimeField} */
    const dateFieldConfig = { name: 'date', widget: 'datetime' };

    expect(
      prepareConditions({ field: 'date', gte: 'yesterday' }, { dateFieldConfig, now: NOW })
        .comparisons,
    ).toEqual([{ operator: 'gte', target: undefined }]);

    vi.restoreAllMocks();
  });
});

describe('Test matchesConditions()', () => {
  describe('pattern', () => {
    test('matches a regular expression against the raw or referenced value', () => {
      expect(matches('published', { field: 'status', pattern: 'pub' })).toBe(true);
      expect(matches('draft', { field: 'status', pattern: 'pub' })).toBe(false);
      expect(matches('slug', { field: 'author', pattern: '^John' }, { refValue: 'John' })).toBe(
        true,
      );
      expect(matches('John', { field: 'author', pattern: '^John' }, { refValue: 'slug' })).toBe(
        true,
      );
    });

    test('matches an exact non-string value', () => {
      expect(matches(true, { field: 'draft', pattern: true })).toBe(true);
      expect(matches(false, { field: 'draft', pattern: true })).toBe(false);
      expect(matches('true', { field: 'draft', pattern: true })).toBe(false);
    });

    test('resolves the template tags in the pattern', () => {
      expect(matches('2026-09-16T10:00', { field: 'date', pattern: '^{{year}}' })).toBe(true);
      expect(matches('2025-09-16T10:00', { field: 'date', pattern: '^{{year}}' })).toBe(false);
      expect(matches('2026-09-16T10:00', { field: 'date', pattern: '^{{today}}' })).toBe(true);
      expect(matches('2026-09-17T10:00', { field: 'date', pattern: '^{{today}}' })).toBe(false);
    });

    test('never matches an undefined value', () => {
      expect(matches(undefined, { field: 'status', pattern: '' })).toBe(false);
      expect(matches(undefined, { field: 'status', pattern: '^$' })).toBe(false);
      expect(matches(undefined, { field: 'status', pattern: 'a' }, { refValue: 'a' })).toBe(true);
    });

    test('is combined with the comparisons', () => {
      const conditions = { field: 'date', pattern: '^2026', lt: '2026-09-16' };

      expect(matches('2026-09-15', conditions)).toBe(true);
      expect(matches('2026-09-17', conditions)).toBe(false);
      expect(matches('2025-09-15', conditions)).toBe(false);
    });
  });

  describe('equality', () => {
    test('compares with `eq` and `ne`', () => {
      expect(matches('a', { field: 'x', eq: 'a' })).toBe(true);
      expect(matches('b', { field: 'x', eq: 'a' })).toBe(false);
      expect(matches('a', { field: 'x', ne: 'a' })).toBe(false);
      expect(matches('b', { field: 'x', ne: 'a' })).toBe(true);
    });

    test('accepts the string form of a number or boolean either way', () => {
      expect(matches(2024, { field: 'x', eq: '2024' })).toBe(true);
      expect(matches('2024', { field: 'x', eq: 2024 })).toBe(true);
      expect(matches(true, { field: 'x', eq: 'true' })).toBe(true);
      expect(matches('false', { field: 'x', eq: false })).toBe(true);
      expect(matches(false, { field: 'x', eq: true })).toBe(false);
      expect(matches(0, { field: 'x', eq: false })).toBe(false);
    });

    test('accepts the raw or referenced value', () => {
      expect(matches('john', { field: 'author', eq: 'John Doe' }, { refValue: 'John Doe' })).toBe(
        true,
      );
      expect(matches('john', { field: 'author', eq: 'john' }, { refValue: 'John Doe' })).toBe(true);
      expect(matches('john', { field: 'author', ne: 'John Doe' }, { refValue: 'John Doe' })).toBe(
        false,
      );
      expect(matches('john', { field: 'author', ne: 'jane' }, { refValue: 'John Doe' })).toBe(true);
    });

    test('compares with `in` and `not_in`', () => {
      expect(matches('a', { field: 'x', in: ['a', 'b'] })).toBe(true);
      expect(matches('c', { field: 'x', in: ['a', 'b'] })).toBe(false);
      expect(matches(1, { field: 'x', in: ['1', 2] })).toBe(true);
      expect(matches('a', { field: 'x', not_in: ['a', 'b'] })).toBe(false);
      expect(matches('c', { field: 'x', not_in: ['a', 'b'] })).toBe(true);
      expect(matches('a', { field: 'x', in: [] })).toBe(false);
      expect(matches('a', { field: 'x', not_in: [] })).toBe(true);
    });

    test('resolves the template tags', () => {
      expect(matches('2026-09-16', { field: 'date', eq: '{{today}}' })).toBe(true);
      expect(matches('2026-09-15', { field: 'date', eq: '{{today}}' })).toBe(false);
      expect(matches('2026', { field: 'year', in: ['{{year}}'] })).toBe(true);
      expect(matches(2026, { field: 'year', eq: '{{year}}' })).toBe(true);
    });

    test('treats an undefined or null value as unequal', () => {
      expect(matches(undefined, { field: 'x', eq: 'a' })).toBe(false);
      expect(matches(undefined, { field: 'x', ne: 'a' })).toBe(true);
      expect(matches(undefined, { field: 'x', in: ['a'] })).toBe(false);
      expect(matches(undefined, { field: 'x', not_in: ['a'] })).toBe(true);
      expect(matches(null, { field: 'x', eq: 'null' })).toBe(false);
      expect(matches(null, /** @type {any} */ ({ field: 'x', eq: null }))).toBe(true);
    });
  });

  describe('ordinal comparison', () => {
    test('compares numbers', () => {
      expect(matches(5, { field: 'n', lt: 10 })).toBe(true);
      expect(matches(10, { field: 'n', lt: 10 })).toBe(false);
      expect(matches(10, { field: 'n', lte: 10 })).toBe(true);
      expect(matches(11, { field: 'n', lte: 10 })).toBe(false);
      expect(matches(11, { field: 'n', gt: 10 })).toBe(true);
      expect(matches(10, { field: 'n', gt: 10 })).toBe(false);
      expect(matches(10, { field: 'n', gte: 10 })).toBe(true);
      expect(matches(9, { field: 'n', gte: 10 })).toBe(false);
    });

    test('compares numeric strings as numbers', () => {
      expect(matches('9', { field: 'n', lt: '10' })).toBe(true);
      expect(matches('9', { field: 'n', lt: 10 })).toBe(true);
      expect(matches(9, { field: 'n', lt: '10' })).toBe(true);
      expect(matches('9.5', { field: 'n', gt: 9 })).toBe(true);
      expect(matches('-1', { field: 'n', lt: 0 })).toBe(true);
    });

    test('compares strings otherwise', () => {
      expect(matches('apple', { field: 's', lt: 'banana' })).toBe(true);
      expect(matches('banana', { field: 's', lt: 'banana' })).toBe(false);
      expect(matches('banana', { field: 's', gte: 'banana' })).toBe(true);
      expect(matches('cherry', { field: 's', gt: 'banana' })).toBe(true);
      expect(matches('9', { field: 's', lt: '10a' })).toBe(false);
      expect(matches(' ', { field: 's', lt: 0 })).toBe(true);
    });

    test('compares dates on a string field by their string form', () => {
      expect(matches('2026-09-15', { field: 'date', lt: '{{today}}' })).toBe(true);
      expect(matches('2026-09-16', { field: 'date', lt: '{{today}}' })).toBe(false);
      expect(matches('2026-09-16', { field: 'date', gte: '{{today}}' })).toBe(true);
      expect(matches('2026-09-16T10:00', { field: 'date', gte: '{{today}}' })).toBe(true);
    });

    test('compares a `Date` value or target as an instant', () => {
      const commitDate = new Date(2026, 8, 16, 12, 0, 0);

      expect(matches(commitDate, { field: 'commit_date', lt: '{{now}}' })).toBe(true);
      expect(matches(commitDate, { field: 'commit_date', gt: '{{now}}' })).toBe(false);
      expect(matches(commitDate, { field: 'commit_date', gte: '{{today}}' })).toBe(true);
      // A date-only value stands for the local day
      expect(
        matches(new Date(2026, 8, 16, 0, 30), { field: 'commit_date', gte: '{{today}}' }),
      ).toBe(true);
      expect(
        matches(new Date(2026, 8, 15, 23, 30), { field: 'commit_date', gte: '{{today}}' }),
      ).toBe(false);
      expect(
        matches(new Date(2026, 8, 15, 23, 30), { field: 'commit_date', lt: '{{today}}' }),
      ).toBe(true);
      expect(
        matches(new Date(2026, 8, 16, 23, 59), { field: 'commit_date', lt: '2026-09-17' }),
      ).toBe(true);
      expect(matches('2026-09-16', { field: 'date', gte: '{{now}}' })).toBe(false);
      expect(matches('2026-09-17', { field: 'date', gte: '{{now}}' })).toBe(true);
      expect(matches(commitDate, { field: 'commit_date', lte: '2026-09-16T12:00:00' })).toBe(true);
      expect(matches(new Date('invalid'), { field: 'commit_date', lt: '{{now}}' })).toBe(false);
      expect(matches(commitDate, { field: 'commit_date', lt: 'invalid' })).toBe(false);
      expect(matches('2026-09-16T10:00:00', { field: 'date', lt: '{{now}}' })).toBe(true);
      expect(matches('2026-09-16T18:00:00', { field: 'date', lt: '{{now}}' })).toBe(false);
      expect(matches('', { field: 'date', lt: '{{now}}' })).toBe(false);
      expect(matches('invalid', { field: 'date', lt: '{{now}}' })).toBe(false);
    });

    test('never matches an undefined, null or uncomparable value', () => {
      expect(matches(undefined, { field: 'n', lt: 10 })).toBe(false);
      expect(matches(null, { field: 'n', lt: 10 })).toBe(false);
      expect(matches(5, /** @type {any} */ ({ field: 'n', lt: null }))).toBe(false);
      expect(matches(5, { field: 'n', lt: undefined })).toBe(true); // No comparison
    });

    test('uses the raw value only', () => {
      expect(matches('a', { field: 'x', lt: 'b' }, { refValue: 'z' })).toBe(true);
      expect(matches('z', { field: 'x', lt: 'b' }, { refValue: 'a' })).toBe(false);
    });

    test('requires every comparison to be satisfied', () => {
      const conditions = { field: 'n', gte: 10, lt: 20 };

      expect(matches(9, conditions)).toBe(false);
      expect(matches(10, conditions)).toBe(true);
      expect(matches(19, conditions)).toBe(true);
      expect(matches(20, conditions)).toBe(false);
      expect(matches(15, { field: 'n', gte: 10, ne: 15 })).toBe(false);
    });
  });

  describe('multi-value field', () => {
    const raw = ['news', 'updates'];
    const labels = ['News', 'Updates'];

    test('matches the pattern against any item', () => {
      expect(matches(raw, { field: 'categories', pattern: 'news' })).toBe(true);
      expect(matches(raw, { field: 'categories', pattern: '^updates$' })).toBe(true);
      expect(matches(raw, { field: 'categories', pattern: 'events' })).toBe(false);
      expect(matches(raw, { field: 'categories', pattern: 'News' }, { refValue: labels })).toBe(
        true,
      );
      // A joined string would match, an item never
      expect(matches(raw, { field: 'categories', pattern: 'news,updates' })).toBe(false);
      expect(matches([true, false], { field: 'flags', pattern: true })).toBe(true);
      expect(matches([], { field: 'categories', pattern: '' })).toBe(false);
    });

    test('compares any item for equality', () => {
      expect(matches(raw, { field: 'categories', eq: 'news' })).toBe(true);
      expect(matches(raw, { field: 'categories', eq: 'updates' })).toBe(true);
      expect(matches(raw, { field: 'categories', eq: 'events' })).toBe(false);
      expect(matches(raw, { field: 'categories', eq: 'News' }, { refValue: labels })).toBe(true);
      expect(matches(raw, { field: 'categories', in: ['events', 'updates'] })).toBe(true);
      expect(matches(raw, { field: 'categories', in: ['events'] })).toBe(false);
      expect(matches([], { field: 'categories', eq: 'news' })).toBe(false);
    });

    test('requires every item to differ for `ne` and `not_in`', () => {
      expect(matches(raw, { field: 'categories', ne: 'news' })).toBe(false);
      expect(matches(raw, { field: 'categories', ne: 'events' })).toBe(true);
      expect(matches(raw, { field: 'categories', ne: 'Updates' }, { refValue: labels })).toBe(
        false,
      );
      expect(matches(raw, { field: 'categories', not_in: ['events', 'updates'] })).toBe(false);
      expect(matches(raw, { field: 'categories', not_in: ['events'] })).toBe(true);
      expect(matches([], { field: 'categories', ne: 'news' })).toBe(true);
    });

    test('compares any raw item for an ordinal operator', () => {
      expect(matches([3, 7], { field: 'scores', gte: 5 })).toBe(true);
      expect(matches([3, 4], { field: 'scores', gte: 5 })).toBe(false);
      expect(matches(['3', '7'], { field: 'scores', lt: 5 })).toBe(true);
      expect(matches([3, 7], { field: 'scores', lt: 5 }, { refValue: [1, 2] })).toBe(true);
      expect(matches([6, 7], { field: 'scores', lt: 5 }, { refValue: [1, 2] })).toBe(false);
      expect(matches([], { field: 'scores', gte: 5 })).toBe(false);
    });

    test('ignores undefined items and duplicate labels', () => {
      expect(matches([undefined, 'news'], { field: 'categories', eq: 'news' })).toBe(true);
      expect(
        matches(
          ['news', 'gone'],
          { field: 'categories', ne: 'gone' },
          {
            refValue: ['News', 'gone'],
          },
        ),
      ).toBe(false);
      expect(
        matches(
          ['news', 'gone'],
          { field: 'categories', eq: 'gone' },
          {
            refValue: ['News', 'gone'],
          },
        ),
      ).toBe(true);
    });
  });

  describe('DateTime field', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    /** @type {DateTimeField} */
    const dateTimeField = { name: 'date', widget: 'datetime' };
    /** @type {DateTimeField} */
    const dateOnlyField = { name: 'date', widget: 'datetime', time_format: false };
    /** @type {DateTimeField} */
    const customFormatField = { name: 'date', widget: 'datetime', format: 'DD/MM/YYYY HH:mm' };
    /** @type {DateTimeField} */
    const utcField = { name: 'date', widget: 'datetime', picker_utc: true };

    test('compares with `{{now}}` as an instant', () => {
      const options = { dateFieldConfig: dateTimeField };

      expect(matches('2026-09-16T14:05:08', { field: 'date', lt: '{{now}}' }, options)).toBe(true);
      expect(matches('2026-09-16T14:05:10', { field: 'date', lt: '{{now}}' }, options)).toBe(false);
      expect(matches('2026-09-16T14:05:10', { field: 'date', gte: '{{now}}' }, options)).toBe(true);
      expect(matches('2026-09-16T14:05:09', { field: 'date', gte: '{{now}}' }, options)).toBe(true);
      expect(matches('2026-09-16T14:05:09', { field: 'date', gt: '{{now}}' }, options)).toBe(false);
      expect(matches('2026-09-16T14:05:09', { field: 'date', lte: '{{now}}' }, options)).toBe(true);
    });

    test('compares an ISO 8601 value with an offset', () => {
      const options = { dateFieldConfig: dateTimeField };
      const past = new Date(NOW.getTime() - 60000).toISOString();
      const future = new Date(NOW.getTime() + 60000).toISOString();

      expect(matches(past, { field: 'date', lt: '{{now}}' }, options)).toBe(true);
      expect(matches(future, { field: 'date', lt: '{{now}}' }, options)).toBe(false);
      expect(matches(future, { field: 'date', gt: '{{now}}' }, options)).toBe(true);
    });

    test('compares a date-only value with `{{today}}` the way the value is parsed', () => {
      const options = { dateFieldConfig: dateOnlyField };

      expect(matches('2026-09-15', { field: 'date', lt: '{{today}}' }, options)).toBe(true);
      expect(matches('2026-09-16', { field: 'date', lt: '{{today}}' }, options)).toBe(false);
      expect(matches('2026-09-16', { field: 'date', gte: '{{today}}' }, options)).toBe(true);
      expect(matches('2026-09-17', { field: 'date', gte: '{{today}}' }, options)).toBe(true);
      expect(matches('2026-09-17', { field: 'date', gt: '{{today}}' }, options)).toBe(true);
      expect(matches('2026-09-16', { field: 'date', gt: '{{today}}' }, options)).toBe(false);
      expect(matches('2026-09-16', { field: 'date', lte: '{{today}}' }, options)).toBe(true);
    });

    test('compares with a literal date', () => {
      const options = { dateFieldConfig: dateTimeField };

      expect(matches('2026-09-16T10:00', { field: 'date', gte: '2026-09-01' }, options)).toBe(true);
      expect(matches('2026-08-31T10:00', { field: 'date', gte: '2026-09-01' }, options)).toBe(
        false,
      );
      expect(
        matches(
          '2026-09-16T10:00',
          { field: 'date', gte: '2026-09-01', lt: '2026-10-01' },
          options,
        ),
      ).toBe(true);
    });

    test('parses a value and a literal date in the field’s format', () => {
      const options = { dateFieldConfig: customFormatField };

      expect(matches('16/09/2026 14:00', { field: 'date', lt: '{{now}}' }, options)).toBe(true);
      expect(matches('16/09/2026 15:00', { field: 'date', lt: '{{now}}' }, options)).toBe(false);
      expect(matches('16/09/2026 15:00', { field: 'date', gte: '01/09/2026 00:00' }, options)).toBe(
        true,
      );
      expect(matches('16/08/2026 15:00', { field: 'date', gte: '01/09/2026 00:00' }, options)).toBe(
        false,
      );
    });

    test('compares a UTC value with `{{now}}`', () => {
      const options = { dateFieldConfig: utcField };
      const past = new Date(NOW.getTime() - 60000).toISOString();
      const future = new Date(NOW.getTime() + 60000).toISOString();

      expect(matches(past, { field: 'date', lt: '{{now}}' }, options)).toBe(true);
      expect(matches(future, { field: 'date', lt: '{{now}}' }, options)).toBe(false);
    });

    test('never matches an invalid or missing value', () => {
      const options = { dateFieldConfig: dateTimeField };

      expect(matches('invalid', { field: 'date', lt: '{{now}}' }, options)).toBe(false);
      expect(matches('', { field: 'date', lt: '{{now}}' }, options)).toBe(false);
      expect(matches(undefined, { field: 'date', lt: '{{now}}' }, options)).toBe(false);
      expect(matches('2026-09-16', { field: 'date', lt: 'invalid' }, options)).toBe(false);
    });

    test('compares with `eq` and `in` as strings', () => {
      const options = { dateFieldConfig: dateOnlyField };

      expect(matches('2026-09-16', { field: 'date', eq: '{{today}}' }, options)).toBe(true);
      expect(matches('2026-09-16', { field: 'date', in: ['{{today}}'] }, options)).toBe(true);
      expect(matches('2026-09-15', { field: 'date', eq: '{{today}}' }, options)).toBe(false);
    });
  });
});
