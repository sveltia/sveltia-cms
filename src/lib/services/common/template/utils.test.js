import { describe, expect, test } from 'vitest';

import {
  getFileNameLocaleSuffixes,
  getFileNameParts,
  stripFieldTagPrefix,
} from '$lib/services/common/template/utils';

describe('Test stripFieldTagPrefix()', () => {
  test('removes the `fields.` prefix', () => {
    expect(stripFieldTagPrefix('fields.title')).toBe('title');
    expect(stripFieldTagPrefix('fields.author.name')).toBe('author.name');
  });

  test('returns a tag without the prefix as is', () => {
    expect(stripFieldTagPrefix('title')).toBe('title');
    expect(stripFieldTagPrefix('slug')).toBe('slug');
  });

  test('only removes the prefix at the start', () => {
    expect(stripFieldTagPrefix('author.fields.name')).toBe('author.fields.name');
    expect(stripFieldTagPrefix('fields.fields.name')).toBe('fields.name');
  });
});

describe('Test getFileNameParts()', () => {
  test('splits the file name at the last dot', () => {
    expect(getFileNameParts('content/posts/my-post.md')).toEqual({
      filename: 'my-post',
      extension: 'md',
    });
    expect(getFileNameParts('content/my.post.md')).toEqual({
      filename: 'my.post',
      extension: 'md',
    });
    expect(getFileNameParts('archive.tar.gz')).toEqual({
      filename: 'archive.tar',
      extension: 'gz',
    });
  });

  test('returns an empty extension for a file name without a dot', () => {
    expect(getFileNameParts('content/README')).toEqual({ filename: 'README', extension: '' });
  });
});

describe('Test getFileNameParts() with locale suffixes', () => {
  test('removes a locale code following the file name', () => {
    expect(getFileNameParts('content/my.post.en.md', ['en', 'fr'])).toEqual({
      filename: 'my.post',
      extension: 'md',
    });
    expect(getFileNameParts('content/my-post.fr.md', ['en', 'fr'])).toEqual({
      filename: 'my-post',
      extension: 'md',
    });
  });

  test('keeps a file name without a locale code', () => {
    expect(getFileNameParts('content/my.post.md', ['en', 'fr'])).toEqual({
      filename: 'my.post',
      extension: 'md',
    });
  });
});

describe('Test getFileNameLocaleSuffixes()', () => {
  /**
   * Create a collection with the given i18n structure.
   * @param {boolean} i18nMultiFile Whether the `multiple_files` structure is used.
   * @returns {any} Collection.
   */
  const createCollection = (i18nMultiFile) => ({
    _i18n: { structureMap: { i18nMultiFile }, allLocales: ['en', 'fr'] },
  });

  test('returns the locales with the `multiple_files` structure', () => {
    expect(getFileNameLocaleSuffixes(createCollection(true))).toEqual(['en', 'fr']);
  });

  test('returns nothing with another structure', () => {
    expect(getFileNameLocaleSuffixes(createCollection(false))).toEqual([]);
  });

  test('returns nothing without the i18n configuration', () => {
    expect(getFileNameLocaleSuffixes(/** @type {any} */ ({}))).toEqual([]);
    expect(getFileNameLocaleSuffixes(/** @type {any} */ ({ _i18n: {} }))).toEqual([]);
  });
});
