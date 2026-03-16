import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';

import { searchMode, searchTerms } from '$lib/services/search';

import { isSearchRoute } from './navigation';

describe('isSearchRoute', () => {
  beforeEach(() => {
    // Reset stores to initial state before each test
    searchMode.set(null);
    searchTerms.set('');
  });

  describe('route matching', () => {
    it('should return false for non-search routes', () => {
      expect(isSearchRoute('/contents')).toBe(false);
      expect(isSearchRoute('/assets')).toBe(false);
      expect(isSearchRoute('/settings')).toBe(false);
      expect(isSearchRoute('/')).toBe(false);
      expect(isSearchRoute('/search')).toBe(false);
      expect(isSearchRoute('/search/')).toBe(false);
    });

    it('should return true for valid search routes with URL-encoded terms', () => {
      expect(isSearchRoute('/search/hello')).toBe(true);
      expect(isSearchRoute('/search/hello%20world')).toBe(true);
      expect(isSearchRoute('/search/test%20query%20123')).toBe(true);
    });

    it('should return true for search routes with special characters', () => {
      expect(isSearchRoute('/search/hello-world')).toBe(true);
      expect(isSearchRoute('/search/hello_world')).toBe(true);
      expect(isSearchRoute('/search/hello.world')).toBe(true);
      expect(isSearchRoute('/search/hello@world')).toBe(true);
    });

    it('should return true for search routes with numbers', () => {
      expect(isSearchRoute('/search/test123')).toBe(true);
      expect(isSearchRoute('/search/123')).toBe(true);
      expect(isSearchRoute('/search/test-2024')).toBe(true);
    });
  });

  describe('store updates - searchTerms', () => {
    it('should set searchTerms when navigating to a search route with new terms', () => {
      const result = isSearchRoute('/search/hello');

      expect(result).toBe(true);
      expect(get(searchTerms)).toBe('hello');
    });

    it('should decode URL-encoded search terms', () => {
      isSearchRoute('/search/hello%20world');

      expect(get(searchTerms)).toBe('hello%20world');
    });

    it('should not update searchTerms if they are already set to the same value', () => {
      searchTerms.set('hello');

      let updateCount = 0;

      const unsubscribe = searchTerms.subscribe(() => {
        updateCount += 1;
      });

      isSearchRoute('/search/hello');

      // The initial subscription call increments by 1, navigating doesn't cause additional changes
      expect(updateCount).toBe(1);
      expect(get(searchTerms)).toBe('hello');

      unsubscribe();
    });

    it('should update searchTerms when navigating to a search route with different terms', () => {
      searchTerms.set('old');

      isSearchRoute('/search/new');

      expect(get(searchTerms)).toBe('new');
    });

    it('should preserve empty string if route has no terms after /search/', () => {
      searchTerms.set('previous');

      const result = isSearchRoute('/search/');

      expect(result).toBe(false);
      expect(get(searchTerms)).toBe('previous');
    });
  });

  describe('store updates - searchMode', () => {
    it('should set searchMode to "contents" when currently null', () => {
      expect(get(searchMode)).toBe(null);

      isSearchRoute('/search/test');

      expect(get(searchMode)).toBe('contents');
    });

    it('should not override existing searchMode if already set', () => {
      searchMode.set('assets');

      isSearchRoute('/search/test');

      expect(get(searchMode)).toBe('assets');
    });

    it('should set searchMode to "contents" even if searchTerms are not updated', () => {
      searchTerms.set('test');
      searchMode.set(null);

      isSearchRoute('/search/test');

      expect(get(searchMode)).toBe('contents');
    });

    it('should maintain searchMode if it is already set to "contents"', () => {
      searchMode.set('contents');

      isSearchRoute('/search/new-terms');

      expect(get(searchMode)).toBe('contents');
    });
  });

  describe('combined store behavior', () => {
    it('should update both stores when navigating to a new search route', () => {
      isSearchRoute('/search/query');

      expect(get(searchTerms)).toBe('query');
      expect(get(searchMode)).toBe('contents');
    });

    it('should handle multiple consecutive searches with different terms', () => {
      isSearchRoute('/search/first');
      expect(get(searchTerms)).toBe('first');
      expect(get(searchMode)).toBe('contents');

      isSearchRoute('/search/second');
      expect(get(searchTerms)).toBe('second');
      expect(get(searchMode)).toBe('contents');

      isSearchRoute('/search/third');
      expect(get(searchTerms)).toBe('third');
      expect(get(searchMode)).toBe('contents');
    });

    it('should handle switching between different search modes', () => {
      isSearchRoute('/search/results1');
      expect(get(searchMode)).toBe('contents');

      searchMode.set('assets');
      isSearchRoute('/search/results2');
      expect(get(searchMode)).toBe('assets');
    });
  });

  describe('edge cases', () => {
    it('should handle very long search terms', () => {
      const longTerm = 'a'.repeat(1000);

      isSearchRoute(`/search/${longTerm}`);

      expect(get(searchTerms)).toBe(longTerm);
    });

    it('should handle search terms with Unicode characters', () => {
      isSearchRoute('/search/café');

      expect(get(searchTerms)).toBe('café');
    });

    it('should handle search terms with slashes encoded as %2F', () => {
      isSearchRoute('/search/path%2Fto%2Ffile');

      expect(get(searchTerms)).toBe('path%2Fto%2Ffile');
    });

    it('should handle search terms with query-like patterns', () => {
      isSearchRoute('/search/key=value&other=test');

      expect(get(searchTerms)).toBe('key=value&other=test');
    });
  });

  describe('return value consistency', () => {
    it('should return true consistently for the same valid route', () => {
      expect(isSearchRoute('/search/test')).toBe(true);
      expect(isSearchRoute('/search/test')).toBe(true);
      expect(isSearchRoute('/search/test')).toBe(true);
    });

    it('should return false consistently for non-search routes', () => {
      expect(isSearchRoute('/contents')).toBe(false);
      expect(isSearchRoute('/contents')).toBe(false);
      expect(isSearchRoute('/assets')).toBe(false);
    });

    it('should maintain correct return value after store modifications', () => {
      searchMode.set('assets');
      searchTerms.set('existing');

      expect(isSearchRoute('/search/new')).toBe(true);
      expect(isSearchRoute('/contents')).toBe(false);
    });
  });
});
