import { describe, expect, test, vi } from 'vitest';

import {
  alignPairs,
  getDuplicateKeysFieldKeyPaths,
  syncAllDuplicateKeys,
  syncDuplicateKeys,
} from './duplicate-keys';

/**
 * @import { Field } from '$lib/types/public';
 */

/** @type {Field[]} */
const fields = [
  { name: 'title', widget: 'string', i18n: true },
  { name: 'metadata', widget: 'keyvalue', i18n: 'duplicate_keys' },
  { name: 'labels', widget: 'keyvalue', i18n: true },
  {
    name: 'sections',
    widget: 'list',
    i18n: true,
    fields: [{ name: 'attrs', widget: 'keyvalue', i18n: 'duplicate_keys' }],
  },
];

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(() => ({ name: 'posts', _type: 'entry', fields })),
}));

const getFieldArgs = { collectionName: 'posts' };

describe('Test alignPairs()', () => {
  test('should keep the values of the keys the locale already holds, in the default order', () => {
    expect(
      alignPairs(
        [
          ['a', '1'],
          ['b', '2'],
        ],
        [
          ['b', 'deux'],
          ['a', 'un'],
        ],
      ),
    ).toEqual([
      ['a', 'un'],
      ['b', 'deux'],
    ]);
  });

  test('should start a new key with an empty value', () => {
    expect(
      alignPairs(
        [
          ['a', '1'],
          ['b', '2'],
        ],
        [['a', 'un']],
      ),
    ).toEqual([
      ['a', 'un'],
      ['b', ''],
    ]);
  });

  test('should drop a key removed from the default locale', () => {
    expect(
      alignPairs(
        [['b', '2']],
        [
          ['a', 'un'],
          ['b', 'deux'],
        ],
      ),
    ).toEqual([['b', 'deux']]);
  });

  test('should carry the value over to a key renamed in the default locale', () => {
    expect(
      alignPairs(
        [
          ['a', '1'],
          ['bee', '2'],
          ['c', '3'],
        ],
        [
          ['a', 'un'],
          ['b', 'deux'],
          ['c', 'trois'],
        ],
      ),
    ).toEqual([
      ['a', 'un'],
      ['bee', 'deux'],
      ['c', 'trois'],
    ]);
  });

  test('should not carry a value over from a key that still exists elsewhere', () => {
    // `a` was removed and `c` added: the pair at the second position, `b`, is still there
    expect(
      alignPairs(
        [
          ['b', '2'],
          ['c', '3'],
        ],
        [
          ['a', 'un'],
          ['b', 'deux'],
        ],
      ),
    ).toEqual([
      ['b', 'deux'],
      ['c', ''],
    ]);
  });

  test('should return an empty array when the default locale holds no pairs', () => {
    expect(alignPairs([], [['a', 'un']])).toEqual([]);
  });
});

describe('Test syncDuplicateKeys()', () => {
  test('should mirror the keys to every other locale, keeping their values', () => {
    const valueStore = {
      en: { 'metadata.a': '1', 'metadata.b': '2', title: 'Hello' },
      fr: { 'metadata.b': 'deux', title: 'Bonjour' },
      de: { metadata: null, title: 'Hallo' },
    };

    syncDuplicateKeys({ valueStore, defaultLocale: 'en', keyPath: 'metadata' });

    expect(valueStore).toEqual({
      en: { 'metadata.a': '1', 'metadata.b': '2', title: 'Hello' },
      fr: { 'metadata.a': '', 'metadata.b': 'deux', title: 'Bonjour' },
      de: { 'metadata.a': '', 'metadata.b': '', title: 'Hallo' },
    });
  });

  test('should leave a locale alone when its pairs are already lined up', () => {
    const fr = { 'metadata.a': 'un', 'metadata.b': 'deux' };
    const valueStore = { en: { 'metadata.a': '1', 'metadata.b': '2' }, fr };
    const keys = Object.keys(fr);

    syncDuplicateKeys({ valueStore, defaultLocale: 'en', keyPath: 'metadata' });

    expect(valueStore.fr).toBe(fr);
    expect(Object.keys(fr)).toEqual(keys);
  });

  test('should clear the pairs of other locales when the default locale holds none', () => {
    const valueStore = {
      en: { metadata: null },
      fr: { 'metadata.a': 'un' },
    };

    syncDuplicateKeys({ valueStore, defaultLocale: 'en', keyPath: 'metadata' });

    expect(valueStore.fr).toEqual({});
  });

  test('should do nothing when the default locale is missing from the store', () => {
    const valueStore = { fr: { 'metadata.a': 'un' } };

    syncDuplicateKeys({ valueStore, defaultLocale: 'en', keyPath: 'metadata' });

    expect(valueStore).toEqual({ fr: {} });
  });
});

describe('Test getDuplicateKeysFieldKeyPaths()', () => {
  test('should find the fields through their pairs in any locale', () => {
    const valueStore = {
      en: {
        title: 'Hello',
        'labels.a': '1',
        'sections.0.attrs.x': 'y',
      },
      fr: {
        'metadata.a': 'un',
        'metadata.b': 'deux',
      },
    };

    expect(getDuplicateKeysFieldKeyPaths({ valueStore, getFieldArgs })).toEqual([
      'sections.0.attrs',
      'metadata',
    ]);
  });

  test('should return an empty array when no such field holds pairs', () => {
    const valueStore = { en: { title: 'Hello', metadata: null, 'labels.a': '1' } };

    expect(getDuplicateKeysFieldKeyPaths({ valueStore, getFieldArgs })).toEqual([]);
  });
});

describe('Test syncAllDuplicateKeys()', () => {
  test('should sync every `duplicate_keys` field and nothing else', () => {
    const valueStore = {
      en: {
        'metadata.a': '1',
        'labels.a': '1',
        'sections.0.attrs.x': 'y',
      },
      fr: {
        'metadata.b': 'deux',
        'labels.b': 'deux',
        'sections.0.attrs.z': 'w',
      },
    };

    syncAllDuplicateKeys({ valueStore, defaultLocale: 'en', getFieldArgs });

    expect(valueStore.fr).toEqual({
      'labels.b': 'deux',
      'metadata.a': 'deux',
      'sections.0.attrs.x': 'w',
    });
  });
});
