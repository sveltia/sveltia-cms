import { get } from 'svelte/store';

import { searchMode, searchTerms } from '$lib/services/search';

const ROUTE_REGEX = /^\/search\/(?<terms>.+)$/;

/**
 * Navigate to the search results page with the given path. The path should be in the format of
 * `/search/{terms}`.
 * @param {string} path Path to navigate to.
 * @returns {boolean} Whether the path is a search route.
 */
export const isSearchRoute = (path) => {
  const searchMatch = path.match(ROUTE_REGEX);

  if (searchMatch?.groups) {
    const { terms } = searchMatch.groups;

    if (terms && terms !== get(searchTerms)) {
      searchTerms.set(terms);
    }

    if (!get(searchMode)) {
      searchMode.set('contents');
    }

    return true;
  }

  return false; // Not a search route
};
