import { describe, expect, test } from 'vitest';
import { toFixed } from './number';

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
