// @ts-nocheck
import { describe, expect, test } from 'vitest';

import { DEFAULT_PERMALINK_KEY, getPermalinkKey } from '$lib/services/contents/entry/permalink';

describe('Test getPermalinkKey()', () => {
  /**
   * Create a mock entry collection.
   * @param {any} [permalinkField] The `permalink_field` option value.
   * @returns {any} Mock collection.
   */
  const createCollection = (permalinkField) => ({
    name: 'portfolio',
    _type: 'entry',
    ...(permalinkField === undefined ? {} : { permalink_field: permalinkField }),
  });

  test('should return `undefined` when the option is not defined', () => {
    expect(getPermalinkKey({ collection: createCollection() })).toBeUndefined();
  });

  test('should return the default property name when the option is `true`', () => {
    expect(getPermalinkKey({ collection: createCollection(true) })).toBe(DEFAULT_PERMALINK_KEY);
  });

  test('should return the `permalink_field` option value', () => {
    expect(getPermalinkKey({ collection: createCollection('url_path') })).toBe('url_path');
  });

  test('should return `undefined` when the option is `false` or an empty string', () => {
    expect(getPermalinkKey({ collection: createCollection(false) })).toBeUndefined();
    expect(getPermalinkKey({ collection: createCollection('') })).toBeUndefined();
  });

  test('should return `undefined` for a non-entry collection', () => {
    expect(
      getPermalinkKey({ collection: { ...createCollection(true), _type: 'file' } }),
    ).toBeUndefined();
    expect(getPermalinkKey({ collection: undefined })).toBeUndefined();
  });

  test('should return `undefined` when a field with the same name is configured', () => {
    expect(
      getPermalinkKey({ collection: createCollection(true), fields: [{ name: 'permalink' }] }),
    ).toBeUndefined();
  });
});
