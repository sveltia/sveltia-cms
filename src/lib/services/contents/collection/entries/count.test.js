import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  countCollectionEntries,
  getEntriesByCollection,
} from '$lib/services/contents/collection/entries';
import { countQuotaEntries } from '$lib/services/contents/collection/entries/count';
import { unpublishedEntries } from '$lib/services/workflow';

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
  countCollectionEntries: vi.fn((_collectionName, entries) => entries.length),
}));

// Only the store is mocked; `mergeUnpublishedEntries` is a pure helper and is used as is
vi.mock('$lib/services/workflow', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  unpublishedEntries: { current: [] },
}));

/**
 * Create an entry.
 * @param {string} subPath Entry sub path.
 * @param {string} [collectionName] Collection name, given for an unpublished entry.
 * @returns {any} Entry.
 */
const createEntry = (subPath, collectionName) => ({
  id: collectionName ? `draft-${subPath}` : subPath,
  slug: subPath,
  subPath,
  locales: { _default: { path: `content/${collectionName ?? 'posts'}/${subPath}.md` } },
  ...(collectionName ? { workflow: { collectionName } } : {}),
});

describe('countQuotaEntries()', () => {
  beforeEach(() => {
    unpublishedEntries.current = [];
  });

  test('counts the published entries', () => {
    vi.mocked(getEntriesByCollection).mockReturnValue([createEntry('a'), createEntry('b')]);

    expect(countQuotaEntries('posts')).toBe(2);
    expect(getEntriesByCollection).toHaveBeenCalledWith('posts');
  });

  test('counts a never-published draft, but an updated entry only once', () => {
    vi.mocked(getEntriesByCollection).mockReturnValue([createEntry('a'), createEntry('b')]);
    unpublishedEntries.current = /** @type {any[]} */ ([
      createEntry('a', 'posts'),
      createEntry('new', 'posts'),
      createEntry('other', 'pages'),
    ]);

    expect(countQuotaEntries('posts')).toBe(3);
  });

  test('leaves the counting to countCollectionEntries()', () => {
    vi.mocked(getEntriesByCollection).mockReturnValue([createEntry('a')]);
    vi.mocked(countCollectionEntries).mockReturnValueOnce(0);

    expect(countQuotaEntries('posts')).toBe(0);
    expect(countCollectionEntries).toHaveBeenCalledWith('posts', [createEntry('a')]);
  });
});
