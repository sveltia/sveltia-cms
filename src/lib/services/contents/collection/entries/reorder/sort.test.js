import { describe, expect, test } from 'vitest';

import { sortEntriesByOrderField } from './sort';

/**
 * Build a minimal entry collection mock for tests.
 * @param {object} [overrides] Optional overrides.
 * @returns {any} Mock collection.
 */
const makeCollection = (overrides = {}) => ({
  name: 'posts',
  reorder: true,
  fields: [{ name: 'title', widget: 'string' }],
  _file: { format: 'yaml' },
  _i18n: {
    i18nEnabled: false,
    allLocales: ['_default'],
    defaultLocale: '_default',
    structureMap: {},
  },
  ...overrides,
});

/**
 * Build a minimal entry mock for tests.
 * @param {string} id Entry id.
 * @param {Record<string, any>} content Default-locale content.
 * @returns {any} Mock entry.
 */
const makeEntry = (id, content) => ({
  id,
  slug: id,
  subPath: id,
  locales: {
    _default: { slug: id, path: `content/${id}.md`, content },
  },
});

/**
 * Build a minimal entry collection mock storing all the entries in one file.
 * @returns {any} Mock collection.
 */
const makeArrayFileCollection = () =>
  makeCollection({
    _type: 'entry',
    file: 'data/items.json',
    _file: { format: 'json', arrayFile: true, fullPath: 'data/items.json' },
  });

/**
 * Build a minimal entry mock stored in a file with the other entries.
 * @param {string} id Entry id.
 * @param {number | undefined} arrayIndex Position in the array.
 * @returns {any} Mock entry.
 */
const makeArrayEntry = (id, arrayIndex) => ({
  id,
  slug: id,
  subPath: id,
  arrayIndex,
  locales: {
    _default: { slug: id, path: 'data/items.json', content: { title: id } },
  },
});

describe('sortEntriesByOrderField()', () => {
  test('returns a shallow copy unchanged when no order field is configured', () => {
    const entries = [makeEntry('a', { title: 'A' }), makeEntry('b', { title: 'B' })];
    const collection = /** @type {any} */ ({ _i18n: { defaultLocale: '_default' } });
    const sorted = sortEntriesByOrderField(entries, collection);

    expect(sorted).toEqual(entries);
    expect(sorted).not.toBe(entries);
  });

  test('sorts by the order value, with entries lacking one at the end in their input order', () => {
    const unorderedA = makeEntry('x', { title: 'X' });
    const second = makeEntry('b', { title: 'B', order: '2' });
    const unorderedB = makeEntry('y', { title: 'Y', order: 'n/a' });
    const first = makeEntry('a', { title: 'A', order: 1 });

    expect(
      sortEntriesByOrderField([unorderedA, second, unorderedB, first], makeCollection()),
    ).toEqual([first, second, unorderedA, unorderedB]);
  });

  test('sorts the entries of an array file collection by their position', () => {
    const second = makeArrayEntry('b', 2);
    const unknownA = makeArrayEntry('x', undefined);
    const first = makeArrayEntry('a', 1);
    const unknownB = makeArrayEntry('y', undefined);

    expect(
      sortEntriesByOrderField([second, unknownA, first, unknownB], makeArrayFileCollection()),
    ).toEqual([unknownA, unknownB, first, second]);
  });

  test('moves an entry without an order value after one that comes later with a value', () => {
    // Laid out so the V8 comparator is called with (unordered, ordered), which is the branch the
    // previous test doesn’t reach
    const five = makeEntry('a', { title: 'A', order: 5 });
    const unordered = makeEntry('n', { title: 'N' });
    const three = makeEntry('b', { title: 'B', order: 3 });

    expect(sortEntriesByOrderField([five, unordered, three], makeCollection())).toEqual([
      three,
      five,
      unordered,
    ]);
  });
});
