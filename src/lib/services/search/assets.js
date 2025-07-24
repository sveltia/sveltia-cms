import { derived } from 'svelte/store';
import { allAssets } from '$lib/services/assets';
import { searchTerms } from '$lib/services/search';
import { hasMatch, normalize } from '$lib/services/search/util';

/**
 * @import { Readable } from 'svelte/store';
 * @import { Asset } from '$lib/types/private';
 */

/**
 * Search assets based on the given search terms.
 * @param {object} args Arguments.
 * @param {Asset[]} args.assets All assets to search in.
 * @param {string} args.terms Search terms.
 * @returns {Asset[]} Search results.
 */
export const searchAssets = ({ assets, terms }) => {
  terms = normalize(terms);

  if (!assets.length || !terms) {
    return [];
  }

  return assets.filter((asset) => hasMatch({ value: asset.name, terms }));
};

/**
 * Hold asset search results for the current search terms.
 * @type {Readable<Asset[]>}
 */
export const assetSearchResults = derived([allAssets, searchTerms], ([assets, terms]) =>
  searchAssets({ assets, terms }),
);
