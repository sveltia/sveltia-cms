import { beforeEach, describe, expect, test } from 'vitest';

import {
  _resetUnsafeIntegerSources,
  getUnsafeIntegerSource,
  hasUnsafeIntegerSources,
  mayHaveUnsafeInteger,
  replaceBigInts,
  restoreBigInts,
  reviveUnsafeInteger,
  toNumber,
} from '$lib/services/contents/file/integers';

beforeEach(() => {
  _resetUnsafeIntegerSources();
});

describe('mayHaveUnsafeInteger()', () => {
  test('looks for a run of more than 15 digits', () => {
    expect(mayHaveUnsafeInteger('a: 9007199254740993')).toBe(true);
    expect(mayHaveUnsafeInteger('a: 900719925474099')).toBe(false);
    expect(mayHaveUnsafeInteger('a: 1.5')).toBe(false);
  });
});

describe('toNumber()', () => {
  test('remembers the source text of an integer a number can’t represent exactly', () => {
    expect(hasUnsafeIntegerSources()).toBe(false);
    expect(toNumber(12345678901234567890n)).toBe(12345678901234567000);
    expect(hasUnsafeIntegerSources()).toBe(true);
    expect(getUnsafeIntegerSource(12345678901234567000)).toBe('12345678901234567890');
    expect(toNumber(-9007199254740993n)).toBe(-9007199254740992);
    expect(getUnsafeIntegerSource(-9007199254740992)).toBe('-9007199254740993');
  });

  test('remembers an integer too large for a number', () => {
    const value = 10n ** 400n;

    expect(toNumber(value)).toBe(Infinity);
    expect(getUnsafeIntegerSource(Infinity)).toBe(String(value));
  });

  test('doesn’t remember a safe integer', () => {
    expect(toNumber(3n)).toBe(3);
    expect(toNumber(-9007199254740991n)).toBe(-9007199254740991);
    expect(hasUnsafeIntegerSources()).toBe(false);
  });

  test('remembers an unsafe integer a number represents exactly too', () => {
    expect(toNumber(2n ** 60n)).toBe(2 ** 60);
    expect(getUnsafeIntegerSource(2 ** 60)).toBe(String(2n ** 60n));
  });

  test('forgets the source text when different integers are read as the same number', () => {
    toNumber(9007199254740993n);
    toNumber(9007199254740993n);
    expect(getUnsafeIntegerSource(9007199254740992)).toBe('9007199254740993');
    // `9007199254740995` is read as another number
    toNumber(9007199254740995n);
    expect(getUnsafeIntegerSource(9007199254740996)).toBe('9007199254740995');
    // `9007199254740992`, which the number represents exactly, can’t be told from
    // `9007199254740993`
    toNumber(9007199254740992n);
    expect(getUnsafeIntegerSource(9007199254740992)).toBeUndefined();
    toNumber(9007199254740993n);
    expect(getUnsafeIntegerSource(9007199254740992)).toBeUndefined();
  });
});

describe('getUnsafeIntegerSource()', () => {
  test('returns nothing for any other value', () => {
    toNumber(12345678901234567890n);
    expect(getUnsafeIntegerSource(3)).toBeUndefined();
    expect(getUnsafeIntegerSource(1.5)).toBeUndefined();
    expect(getUnsafeIntegerSource('12345678901234567000')).toBeUndefined();
    expect(getUnsafeIntegerSource(undefined)).toBeUndefined();
  });
});

describe('replaceBigInts()', () => {
  test('replaces every BigInt with a number in place', () => {
    const value = { a: 3n, b: [12345678901234567890n, 'x', { c: 1n }], d: null, e: 'y' };

    expect(replaceBigInts(value)).toBe(value);
    expect(value).toEqual({ a: 3, b: [12345678901234567000, 'x', { c: 1 }], d: null, e: 'y' });
    expect(replaceBigInts(5n)).toBe(5);
    expect(replaceBigInts('z')).toBe('z');
  });

  test('remembers an unsafe integer read as a number', () => {
    expect(replaceBigInts({ a: 2 ** 60, b: 1.5, c: 3 })).toEqual({ a: 2 ** 60, b: 1.5, c: 3 });
    expect(getUnsafeIntegerSource(2 ** 60)).toBe(String(2n ** 60n));
    expect(getUnsafeIntegerSource(1.5)).toBeUndefined();
  });
});

describe('reviveUnsafeInteger()', () => {
  test('reads an integer a number can’t represent exactly from its source text', () => {
    expect(
      JSON.parse('{"a":12345678901234567890,"b":[1,1.5e300,"x"]}', reviveUnsafeInteger),
    ).toEqual({ a: 12345678901234567000, b: [1, 1.5e300, 'x'] });
    expect(getUnsafeIntegerSource(12345678901234567000)).toBe('12345678901234567890');
    // A number in exponent notation isn’t an integer written out
    expect(getUnsafeIntegerSource(1.5e300)).toBeUndefined();
  });

  test('reads the number as usual without the source text', () => {
    expect(reviveUnsafeInteger('a', 12345678901234567000)).toBe(12345678901234567000);
    expect(reviveUnsafeInteger('a', 12345678901234567000, {})).toBe(12345678901234567000);
    expect(hasUnsafeIntegerSources()).toBe(false);
  });
});

describe('restoreBigInts()', () => {
  test('copies a value, restoring the integers a number can’t represent exactly', () => {
    toNumber(12345678901234567890n);

    const date = new Date();
    const value = { a: 12345678901234567000, b: [12345678901234567000, 3], c: { d: 'x' }, date };
    const result = restoreBigInts(value);

    expect(result).toEqual({
      a: 12345678901234567890n,
      b: [12345678901234567890n, 3],
      c: { d: 'x' },
      date,
    });
    expect(result.date).toBe(date);
    expect(value.a).toBe(12345678901234567000);
    expect(restoreBigInts(Object.assign(Object.create(null), { a: 1 }))).toEqual({ a: 1 });
  });
});
