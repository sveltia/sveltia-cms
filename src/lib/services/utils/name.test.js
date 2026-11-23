import { describe, expect, test } from 'vitest';

import { getInitials } from '$lib/services/utils/name';

describe('getInitials', () => {
  test('takes the first letter of the first two words', () => {
    expect(getInitials('Ada Lovelace')).toBe('AL');
    expect(getInitials(' bob ')).toBe('B');
    expect(getInitials('Ada Byron King Lovelace')).toBe('AB');
    expect(getInitials('')).toBe('');
  });

  test('takes the first character of a Chinese, Japanese or Korean name', () => {
    expect(getInitials('张伟')).toBe('张');
    expect(getInitials('山田 太郎')).toBe('山');
    expect(getInitials('やまだ たろう')).toBe('や');
    expect(getInitials('김민수')).toBe('김');
  });

  test('keeps a letter whole, and leaves out what isn’t a letter', () => {
    // A letter with a combining mark, and a Devanagari conjunct
    expect(getInitials('E\u0301mile Zola')).toBe('E\u0301Z');
    expect(getInitials('क्षमा')).toBe('क्ष');
    expect(getInitials('(Ada) 🙂 Lovelace')).toBe('AL');
    expect(getInitials('Ελένη Παππά')).toBe('ΕΠ');
  });

  test('falls back to another name without letters', () => {
    expect(getInitials('🙂', 'ada')).toBe('A');
    expect(getInitials('🙂 ⭐')).toBe('');
    expect(getInitials('', '')).toBe('');
  });
});
