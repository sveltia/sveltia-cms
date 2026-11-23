import { beforeEach, describe, expect, test, vi } from 'vitest';

import { additionsComments } from '$lib/services/additions/comments.svelte';
import { getConversationAliasKeys } from '$lib/services/additions/conversation-aliases';
import { getEarlierEntryPaths } from '$lib/services/contents/entry/earlier-paths';

vi.mock('$lib/services/additions/comments.svelte', () => ({
  additionsComments: { counts: {}, versions: {} },
}));
vi.mock('$lib/services/contents/entry/earlier-paths', () => ({ getEarlierEntryPaths: vi.fn() }));

/** @type {any} */
const DRAFT = {
  isNew: false,
  collectionName: 'posts',
  collection: { name: 'posts' },
  fields: [],
  originalEntry: { subPath: 'hi', locales: {} },
};

beforeEach(() => {
  additionsComments.counts = { 'posts/hello': 2, 'posts/hey': 0 };
  vi.mocked(getEarlierEntryPaths).mockReturnValue([
    { subPath: 'hello', paths: ['content/posts/hello.md'] },
    { subPath: 'hey', paths: ['content/posts/hey.md'] },
  ]);
});

describe('getConversationAliasKeys', () => {
  test('gives the earlier keys of the entry that have comments', () => {
    expect(getConversationAliasKeys(DRAFT)).toEqual(['posts/hello']);
    expect(getEarlierEntryPaths).toHaveBeenCalledWith({
      collection: DRAFT.collection,
      fields: DRAFT.fields,
      entry: DRAFT.originalEntry,
    });
  });

  test('has nothing for a new entry, or no draft', () => {
    expect(getConversationAliasKeys({ ...DRAFT, isNew: true })).toEqual([]);
    expect(getConversationAliasKeys(undefined)).toEqual([]);
  });
});
