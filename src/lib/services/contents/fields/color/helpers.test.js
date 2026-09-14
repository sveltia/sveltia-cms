import { describe, expect, test } from 'vitest';

import { formatHexAsRGB, getColorFieldValue, parseColorFieldValue } from './helpers.js';

describe('formatHexAsRGB()', () => {
  test('formats a 6-digit hex color', () => {
    expect(formatHexAsRGB('#ff8000')).toBe('rgb(255 128 0)');
    expect(formatHexAsRGB('#000000')).toBe('rgb(0 0 0)');
    expect(formatHexAsRGB('#FFFFFF')).toBe('rgb(255 255 255)');
  });

  test('ignores the alpha channel unless enabled', () => {
    expect(formatHexAsRGB('#ff800080')).toBe('rgb(255 128 0)');
    expect(formatHexAsRGB('#ff800080', { enableAlpha: false })).toBe('rgb(255 128 0)');
  });

  test('includes the alpha channel as a percentage when enabled', () => {
    expect(formatHexAsRGB('#ff800080', { enableAlpha: true })).toBe('rgb(255 128 0 / 50%)');
    expect(formatHexAsRGB('#ff8000ff', { enableAlpha: true })).toBe('rgb(255 128 0 / 100%)');
    expect(formatHexAsRGB('#ff800000', { enableAlpha: true })).toBe('rgb(255 128 0 / 0%)');
  });

  test('omits the alpha channel when the color has none, even if enabled', () => {
    expect(formatHexAsRGB('#ff8000', { enableAlpha: true })).toBe('rgb(255 128 0)');
  });

  test('returns an empty string for anything but a hex color', () => {
    expect(formatHexAsRGB(undefined)).toBe('');
    expect(formatHexAsRGB('')).toBe('');
    expect(formatHexAsRGB('#fff')).toBe('');
    expect(formatHexAsRGB('#gggggg')).toBe('');
    expect(formatHexAsRGB('rgb(255 128 0)')).toBe('');
    expect(formatHexAsRGB('ff8000')).toBe('');
  });
});

describe('parseColorFieldValue()', () => {
  test('splits a hex color into the color and alpha parts', () => {
    expect(parseColorFieldValue('#ff8000')).toEqual({ rgb: '#ff8000', alpha: 255 });
    expect(parseColorFieldValue('#ff800080')).toEqual({ rgb: '#ff8000', alpha: 128 });
    expect(parseColorFieldValue('#FF800000')).toEqual({ rgb: '#FF8000', alpha: 0 });
  });

  test('returns `undefined` for anything but a hex color', () => {
    expect(parseColorFieldValue(undefined)).toBe(undefined);
    expect(parseColorFieldValue(42)).toBe(undefined);
    expect(parseColorFieldValue('')).toBe(undefined);
    expect(parseColorFieldValue('red')).toBe(undefined);
    expect(parseColorFieldValue('#fff')).toBe(undefined);
  });
});

describe('getColorFieldValue()', () => {
  test('stores the color, with the alpha channel when enabled', () => {
    expect(getColorFieldValue({ rgb: '#ff8000', alpha: 128 })).toBe('#ff8000');
    expect(getColorFieldValue({ rgb: '#ff8000', alpha: 128, enableAlpha: true })).toBe('#ff800080');
    expect(getColorFieldValue({ rgb: '#ff8000', alpha: 0, enableAlpha: true })).toBe('#ff800000');
  });

  test('stores an empty string when the input holds no color', () => {
    expect(getColorFieldValue({ rgb: '', alpha: 255 })).toBe('');
    expect(getColorFieldValue({ rgb: 'red', alpha: 255, enableAlpha: true })).toBe('');
  });
});
