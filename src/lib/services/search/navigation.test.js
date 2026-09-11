import { beforeEach, describe, expect, it, vi } from 'vitest';

import { searchMode, searchTerms } from '$lib/services/search';

import { isSearchRoute } from './navigation';

describe('isSearchRoute', () => {
  beforeEach(() => {
    // Reset stores to initial state before each test
    searchMode.current = null;
    searchTerms.current = '';
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
      expect(searchTerms.current).toBe('hello');
    });

    it('should decode URL-encoded search terms', () => {
      isSearchRoute('/search/hello%20world');

      expect(searchTerms.current).toBe('hello%20world');
    });

    it('should not update searchTerms if they are already set to the same value', () => {
      searchTerms.current = 'hello';

      const setter = vi.spyOn(searchTerms, 'current', 'set');

      isSearchRoute('/search/hello');

      expect(setter).not.toHaveBeenCalled();
      expect(searchTerms.current).toBe('hello');

      setter.mockRestore();
    });

    it('should update searchTerms when navigating to a search route with different terms', () => {
      searchTerms.current = 'old';

      isSearchRoute('/search/new');

      expect(searchTerms.current).toBe('new');
    });

    it('should preserve empty string if route has no terms after /search/', () => {
      searchTerms.current = 'previous';

      const result = isSearchRoute('/search/');

      expect(result).toBe(false);
      expect(searchTerms.current).toBe('previous');
    });
  });

  describe('store updates - searchMode', () => {
    it('should set searchMode to "contents" when currently null', () => {
      expect(searchMode.current).toBe(null);

      isSearchRoute('/search/test');

      expect(searchMode.current).toBe('contents');
    });

    it('should not override existing searchMode if already set', () => {
      searchMode.current = 'assets';

      isSearchRoute('/search/test');

      expect(searchMode.current).toBe('assets');
    });

    it('should set searchMode to "contents" even if searchTerms are not updated', () => {
      searchTerms.current = 'test';
      searchMode.current = null;

      isSearchRoute('/search/test');

      expect(searchMode.current).toBe('contents');
    });

    it('should maintain searchMode if it is already set to "contents"', () => {
      searchMode.current = 'contents';

      isSearchRoute('/search/new-terms');

      expect(searchMode.current).toBe('contents');
    });
  });

  describe('combined store behavior', () => {
    it('should update both stores when navigating to a new search route', () => {
      isSearchRoute('/search/query');

      expect(searchTerms.current).toBe('query');
      expect(searchMode.current).toBe('contents');
    });

    it('should handle multiple consecutive searches with different terms', () => {
      isSearchRoute('/search/first');
      expect(searchTerms.current).toBe('first');
      expect(searchMode.current).toBe('contents');

      isSearchRoute('/search/second');
      expect(searchTerms.current).toBe('second');
      expect(searchMode.current).toBe('contents');

      isSearchRoute('/search/third');
      expect(searchTerms.current).toBe('third');
      expect(searchMode.current).toBe('contents');
    });

    it('should handle switching between different search modes', () => {
      isSearchRoute('/search/results1');
      expect(searchMode.current).toBe('contents');

      searchMode.current = 'assets';
      isSearchRoute('/search/results2');
      expect(searchMode.current).toBe('assets');
    });
  });

  describe('edge cases', () => {
    it('should handle very long search terms', () => {
      const longTerm = 'a'.repeat(1000);

      isSearchRoute(`/search/${longTerm}`);

      expect(searchTerms.current).toBe(longTerm);
    });

    it('should handle search terms with Unicode characters', () => {
      isSearchRoute('/search/café');

      expect(searchTerms.current).toBe('café');
    });

    it('should handle search terms with slashes encoded as %2F', () => {
      isSearchRoute('/search/path%2Fto%2Ffile');

      expect(searchTerms.current).toBe('path%2Fto%2Ffile');
    });

    it('should handle search terms with query-like patterns', () => {
      isSearchRoute('/search/key=value&other=test');

      expect(searchTerms.current).toBe('key=value&other=test');
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
      searchMode.current = 'assets';
      searchTerms.current = 'existing';

      expect(isSearchRoute('/search/new')).toBe(true);
      expect(isSearchRoute('/contents')).toBe(false);
    });
  });
});
