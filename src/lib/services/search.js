import { derived, writable } from 'svelte/store';
import { allAssets } from '$lib/services/assets';
import { allEntries, getCollection } from '$lib/services/contents';

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
const normalize = (value) =>
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
    const entries = (() => {
      if (!_allEntries?.length || !terms) {
        return [];
      }

      return _allEntries.filter(({ collectionName, fileName, locales }) => {
        const collection = getCollection(collectionName);
        const label = fileName
          ? collection?._fileMap?.[fileName]?.label || fileName
          : collection?.label || collectionName;

        if (normalize(label).includes(terms)) {
          return true;
        }

        return Object.values(locales).some(({ content }) =>
          Object.values(content).some(
            (value) => typeof value === 'string' && !!value && normalize(value).includes(terms),
          ),
        );
      });
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
