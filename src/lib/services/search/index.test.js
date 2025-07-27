import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';

import { searchMode, searchTerms } from './index';

describe('search stores', () => {
  beforeEach(() => {
    // Reset stores to initial state
    searchMode.set(null);
    searchTerms.set('');
  });

  describe('searchMode', () => {
    it('should initialize with null value', () => {
      expect(get(searchMode)).toBe(null);
    });

    it('should accept "entries" mode', () => {
      searchMode.set('entries');

      expect(get(searchMode)).toBe('entries');
    });

    it('should accept "assets" mode', () => {
      searchMode.set('assets');

      expect(get(searchMode)).toBe('assets');
    });

    it('should accept null to reset mode', () => {
      searchMode.set('entries');
      searchMode.set(null);

      expect(get(searchMode)).toBe(null);
    });

    it('should notify subscribers when value changes', () => {
      let notifiedValue = null;

      const unsubscribe = searchMode.subscribe((value) => {
        notifiedValue = value;
      });

      searchMode.set('assets');

      expect(notifiedValue).toBe('assets');

      unsubscribe();
    });
  });

  describe('searchTerms', () => {
    it('should initialize with empty string', () => {
      expect(get(searchTerms)).toBe('');
    });

    it('should store search terms', () => {
      searchTerms.set('test query');

      expect(get(searchTerms)).toBe('test query');
    });

    it('should handle empty search terms', () => {
      searchTerms.set('test');
      searchTerms.set('');

      expect(get(searchTerms)).toBe('');
    });

    it('should handle whitespace in search terms', () => {
      searchTerms.set('  search with spaces  ');

      expect(get(searchTerms)).toBe('  search with spaces  ');
    });

    it('should handle special characters in search terms', () => {
      const specialTerms = 'test@example.com & "quotes" + symbols';

      searchTerms.set(specialTerms);

      expect(get(searchTerms)).toBe(specialTerms);
    });

    it('should handle unicode characters in search terms', () => {
      const unicodeTerms = 'café naïve résumé 测试';

      searchTerms.set(unicodeTerms);

      expect(get(searchTerms)).toBe(unicodeTerms);
    });

    it('should notify subscribers when value changes', () => {
      let notifiedValue = null;

      const unsubscribe = searchTerms.subscribe((value) => {
        notifiedValue = value;
      });

      searchTerms.set('new search');

      expect(notifiedValue).toBe('new search');

      unsubscribe();
    });

    it('should maintain independent state from searchMode', () => {
      searchMode.set('entries');
      searchTerms.set('test search');

      expect(get(searchMode)).toBe('entries');
      expect(get(searchTerms)).toBe('test search');

      searchMode.set('assets');

      expect(get(searchMode)).toBe('assets');
      expect(get(searchTerms)).toBe('test search'); // Should remain unchanged
    });
  });

  describe('store interactions', () => {
    it('should allow both stores to be updated independently', () => {
      searchMode.set('entries');
      searchTerms.set('first search');

      expect(get(searchMode)).toBe('entries');
      expect(get(searchTerms)).toBe('first search');

      searchTerms.set('second search');

      expect(get(searchMode)).toBe('entries'); // Should remain unchanged
      expect(get(searchTerms)).toBe('second search');

      searchMode.set('assets');

      expect(get(searchMode)).toBe('assets');
      expect(get(searchTerms)).toBe('second search'); // Should remain unchanged
    });

    it('should handle rapid updates to both stores', () => {
      searchMode.set('entries');
      searchTerms.set('query1');
      searchMode.set('assets');
      searchTerms.set('query2');
      searchMode.set(null);
      searchTerms.set('');

      expect(get(searchMode)).toBe(null);
      expect(get(searchTerms)).toBe('');
    });
  });
});
