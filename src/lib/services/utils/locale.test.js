import { describe, expect, test } from 'vitest';

import { getLanguageScript, getLikelyLocale } from '$lib/services/utils/locale';

describe('getLikelyLocale()', () => {
  test('adds the likely subtags', () => {
    expect(getLikelyLocale('pa-PK')?.script).toBe('Arab');
    expect(getLikelyLocale('pa')?.script).toBe('Guru');
    expect(getLikelyLocale('zh-TW')?.toString()).toBe('zh-Hant-TW');
  });

  test('returns the cached result for the same code', () => {
    expect(getLikelyLocale('ja')).toBe(getLikelyLocale('ja'));
  });

  test('returns undefined for an invalid code', () => {
    expect(getLikelyLocale('not a locale')).toBeUndefined();
    expect(getLikelyLocale('not a locale')).toBeUndefined();
  });
});

describe('getLanguageScript()', () => {
  test('returns the language and the likely script', () => {
    expect(getLanguageScript('zh-TW')).toBe('zh-Hant');
    expect(getLanguageScript('zh-HK')).toBe('zh-Hant');
    expect(getLanguageScript('zh')).toBe('zh-Hans');
    expect(getLanguageScript('en-CA')).toBe('en-Latn');
  });

  test('returns undefined for an invalid code', () => {
    expect(getLanguageScript('_')).toBeUndefined();
  });
});
