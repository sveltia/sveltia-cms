import { publishedAssets } from '$lib/services/assets';
import { searchTerms } from '$lib/services/search';
import { hasAllMatches, tokenize } from '$lib/services/search/util';
import { createDerivedState } from '$lib/services/utils/state.svelte';

/**
 * @import { Asset } from '$lib/types/private';
 * @import { NormalizedValueCache } from '$lib/services/search/util';
 */

/**
 * Search assets based on the given search terms. The terms are split into words, and an asset is
 * listed when its name contains all of them in any order, so the query “annual report cover”
 * matches a file named `annual-report-cover-photo.png`. This is the same rule as the asset picker
 * dialog applies.
 * @param {object} args Arguments.
 * @param {Asset[]} args.assets All assets to search in.
 * @param {string} args.terms Search terms.
 * @returns {Asset[]} Search results.
 */
export const searchAssets = ({ assets, terms }) => {
  const tokens = tokenize(terms);

  if (!assets.length || !tokens.length) {
    return [];
  }

  /** @type {NormalizedValueCache} */
  const normalizedValueCache = new Map();

  return assets.filter((asset) =>
    hasAllMatches({ value: asset.name, tokens, normalizedValueCache }),
  );
};

/**
 * Hold asset search results for the current search terms.
 */
export const assetSearchResults = createDerivedState(() =>
  searchAssets({ assets: publishedAssets.current, terms: searchTerms.current }),
);
