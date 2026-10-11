import { goBack, goto, parseLocation } from '$lib/services/app/navigation';
import { searchMode, searchTerms } from '$lib/services/search';
import { isSearchResultsPath } from '$lib/services/search/navigation';

/**
 * Path of the page the current search has started from, e.g. an asset folder or a collection, to
 * go back to once the search terms are cleared. `undefined` if the search results page has been
 * opened directly, e.g. by reloading it.
 * @type {string | undefined}
 */
let originPath = undefined;

/**
 * Update the search terms typed in the quick search bar. Navigate to the search results page if
 * any terms are given, or back to the page the search has started from if they’re cleared.
 * @param {string} terms New search terms.
 */
export const updateSearchTerms = (terms) => {
  const hadTerms = !!searchTerms.current;
  const { path } = parseLocation();
  const searching = isSearchResultsPath(path);

  searchTerms.current = terms;

  if (terms) {
    if (!searching) {
      originPath = path;
    }

    // Encode the terms, or a `?` or `#` would cut them short in the URL, and a stray `%` would make
    // the path impossible to decode
    goto(`/search/${encodeURIComponent(terms)}`, { replaceState: searching });
  } else if (hadTerms && searching) {
    // Without a known origin, go to the library being searched
    goBack(originPath ?? (searchMode.current === 'assets' ? '/assets' : '/collections'));
    originPath = undefined;
  }
};

/**
 * Forget the current search once the search results have been left for another page, e.g. with the
 * browser’s Back button, so the search bar doesn’t keep showing terms that no longer apply. The
 * search is kept while an entry or an asset opened from the results is shown, as the user goes
 * back to the results from there. Call this whenever the URL hash changes.
 */
export const resetSearchAfterLeaving = () => {
  if (isSearchResultsPath(parseLocation().path)) {
    return;
  }

  /** @type {string | undefined} */
  const from = window.history.state?.from;

  if (from && isSearchResultsPath(parseLocation(from).path)) {
    return;
  }

  originPath = undefined;

  if (searchTerms.current) {
    searchTerms.current = '';
  }
};
