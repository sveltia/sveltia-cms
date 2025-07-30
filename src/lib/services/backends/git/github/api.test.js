import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  normalizeGraphQLBaseURL,
  normalizeRestBaseURL,
} from '$lib/services/backends/git/github/api';
import { DEFAULT_API_ROOT } from '$lib/services/backends/git/github/constants';

describe('GitHub repository service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeRestBaseURL', () => {
    test('returns default GitHub API root unchanged', () => {
      const url = DEFAULT_API_ROOT;
      const result = normalizeRestBaseURL(url);

      expect(result).toBe(DEFAULT_API_ROOT);
    });

    test('returns URL unchanged when it already ends with /api/v3', () => {
      const url = 'https://github.example.com/api/v3';
      const result = normalizeRestBaseURL(url);

      expect(result).toBe('https://github.example.com/api/v3');
    });

    test('adds /v3 when URL ends with /api', () => {
      const url = 'https://github.example.com/api';
      const result = normalizeRestBaseURL(url);

      expect(result).toBe('https://github.example.com/api/v3');
    });

    test('adds /api/v3 when URL does not end with /api or /api/v3', () => {
      const url = 'https://github.example.com';
      const result = normalizeRestBaseURL(url);

      expect(result).toBe('https://github.example.com/api/v3');
    });

    test('strips trailing slashes before processing', () => {
      const url = 'https://github.example.com/';
      const result = normalizeRestBaseURL(url);

      expect(result).toBe('https://github.example.com/api/v3');
    });

    test('strips multiple trailing slashes before processing', () => {
      const url = 'https://github.example.com///';
      const result = normalizeRestBaseURL(url);

      expect(result).toBe('https://github.example.com/api/v3');
    });

    test('handles URL ending with /api and trailing slashes', () => {
      const url = 'https://github.example.com/api/';
      const result = normalizeRestBaseURL(url);

      expect(result).toBe('https://github.example.com/api/v3');
    });

    test('handles URL ending with /api/v3 and trailing slashes', () => {
      const url = 'https://github.example.com/api/v3/';
      const result = normalizeRestBaseURL(url);

      expect(result).toBe('https://github.example.com/api/v3');
    });
  });

  describe('normalizeGraphQLBaseURL', () => {
    test('returns default GitHub API root with /graphql suffix', () => {
      const url = DEFAULT_API_ROOT;
      const result = normalizeGraphQLBaseURL(url);

      expect(result).toBe(`${DEFAULT_API_ROOT}/graphql`);
    });

    test('returns URL unchanged when it already ends with /graphql', () => {
      const url = 'https://github.example.com/api/graphql';
      const result = normalizeGraphQLBaseURL(url);

      expect(result).toBe('https://github.example.com/api/graphql');
    });

    test('replaces /api/v3 with /graphql', () => {
      const url = 'https://github.example.com/api/v3';
      const result = normalizeGraphQLBaseURL(url);

      expect(result).toBe('https://github.example.com/graphql');
    });

    test('adds /graphql when URL ends with /api', () => {
      const url = 'https://github.example.com/api';
      const result = normalizeGraphQLBaseURL(url);

      expect(result).toBe('https://github.example.com/api/graphql');
    });

    test('adds /api/graphql when URL does not end with specific patterns', () => {
      const url = 'https://github.example.com';
      const result = normalizeGraphQLBaseURL(url);

      expect(result).toBe('https://github.example.com/api/graphql');
    });

    test('strips trailing slashes before processing', () => {
      const url = 'https://github.example.com/';
      const result = normalizeGraphQLBaseURL(url);

      expect(result).toBe('https://github.example.com/api/graphql');
    });

    test('strips multiple trailing slashes before processing', () => {
      const url = 'https://github.example.com///';
      const result = normalizeGraphQLBaseURL(url);

      expect(result).toBe('https://github.example.com/api/graphql');
    });

    test('handles URL ending with /graphql and trailing slashes', () => {
      const url = 'https://github.example.com/api/graphql/';
      const result = normalizeGraphQLBaseURL(url);

      expect(result).toBe('https://github.example.com/api/graphql');
    });

    test('handles URL ending with /api and trailing slashes', () => {
      const url = 'https://github.example.com/api/';
      const result = normalizeGraphQLBaseURL(url);

      expect(result).toBe('https://github.example.com/api/graphql');
    });

    test('handles URL ending with /api/v3 and trailing slashes', () => {
      const url = 'https://github.example.com/api/v3/';
      const result = normalizeGraphQLBaseURL(url);

      expect(result).toBe('https://github.example.com/graphql');
    });
  });
});
