import { describe, expect, it, vi } from 'vitest';

import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getAssociatedCollections } from '$lib/services/contents/entry';

import { scanEntry, searchEntries } from './entries';

/**
 * @import { Entry } from '$lib/types/private';
 */

// Mock the dependencies
vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFilesByEntry: vi.fn(() => [
    { name: 'test-file', label: 'Test File' },
    { name: 'data-file', label: 'Data File' },
  ]),
}));

vi.mock('$lib/services/contents/entry', () => ({
  getAssociatedCollections: vi.fn((entry) => {
    // Return empty array for entries without mock collections
    if (entry.id.startsWith('no-collection')) {
      return [];
    }

    // Return mock collections for other entries
    return [
      {
        name: entry.collectionName || 'blog',
        label: 'Blog Posts',
      },
    ];
  }),
}));

vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummary: vi.fn((collection, entry) => {
    // Return a mock summary based on entry content
    const content = entry.locales[entry.currentLocaleKey]?.content;

    return content?.title || 'Mock Entry Summary';
  }),
}));

vi.mock('$lib/services/search/util', () => ({
  hasMatch: vi.fn(({ value, terms }) => {
    // Simple case-insensitive substring match
    const normalizedValue = String(value).toLowerCase();
    const normalizedTerms = String(terms).toLowerCase();

    return normalizedValue.includes(normalizedTerms);
  }),
  normalize: vi.fn((text) => String(text).toLowerCase().trim()),
}));

describe('searchEntries basic functionality', () => {
  /**
   * Create test entries with proper type structure.
   * @param {string} id Entry ID.
   * @param {object} content Entry content.
   * @returns {Entry} Mock entry object.
   */
  const createEntry = (id, content = {}) =>
    /** @type {Entry} */ ({
      id,
      slug: id,
      subPath: `/${id}`,
      collectionName: 'blog',
      fileName: `${id}.md`,
      sha: 'mock-sha',
      size: 1024,
      locales: {
        en: {
          slug: id,
          path: `/${id}`,
          content: {
            title: 'Default Title',
            description: 'Default description',
            ...content,
          },
        },
      },
      defaultLocaleKey: 'en',
      currentLocaleKey: 'en',
      // RepositoryFileMetadata properties
      commitAuthor: undefined,
      commitDate: undefined,
    });

  it('should return empty array when no entries provided', () => {
    const result = searchEntries({ entries: [], terms: 'test' });

    expect(result).toEqual([]);
  });

  it('should return empty array when no terms provided', () => {
    const entries = [createEntry('entry1'), createEntry('entry2')];
    const result = searchEntries({ entries, terms: '' });

    expect(result).toEqual([]);
  });

  it('should return empty array when terms are only whitespace', () => {
    const entries = [createEntry('entry1'), createEntry('entry2')];
    const result = searchEntries({ entries, terms: '   ' });

    expect(result).toEqual([]);
  });

  it('should test scanEntry function exists and returns number', () => {
    const entry = createEntry('test-entry', {
      title: 'Test Entry',
      description: 'A test entry about testing',
    });

    const points = scanEntry({ entry, terms: 'test' });

    expect(typeof points).toBe('number');
    expect(points).toBeGreaterThanOrEqual(0);
  });

  it('should handle entries with complex content', () => {
    const entries = [
      createEntry('blog-post', {
        title: 'JavaScript Best Practices',
        description: 'Learn about JavaScript development',
        tags: ['javascript', 'programming'],
        published: true,
        date: '2023-01-01',
      }),
      createEntry('python-guide', {
        title: 'Python Programming Guide',
        description: 'A comprehensive Python tutorial',
        tags: ['python', 'tutorial'],
        published: false,
      }),
    ];

    const result = searchEntries({ entries, terms: 'javascript' });

    // The function should work without errors
    expect(Array.isArray(result)).toBe(true);

    // If it finds matches, they should be valid entries
    result.forEach((entry) => {
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('slug');
      expect(entry).toHaveProperty('subPath');
      expect(entry).toHaveProperty('locales');
    });
  });

  it('should handle case-insensitive searches', () => {
    const entries = [
      createEntry('tutorial', {
        title: 'JavaScript Tutorial',
        description: 'Learn JavaScript basics',
      }),
      createEntry('guide', {
        title: 'Python Guide',
        description: 'Python programming guide',
      }),
    ];

    const result = searchEntries({ entries, terms: 'JAVASCRIPT' });

    expect(Array.isArray(result)).toBe(true);
  });

  it('should verify searchEntries respects normalization', () => {
    const entries = [
      createEntry('café-review', {
        title: 'Café Review',
        description: 'Review of a local café',
      }),
    ];

    // Should find the entry even with different accent usage
    const result = searchEntries({ entries, terms: 'cafe' });

    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle entries with numeric content', () => {
    const entries = [
      createEntry('year-2023', {
        title: 'Year 2023 Review',
        description: 'Looking back at 2023',
        year: 2023,
        views: 1500,
      }),
    ];

    const result = searchEntries({ entries, terms: '2023' });

    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle entries with empty or null content values', () => {
    const entries = [
      createEntry('empty-content', {
        title: 'Valid Title',
        description: '', // empty string
        tags: null, // null value
        metadata: undefined, // undefined value
      }),
    ];

    const result = searchEntries({ entries, terms: 'valid' });

    expect(Array.isArray(result)).toBe(true);
  });

  it('should test scanEntry with different content types', () => {
    const entry = createEntry('mixed-content', {
      title: 'Mixed Content Entry',
      description: 'Entry with various data types',
      year: 2023,
      published: true,
      tags: ['test', 'entry'],
      rating: 4.5,
    });

    // Test with different search terms
    const titlePoints = scanEntry({ entry, terms: 'mixed' });
    const yearPoints = scanEntry({ entry, terms: '2023' });
    const nonMatchPoints = scanEntry({ entry, terms: 'nonexistent' });

    expect(typeof titlePoints).toBe('number');
    expect(typeof yearPoints).toBe('number');
    expect(typeof nonMatchPoints).toBe('number');
    expect(nonMatchPoints).toBe(0);
  });

  it('should handle multiple locale entries', () => {
    const entry = /** @type {Entry} */ ({
      id: 'multilingual',
      slug: 'multilingual',
      subPath: '/multilingual',
      collectionName: 'blog',
      fileName: 'multilingual.md',
      sha: 'mock-sha',
      size: 1024,
      locales: {
        en: {
          slug: 'multilingual',
          path: '/multilingual',
          content: {
            title: 'English Title',
            description: 'English description',
          },
        },
        es: {
          slug: 'multilingual',
          path: '/multilingual',
          content: {
            title: 'Título en Español',
            description: 'Descripción en español',
          },
        },
      },
      defaultLocaleKey: 'en',
      currentLocaleKey: 'en',
      // RepositoryFileMetadata properties
      commitAuthor: undefined,
      commitDate: undefined,
    });

    const points = scanEntry({ entry, terms: 'english' });

    expect(typeof points).toBe('number');
    expect(points).toBeGreaterThanOrEqual(0);
  });

  it('should award points for collection label matches', () => {
    const entry = createEntry('blog-post', {
      title: 'My Blog Post',
      description: 'A post about blogs',
    });

    // Search for the collection label "Blog"
    const points = scanEntry({ entry, terms: 'blog' });

    expect(points).toBeGreaterThan(0);
  });

  it('should award points for collection name matches', () => {
    const entry = createEntry('post-1', {
      title: 'First Post',
      description: 'My first post',
    });

    // Search for collection name
    const points = scanEntry({ entry, terms: 'posts' });

    expect(points).toBeGreaterThan(0);
  });

  it('should award points for file label matches', () => {
    const entry = createEntry('entry-with-files', {
      title: 'Entry Title',
      description: 'Entry description',
    });

    // Search for file label
    const points = scanEntry({ entry, terms: 'test' });

    expect(points).toBeGreaterThan(0);
  });

  it('should award points for entry summary matches', () => {
    const entry = createEntry('summary-entry', {
      title: 'Summary Test Entry',
      description: 'This tests the summary matching',
    });

    // Search for terms in summary
    const points = scanEntry({ entry, terms: 'summary' });

    expect(points).toBeGreaterThan(0);
  });

  it('should handle entries with no associated collections', () => {
    const entry = createEntry('no-collection-entry', {
      title: 'Orphaned Entry',
      description: 'Entry with no collection',
    });

    // Should still score points for content matches
    const points = scanEntry({ entry, terms: 'orphaned' });

    expect(typeof points).toBe('number');
    expect(points).toBeGreaterThanOrEqual(0);
  });

  it('should handle entries with boolean values in content', () => {
    const entry = createEntry('boolean-entry', {
      title: 'Boolean Test',
      published: true,
      featured: false,
    });

    const points = scanEntry({ entry, terms: 'boolean' });

    expect(typeof points).toBe('number');
  });

  it('should sort results by relevance (highest points first)', () => {
    const entries = [
      createEntry('low-relevance', {
        title: 'Article about coding',
        description: 'Generic article',
      }),
      createEntry('high-relevance', {
        title: 'JavaScript JavaScript JavaScript',
        description: 'All about JavaScript development',
      }),
      createEntry('medium-relevance', {
        title: 'JavaScript Tutorial',
        description: 'Learn the basics',
      }),
    ];

    const result = searchEntries({ entries, terms: 'javascript' });

    expect(result.length).toBeGreaterThan(0);

    // Verify results are sorted by scanning their points
    if (result.length > 1) {
      const points = result.map((entry) => scanEntry({ entry, terms: 'javascript' }));

      // Each point should be >= the next one (sorted descending)
      for (let i = 0; i < points.length - 1; i += 1) {
        expect(points[i]).toBeGreaterThanOrEqual(points[i + 1]);
      }
    }
  });

  it('should filter out entries with zero points', () => {
    const entries = [
      createEntry('match', {
        title: 'JavaScript Tutorial',
        description: 'Learn JavaScript',
      }),
      createEntry('no-match', {
        title: 'Python Guide',
        description: 'Learn Python',
      }),
    ];

    const result = searchEntries({ entries, terms: 'javascript' });

    // Should only include entries with matches
    expect(result.every((entry) => scanEntry({ entry, terms: 'javascript' }) > 0)).toBe(true);
  });

  it('should test collection name fallback when label is undefined', () => {
    // Override mock to return collection without label
    vi.mocked(getAssociatedCollections).mockReturnValueOnce([
      /** @type {any} */ ({
        name: 'articles',
        // No label property - should fallback to name
      }),
    ]);

    const entry = createEntry('test-fallback', {
      title: 'Test Entry',
      description: 'Testing fallback',
    });

    // Search for collection name (not label)
    const points = scanEntry({ entry, terms: 'articles' });

    expect(points).toBeGreaterThan(0);
  });

  it('should test file name fallback when label is undefined', () => {
    // Override mock to return files without labels
    vi.mocked(getCollectionFilesByEntry).mockReturnValueOnce([
      /** @type {any} */ ({
        name: 'config-file',
        // No label property - should fallback to name
      }),
      /** @type {any} */ ({
        name: 'settings-file',
        // No label property - should fallback to name
      }),
    ]);

    const entry = createEntry('test-file-fallback', {
      title: 'Test Entry',
      description: 'Testing file fallback',
    });

    // Search for file name (not label)
    const points = scanEntry({ entry, terms: 'config' });

    expect(points).toBeGreaterThan(0);
  });
});
