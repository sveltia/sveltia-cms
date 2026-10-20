import { beforeEach, describe, expect, test } from 'vitest';
import { parseDocument } from 'yaml';

import {
  collectJSONFloatSources,
  collectYAMLFloatSources,
  getJSONSourceText,
  getSavedValueSources,
  mayHaveWholeNumberFloat,
  moveArrayItemSources,
  rememberValueSources,
  restoreValueSources,
  reviveWholeNumberFloat,
  SourcedValue,
  sourcedValueYAMLTag,
  valueSources,
} from '$lib/services/contents/file/value-sources';

beforeEach(() => {
  valueSources.clear();
});

describe('mayHaveWholeNumberFloat()', () => {
  test('looks for a number with a fractional part of zeros, an exponent or a float tag', () => {
    expect(mayHaveWholeNumberFloat('a: 10.0')).toBe(true);
    expect(mayHaveWholeNumberFloat('a: 10.')).toBe(true);
    expect(mayHaveWholeNumberFloat('a: 10.000\n')).toBe(true);
    expect(mayHaveWholeNumberFloat('a: .0')).toBe(true);
    expect(mayHaveWholeNumberFloat('.0')).toBe(true);
    expect(mayHaveWholeNumberFloat('a: 1e3')).toBe(true);
    expect(mayHaveWholeNumberFloat('{"a":1E+3}')).toBe(true);
    expect(mayHaveWholeNumberFloat('a: 10')).toBe(false);
    expect(mayHaveWholeNumberFloat('a: 1.5')).toBe(false);
    expect(mayHaveWholeNumberFloat('a: 10.05')).toBe(false);
    expect(mayHaveWholeNumberFloat('a: e3')).toBe(false);
  });
});

describe('collectYAMLFloatSources()', () => {
  /**
   * Collect the float sources of a YAML document.
   * @param {string} str Document.
   * @returns {Record<string, any>} Source map.
   */
  const collect = (str) => collectYAMLFloatSources(parseDocument(str, { intAsBigInt: true }));

  test('collects the floats that are whole numbers', () => {
    expect(
      collect(
        [
          'a: 10.0',
          'b: -3.0',
          'c: 1e3',
          'd: 10',
          'e: 1.5',
          'f: "10.0"',
          'g: +1.0',
          'h: 0x10',
          'i: 0o10',
          'j: !!float 10.0',
          'k: !!float 10',
          'l: !!int 10',
          'm: .inf',
          'n: 10.',
          'o: !foo 10.0',
          'p: -0.0',
        ].join('\n'),
      ),
    ).toEqual({
      a: { value: 10, source: '10.0' },
      b: { value: -3, source: '-3.0' },
      c: { value: 1000, source: '1e3' },
      g: { value: 1, source: '+1.0' },
      j: { value: 10, source: '10.0' },
      n: { value: 10, source: '10.' },
      p: { value: -0, source: '-0.0' },
    });
  });

  test('collects the floats in nested maps and sequences', () => {
    expect(collect('a:\n  b: 2.0\n  c:\n    - 1.0\n    - 2\n    - d: 3.0\n')).toEqual({
      'a.b': { value: 2, source: '2.0' },
      'a.c.0': { value: 1, source: '1.0' },
      'a.c.2.d': { value: 3, source: '3.0' },
    });
  });

  test('tells an integer from a float without the `intAsBigInt` option', () => {
    expect(collectYAMLFloatSources(parseDocument('a: 10\nb: 10.0'))).toEqual({
      b: { value: 10, source: '10.0' },
    });
  });

  test('leaves out a float at the root, a key, an alias and a complex key', () => {
    expect(collect('10.0')).toEqual({});
    expect(collect('10.0: a\nb: &x 2.0\nc: *x\n? [1.0]\n: 3.0\n')).toEqual({
      b: { value: 2, source: '2.0' },
    });
  });

  test('tells a key containing a dot from a nested key', () => {
    expect(collect('a.b: 1.0\nc:\n  d.e\\f:\n    - 2.0\na:\n  b: 3.0\n')).toEqual({
      'a\\.b': { value: 1, source: '1.0' },
      'c.d\\.e\\\\f.0': { value: 2, source: '2.0' },
      'a.b': { value: 3, source: '3.0' },
    });
  });

  test('handles a document without content', () => {
    expect(collect('')).toEqual({});
  });
});

describe('reviveWholeNumberFloat()', () => {
  test('marks a float that is a whole number', () => {
    const value = reviveWholeNumberFloat('a', 10, { source: '10.0' });

    expect(value).toBeInstanceOf(SourcedValue);
    expect(value).toEqual(new SourcedValue(10, '10.0'));
    expect(reviveWholeNumberFloat('a', 1000, { source: '1E3' })).toEqual(
      new SourcedValue(1000, '1E3'),
    );
  });

  test('leaves other values as they are', () => {
    expect(reviveWholeNumberFloat('a', 10, { source: '10' })).toBe(10);
    expect(reviveWholeNumberFloat('a', -10, { source: '-10' })).toBe(-10);
    expect(reviveWholeNumberFloat('a', 1.5, { source: '1.5' })).toBe(1.5);
    expect(reviveWholeNumberFloat('a', '10.0', { source: '"10.0"' })).toBe('10.0');
    expect(reviveWholeNumberFloat('a', 10, {})).toBe(10);
    expect(reviveWholeNumberFloat('a', 10)).toBe(10);
  });
});

describe('collectJSONFloatSources()', () => {
  test('replaces the marked floats with their numbers and collects their source text', () => {
    const parsed = {
      a: new SourcedValue(10, '10.0'),
      b: [new SourcedValue(-3, '-3.0'), 2, { c: new SourcedValue(1000, '1e3') }],
      d: 'x',
    };

    expect(collectJSONFloatSources(parsed)).toEqual({
      value: { a: 10, b: [-3, 2, { c: 1000 }], d: 'x' },
      sourceMap: {
        a: { value: 10, source: '10.0' },
        'b.0': { value: -3, source: '-3.0' },
        'b.2.c': { value: 1000, source: '1e3' },
      },
    });
  });

  test('collects a marked float under a key containing a dot', () => {
    expect(collectJSONFloatSources({ 'a.b': { c: new SourcedValue(1, '1.0') } })).toEqual({
      value: { 'a.b': { c: 1 } },
      sourceMap: { 'a\\.b.c': { value: 1, source: '1.0' } },
    });
  });

  test('leaves out a float at the root', () => {
    expect(collectJSONFloatSources(new SourcedValue(10, '10.0'))).toEqual({
      value: 10,
      sourceMap: {},
    });
  });

  test('works with the native reviver', () => {
    const { value, sourceMap } = collectJSONFloatSources(
      JSON.parse('{"a":10.0,"b":[1e3,-3.0,10,1.5]}', reviveWholeNumberFloat),
    );

    expect(value).toEqual({ a: 10, b: [1000, -3, 10, 1.5] });
    expect(sourceMap).toEqual({
      a: { value: 10, source: '10.0' },
      'b.0': { value: 1000, source: '1e3' },
      'b.1': { value: -3, source: '-3.0' },
    });
  });
});

describe('rememberValueSources()', () => {
  test('remembers a source map that isn’t empty', () => {
    rememberValueSources('a.yml', {});
    expect(valueSources.has('a.yml')).toBe(false);

    rememberValueSources('a.yml', { a: { value: 10, source: '10.0' } });
    expect(valueSources.get('a.yml')).toEqual({ a: { value: 10, source: '10.0' } });
  });
});

describe('getSavedValueSources()', () => {
  const sourceMap = { a: { value: 10, source: '10.0' } };

  test('hands the source map of the previous file over to the saved file', () => {
    valueSources.set('old.yml', sourceMap);

    expect(getSavedValueSources({ previousPath: 'old.yml', path: 'new.yml' })).toBe(sourceMap);
    expect(valueSources.get('new.yml')).toBe(sourceMap);
  });

  test('returns nothing for a new file or a file without a source map', () => {
    // Remembered for a file deleted since
    valueSources.set('new.yml', sourceMap);

    expect(getSavedValueSources({ path: 'new.yml' })).toBeUndefined();
    expect(valueSources.has('new.yml')).toBe(false);
    expect(getSavedValueSources({ previousPath: 'old.yml', path: 'new.yml' })).toBeUndefined();
    expect(valueSources.has('new.yml')).toBe(false);
  });
});

describe('moveArrayItemSources()', () => {
  test('moves the source text along with the items', () => {
    const a = { value: 1, source: '1.0' };
    const b = { value: 2, source: '2.0' };
    const c = { value: 3, source: '3.0' };
    const d = { value: 4, source: '4.0' };

    expect(
      moveArrayItemSources({ '0.price': a, '0.sizes.1': b, '1.price': c, 2: d }, [1, undefined, 0]),
    ).toEqual({ '0.price': c, '2.price': a, '2.sizes.1': b });
    expect(moveArrayItemSources({ 2: d }, [2, 3])).toEqual({ 0: d });
  });
});

describe('SourcedValue', () => {
  test('is written as its value without a replacer', () => {
    expect(JSON.stringify({ a: new SourcedValue(10, '10.0') })).toBe('{"a":10}');
  });
});

describe('restoreValueSources()', () => {
  const sourceMap = {
    a: { value: 10, source: '10.0' },
    'b.0': { value: -3, source: '-3.0' },
    'b.1.c': { value: 1000, source: '1e3' },
    d: { value: 5, source: '5.0' },
  };

  test('replaces the values that haven’t changed', () => {
    const content = { a: 10, b: [-3, { c: 1000 }], d: 6, e: 'x' };
    const restored = restoreValueSources(content, sourceMap);

    expect(restored).toEqual({
      a: new SourcedValue(10, '10.0'),
      b: [new SourcedValue(-3, '-3.0'), { c: new SourcedValue(1000, '1e3') }],
      d: 6,
      e: 'x',
    });
    expect(restored.a).toBeInstanceOf(SourcedValue);
    // The content is copied
    expect(content).toEqual({ a: 10, b: [-3, { c: 1000 }], d: 6, e: 'x' });
  });

  test('replaces a value that has the same value but another type only if it’s equal', () => {
    expect(restoreValueSources({ a: '10' }, sourceMap)).toEqual({ a: '10' });
  });

  test('leaves class instances and a value at the root alone', () => {
    const date = new Date();

    expect(restoreValueSources({ a: date }, { a: { value: 1, source: '1.0' } }).a).toBe(date);
    expect(restoreValueSources(10, { '': { value: 10, source: '10.0' } })).toBe(10);
  });

  test('tells a key containing a dot from a nested key', () => {
    expect(restoreValueSources({ 'a.b': 10, a: { b: 10 } }, { 'a\\.b': sourceMap.a })).toEqual({
      'a.b': new SourcedValue(10, '10.0'),
      a: { b: 10 },
    });
  });

  test('handles an object without a prototype', () => {
    const content = Object.assign(Object.create(null), { a: 10 });

    expect(restoreValueSources(content, sourceMap)).toEqual({ a: new SourcedValue(10, '10.0') });
  });

  test('doesn’t take a value from an `Object.prototype` member', () => {
    expect(restoreValueSources({ toString: 10 }, sourceMap)).toEqual({ toString: 10 });
  });
});

describe('getJSONSourceText()', () => {
  test('returns the source text if it’s a JSON number representing the value', () => {
    expect(getJSONSourceText(new SourcedValue(10, '10.0'))).toBe('10.0');
    expect(getJSONSourceText(new SourcedValue(-3, '-3.0'))).toBe('-3.0');
    expect(getJSONSourceText(new SourcedValue(1000, '1E+3'))).toBe('1E+3');
  });

  test('returns nothing for text that isn’t a JSON number representing the value', () => {
    // YAML floats
    expect(getJSONSourceText(new SourcedValue(10, '10.'))).toBeUndefined();
    expect(getJSONSourceText(new SourcedValue(1, '+1.0'))).toBeUndefined();
    expect(getJSONSourceText(new SourcedValue(10, '.1e2'))).toBeUndefined();
    // Another number
    expect(getJSONSourceText(new SourcedValue(10, '11.0'))).toBeUndefined();
    // An integer
    expect(getJSONSourceText(new SourcedValue(10, '10'))).toBeUndefined();
    // Not a number
    expect(getJSONSourceText(new SourcedValue('10', '10.0'))).toBeUndefined();
    expect(getJSONSourceText(new SourcedValue(10, '10.0, "b": 1'))).toBeUndefined();
  });
});

describe('sourcedValueYAMLTag', () => {
  /**
   * Stringify a scalar with the tag.
   * @param {SourcedValue} value Value.
   * @returns {string} Text.
   */
  const stringify = (value) =>
    /** @type {any} */ (sourcedValueYAMLTag).stringify(
      { value },
      {},
      () => {},
      () => {},
    );

  test('reads a number', () => {
    expect(sourcedValueYAMLTag.resolve('10.0', () => {}, {})).toBe(10);
  });

  test('identifies a sourced value', () => {
    expect(sourcedValueYAMLTag.identify?.(new SourcedValue(10, '10.0'))).toBe(true);
    expect(sourcedValueYAMLTag.identify?.(10)).toBe(false);
  });

  test('writes the source text if it’s a YAML float representing the value', () => {
    expect(stringify(new SourcedValue(10, '10.0'))).toBe('10.0');
    expect(stringify(new SourcedValue(10, '10.'))).toBe('10.');
    expect(stringify(new SourcedValue(1, '+1.0'))).toBe('+1.0');
    expect(stringify(new SourcedValue(10, '.1e2'))).toBe('.1e2');
    expect(stringify(new SourcedValue(1000, '1E+3'))).toBe('1E+3');
  });

  test('writes the value as a float otherwise', () => {
    expect(stringify(new SourcedValue(10, '11.0'))).toBe('10.0');
    expect(stringify(new SourcedValue(10, '10.0\nb: 1'))).toBe('10.0');
    expect(stringify(new SourcedValue(-0, '-0'))).toBe('-0.0');
    expect(stringify(new SourcedValue(1e21, 'x'))).toBe('1e+21');
    expect(stringify(new SourcedValue('x\ny: 1', 'x\ny: 1'))).toBe('"x\\ny: 1"');
  });
});
