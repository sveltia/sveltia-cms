// @ts-nocheck

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { isEntryCollection } from '$lib/services/contents/collection';
import { getIndexFile, isCollectionIndexFile } from '$lib/services/contents/collection/index-file';

// Mock dependencies
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn(() => 'Index File'),
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

  test('returns default configuration with label from i18n', () => {
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
      label: 'Index File',
      icon: 'home',
      fields: undefined,
      editor: undefined,
    });
  });

  test('uses defaults when index_file object has null/undefined values', () => {
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
      label: 'Index File',
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
