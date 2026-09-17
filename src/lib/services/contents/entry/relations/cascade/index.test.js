// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getCandidateEntries } from '$lib/services/contents/entry/relations/cascade';

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));

const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');
const postsCollection = { name: 'posts', _type: 'entry' };

/**
 * Create a blog post entry.
 * @param {string} id Entry ID and slug.
 * @returns {object} Entry.
 */
const createPost = (id) => ({
  id,
  slug: id,
  subPath: id,
  locales: { _default: { slug: id, path: `content/posts/${id}.md`, content: {} } },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCandidateEntries()', () => {
  test('returns the entries of the source collection', () => {
    const entries = [createPost('a'), createPost('b')];

    getEntriesByCollection.mockReturnValue(entries);

    expect(
      getCandidateEntries({
        relation: { sourceCollection: postsCollection },
        excludeIds: new Set(),
      }),
    ).toEqual(entries);
    expect(getEntriesByCollection).toHaveBeenCalledWith('posts');
  });

  test('leaves out the excluded entries', () => {
    getEntriesByCollection.mockReturnValue([createPost('a'), createPost('b'), createPost('c')]);

    expect(
      getCandidateEntries({
        relation: { sourceCollection: postsCollection },
        excludeIds: new Set(['a', 'c']),
      }).map(({ id }) => id),
    ).toEqual(['b']);
  });

  test('only returns the field’s own file in a file collection', () => {
    getEntriesByCollection.mockReturnValue([createPost('general'), createPost('other')]);

    expect(
      getCandidateEntries({
        relation: {
          sourceCollection: { name: 'config', _type: 'file' },
          sourceCollectionFile: { name: 'general' },
        },
        excludeIds: new Set(),
      }).map(({ id }) => id),
    ).toEqual(['general']);
  });
});
