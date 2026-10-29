import { beforeEach, describe, expect, test, vi } from 'vitest';

import { sortOptions } from '$lib/services/contents/fields/relation/helpers/sort';

/**
 * @import {
 * Entry,
 * InternalEntryCollection,
 * RelationOption,
 * RelationOptionGroup,
 * } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/values', () => ({
  getPropertyValue: vi.fn(),
}));

const { getField } = await import('$lib/services/contents/entry/fields');
const { getPropertyValue } = await import('$lib/services/contents/entry/values');

/** @type {InternalEntryCollection} */
const collection = /** @type {any} */ ({
  name: 'posts',
  _type: 'entry',
  folder: 'posts',
  fields: [],
  _file: { format: 'frontmatter', extension: 'md', formatOptions: {} },
  _i18n: { i18nEnabled: true, defaultLocale: 'en', allLocales: ['en', 'fr'] },
});

/**
 * Build a referenced entry.
 * @param {string} slug Entry slug.
 * @param {Record<string, Record<string, any>>} locales Content by locale.
 * @param {Partial<Entry>} [props] Other entry properties.
 * @returns {Entry} Entry.
 */
const makeEntry = (slug, locales, props = {}) =>
  /** @type {Entry} */ ({
    id: slug,
    slug,
    subPath: slug,
    locales: Object.fromEntries(
      Object.entries(locales).map(([locale, content]) => [
        locale,
        { slug, path: `posts/${slug}.md`, content },
      ]),
    ),
    ...props,
  });

/**
 * Build an option group with one option for each label.
 * @param {Entry} refEntry Referenced entry.
 * @param {string[]} labels Option labels.
 * @returns {RelationOptionGroup} Option group.
 */
const makeGroup = (refEntry, labels) => ({
  refEntry,
  options: labels.map((label) => ({ label, value: label, searchValue: label })),
});

/**
 * Get the labels of the given options.
 * @param {RelationOption[]} options Options.
 * @returns {string[]} Labels.
 */
const labels = (options) => options.map(({ label }) => label);

describe('Test sortOptions()', () => {
  beforeEach(() => {
    vi.mocked(getField).mockReturnValue(undefined);
    vi.mocked(getPropertyValue).mockImplementation(
      ({ entry, locale, key }) => entry.locales[locale]?.content[key],
    );
  });

  test('should sort by a string field in ascending order by default', () => {
    const groups = [
      makeGroup(makeEntry('b', { en: { title: 'Banana' } }), ['B']),
      makeGroup(makeEntry('c', { en: { title: 'cherry' } }), ['C']),
      makeGroup(makeEntry('a', { en: { title: 'Apple' } }), ['A']),
    ];

    const result = sortOptions({ groups, collection, sortBy: { field: 'title' }, locale: 'en' });

    expect(labels(result)).toEqual(['A', 'B', 'C']);
  });

  test('should sort by a number field in descending order, keeping empty values last', () => {
    vi.mocked(getField).mockReturnValue(/** @type {Field} */ ({ name: 'n', widget: 'number' }));

    const groups = [
      makeGroup(makeEntry('two', { en: { n: 2 } }), ['Two']),
      makeGroup(makeEntry('none', { en: {} }), ['None']),
      makeGroup(makeEntry('ten', { en: { n: 10 } }), ['Ten']),
      makeGroup(makeEntry('one', { en: { n: 1 } }), ['One']),
    ];

    const result = sortOptions({
      groups,
      collection,
      sortBy: { field: 'n', direction: 'descending' },
      locale: 'en',
    });

    // A string comparison would put `10` before `2` in ascending order
    expect(labels(result)).toEqual(['Ten', 'Two', 'One', 'None']);
  });

  test('should sort by a date field, comparing the dates rather than the strings', () => {
    vi.mocked(getField).mockReturnValue(
      /** @type {Field} */ ({ name: 'date', widget: 'datetime', format: 'MM/DD/YYYY' }),
    );

    const groups = [
      makeGroup(makeEntry('a', { en: { date: '12/01/2024' } }), ['December 2024']),
      makeGroup(makeEntry('b', { en: { date: '01/15/2025' } }), ['January 2025']),
      makeGroup(makeEntry('c', { en: { date: 'not a date' } }), ['Invalid']),
    ];

    const result = sortOptions({
      groups,
      collection,
      sortBy: { field: 'date', direction: 'descending' },
      locale: 'en',
    });

    expect(labels(result)).toEqual(['January 2025', 'December 2024', 'Invalid']);
  });

  test('should sort the options with the same value by label in either direction', () => {
    const groups = [
      makeGroup(makeEntry('x', { en: { category: 'News' } }), ['Zebra']),
      makeGroup(makeEntry('y', { en: { category: 'Blog' } }), ['Mango']),
      makeGroup(makeEntry('z', { en: { category: 'News' } }), ['Apple']),
      makeGroup(makeEntry('w', { en: {} }), ['Yak']),
      makeGroup(makeEntry('v', { en: {} }), ['Bee']),
    ];

    expect(
      labels(sortOptions({ groups, collection, sortBy: { field: 'category' }, locale: 'en' })),
    ).toEqual(['Mango', 'Apple', 'Zebra', 'Bee', 'Yak']);

    expect(
      labels(
        sortOptions({
          groups,
          collection,
          sortBy: { field: 'category', direction: 'descending' },
          locale: 'en',
        }),
      ),
    ).toEqual(['Apple', 'Zebra', 'Mango', 'Bee', 'Yak']);
  });

  test('should sort the options by label when the values only differ in case', () => {
    const groups = [
      makeGroup(makeEntry('x', { en: { category: 'news' } }), ['Zebra']),
      makeGroup(makeEntry('y', { en: { category: 'News' } }), ['Apple']),
    ];

    expect(
      labels(sortOptions({ groups, collection, sortBy: { field: 'category' }, locale: 'en' })),
    ).toEqual(['Apple', 'Zebra']);
  });

  test('should keep the options generated from the same entry together', () => {
    const groups = [
      makeGroup(makeEntry('b', { en: { title: 'B' } }), ['Paris', 'Lyon']),
      makeGroup(makeEntry('a', { en: { title: 'A' } }), ['Tokyo', 'Osaka']),
    ];

    const result = sortOptions({ groups, collection, sortBy: { field: 'title' }, locale: 'en' });

    expect(labels(result)).toEqual(['Osaka', 'Tokyo', 'Lyon', 'Paris']);
  });

  test('should read the value from the current locale, falling back to the default locale', () => {
    vi.mocked(getField).mockReturnValue(
      /** @type {Field} */ ({ name: 'title', widget: 'string', i18n: true }),
    );

    const groups = [
      makeGroup(makeEntry('a', { en: { title: 'Zucchini' }, fr: { title: 'Courgette' } }), ['A']),
      makeGroup(makeEntry('b', { en: { title: 'Eggplant' } }), ['B']),
    ];

    expect(
      labels(sortOptions({ groups, collection, sortBy: { field: 'title' }, locale: 'fr' })),
    ).toEqual(['A', 'B']);

    expect(
      labels(sortOptions({ groups, collection, sortBy: { field: 'title' }, locale: 'en' })),
    ).toEqual(['B', 'A']);
  });

  test('should read a field that isn’t localized from the default locale', () => {
    vi.mocked(getField).mockReturnValue(
      /** @type {Field} */ ({ name: 'rank', widget: 'number', i18n: false }),
    );

    // The rank is only stored in the default locale
    const groups = [
      makeGroup(makeEntry('a', { en: { rank: 2 }, fr: { title: 'A' } }), ['A']),
      makeGroup(makeEntry('b', { en: { rank: 1 }, fr: { title: 'B' } }), ['B']),
    ];

    expect(
      labels(sortOptions({ groups, collection, sortBy: { field: 'rank' }, locale: 'fr' })),
    ).toEqual(['B', 'A']);
  });

  test('should sort by an entry metadata key', () => {
    vi.mocked(getPropertyValue).mockImplementation(({ entry, key }) =>
      key === 'commit_date' ? entry.commitDate : undefined,
    );

    const groups = [
      makeGroup(makeEntry('a', { en: {} }, { commitDate: new Date('2025-01-01') }), ['Old']),
      makeGroup(makeEntry('b', { en: {} }, { commitDate: new Date('2026-01-01') }), ['New']),
    ];

    const result = sortOptions({
      groups,
      collection,
      sortBy: { field: 'commit_date', direction: 'descending' },
      locale: 'en',
    });

    expect(labels(result)).toEqual(['New', 'Old']);
  });

  describe('Manual order', () => {
    /** @type {InternalEntryCollection} */
    const reorderCollection = { ...collection, reorder: { key: 'weight' } };

    const groups = [
      makeGroup(makeEntry('a', { en: { weight: 10 } }), ['Ten']),
      makeGroup(makeEntry('b', { en: {} }), ['None']),
      makeGroup(makeEntry('c', { en: { weight: '2' } }), ['Two']),
    ];

    test('should sort by the reorder field with the `_manual` key', () => {
      const result = sortOptions({
        groups,
        collection: reorderCollection,
        sortBy: { field: '_manual', direction: 'descending' },
        locale: 'en',
      });

      expect(labels(result)).toEqual(['Ten', 'Two', 'None']);
      expect(getPropertyValue).not.toHaveBeenCalled();
    });

    test('should sort the reorder field as numbers when it’s given as the key', () => {
      const result = sortOptions({
        groups,
        collection: reorderCollection,
        sortBy: { field: 'weight' },
        locale: 'en',
      });

      expect(labels(result)).toEqual(['Two', 'Ten', 'None']);
    });

    test('should sort by label with the `_manual` key if the collection can’t be reordered', () => {
      const result = sortOptions({
        groups,
        collection,
        sortBy: { field: '_manual' },
        locale: 'en',
      });

      expect(labels(result)).toEqual(['None', 'Ten', 'Two']);
    });
  });
});
