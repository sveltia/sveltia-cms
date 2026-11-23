import { describe, expect, test, vi } from 'vitest';

import { getField } from '$lib/services/contents/entry/fields';
import {
  addSharedValues,
  getDraftSharedValues,
  getInheritedI18nOption,
  isDuplicatedField,
  isFieldInLocale,
  isSyncedField,
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
  tags: { name: 'tags', widget: 'list', i18n: true },
  kv: { name: 'kv', widget: 'keyvalue', i18n: true },
  ids: { name: 'ids', widget: 'list' },
  meta: { name: 'meta', widget: 'object', i18n: 'duplicate' },
  'meta.caption': { name: 'caption', widget: 'string', i18n: true },
  'meta.box': { name: 'box', widget: 'object', i18n: true },
  'meta.box.note': { name: 'note', widget: 'string' },
  'meta.tags': { name: 'tags', widget: 'list' },
  'meta.tags.label': { name: 'label', widget: 'string' },
  blocks: { name: 'blocks', widget: 'list', i18n: true },
  'blocks.text': { name: 'text', widget: 'string' },
  refs: { name: 'refs', widget: 'list', i18n: 'sync' },
  'refs.url': { name: 'url', widget: 'string' },
  'refs.label': { name: 'label', widget: 'string', i18n: true },
};

/**
 * Fields whose values have no field of their own, as an item of a List field without subfields or
 * a KeyValue pair, for which `getField` returns `undefined`.
 */
const FIELDS_WITHOUT_SUBFIELDS = ['tags', 'kv', 'ids'];

vi.mock('$lib/services/contents/entry/fields', () => ({
  getDraftFieldArgs: vi.fn(({ collectionName, fileName, isIndexFile }, args = {}) => ({
    collectionName,
    fileName,
    isIndexFile,
    ...args,
  })),
  getField: vi.fn(({ keyPath }) =>
    FIELDS_WITHOUT_SUBFIELDS.includes(keyPath.split('.')[0]) && keyPath.includes('.')
      ? undefined
      : FIELDS[keyPath.replace(/\.\d+/g, '')],
  ),
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

/**
 * Get the arguments to check the field at the given key path.
 * @param {string} keyPath Key path.
 * @returns {{ fieldConfig: any, getFieldArgs: any }} Arguments.
 */
const getCheckArgs = (keyPath) => ({
  fieldConfig: FIELDS[keyPath.replace(/\.\d+/g, '')],
  getFieldArgs: { ...getFieldArgs, keyPath, valueMap: {} },
});

describe('isDuplicatedField()', () => {
  test('detects the field’s own `duplicate` or `sync` strategy', () => {
    expect(isDuplicatedField(getCheckArgs('meta'))).toBe(true);
    expect(isDuplicatedField(getCheckArgs('refs'))).toBe(true);
    expect(isDuplicatedField(getCheckArgs('title'))).toBe(false);
  });

  test('lets an explicit `i18n` option of the field or a nearer ancestor win', () => {
    expect(isDuplicatedField(getCheckArgs('meta.caption'))).toBe(false);
    expect(isDuplicatedField(getCheckArgs('meta.box.note'))).toBe(false);
  });

  test('detects a duplicated ancestor, skipping the list item indexes', () => {
    expect(isDuplicatedField(getCheckArgs('meta.tags'))).toBe(true);
    expect(isDuplicatedField(getCheckArgs('meta.tags.0.label'))).toBe(true);
    expect(isDuplicatedField(getCheckArgs('refs.0.url'))).toBe(true);
    expect(isDuplicatedField(getCheckArgs('blocks.0.text'))).toBe(false);
    expect(getField).not.toHaveBeenCalledWith(expect.objectContaining({ keyPath: 'blocks.0' }));
  });
});

describe('isSyncedField()', () => {
  test('detects the field’s own or an ancestor’s `sync` strategy only', () => {
    expect(isSyncedField(getCheckArgs('refs'))).toBe(true);
    expect(isSyncedField(getCheckArgs('refs.0.url'))).toBe(true);
    expect(isSyncedField(getCheckArgs('refs.0.label'))).toBe(false);
    expect(isSyncedField(getCheckArgs('sku'))).toBe(false);
    expect(isSyncedField(getCheckArgs('meta.tags.0.label'))).toBe(false);
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

  test('takes a value without a field of its own to be localized along with its ancestor', () => {
    expect(isFieldInLocale({ ...args, keyPath: 'tags.1' })).toBe(true);
    expect(isFieldInLocale({ ...args, keyPath: 'kv.a' })).toBe(true);
    expect(isFieldInLocale({ ...args, keyPath: 'tags.0.x' })).toBe(true);
    expect(isFieldInLocale({ ...args, keyPath: 'ids.0' })).toBe(false);
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

  test('doesn’t add the extra items of a localized List field without subfields', () => {
    expect(
      addSharedValues({
        getFieldArgs,
        ...locales,
        content: { 'tags.0': 'a' },
        defaultContent: { 'tags.0': 'x', 'tags.1': 'y', 'kv.a': '1', 'ids.0': 'i1' },
      }),
    ).toEqual({ 'tags.0': 'a', 'ids.0': 'i1' });
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
