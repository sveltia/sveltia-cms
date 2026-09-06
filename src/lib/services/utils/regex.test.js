import { describe, expect, test } from 'vitest';

import { getRegex } from './regex';

describe('Test getRegex()', () => {
  test('returns RegExp object as is when input is already a RegExp', () => {
    const regex = /test/i;
    const result = getRegex(regex);

    expect(result).toBe(regex);
    expect(result).toBeInstanceOf(RegExp);
  });

  test('drops the stateful flags from a RegExp input', () => {
    const regex = /test/giy;
    const result = getRegex(regex);

    expect(result).not.toBe(regex);
    expect(result?.source).toBe('test');
    expect(result?.flags).toBe('i');
  });

  test('converts simple string pattern to RegExp', () => {
    const result = getRegex('.{12,}');

    expect(result).toBeInstanceOf(RegExp);
    expect(result?.source).toBe('.{12,}');
    expect(result?.flags).toBe('');
  });

  test('converts complete regex string with pattern and flags', () => {
    const result = getRegex('/^.{0,280}$/s');

    expect(result).toBeInstanceOf(RegExp);
    expect(result?.source).toBe('^.{0,280}$');
    expect(result?.flags).toBe('s');
  });

  test('converts regex string with multiple flags', () => {
    const result = getRegex('/test/im');

    expect(result).toBeInstanceOf(RegExp);
    expect(result?.source).toBe('test');
    expect(result?.flags).toBe('im');
  });

  test('drops the stateful flags from a regex string', () => {
    const result = getRegex('/test/gimy');

    expect(result).toBeInstanceOf(RegExp);
    expect(result?.source).toBe('test');
    expect(result?.flags).toBe('im');
  });

  test('converts regex string with leading slash but no pattern delimiters', () => {
    const result = getRegex('/pattern');

    expect(result).toBeInstanceOf(RegExp);
    expect(result?.source).toBe('pattern');
    expect(result?.flags).toBe('');
  });

  test('handles regex string without leading slash', () => {
    const result = getRegex('simple-pattern');

    expect(result).toBeInstanceOf(RegExp);
    expect(result?.source).toBe('simple-pattern');
    expect(result?.flags).toBe('');
  });

  test('handles empty string pattern', () => {
    const result = getRegex('');

    expect(result).toBeUndefined();
  });

  test('handles regex with no flags specified', () => {
    const result = getRegex('/pattern/');

    expect(result).toBeInstanceOf(RegExp);
    expect(result?.source).toBe('pattern');
    expect(result?.flags).toBe('');
  });

  test('returns undefined for invalid regex pattern', () => {
    const result = getRegex('/[/');

    expect(result).toBeUndefined();
  });

  test('returns undefined for non-string, non-RegExp input', () => {
    expect(getRegex(123)).toBeUndefined();
    expect(getRegex(null)).toBeUndefined();
    expect(getRegex(undefined)).toBeUndefined();
    expect(getRegex({})).toBeUndefined();
    expect(getRegex([])).toBeUndefined();
    expect(getRegex(true)).toBeUndefined();
  });

  test('handles complex regex patterns with special characters', () => {
    const result = getRegex('/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/i');

    expect(result).toBeInstanceOf(RegExp);
    expect(result?.source).toBe('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$');
    expect(result?.flags).toBe('i');
  });

  test('handles regex with all valid flags', () => {
    const result = getRegex('/test/dgimsuy');

    expect(result).toBeInstanceOf(RegExp);
    expect(result?.source).toBe('test');
    expect(result?.flags).toBe('dimsu');
  });

  // A global or sticky regex advances `lastIndex` on every `test()` call, so reusing it across a
  // list of values would match only some of them
  test('matches every value when the same regex is reused', () => {
    const result = getRegex('/news/g');
    const values = Array.from({ length: 10 }, (_item, index) => `news-${index}`);

    expect(values.filter((value) => result?.test(value) ?? false)).toHaveLength(10);
  });

  test('validates that returned RegExp works correctly', () => {
    const result = getRegex('/\\d{3}-\\d{3}-\\d{4}/');

    expect(result).toBeInstanceOf(RegExp);
    expect(result?.test('123-456-7890')).toBe(true);
    expect(result?.test('abc-def-ghij')).toBe(false);
  });

  test('validates that RegExp with flags works correctly', () => {
    const result = getRegex('/test/i');

    expect(result).toBeInstanceOf(RegExp);
    expect(result?.test('TEST')).toBe(true);
    expect(result?.test('test')).toBe(true);
    expect(result?.test('Test')).toBe(true);
  });
});
