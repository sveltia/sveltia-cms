// @ts-nocheck

import { _, locale as appLocale } from '@sveltia/i18n';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { isEntryCollection } from '$lib/services/contents/collection';
import {
  getIndexFile,
  isCollectionIndexFile,
  isCollectionIndexFilePath,
} from '$lib/services/contents/collection/entries/index-file';

// Mock dependencies
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn(() => 'Index File'),
  locale: { current: 'en-US' },
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

  test('passes the extension and format options through', () => {
    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: { name: 'posts', extension: 'json', format: 'json' },
    };

    expect(getIndexFile(collection)).toEqual({
      name: 'posts',
      label: 'Index File',
      icon: 'home',
      extension: 'json',
      format: 'json',
      fields: undefined,
      editor: undefined,
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

  test('caches the result per collection', () => {
    const collection = { name: 'test-collection', folder: 'content/posts', index_file: true };
    const first = getIndexFile(collection);
    const second = getIndexFile(collection);

    expect(second).toBe(first);
    // The localized default label is only looked up on the first call
    expect(vi.mocked(_)).toHaveBeenCalledTimes(1);
  });

  test('rebuilds the cached result when the app locale changes', () => {
    const collection = { name: 'test-collection', folder: 'content/posts', index_file: true };
    const first = getIndexFile(collection);

    vi.mocked(_).mockReturnValue('Fichier d’index');
    appLocale.current = 'fr';

    const second = getIndexFile(collection);

    expect(second).not.toBe(first);
    expect(second?.label).toBe('Fichier d’index');

    appLocale.current = 'en-US';
    vi.mocked(_).mockReturnValue('Index File');
  });

  test('caches a disabled index file too', () => {
    const collection = { name: 'test-collection', folder: 'content/posts' };

    expect(getIndexFile(collection)).toBeUndefined();
    expect(getIndexFile(collection)).toBeUndefined();
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

  test('handles a partial entry without any locale', () => {
    const collection = {
      name: 'test-collection',
      folder: 'content/posts',
      index_file: true,
    };

    // `buildDraft()` calls this with an empty object for a new entry
    // @ts-ignore - Intentionally incomplete for testing
    expect(isCollectionIndexFile(collection, {})).toBe(false);
  });

  test('tells the index file from the entries by the entry path', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      index_file: true,
      _file: { fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?)\.md$/ },
    };

    /**
     * Build an entry with the given path.
     * @param {string} slug Entry slug.
     * @param {string} path File path.
     * @returns {any} Entry.
     */
    const getEntry = (slug, path) => ({
      id: path,
      slug,
      subPath: slug,
      locales: { _default: { slug, path, content: {} } },
    });

    expect(isCollectionIndexFile(collection, getEntry('_index', 'content/posts/_index.md'))).toBe(
      true,
    );
    expect(isCollectionIndexFile(collection, getEntry('hello', 'content/posts/hello.md'))).toBe(
      false,
    );
  });

  test('doesn’t take a nested collection’s index file for its own', () => {
    // A `pages` collection on the content root with the `path` option claims a `posts` collection’s
    // own index file, which carries the slug computed by `posts`
    // @see https://github.com/sveltia/sveltia-cms/issues/1005
    const collection = {
      name: 'pages',
      folder: 'content',
      path: '{{slug}}/_index',
      index_file: true,
      _file: { fullPathRegEx: /^content\/(?<subPath>[^/]+?\/_index|_index)\.md$/ },
    };

    /**
     * Build an entry with the given path. The slug is what the owning collection computed.
     * @param {string} slug Entry slug.
     * @param {string} path File path.
     * @returns {any} Entry.
     */
    const getEntry = (slug, path) => ({
      id: path,
      slug,
      subPath: slug,
      locales: { _default: { slug, path, content: {} } },
    });

    expect(isCollectionIndexFile(collection, getEntry('_index', 'content/_index.md'))).toBe(true);
    // `content/posts/_index.md` belongs to the `posts` collection, where its slug is `_index`
    expect(isCollectionIndexFile(collection, getEntry('_index', 'content/posts/_index.md'))).toBe(
      false,
    );
    expect(isCollectionIndexFile(collection, getEntry('about', 'content/about/_index.md'))).toBe(
      false,
    );
  });

  test('uses any locale’s path', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      index_file: true,
      _file: { fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?)\.(?<locale>en|fr)\.md$/ },
    };

    const entry = {
      id: 'entry-1',
      slug: '_index',
      subPath: '_index',
      locales: {
        fr: { slug: '_index', path: 'content/posts/_index.fr.md', content: {} },
        en: { slug: '_index', path: 'content/posts/_index.en.md', content: {} },
      },
    };

    // @ts-ignore - Intentionally incomplete for testing
    expect(isCollectionIndexFile(collection, entry)).toBe(true);
  });
});

describe('isCollectionIndexFilePath()', () => {
  beforeEach(() => {
    vi.mocked(isEntryCollection).mockImplementation(
      (collection) => typeof collection?.folder === 'string' && !Array.isArray(collection?.files),
    );
  });

  const fullPathRegEx =
    /^content\/posts\/(?<subPath>(?!posts(?=\.md$))(?:[^/]+?)(?=\.md$)|posts(?=\.json$))\.(?:md|json)$/;

  test('returns false when index file inclusion is disabled', () => {
    const collection = { name: 'posts', folder: 'content/posts', _file: { fullPathRegEx } };

    expect(isCollectionIndexFilePath(collection, 'content/posts/_index.md')).toBe(false);
  });

  test('returns false without a path matcher', () => {
    const collection = { name: 'posts', folder: 'content/posts', index_file: true };

    expect(isCollectionIndexFilePath(collection, 'content/posts/_index.md')).toBe(false);
  });

  test('tells the index file from the entries by the sub path', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      index_file: { name: 'posts', extension: 'json' },
      _file: { fullPathRegEx },
    };

    expect(isCollectionIndexFilePath(collection, 'content/posts/posts.json')).toBe(true);
    expect(isCollectionIndexFilePath(collection, 'content/posts/hello.md')).toBe(false);
    expect(isCollectionIndexFilePath(collection, 'content/posts/hello.json')).toBe(false);
    expect(isCollectionIndexFilePath(collection, 'content/pages/posts.json')).toBe(false);
  });
});
