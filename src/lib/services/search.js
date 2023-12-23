import { flatten } from 'flat';
import { derived, writable } from 'svelte/store';
import { allAssets } from '$lib/services/assets';
import { allEntries } from '$lib/services/contents';

/**
 * @type {import('svelte/store').Writable<string>}
 */
export const searchTerms = writable('');

/**
 * Hold search results for the current search terms.
 * @type {import('svelte/store').Readable<{ entries: Entry[], assets: Asset[] }>}
 * @todo Make this smarter (prioritize titles; count the number of appearance; split words;
 * search relation fields; add snippets).
 */
export const searchResults = derived(
  [allEntries, allAssets, searchTerms],
  ([_allEntries, _allAssets, _searchTerms], set) => {
    const entries =
      _allEntries?.length && _searchTerms
        ? _allEntries.filter((entry) =>
            Object.values(flatten(entry)).some(
              (value) =>
                typeof value === 'string' &&
                value.toLowerCase().includes(_searchTerms.toLowerCase()),
            ),
          )
        : [];

    const assets =
      _allAssets?.length && _searchTerms
        ? _allAssets.filter((asset) =>
            asset.name.toLowerCase().includes(_searchTerms.toLowerCase()),
          )
        : [];

    set({ entries, assets });
  },
);
