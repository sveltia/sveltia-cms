import { describe, expect, test } from 'vitest';

import {
  getFileKey,
  getFolderKey,
  getPrefix,
  getRelativeKey,
} from '$lib/services/integrations/media-libraries/cloud/shared/keys';

/**
 * Create a cloud storage configuration with the given prefix.
 * @param {string} [prefix] Prefix option.
 * @returns {any} Configuration.
 */
const config = (prefix) => (prefix === undefined ? {} : { prefix });

describe('getPrefix', () => {
  test('returns an empty string when no prefix is configured', () => {
    expect(getPrefix(config())).toBe('');
    expect(getPrefix(config(''))).toBe('');
  });

  test('keeps a prefix that already ends with a slash', () => {
    expect(getPrefix(config('uploads/'))).toBe('uploads/');
    expect(getPrefix(config('a/b/'))).toBe('a/b/');
  });

  test('adds a missing trailing slash', () => {
    expect(getPrefix(config('uploads'))).toBe('uploads/');
    expect(getPrefix(config('a/b'))).toBe('a/b/');
  });
});

describe('getFolderKey', () => {
  test('returns the folder path with a trailing slash under the prefix', () => {
    expect(getFolderKey(config('uploads'), 'images')).toBe('uploads/images/');
    expect(getFolderKey(config('uploads/'), 'a/b')).toBe('uploads/a/b/');
  });

  test('returns the folder path at the root without a prefix', () => {
    expect(getFolderKey(config(), 'images')).toBe('images/');
  });
});

describe('getFileKey', () => {
  test('returns the file path under the prefix', () => {
    expect(getFileKey(config('uploads'), 'images/a.png')).toBe('uploads/images/a.png');
    expect(getFileKey(config('uploads/'), 'a.png')).toBe('uploads/a.png');
  });

  test('returns the file path as is without a prefix', () => {
    expect(getFileKey(config(), 'a.png')).toBe('a.png');
  });
});

describe('getRelativeKey', () => {
  test('strips the prefix from a key', () => {
    expect(getRelativeKey(config('uploads'), 'uploads/images/a.png')).toBe('images/a.png');
    expect(getRelativeKey(config('uploads/'), 'uploads/a.png')).toBe('a.png');
  });

  test('leaves a key outside the prefix as is', () => {
    expect(getRelativeKey(config('uploads'), 'other/a.png')).toBe('other/a.png');
    // The prefix is a directory, so a sibling sharing its leading characters is not inside it
    expect(getRelativeKey(config('uploads'), 'uploads-old/a.png')).toBe('uploads-old/a.png');
  });

  test('leaves a key as is without a prefix', () => {
    expect(getRelativeKey(config(), 'images/a.png')).toBe('images/a.png');
  });

  test('round-trips a key built by `getFileKey`', () => {
    const cfg = config('a/b');

    expect(getRelativeKey(cfg, getFileKey(cfg, 'c/d.png'))).toBe('c/d.png');
  });
});
