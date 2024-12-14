import { derived, writable } from 'svelte/store';
import { allAssets } from '$lib/services/assets';
import { allEntries } from '$lib/services/contents';
import { getCollectionsByEntry } from '$lib/services/contents/collection';
import { getFilesByEntry } from '$lib/services/contents/collection/files';

/**
 * @type {import('svelte/store').Writable<string>}
 */
export const searchTerms = writable('');

/**
 * Normalize the given string for search value comparison. Since `transliterate` is slow, we only
 * apply basic normalization.
 * @param {string} value - Original value.
 * @returns {string} Normalized value.
 */
export const normalize = (value) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();

/**
 * Hold search results for the current search terms.
 * @type {import('svelte/store').Readable<{ entries: Entry[], assets: Asset[] }>}
 * @todo Make this smarter (prioritize titles; count the number of appearance; split words;
 * search relation fields; add snippets).
 */
export const searchResults = derived(
  [allEntries, allAssets, searchTerms],
  ([_allEntries, _allAssets, _searchTerms], set) => {
    const terms = _searchTerms ? normalize(_searchTerms) : '';
    /**
     * Check if the given label matches the search terms.
     * @param {string} label - Label.
     * @returns {boolean} Result.
     */
    const hasMatch = (label) => normalize(label).includes(terms);

    const entries = (() => {
      if (!_allEntries?.length || !terms) {
        return [];
      }

      return _allEntries.filter((entry) =>
        getCollectionsByEntry(entry).some(
          (collection) =>
            hasMatch(collection.label || collection.name) ||
            getFilesByEntry(collection, entry).some((file) => hasMatch(file.label || file.name)) ||
            Object.values(entry.locales).some(({ content }) =>
              Object.values(content).some(
                (value) => typeof value === 'string' && !!value && hasMatch(value),
              ),
            ),
        ),
      );
    })();

    const assets = (() => {
      if (!_allAssets?.length || !terms) {
        return [];
      }

      return _allAssets.filter((asset) => normalize(asset.name).includes(terms));
    })();

    set({ entries, assets });
  },
);
