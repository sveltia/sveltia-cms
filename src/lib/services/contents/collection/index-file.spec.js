import { get } from 'svelte/store';
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { isEntryCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import {
  getIndexFile,
  isCollectionIndexFile,
  canCreateIndexFile,
} from '$lib/services/contents/collection/index-file';

// Mock dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
  writable: vi.fn(),
}));
vi.mock('svelte-i18n', () => ({
  _: { subscribe: vi.fn() },
}));
vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(),
}));
vi.mock('$lib/services/contents/collection', () => ({
  isEntryCollection: vi.fn(),
}));

describe('getIndexFile()', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock behavior for isEntryCollection
    vi.mocked(isEntryCollection).mockImplementation(
      (collection) => typeof collection?.folder === 'string' && !Array.isArray(collection?.files),
    );

    // Setup default mock behavior for getEntriesByCollection
    vi.mocked(getEntriesByCollection).mockReturnValue([]);

    // Setup default mock for svelte/store get function
    vi.mocked(get).mockReturnValue(() => 'Index File');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns undefined for non-entry collection (no folder)', () => {
    const collection = {
      name: 'test-collection',
      // No folder property - not an entry collection
      index_file: true,
    };

    const result = getIndexFile(collection);

    expect(result).toBeUndefined();
  });

  test('returns undefined for file collection (folder is not string)', () => {
    const collection = {
      name: 'test-collection',
      folder: {}, // Not a string - file collection
      index_file: true,
    };

    // @ts-ignore - Intentionally using wrong type for testing
    const result = getIndexFile(collection);

    expect(result).toBeUndefined();
  });

  test('returns undefined when index_file is not enabled', () => {
    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      // index_file is falsy
    };

    const result = getIndexFile(collection);

    expect(result).toBeUndefined();
  });

  test('returns undefined when index_file is false', () => {
    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: false,
    };

    const result = getIndexFile(collection);

    expect(result).toBeUndefined();
  });

  test('returns default configuration when index_file is true', () => {
    vi.mocked(get).mockReturnValue(() => 'Index File');

    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: true,
    };

    const result = getIndexFile(collection);

    expect(result).toEqual({
      name: '_index',
      label: 'Index File',
      icon: 'home',
      fields: undefined,
      editor: undefined,
    });
  });

  test('returns default configuration with fallback label when svelte-i18n fails', () => {
    vi.mocked(get).mockImplementation(() => {
      throw new Error('svelte-i18n not initialized');
    });

    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: true,
    };

    const result = getIndexFile(collection);

    expect(result).toEqual({
      name: '_index',
      label: 'Index File',
      icon: 'home',
      fields: undefined,
      editor: undefined,
    });
  });

  test('returns custom configuration when index_file is an object', () => {
    vi.mocked(get).mockReturnValue(() => 'Localized Index File');

    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: {
        name: 'index',
        label: 'Custom Index',
        icon: 'folder',
        fields: [{ name: 'title', widget: 'string' }],
        editor: { preview: false },
      },
    };

    const result = getIndexFile(collection);

    expect(result).toEqual({
      name: 'index',
      label: 'Custom Index',
      icon: 'folder',
      fields: [{ name: 'title', widget: 'string' }],
      editor: { preview: false },
    });
  });

  test('uses defaults for missing properties in index_file object', () => {
    vi.mocked(get).mockReturnValue(() => 'Localized Index File');

    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: {
        name: 'custom-index',
        // Missing label, icon, fields, editor
      },
    };

    const result = getIndexFile(collection);

    expect(result).toEqual({
      name: 'custom-index',
      label: 'Localized Index File',
      icon: 'home',
      fields: undefined,
      editor: undefined,
    });
  });

  test('uses defaults when index_file object has null/undefined values', () => {
    vi.mocked(get).mockReturnValue(() => 'Localized Index File');

    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: {
        name: null,
        label: undefined,
        icon: null,
        fields: null,
        editor: undefined,
      },
    };

    // @ts-ignore - Intentionally using wrong types for testing edge cases
    const result = getIndexFile(collection);

    expect(result).toEqual({
      name: '_index',
      label: 'Localized Index File',
      icon: 'home',
      fields: null,
      editor: undefined,
    });
  });
});

describe('isCollectionIndexFile()', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock behavior for isEntryCollection
    vi.mocked(isEntryCollection).mockImplementation(
      (collection) => typeof collection?.folder === 'string' && !Array.isArray(collection?.files),
    );

    // Setup default mock behavior for getEntriesByCollection
    vi.mocked(getEntriesByCollection).mockReturnValue([]);

    // Setup default mock for svelte/store get function
    vi.mocked(get).mockReturnValue(() => 'Index File');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns false when getIndexFile returns undefined', () => {
    const collection = {
      name: 'test-collection',
      // No folder - will make getIndexFile return undefined
    };

    const entry = {
      id: 'entry-1',
      slug: '_index',
      subPath: '_index.md',
      locales: {},
    };

    // @ts-ignore - Intentionally incomplete for testing
    const result = isCollectionIndexFile(collection, entry);

    expect(result).toBe(false);
  });

  test('returns true when entry slug matches index file name', () => {
    vi.mocked(get).mockReturnValue(() => 'Index File');

    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: true,
    };

    const entry = {
      id: 'entry-1',
      slug: '_index',
      subPath: '_index.md',
      locales: {},
    };

    // @ts-ignore - Intentionally incomplete for testing
    const result = isCollectionIndexFile(collection, entry);

    expect(result).toBe(true);
  });

  test('returns false when entry slug does not match index file name', () => {
    vi.mocked(get).mockReturnValue(() => 'Index File');

    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: true,
    };

    const entry = {
      id: 'entry-1',
      slug: 'regular-post',
      subPath: 'regular-post.md',
      locales: {},
    };

    // @ts-ignore - Intentionally incomplete for testing
    const result = isCollectionIndexFile(collection, entry);

    expect(result).toBe(false);
  });

  test('returns true when entry slug matches custom index file name', () => {
    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: {
        name: 'home',
      },
    };

    const entry = {
      id: 'entry-1',
      slug: 'home',
      subPath: 'home.md',
      locales: {},
    };

    // @ts-ignore - Intentionally incomplete for testing
    const result = isCollectionIndexFile(collection, entry);

    expect(result).toBe(true);
  });

  test('handles empty string slug', () => {
    vi.mocked(get).mockReturnValue(() => 'Index File');

    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: true,
    };

    const entry = {
      id: 'entry-1',
      slug: '',
      subPath: '.md',
      locales: {},
    };

    // @ts-ignore - Intentionally incomplete for testing
    const result = isCollectionIndexFile(collection, entry);

    expect(result).toBe(false);
  });
});

describe('canCreateIndexFile()', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock behavior for isEntryCollection
    vi.mocked(isEntryCollection).mockImplementation(
      (collection) => typeof collection?.folder === 'string' && !Array.isArray(collection?.files),
    );

    // Setup default mock behavior for getEntriesByCollection
    vi.mocked(getEntriesByCollection).mockReturnValue([]);

    // Setup default mock for svelte/store get function
    vi.mocked(get).mockReturnValue(() => 'Index File');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns false when getIndexFile returns undefined', () => {
    const collection = {
      name: 'test-collection',
      // No folder - will make getIndexFile return undefined
    };

    vi.mocked(getEntriesByCollection).mockReturnValue([]);

    // @ts-ignore - Intentionally incomplete for testing
    const result = canCreateIndexFile(collection);

    expect(result).toBe(false);
  });

  test('returns true when index file is enabled and does not exist', () => {
    vi.mocked(get).mockReturnValue(() => 'Index File');

    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: true,
    };

    const entries = [
      {
        id: 'entry-1',
        slug: 'post-1',
        subPath: 'post-1.md',
        locales: {},
      },
      {
        id: 'entry-2',
        slug: 'post-2',
        subPath: 'post-2.md',
        locales: {},
      },
    ];

    vi.mocked(getEntriesByCollection).mockReturnValue(entries);

    // @ts-ignore - Intentionally incomplete for testing
    const result = canCreateIndexFile(collection);

    expect(result).toBe(true);
    expect(vi.mocked(getEntriesByCollection)).toHaveBeenCalledWith('test-collection');
  });

  test('returns false when index file already exists', () => {
    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: true,
    };

    const entries = [
      {
        id: 'entry-1',
        slug: '_index', // Index file already exists
        subPath: '_index.md',
        locales: {},
      },
      {
        id: 'entry-2',
        slug: 'post-1',
        subPath: 'post-1.md',
        locales: {},
      },
    ];

    vi.mocked(getEntriesByCollection).mockReturnValue(entries);

    // @ts-ignore - Intentionally incomplete for testing
    const result = canCreateIndexFile(collection);

    expect(result).toBe(false);
    expect(vi.mocked(getEntriesByCollection)).toHaveBeenCalledWith('test-collection');
  });

  test('returns false when custom index file already exists', () => {
    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: {
        name: 'home',
      },
    };

    const entries = [
      {
        id: 'entry-1',
        slug: 'home', // Custom index file already exists
        subPath: 'home.md',
        locales: {},
      },
      {
        id: 'entry-2',
        slug: 'post-1',
        subPath: 'post-1.md',
        locales: {},
      },
    ];

    vi.mocked(getEntriesByCollection).mockReturnValue(entries);

    // @ts-ignore - Intentionally incomplete for testing
    const result = canCreateIndexFile(collection);

    expect(result).toBe(false);
    expect(vi.mocked(getEntriesByCollection)).toHaveBeenCalledWith('test-collection');
  });

  test('returns true when custom index file is enabled and does not exist', () => {
    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: {
        name: 'homepage',
      },
    };

    const entries = [
      {
        id: 'entry-1',
        slug: 'post-1',
        subPath: 'post-1.md',
        locales: {},
      },
      {
        id: 'entry-2',
        slug: 'post-2',
        subPath: 'post-2.md',
        locales: {},
      },
    ];

    vi.mocked(getEntriesByCollection).mockReturnValue(entries);

    // @ts-ignore - Intentionally incomplete for testing
    const result = canCreateIndexFile(collection);

    expect(result).toBe(true);
    expect(vi.mocked(getEntriesByCollection)).toHaveBeenCalledWith('test-collection');
  });

  test('handles empty entries array', () => {
    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: true,
    };

    vi.mocked(getEntriesByCollection).mockReturnValue([]);

    // @ts-ignore - Intentionally incomplete for testing
    const result = canCreateIndexFile(collection);

    expect(result).toBe(true);
    expect(vi.mocked(getEntriesByCollection)).toHaveBeenCalledWith('test-collection');
  });

  test('handles entries with duplicate slugs correctly', () => {
    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: true,
    };

    const entries = [
      {
        id: 'entry-1',
        slug: '_index',
        subPath: '_index.md',
        locales: {},
      },
      {
        id: 'entry-2',
        slug: '_index', // Duplicate slug (should not happen in practice)
        subPath: '_index.md',
        locales: {},
      },
    ];

    vi.mocked(getEntriesByCollection).mockReturnValue(entries);

    // @ts-ignore - Intentionally incomplete for testing
    const result = canCreateIndexFile(collection);

    expect(result).toBe(false); // Should still return false since index file exists
    expect(vi.mocked(getEntriesByCollection)).toHaveBeenCalledWith('test-collection');
  });
});
