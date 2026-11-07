import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getListedEntryValue,
  isEmptyValue,
  normalizeMultiValue,
} from '$lib/services/contents/collection/view/values';
import { getPropertyValue } from '$lib/services/contents/entry/values';

vi.mock('$lib/services/contents/entry/values', () => ({
  getPropertyValue: vi.fn(),
}));

describe('isEmptyValue', () => {
  test('should tell an undefined, null or empty string value apart from any other', () => {
    expect(isEmptyValue(undefined)).toBe(true);
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue('')).toBe(true);
    expect(isEmptyValue(0)).toBe(false);
    expect(isEmptyValue(false)).toBe(false);
    expect(isEmptyValue([])).toBe(false);
  });
});

describe('getListedEntryValue', () => {
  beforeEach(() => {
    vi.mocked(getPropertyValue).mockReturnValue('value');
  });

  test('should read the value in the default locale', () => {
    /** @type {any} */
    const entry = { locales: { en: {}, fr: {} } };
    const args = { entry, locale: 'en', collectionName: 'posts', key: 'title' };

    expect(getListedEntryValue({ ...args, resolveRef: false })).toBe('value');
    expect(getPropertyValue).toHaveBeenCalledWith({ ...args, resolveRef: false });
  });

  test('should read the value in the locale an entry lacking the default one is listed in', () => {
    /** @type {any} */
    const entry = { locales: { fr: {} } };

    getListedEntryValue({ entry, locale: 'en', collectionName: 'posts', key: 'title' });

    expect(getPropertyValue).toHaveBeenCalledWith(expect.objectContaining({ entry, locale: 'fr' }));
  });
});

describe('normalizeMultiValue', () => {
  test('should drop the empty items of an array', () => {
    expect(normalizeMultiValue(['a', '', null, undefined, 0, false])).toEqual(['a', 0, false]);
  });

  test('should return undefined for an array without any item', () => {
    expect(normalizeMultiValue([])).toBeUndefined();
    expect(normalizeMultiValue([null, ''])).toBeUndefined();
  });

  test('should return any other value as is', () => {
    expect(normalizeMultiValue('')).toBe('');
    expect(normalizeMultiValue(null)).toBeNull();
    expect(normalizeMultiValue('a')).toBe('a');
  });
});
