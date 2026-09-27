import { describe, expect, test, vi } from 'vitest';

import { isPairOrderModified } from './order';

/**
 * @import { EntryDraft, FlattenedEntryContent } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

/** @type {Field[]} */
const fields = [
  { name: 'title', widget: 'string' },
  { name: 'metadata', widget: 'keyvalue' },
  { name: 'author', widget: 'object', fields: [{ name: 'name' }, { name: 'email' }] },
  {
    name: 'sections',
    widget: 'list',
    fields: [
      { name: 'title', widget: 'string' },
      { name: 'attrs', widget: 'keyvalue' },
    ],
  },
];

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(() => ({ name: 'posts', _type: 'entry', fields })),
}));

/**
 * Check whether a key holds content, like the function `isDraftModified()` passes.
 * @param {FlattenedEntryContent} valueMap Value map.
 * @param {string} key Key.
 * @returns {boolean} Result.
 */
const isRealKey = (valueMap, key) => !key.endsWith('.__sc_item_id') && valueMap[key] !== undefined;

/**
 * Create a draft with the given value maps for the `en` locale.
 * @param {FlattenedEntryContent} originalValueMap Original values.
 * @param {FlattenedEntryContent} currentValueMap Current values.
 * @returns {EntryDraft} Draft.
 */
const createDraft = (originalValueMap, currentValueMap) =>
  /** @type {EntryDraft} */ (
    /** @type {unknown} */ ({
      collectionName: 'posts',
      isIndexFile: false,
      originalValues: { en: originalValueMap },
      currentValues: { en: currentValueMap },
    })
  );

describe('Test isPairOrderModified()', () => {
  test('should return false when nothing has been reordered', () => {
    const valueMap = { title: 'Hello', 'metadata.a': '1', 'metadata.b': '2' };

    expect(isPairOrderModified({ draft: createDraft(valueMap, { ...valueMap }), isRealKey })).toBe(
      false,
    );
  });

  test('should return true when the pairs of a KeyValue field have been reordered', () => {
    const draft = createDraft(
      { title: 'Hello', 'metadata.a': '1', 'metadata.b': '2' },
      { title: 'Hello', 'metadata.b': '2', 'metadata.a': '1' },
    );

    expect(isPairOrderModified({ draft, isRealKey })).toBe(true);
  });

  test('should return true when the pairs of a nested KeyValue field have been reordered', () => {
    const draft = createDraft(
      { 'sections.0.title': 'One', 'sections.0.attrs.a': '1', 'sections.0.attrs.b': '2' },
      { 'sections.0.title': 'One', 'sections.0.attrs.b': '2', 'sections.0.attrs.a': '1' },
    );

    expect(isPairOrderModified({ draft, isRealKey })).toBe(true);
  });

  test('should ignore the fields moving relative to each other', () => {
    const draft = createDraft(
      { title: 'Hello', 'metadata.a': '1', 'metadata.b': '2' },
      { 'metadata.a': '1', 'metadata.b': '2', title: 'Hello' },
    );

    expect(isPairOrderModified({ draft, isRealKey })).toBe(false);
  });

  test('should ignore the reordered subfields of a field other than KeyValue', () => {
    const draft = createDraft(
      { 'author.name': 'Jane', 'author.email': 'jane@example.com', 'sections.0.title': 'One' },
      { 'author.email': 'jane@example.com', 'author.name': 'Jane', 'sections.0.title': 'One' },
    );

    expect(isPairOrderModified({ draft, isRealKey })).toBe(false);
  });

  test('should ignore internal and undefined properties', () => {
    const draft = createDraft(
      { 'metadata.a': '1', 'metadata.b': '2', 'sections.0.__sc_item_id': 'x' },
      {
        'metadata.c': undefined,
        'metadata.a': '1',
        'sections.0.__sc_item_id': 'y',
        'metadata.b': '2',
      },
    );

    expect(isPairOrderModified({ draft, isRealKey })).toBe(false);
  });
});
