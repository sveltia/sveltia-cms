import { describe, expect, test } from 'vitest';

import {
  isFieldI18nDisabled,
  isFieldLocalized,
  isFieldTranslatable,
} from '$lib/services/contents/i18n/fields';

/** @type {any[]} */
const OPTIONS = [undefined, true, false, 'translate', 'duplicate', 'duplicate_keys', 'none'];
/**
 * Get the options for which the given predicate returns `true`.
 * @param {(i18n: any) => boolean} predicate Predicate.
 * @returns {any[]} Matching options.
 */
const getMatches = (predicate) => OPTIONS.filter((i18n) => predicate(i18n));

describe('Test isFieldTranslatable()', () => {
  test('matches `true` and `translate` only', () => {
    expect(getMatches(isFieldTranslatable)).toEqual([true, 'translate']);
  });
});

describe('Test isFieldLocalized()', () => {
  test('matches `true`, `translate` and `duplicate` only', () => {
    expect(getMatches(isFieldLocalized)).toEqual([true, 'translate', 'duplicate']);
  });
});

describe('Test isFieldI18nDisabled()', () => {
  test('matches an undefined option, `false` and `none` only', () => {
    expect(getMatches(isFieldI18nDisabled)).toEqual([undefined, false, 'none']);
  });
});
