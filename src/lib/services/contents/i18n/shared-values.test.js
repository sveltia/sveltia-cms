import { describe, expect, test, vi } from 'vitest';

import {
  addSharedValues,
  getDraftSharedValues,
  getInheritedI18nOption,
  isFieldInLocale,
} from '$lib/services/contents/i18n/shared-values';

/**
 * Fields of the `posts` collection, keyed by key path, with list item indexes removed.
 * @type {Record<string, any>}
 */
const FIELDS = {
  title: { name: 'title', widget: 'string', i18n: true },
  date: { name: 'date', widget: 'datetime' },
  sku: { name: 'sku', widget: 'string', i18n: 'duplicate' },
  author: { name: 'author', widget: 'object', i18n: true },
  'author.name': { name: 'name', widget: 'string' },
  'author.id': { name: 'id', widget: 'string', i18n: false },
  links: { name: 'links', widget: 'list', i18n: false },
  'links.url': { name: 'url', widget: 'string', i18n: true },
};

vi.mock('$lib/services/contents/entry/fields', () => ({
  getDraftFieldArgs: vi.fn(({ collectionName, fileName, isIndexFile }, args = {}) => ({
    collectionName,
    fileName,
    isIndexFile,
    ...args,
  })),
  getField: vi.fn(({ keyPath }) => FIELDS[keyPath.replace(/\.\d+/g, '')]),
}));

const getFieldArgs = { collectionName: 'posts', isIndexFile: false };
const locales = { locale: 'ja', defaultLocale: 'en' };

describe('getInheritedI18nOption()', () => {
  test('returns the field’s own option, or that of the nearest ancestor', () => {
    const fieldConfig = { name: 'name', widget: 'string' };

    expect(
      getInheritedI18nOption({
        fieldConfig: { ...fieldConfig, i18n: 'duplicate' },
        getFieldArgs: { ...getFieldArgs, keyPath: 'author.name', valueMap: {} },
      }),
    ).toBe('duplicate');
    expect(
      getInheritedI18nOption({
        fieldConfig,
        getFieldArgs: { ...getFieldArgs, keyPath: 'author.name', valueMap: {} },
      }),
    ).toBe(true);
    expect(
      getInheritedI18nOption({
        fieldConfig: { name: 'date', widget: 'datetime' },
        getFieldArgs: { ...getFieldArgs, keyPath: 'date', valueMap: {} },
      }),
    ).toBeUndefined();
  });
});

describe('isFieldInLocale()', () => {
  const args = { getFieldArgs: { ...getFieldArgs, valueMap: {} }, ...locales };

  test('takes every field to be in the default locale', () => {
    expect(isFieldInLocale({ ...args, locale: 'en', keyPath: 'date' })).toBe(true);
  });

  test('takes a field to be in another locale if it and its ancestors are localized', () => {
    expect(isFieldInLocale({ ...args, keyPath: 'title' })).toBe(true);
    expect(isFieldInLocale({ ...args, keyPath: 'sku' })).toBe(true);
    expect(isFieldInLocale({ ...args, keyPath: 'author.name' })).toBe(true);
    expect(isFieldInLocale({ ...args, keyPath: 'date' })).toBe(false);
    expect(isFieldInLocale({ ...args, keyPath: 'author.id' })).toBe(false);
    expect(isFieldInLocale({ ...args, keyPath: 'links.0.url' })).toBe(false);
    expect(isFieldInLocale({ ...args, keyPath: 'unknown' })).toBe(false);
  });
});

describe('addSharedValues()', () => {
  const defaultContent = {
    title: 'Hello',
    date: '2024-01-15',
    sku: 'X1',
    'author.name': 'Jane',
    'author.id': 'j1',
    'links.0.url': 'https://example.com',
  };

  test('adds the values of the fields that aren’t localized', () => {
    expect(
      addSharedValues({
        getFieldArgs,
        ...locales,
        content: { title: 'こんにちは', sku: 'X1', 'author.name': 'ジェーン' },
        defaultContent,
      }),
    ).toEqual({
      title: 'こんにちは',
      date: '2024-01-15',
      sku: 'X1',
      'author.name': 'ジェーン',
      'author.id': 'j1',
      'links.0.url': 'https://example.com',
    });
  });

  test('doesn’t fill in a localized field missing in the locale', () => {
    expect(
      addSharedValues({ getFieldArgs, ...locales, content: {}, defaultContent }),
    ).not.toHaveProperty('title');
  });

  test('returns the content as is for the default locale or without default content', () => {
    const content = { title: 'Hello' };

    expect(
      addSharedValues({ getFieldArgs, ...locales, locale: 'en', content, defaultContent }),
    ).toBe(content);
    expect(addSharedValues({ getFieldArgs, ...locales, content, defaultContent: undefined })).toBe(
      content,
    );
  });
});

describe('getDraftSharedValues()', () => {
  /**
   * Build an entry draft.
   * @returns {any} Draft.
   */
  const createDraft = () => ({
    collectionName: 'posts',
    collection: { _i18n: { defaultLocale: 'en' } },
    isIndexFile: false,
    currentValues: { en: { title: 'Hello', date: '2024-01-15' }, ja: { title: 'こんにちは' } },
  });

  test('gives the default locale values along with whether a field is shared', () => {
    const sharedValues = getDraftSharedValues(createDraft(), 'ja');

    expect(sharedValues?.values).toEqual({ title: 'Hello', date: '2024-01-15' });
    expect(sharedValues?.isShared('date')).toBe(true);
    expect(sharedValues?.isShared('title')).toBe(false);
  });

  test('gives nothing for the default locale or without a draft', () => {
    expect(getDraftSharedValues(createDraft(), 'en')).toBeUndefined();
    expect(getDraftSharedValues(undefined, 'ja')).toBeUndefined();
  });
});
