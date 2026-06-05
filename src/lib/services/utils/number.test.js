import { describe, expect, test } from 'vitest';

import { isNumeric, toFixed } from './number';

describe('Test isNumeric()', () => {
  test('returns true for single digit strings', () => {
    expect(isNumeric('0')).toBe(true);
    expect(isNumeric('1')).toBe(true);
    expect(isNumeric('5')).toBe(true);
    expect(isNumeric('9')).toBe(true);
  });

  test('returns true for multi-digit numeric strings', () => {
    expect(isNumeric('10')).toBe(true);
    expect(isNumeric('123')).toBe(true);
    expect(isNumeric('9999')).toBe(true);
    expect(isNumeric('1000000')).toBe(true);
  });

  test('returns false for empty string', () => {
    expect(isNumeric('')).toBe(false);
  });

  test('returns false for negative numbers', () => {
    expect(isNumeric('-1')).toBe(false);
    expect(isNumeric('-123')).toBe(false);
  });

  test('returns false for decimal numbers', () => {
    expect(isNumeric('1.5')).toBe(false);
    expect(isNumeric('3.14')).toBe(false);
    expect(isNumeric('0.5')).toBe(false);
  });

  test('returns false for strings with leading or trailing whitespace', () => {
    expect(isNumeric(' 1')).toBe(false);
    expect(isNumeric('1 ')).toBe(false);
    expect(isNumeric(' 123 ')).toBe(false);
  });

  test('returns false for non-numeric strings', () => {
    expect(isNumeric('abc')).toBe(false);
    expect(isNumeric('12a')).toBe(false);
    expect(isNumeric('a12')).toBe(false);
  });

  test('returns false for strings with special characters', () => {
    expect(isNumeric('1-2')).toBe(false);
    expect(isNumeric('1,000')).toBe(false);
    expect(isNumeric('$100')).toBe(false);
  });
});

describe('toFixed', () => {
  test('should convert a number to a fixed decimal string with 2 decimal places', () => {
    expect(toFixed(123.456, 2)).toBe(123.46);
  });

  test('should convert a number to a fixed decimal string with 0 decimal places', () => {
    expect(toFixed(123.456, 0)).toBe(123);
  });

  test('should handle negative numbers correctly', () => {
    expect(toFixed(-123.456, 2)).toBe(-123.46);
  });

  test('should handle rounding correctly', () => {
    expect(toFixed(123.444, 2)).toBe(123.44);
    expect(toFixed(123.445, 2)).toBe(123.45);
  });

  test('should return NaN if the input is not a number', () => {
    // @ts-ignore
    expect(toFixed('abc', 2)).toBeNaN();
  });

  test('should handle edge cases like Infinity and NaN', () => {
    expect(toFixed(Infinity, 2)).toBe(Infinity);
    expect(toFixed(NaN, 2)).toBeNaN();
  });
});
