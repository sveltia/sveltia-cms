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

// Only the store is mocked; `mergeUnpublishedEntries` is a pure helper and is used as is, and so
// is `getCompanionEntries`, pointed at the store mocked here
vi.mock('$lib/services/workflow', async (importOriginal) => {
  const original = /** @type {any} */ (await importOriginal());
  const store = { current: [] };

  return {
    ...original,
    getCompanionEntries: vi.fn((collectionName) =>
      original.getCompanionEntries(collectionName, store.current),
    ),
    unpublishedEntries: store,
  };
});

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

  test('counts a new entry riding along in the pull request of another collection’s entry', () => {
    vi.mocked(getEntriesByCollection).mockReturnValue([createEntry('a')]);
    unpublishedEntries.current = /** @type {any[]} */ ([
      {
        ...createEntry('hello', 'pages'),
        workflow: {
          collectionName: 'pages',
          companions: [
            { collectionName: 'posts', entry: createEntry('new') },
            { collectionName: 'tags', entry: createEntry('news') },
          ],
        },
      },
    ]);

    expect(countQuotaEntries('posts')).toBe(2);
  });

  test('leaves the counting to countCollectionEntries()', () => {
    vi.mocked(getEntriesByCollection).mockReturnValue([createEntry('a')]);
    vi.mocked(countCollectionEntries).mockReturnValueOnce(0);

    expect(countQuotaEntries('posts')).toBe(0);
    expect(countCollectionEntries).toHaveBeenCalledWith('posts', [createEntry('a')]);
  });
});
