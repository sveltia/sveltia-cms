import { beforeEach, describe, expect, it } from 'vitest';

import { searchMode, searchTerms } from '.';

describe('search stores', () => {
  beforeEach(() => {
    // Reset stores to initial state
    searchMode.current = null;
    searchTerms.current = '';
  });

  describe('searchMode', () => {
    it('should initialize with null value', () => {
      expect(searchMode.current).toBe(null);
    });

    it('should accept "entries" mode', () => {
      searchMode.current = 'contents';

      expect(searchMode.current).toBe('contents');
    });

    it('should accept "assets" mode', () => {
      searchMode.current = 'assets';

      expect(searchMode.current).toBe('assets');
    });

    it('should accept null to reset mode', () => {
      searchMode.current = 'contents';
      searchMode.current = null;

      expect(searchMode.current).toBe(null);
    });
  });

  describe('searchTerms', () => {
    it('should initialize with empty string', () => {
      expect(searchTerms.current).toBe('');
    });

    it('should store search terms', () => {
      searchTerms.current = 'test query';

      expect(searchTerms.current).toBe('test query');
    });

    it('should handle empty search terms', () => {
      searchTerms.current = 'test';
      searchTerms.current = '';

      expect(searchTerms.current).toBe('');
    });

    it('should handle whitespace in search terms', () => {
      searchTerms.current = '  search with spaces  ';

      expect(searchTerms.current).toBe('  search with spaces  ');
    });

    it('should handle special characters in search terms', () => {
      const specialTerms = 'test@example.com & "quotes" + symbols';

      searchTerms.current = specialTerms;

      expect(searchTerms.current).toBe(specialTerms);
    });

    it('should handle unicode characters in search terms', () => {
      const unicodeTerms = 'café naïve résumé 测试';

      searchTerms.current = unicodeTerms;

      expect(searchTerms.current).toBe(unicodeTerms);
    });

    it('should maintain independent state from searchMode', () => {
      searchMode.current = 'contents';
      searchTerms.current = 'test search';

      expect(searchMode.current).toBe('contents');
      expect(searchTerms.current).toBe('test search');

      searchMode.current = 'assets';

      expect(searchMode.current).toBe('assets');
      expect(searchTerms.current).toBe('test search'); // Should remain unchanged
    });
  });

  describe('store interactions', () => {
    it('should allow both stores to be updated independently', () => {
      searchMode.current = 'contents';
      searchTerms.current = 'first search';

      expect(searchMode.current).toBe('contents');
      expect(searchTerms.current).toBe('first search');

      searchTerms.current = 'second search';

      expect(searchMode.current).toBe('contents'); // Should remain unchanged
      expect(searchTerms.current).toBe('second search');

      searchMode.current = 'assets';

      expect(searchMode.current).toBe('assets');
      expect(searchTerms.current).toBe('second search'); // Should remain unchanged
    });

    it('should handle rapid updates to both stores', () => {
      searchMode.current = 'contents';
      searchTerms.current = 'query1';
      searchMode.current = 'assets';
      searchTerms.current = 'query2';
      searchMode.current = null;
      searchTerms.current = '';

      expect(searchMode.current).toBe(null);
      expect(searchTerms.current).toBe('');
    });
  });
});
