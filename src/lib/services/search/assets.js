import { publishedAssets } from '$lib/services/assets';
import { searchTerms } from '$lib/services/search';
import { hasMatch, normalize } from '$lib/services/search/util';
import { createDerivedState } from '$lib/services/utils/state.svelte';

/**
 * @import { Asset } from '$lib/types/private';
 * @import { NormalizedValueCache } from '$lib/services/search/util';
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

  /** @type {NormalizedValueCache} */
  const normalizedValueCache = new Map();

  return assets.filter((asset) => hasMatch({ value: asset.name, terms, normalizedValueCache }));
};

/**
 * Hold asset search results for the current search terms.
 */
export const assetSearchResults = createDerivedState(() =>
  searchAssets({ assets: publishedAssets.current, terms: searchTerms.current }),
);
