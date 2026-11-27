import { searchMode, searchTerms } from '$lib/services/search';

const ROUTE_REGEX = /^\/search\/(?<terms>.+)$/;

/**
 * Check if the given URL path is the search results page, without navigating to it.
 * @param {string} path URL path.
 * @returns {boolean} Result.
 */
export const isSearchResultsPath = (path) => ROUTE_REGEX.test(path);

/**
 * Navigate to the search results page with the given path. The path should be in the format of
 * `/search/{terms}`.
 * @param {string} path Path to navigate to.
 * @returns {boolean} Whether the path is a search route.
 */
export const isSearchRoute = (path) => {
  const { groups } = path.match(ROUTE_REGEX) ?? {};

  if (!groups) {
    // Not a search route
    return false;
  }

  const { terms } = groups;

  if (terms && terms !== searchTerms.current) {
    searchTerms.current = terms;
  }

  if (!searchMode.current) {
    searchMode.current = 'contents';
  }

  return true;
};

/**
 * Get the path of the library being searched: the Asset Library or the Content Library. The search
 * results page goes back there with the Back button on small screens, or when the search terms are
 * cleared and the page the search started from isn’t known.
 * @returns {string} Path, `/assets` or `/collections`.
 */
export const getSearchedLibraryPath = () =>
  searchMode.current === 'assets' ? '/assets' : '/collections';
