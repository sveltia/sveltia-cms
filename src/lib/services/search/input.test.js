import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { goBack, goto, parseLocation } from '$lib/services/app/navigation';
import { searchMode, searchTerms } from '$lib/services/search';

import { resetSearchAfterLeaving, updateSearchTerms } from './input';

vi.mock('$lib/services/app/navigation', () => ({
  goBack: vi.fn(),
  goto: vi.fn(),
  parseLocation: vi.fn(),
}));

/**
 * Set the current URL path.
 * @param {string} path Path.
 */
const setPath = (path) => {
  vi.mocked(parseLocation).mockReturnValue({ path, params: {} });
};

/**
 * Type the given terms in the search bar, from the given page.
 * @param {string} path Path of the current page.
 * @param {string} terms Search terms.
 */
const type = (path, terms) => {
  setPath(path);
  updateSearchTerms(terms);
};

describe('updateSearchTerms', () => {
  beforeEach(() => {
    searchMode.current = 'contents';
    searchTerms.current = '';
    // Forget the origin of a search left by the previous test
    type('/search/x', 'x');
    type('/search/x', '');
    vi.clearAllMocks();
  });

  test('opens the search results, then replaces them as the terms change', () => {
    type('/collections/posts', 'hello world');
    expect(searchTerms.current).toBe('hello world');
    expect(goto).toHaveBeenCalledWith('/search/hello%20world', { replaceState: false });

    type('/search/hello world', 'hello?');
    expect(goto).toHaveBeenLastCalledWith('/search/hello%3F', { replaceState: true });
  });

  test('goes back to the page the search has started from when cleared', () => {
    type('/collections/posts/filter/2026', 'hello');
    type('/search/hello', 'hello there');
    type('/search/hello there', '');
    expect(searchTerms.current).toBe('');
    expect(goBack).toHaveBeenCalledExactlyOnceWith('/collections/posts/filter/2026');

    // The origin is forgotten once used
    searchMode.current = 'assets';
    searchTerms.current = 'photo';
    type('/search/photo', '');
    expect(goBack).toHaveBeenLastCalledWith('/assets');
  });

  test('goes back to the empty search page the search has started from on a small screen', () => {
    type('/search', 'hello');
    expect(goto).toHaveBeenCalledWith('/search/hello', { replaceState: false });
    type('/search/hello', '');
    expect(goBack).toHaveBeenCalledWith('/search');
  });

  test('goes to the library being searched without a known origin', () => {
    searchTerms.current = 'hello';
    type('/search/hello', '');
    expect(goBack).toHaveBeenCalledWith('/collections');
  });

  test('stays on the page if there were no terms, or the search results aren’t shown', () => {
    type('/search/hello', '');
    searchTerms.current = 'hello';
    type('/assets', '');
    expect(searchTerms.current).toBe('');
    expect(goBack).not.toHaveBeenCalled();
    expect(goto).not.toHaveBeenCalled();
  });
});

describe('resetSearchAfterLeaving', () => {
  /**
   * Show the given page, as if it had been reached from the given one.
   * @param {string} path Path of the page.
   * @param {string} [fromPath] Path of the previous page, if any.
   */
  const visit = (path, fromPath) => {
    vi.mocked(parseLocation).mockImplementation((href) => ({
      path: href ? new URL(href).hash.slice(1) : path,
      params: {},
    }));
    vi.stubGlobal('window', {
      history: { state: fromPath ? { from: `https://example.com/#${fromPath}` } : null },
    });
  };

  beforeEach(() => {
    searchMode.current = 'contents';
    searchTerms.current = '';
    type('/search/x', 'x');
    type('/search/x', '');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('clears the search once the results have been left, e.g. with the Back button', () => {
    type('/collections/posts', 'hello');
    expect(searchTerms.current).toBe('hello');

    visit('/search/hello', '/collections/posts');
    resetSearchAfterLeaving();
    expect(searchTerms.current).toBe('hello');

    visit('/collections/posts');
    resetSearchAfterLeaving();
    expect(searchTerms.current).toBe('');

    // The page the search has started from is forgotten as well
    searchTerms.current = 'hello';
    type('/search/hello', '');
    expect(goBack).toHaveBeenCalledWith('/collections');
  });

  test('keeps the search while a result opened from the results is shown', () => {
    searchTerms.current = 'hello';
    visit('/collections/posts/entries/hello', '/search/hello');
    resetSearchAfterLeaving();
    expect(searchTerms.current).toBe('hello');

    // But not an entry opened from elsewhere
    visit('/collections/posts/entries/hello', '/collections/posts');
    resetSearchAfterLeaving();
    expect(searchTerms.current).toBe('');

    // Nothing to clear the next time
    resetSearchAfterLeaving();
    expect(searchTerms.current).toBe('');
  });
});
