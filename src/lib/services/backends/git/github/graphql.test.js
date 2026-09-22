import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  buildAliasedQuery,
  fetchAliasedBatch,
  splitIntoChunks,
} from '$lib/services/backends/git/github/graphql';
import { fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { MAX_CONCURRENT_REQUESTS } from '$lib/services/backends/git/shared/concurrency';

vi.mock('$lib/services/backends/git/shared/api');

/**
 * Answer a query with the aliases it asks for, as the API does, using the item index as the value.
 * @param {string} query GraphQL query.
 * @returns {Promise<any>} Response data.
 */
const answerAliases = async (query) => ({
  repository: Object.fromEntries(
    [...query.matchAll(/item_(\d+):/g)].map(([, i]) => [`item_${i}`, { value: Number(i) }]),
  ),
});

/**
 * Build a field selection for the given item.
 * @param {any} item Item.
 * @returns {string} Field selection.
 */
const getFragment = (item) => `object(oid: "${item}") { id }`;
/**
 * Build a field selection for the given item, or none for an item named `skip`.
 * @param {string} item Item.
 * @returns {string} Field selection.
 */
const getFragmentUnlessSkipped = (item) => (item === 'skip' ? '' : getFragment(item));

describe('GitHub GraphQL helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('splitIntoChunks', () => {
    test('splits a list into chunks of the given size', () => {
      expect(splitIntoChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(splitIntoChunks([1, 2], 2)).toEqual([[1, 2]]);
      expect(splitIntoChunks([], 2)).toEqual([]);
    });
  });

  describe('buildAliasedQuery', () => {
    test('aliases each fragment with its item index', () => {
      const query = buildAliasedQuery(
        [
          { index: 3, fragment: 'object(oid: "a") { id }' },
          { index: 7, fragment: 'object(oid: "b") { id }' },
        ],
        'commit',
      );

      expect(query).toContain('query($owner: String!, $repo: String!) {');
      expect(query).toContain('repository(owner: $owner, name: $repo)');
      expect(query).toContain('commit_3: object(oid: "a") { id }');
      expect(query).toContain('commit_7: object(oid: "b") { id }');
    });

    test('declares the branch variable only when asked to', () => {
      const query = buildAliasedQuery(
        [{ index: 0, fragment: 'ref(qualifiedName: $branch) { name }' }],
        'ref',
        { useBranch: true },
      );

      expect(query).toContain('query($owner: String!, $repo: String!, $branch: String!) {');
    });

    test('doesn’t declare the branch variable for a path containing the same text', () => {
      // A branch variable declared but not used would make the API reject the query
      const query = buildAliasedQuery(
        [{ index: 0, fragment: 'object(expression: "main:posts/$branch-notes.md") { id }' }],
        'file',
      );

      expect(query).toContain('query($owner: String!, $repo: String!) {');
    });
  });

  describe('fetchAliasedBatch', () => {
    test('returns the result of each item in the input order', async () => {
      vi.mocked(fetchGraphQL).mockImplementation(answerAliases);

      const results = await fetchAliasedBatch({
        items: ['a', 'b', 'c'],
        alias: 'item',
        getFragment,
        chunkSize: 10,
      });

      expect(fetchGraphQL).toHaveBeenCalledOnce();
      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('item_2: object(oid: "c") { id }'),
        {},
      );
      expect(results).toEqual([{ value: 0 }, { value: 1 }, { value: 2 }]);
    });

    test('splits the items into chunks, keeping at most a few requests in flight', async () => {
      let inFlight = 0;
      let peak = 0;

      vi.mocked(fetchGraphQL).mockImplementation(async (query) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
        inFlight -= 1;

        return answerAliases(query);
      });

      const items = Array.from({ length: 25 }, (_, i) => i);

      const results = await fetchAliasedBatch({
        items,
        alias: 'item',
        getFragment,
        chunkSize: 2,
      });

      // 25 items / 2 per chunk = 13 requests
      expect(fetchGraphQL).toHaveBeenCalledTimes(13);
      expect(peak).toBe(MAX_CONCURRENT_REQUESTS);
      expect(results).toEqual(items.map((i) => ({ value: i })));
    });

    test('leaves out an item without a fragment', async () => {
      vi.mocked(fetchGraphQL).mockImplementation(answerAliases);

      const results = await fetchAliasedBatch({
        items: ['skip', 'a', 'skip', 'skip', 'b'],
        alias: 'item',
        getFragment: getFragmentUnlessSkipped,
        chunkSize: 1,
      });

      // Skipped items don’t take up a chunk
      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
      expect(results).toEqual([undefined, { value: 1 }, undefined, undefined, { value: 4 }]);
    });

    test('sends nothing for an empty list', async () => {
      expect(
        await fetchAliasedBatch({ items: [], alias: 'item', getFragment: String, chunkSize: 5 }),
      ).toEqual([]);
      expect(fetchGraphQL).not.toHaveBeenCalled();
    });

    test('passes a copy of the given variables with each request', async () => {
      const variables = { owner: 'fork-owner', repo: 'fork-repo' };

      vi.mocked(fetchGraphQL).mockImplementation(async (_query, vars) => {
        // `fetchGraphQL` adds the common variables to the given object
        Object.assign(/** @type {any} */ (vars), { branch: 'main' });

        return {};
      });

      await fetchAliasedBatch({
        items: ['a', 'b'],
        alias: 'item',
        getFragment,
        chunkSize: 1,
        variables,
      });

      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
      expect(vi.mocked(fetchGraphQL).mock.calls[0][1]).not.toBe(variables);
      expect(variables).toEqual({ owner: 'fork-owner', repo: 'fork-repo' });
    });

    test('returns undefined for an item missing from the response', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValueOnce({ repository: null });
      vi.mocked(fetchGraphQL).mockResolvedValueOnce(/** @type {any} */ (undefined));

      const results = await fetchAliasedBatch({
        items: ['a', 'b'],
        alias: 'item',
        getFragment,
        chunkSize: 1,
      });

      expect(results).toEqual([undefined, undefined]);
    });

    test('rejects when a request fails', async () => {
      vi.mocked(fetchGraphQL).mockRejectedValue(new Error('Bad credentials'));

      await expect(
        fetchAliasedBatch({
          items: ['a'],
          alias: 'item',
          getFragment,
          chunkSize: 1,
        }),
      ).rejects.toThrow('Bad credentials');
    });
  });
});
