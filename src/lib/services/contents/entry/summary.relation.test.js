import { beforeEach, describe, expect, test, vi } from 'vitest';

import { allEntries } from '$lib/services/contents';
import { getField } from '$lib/services/contents/entry/fields';
import {
  getEntrySummary,
  isDisplayValueFromOtherEntries,
} from '$lib/services/contents/entry/summary';
import { getFieldDisplayValue } from '$lib/services/contents/entry/values';

/**
 * @import { Entry, InternalCollection } from '$lib/types/private';
 */

vi.mock('$lib/services/contents', () => ({
  allEntries: { current: [] },
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/values', () => ({
  getFieldDisplayValue: vi.fn(),
}));

/**
 * Create a collection with the given summary template.
 * @param {string} summary Summary template.
 * @returns {InternalCollection} Collection.
 */
const createCollection = (summary) =>
  /** @type {InternalCollection} */ ({
    name: 'posts',
    folder: 'content/posts',
    fields: [],
    summary,
    _type: 'entry',
    _file: /** @type {any} */ ({}),
    _i18n: /** @type {any} */ ({ defaultLocale: 'en', allLocales: ['en'] }),
    _thumbnailFieldNames: [],
  });

/**
 * Create an entry.
 * @param {string} slug Entry slug.
 * @returns {Entry} Entry.
 */
const createEntry = (slug) => ({
  id: `posts/${slug}`,
  slug,
  subPath: slug,
  locales: {
    en: {
      slug,
      path: `content/posts/${slug}.md`,
      content: { title: slug, author: 'jane' },
    },
  },
});

describe('Test getEntrySummary() caching with Relation fields', () => {
  /** @type {Record<string, string>} */
  let displayValues;

  beforeEach(() => {
    allEntries.current = [];
    displayValues = { title: 'Title', author: 'Jane' };

    vi.mocked(getField).mockImplementation(
      ({ keyPath }) =>
        /** @type {any} */ ({
          name: keyPath,
          widget: keyPath === 'author' ? 'relation' : 'string',
        }),
    );

    vi.mocked(getFieldDisplayValue).mockImplementation(({ keyPath }) => displayValues[keyPath]);
  });

  test('keeps a summary without a Relation field label once other entries change', () => {
    const collection = createCollection('{{title}}');
    const entry = createEntry('hello');

    expect(getEntrySummary(collection, entry, { useTemplate: true })).toBe('Title');

    displayValues.title = 'Changed';
    allEntries.current = [];

    expect(getEntrySummary(collection, entry, { useTemplate: true })).toBe('Title');
    expect(getFieldDisplayValue).toHaveBeenCalledTimes(1);
  });

  test('regenerates a summary with a Relation field label once other entries change', () => {
    const collection = createCollection('{{author}}');
    const entry = createEntry('hello');

    expect(getEntrySummary(collection, entry, { useTemplate: true })).toBe('Jane');

    displayValues.author = 'Janet';

    // Cached as long as the entries stay the same
    expect(getEntrySummary(collection, entry, { useTemplate: true })).toBe('Jane');

    allEntries.current = [];

    expect(getEntrySummary(collection, entry, { useTemplate: true })).toBe('Janet');
  });

  test('keeps the dependency when a label is resolved with a nested summary', () => {
    const collection = createCollection('{{author}}');
    const nestedCollection = createCollection('{{title}}');
    const entry = createEntry('hello');
    const referencedEntry = createEntry('jane');

    // Resolving the label formats the referenced entry’s own summary, which has no Relation field
    vi.mocked(getFieldDisplayValue).mockImplementation(({ keyPath }) => {
      if (keyPath !== 'author') {
        return displayValues[keyPath];
      }

      const nested = getEntrySummary(nestedCollection, referencedEntry, { useTemplate: true });

      return `${displayValues.author} (${nested})`;
    });

    expect(getEntrySummary(collection, entry, { useTemplate: true })).toBe('Jane (Title)');

    displayValues.author = 'Janet';
    allEntries.current = [];

    expect(getEntrySummary(collection, entry, { useTemplate: true })).toBe('Janet (Title)');
  });

  test('regenerates a summary with a List field of Relation items once other entries change', () => {
    const collection = createCollection('{{authors}}');
    const entry = createEntry('hello');

    vi.mocked(getField).mockReturnValue(
      /** @type {any} */ ({ name: 'authors', widget: 'list', field: { widget: 'relation' } }),
    );
    displayValues.authors = 'Jane';

    expect(getEntrySummary(collection, entry, { useTemplate: true })).toBe('Jane');

    displayValues.authors = 'Janet';
    allEntries.current = [];

    expect(getEntrySummary(collection, entry, { useTemplate: true })).toBe('Janet');
  });
});

describe('Test isDisplayValueFromOtherEntries()', () => {
  test('returns true for a Relation field', () => {
    expect(isDisplayValueFromOtherEntries(/** @type {any} */ ({ widget: 'relation' }))).toBe(true);
  });

  test('returns true for a List field with a Relation subfield, at any depth', () => {
    const field = /** @type {any} */ ({ widget: 'list', field: { widget: 'relation' } });

    expect(isDisplayValueFromOtherEntries(field)).toBe(true);
    expect(isDisplayValueFromOtherEntries(/** @type {any} */ ({ widget: 'list', field }))).toBe(
      true,
    );
  });

  test('returns false for a List field whose items are not resolved like a subfield', () => {
    const subField = { widget: 'relation' };

    // `fields` and `types` take precedence over `field` in the display value
    expect(
      isDisplayValueFromOtherEntries(
        /** @type {any} */ ({ widget: 'list', field: subField, fields: [subField] }),
      ),
    ).toBe(false);
    expect(
      isDisplayValueFromOtherEntries(
        /** @type {any} */ ({ widget: 'list', field: subField, types: [] }),
      ),
    ).toBe(false);
    expect(isDisplayValueFromOtherEntries(/** @type {any} */ ({ widget: 'list' }))).toBe(false);
    expect(
      isDisplayValueFromOtherEntries(
        /** @type {any} */ ({ widget: 'list', field: { widget: 'string' } }),
      ),
    ).toBe(false);
  });

  test('returns false for any other field', () => {
    expect(isDisplayValueFromOtherEntries(/** @type {any} */ ({ widget: 'string' }))).toBe(false);
    expect(isDisplayValueFromOtherEntries(undefined)).toBe(false);
  });
});
