import { parse, stringify, TomlDate } from 'smol-toml';
import { beforeEach, describe, expect, test } from 'vitest';

import {
  rememberTomlValueSources,
  restoreTomlValueSources,
} from '$lib/services/contents/file/toml-sources';
import { valueSources } from '$lib/services/contents/file/value-sources';

/**
 * @import { ValueSourceMap } from '$lib/types/private';
 */

/**
 * Remember the source text of the dates in the given TOML document, as read from `a.toml`.
 * @param {string} str TOML document.
 * @returns {ValueSourceMap | undefined} Source map.
 */
const remember = (str) => {
  rememberTomlValueSources({ path: 'a.toml', str, parsed: parse(str) });

  return valueSources.get('a.toml');
};

beforeEach(() => {
  valueSources.clear();
});

describe('rememberTomlValueSources()', () => {
  test('remembers the source text of every kind of date', () => {
    expect(
      remember(
        [
          'offset = 2024-01-01T10:00:00Z',
          'shifted = 2024-01-01T10:00:00+09:00',
          'local = 1979-05-27 07:32:00',
          'day = 1979-05-27',
          'time = 12:30:00',
          'short = 07:32',
          'precise = 1979-05-27T00:32:00.999999-07:00',
          'lower = 1979-05-27t07:32:00z',
        ].join('\n'),
      ),
    ).toEqual({
      offset: { value: '2024-01-01T10:00:00.000Z', source: '2024-01-01T10:00:00Z' },
      shifted: { value: '2024-01-01T10:00:00.000+09:00', source: '2024-01-01T10:00:00+09:00' },
      local: { value: '1979-05-27T07:32:00.000', source: '1979-05-27 07:32:00' },
      day: { value: '1979-05-27', source: '1979-05-27' },
      time: { value: '12:30:00.000', source: '12:30:00' },
      short: { value: '07:32:00.000', source: '07:32' },
      precise: {
        value: '1979-05-27T00:32:00.999-07:00',
        source: '1979-05-27T00:32:00.999999-07:00',
      },
      lower: { value: '1979-05-27T07:32:00.000Z', source: '1979-05-27t07:32:00z' },
    });
  });

  test('remembers the dates in tables, arrays and arrays of tables by key path', () => {
    expect(
      remember(
        [
          'dates = [2024-01-01, 2024-01-02]',
          'inline = { at = 10:00:00 }',
          '[meta]',
          '"og.date" = 2024-01-03',
          '[[events]]',
          'start = 2024-01-04T09:00:00Z',
        ].join('\n'),
      ),
    ).toEqual({
      'dates.0': { value: '2024-01-01', source: '2024-01-01' },
      'dates.1': { value: '2024-01-02', source: '2024-01-02' },
      'inline.at': { value: '10:00:00.000', source: '10:00:00' },
      'meta.og\\.date': { value: '2024-01-03', source: '2024-01-03' },
      'events.0.start': { value: '2024-01-04T09:00:00.000Z', source: '2024-01-04T09:00:00Z' },
    });
  });

  test('writes a date whose source text can’t be told as the parsed value', () => {
    expect(
      remember(
        [
          'a = 2024-01-01T10:00:00Z',
          'b = 2024-01-01T10:00:00.000Z',
          'c = 2024-01-02',
          'd = "2024-01-02"',
          '# Not a date: 2024-99-99',
        ].join('\n'),
      ),
    ).toEqual({
      a: { value: '2024-01-01T10:00:00.000Z', source: '2024-01-01T10:00:00.000Z' },
      b: { value: '2024-01-01T10:00:00.000Z', source: '2024-01-01T10:00:00.000Z' },
      // The same text in a string doesn’t make a difference
      c: { value: '2024-01-02', source: '2024-01-02' },
    });
  });

  test('remembers nothing for a document without a date', () => {
    expect(remember('title = "No date"\ncount = 1\n')).toBeUndefined();
  });
});

describe('rememberTomlValueSources() with floats', () => {
  test('remembers the floats that are whole numbers', () => {
    expect(
      remember(
        [
          'a = 10.0',
          'b = -3.0',
          'c = 1e3',
          'd = +1.0',
          'e = 2_000.0',
          'f = 5',
          'g = 1.5',
          'h = 0xE',
          'i = [ 2.0, { j = 3.0 } ]',
          '[k]',
          'l = 4.00',
          '"m.n" = 6.0',
        ].join('\n'),
      ),
    ).toEqual({
      a: { value: 10, source: '10.0' },
      b: { value: -3, source: '-3.0' },
      c: { value: 1000, source: '1e3' },
      d: { value: 1, source: '+1.0' },
      e: { value: 2000, source: '2_000.0' },
      'i.0': { value: 2, source: '2.0' },
      'i.1.j': { value: 3, source: '3.0' },
      'k.l': { value: 4, source: '4.00' },
      'k.m\\.n': { value: 6, source: '6.0' },
    });
  });

  test('leaves out a number also written as an integer', () => {
    expect(remember('a = 10.0\nb = 10\nc = 14.0\nd = 0xE\ne = 0o16\nf = 0b1110\n')).toBeUndefined();
    // A date or a time doesn’t count as an integer
    expect(remember('a = 1.0\nb = 2024-01-01\nc = 10:01:00\n')).toEqual({
      a: { value: 1, source: '1.0' },
      b: { value: '2024-01-01', source: '2024-01-01' },
      c: { value: '10:01:00.000', source: '10:01:00' },
    });
  });

  test('writes a float written in different ways in a canonical way', () => {
    expect(remember('a = 10.0\nb = 1e1\nc = 10.0\n')).toEqual({
      a: { value: 10, source: '10.0' },
      b: { value: 10, source: '10.0' },
      c: { value: 10, source: '10.0' },
    });
    expect(remember('a = 1e21\nb = 1.0e21\n')).toEqual({
      a: { value: 1e21, source: '1e+21' },
      b: { value: 1e21, source: '1e+21' },
    });
  });

  test('leaves out the numbers in strings and comments', () => {
    expect(
      remember(
        [
          'a = 10.0 # 10',
          'b = "Top 10"',
          "c = 'Top 10'",
          'd = """',
          '10 "" """',
          "e = '''10'''",
          'f = "\\"10\\""',
        ].join('\n'),
      ),
    ).toEqual({ a: { value: 10, source: '10.0' } });
  });

  test('looks for a float only in a document that may have one', () => {
    expect(remember('a = 10\nb = "x"\n')).toBeUndefined();
  });
});

describe('restoreTomlValueSources()', () => {
  test('writes the floats that haven’t changed as they were read', () => {
    const sourceMap = /** @type {any} */ (remember('a = 10.0\nb = 1_000.0\nc = -3.0\nd = 2.0\n'));

    expect(stringify(restoreTomlValueSources({ a: 10, b: 1000, c: -4, d: '2' }, sourceMap))).toBe(
      'a = 10.0\nb = 1_000.0\nc = -4\nd = "2"\n',
    );
  });

  test('writes a float as a float if its source text doesn’t represent the value', () => {
    const sourceMap = {
      a: { value: 10, source: '11.0' },
      b: { value: 10, source: '10' },
      c: { value: 10, source: '10.0\nd = 1' },
      e: { value: -0, source: 'x' },
    };

    expect(stringify(restoreTomlValueSources({ a: 10, b: 10, c: 10, e: -0 }, sourceMap))).toBe(
      'a = 10.0\nb = 10.0\nc = 10.0\ne = -0.0\n',
    );
  });

  test('writes the dates that haven’t changed as they were read', () => {
    const str = [
      'string = 2024-01-01T10:00:00Z',
      'native = 1979-05-27 07:32:00.123456',
      'edited = 12:30:00',
      'retyped = 1979-05-27',
      'list = [10:00:00]',
      '',
      '[meta]',
      'day = 2024-01-02',
      '',
    ].join('\n');

    const sourceMap = /** @type {any} */ (remember(str));

    const restored = restoreTomlValueSources(
      {
        // A field other than a Date & Time field gives the string
        string: '2024-01-01T10:00:00.000Z',
        // A Date & Time field gives a native date
        native: new TomlDate('1979-05-27T07:32:00.123'),
        edited: '12:45:00.000',
        retyped: 'TBD',
        list: ['10:00:00.000'],
        meta: { day: '2024-01-02' },
        added: '2024-01-03',
      },
      sourceMap,
    );

    expect(restored.native).toBeInstanceOf(TomlDate);
    expect(stringify(restored)).toBe(
      [
        'string = 2024-01-01T10:00:00Z',
        'native = 1979-05-27 07:32:00.123456',
        'edited = "12:45:00.000"',
        'retyped = "TBD"',
        'list = [ 10:00:00 ]',
        'added = "2024-01-03"',
        '',
        '[meta]',
        'day = 2024-01-02',
        '',
      ].join('\n'),
    );
  });

  test('leaves the content as it is', () => {
    const sourceMap = /** @type {any} */ (remember('a = 2024-01-01\nb = [2024-01-02]\n'));
    const date = new TomlDate('2024-01-05');
    const content = { a: '2024-01-01', b: ['2024-01-02'], c: date, d: Object.create(null) };
    const restored = restoreTomlValueSources(content, sourceMap);

    expect(restored).not.toBe(content);
    expect(restored.b).not.toBe(content.b);
    expect(restored.c).toBe(date);
    expect(content).toEqual({ a: '2024-01-01', b: ['2024-01-02'], c: date, d: {} });
  });
});
