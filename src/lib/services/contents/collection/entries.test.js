// @ts-nocheck

import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  canCreateIndexFile,
  getEntriesByAssetURL,
  getEntriesByCollection,
  hasAsset,
  MARKDOWN_IMAGE_REGEX,
  selectedEntries,
} from '$lib/services/contents/collection/entries';

// Mock dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
  writable: vi.fn(() => ({ subscribe: vi.fn() })),
}));

vi.mock('$lib/services/assets/info', () => ({
  getMediaFieldURL: vi.fn(),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/contents', () => ({
  allEntries: { subscribe: vi.fn() },
  allEntryFolders: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFilesByEntry: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/index-file', () => ({
  getIndexFile: vi.fn(),
  isCollectionIndexFile: vi.fn(),
}));

vi.mock('$lib/services/contents/entry', () => ({
  getAssociatedCollections: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(),
  getPropertyValue: vi.fn(),
}));

vi.mock('$lib/services/utils/misc', () => ({
  getRegex: vi.fn(),
}));

describe('MARKDOWN_IMAGE_REGEX', () => {
  test('matches simple markdown image', () => {
    const text = '![alt text](image.jpg)';
    const matches = [...text.matchAll(MARKDOWN_IMAGE_REGEX)];

    expect(matches).toHaveLength(1);
    expect(matches[0][1]).toBe('image.jpg');
  });

  test('matches markdown image with title', () => {
    const text = '![alt text](image.jpg "Title")';
    const matches = [...text.matchAll(MARKDOWN_IMAGE_REGEX)];

    expect(matches).toHaveLength(1);
    expect(matches[0][1]).toBe('image.jpg');
  });

  test('matches multiple images', () => {
    const text = '![first](img1.jpg) and ![second](img2.png "Title")';
    const matches = [...text.matchAll(MARKDOWN_IMAGE_REGEX)];

    expect(matches).toHaveLength(2);
    expect(matches[0][1]).toBe('img1.jpg');
    expect(matches[1][1]).toBe('img2.png');
  });

  test('matches images with paths', () => {
    const text = '![alt](/assets/images/photo.jpg)';
    const matches = [...text.matchAll(MARKDOWN_IMAGE_REGEX)];

    expect(matches).toHaveLength(1);
    expect(matches[0][1]).toBe('/assets/images/photo.jpg');
  });

  test('does not match incomplete images', () => {
    const text = '![alt text]';
    const matches = [...text.matchAll(MARKDOWN_IMAGE_REGEX)];

    expect(matches).toHaveLength(0);
  });
});

describe('getEntriesByCollection()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns empty array when collection not found', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');

    vi.mocked(getCollection).mockReturnValue(undefined);

    const result = getEntriesByCollection('non-existent');

    expect(result).toEqual([]);
  });

  test('filters entries by collection', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');

    // Create a minimal collection mock with required properties
    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
    };

    const entries = [
      { id: '1', locales: { en: { content: {} } } },
      { id: '2', locales: { en: { content: {} } } },
      { id: '3', locales: { en: { content: {} } } },
    ];

    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(get).mockReturnValue(entries);

    // Mock getAssociatedCollections to return collections with minimal required properties
    vi.mocked(getAssociatedCollections)
      .mockReturnValueOnce([{ name: 'posts' }])
      .mockReturnValueOnce([{ name: 'pages' }])
      .mockReturnValueOnce([{ name: 'posts' }]);

    const result = getEntriesByCollection('posts');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });

  test('filters entries by field pattern', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');
    const { getPropertyValue } = await import('$lib/services/contents/entry/fields');
    const { getRegex } = await import('$lib/services/utils/misc');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
      filter: {
        field: 'status',
        pattern: '^published$',
      },
    };

    const entries = [
      { id: '1', locales: { en: { content: { status: 'published' } } } },
      { id: '2', locales: { en: { content: { status: 'draft' } } } },
      { id: '3', locales: { en: { content: { status: 'published' } } } },
    ];

    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(get).mockReturnValue(entries);
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'posts' }]);
    vi.mocked(getPropertyValue)
      .mockReturnValueOnce('published')
      .mockReturnValueOnce('draft')
      .mockReturnValueOnce('published');
    vi.mocked(getRegex).mockReturnValue(/^published$/);

    const result = getEntriesByCollection('posts');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });

  test('filters entries by field value array', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');
    const { getPropertyValue } = await import('$lib/services/contents/entry/fields');
    const { getRegex } = await import('$lib/services/utils/misc');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
      filter: {
        field: 'category',
        value: ['tech', 'science'],
      },
    };

    const entries = [
      { id: '1', locales: { en: { content: { category: 'tech' } } } },
      { id: '2', locales: { en: { content: { category: 'sports' } } } },
      { id: '3', locales: { en: { content: { category: 'science' } } } },
    ];

    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(get).mockReturnValue(entries);
    // Mock getRegex to return null since we're not using pattern matching
    vi.mocked(getRegex).mockReturnValue(null);
    // Mock getAssociatedCollections to return 'posts' collection for each entry
    vi.mocked(getAssociatedCollections)
      .mockReturnValueOnce([{ name: 'posts' }]) // Entry 1
      .mockReturnValueOnce([{ name: 'posts' }]) // Entry 2
      .mockReturnValueOnce([{ name: 'posts' }]); // Entry 3
    vi.mocked(getPropertyValue)
      .mockReturnValueOnce('tech') // Entry 1: category 'tech' (included)
      .mockReturnValueOnce('sports') // Entry 2: category 'sports' (excluded)
      .mockReturnValueOnce('science'); // Entry 3: category 'science' (included)

    const result = getEntriesByCollection('posts');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });

  test('filters entries by single field value', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');
    const { getPropertyValue } = await import('$lib/services/contents/entry/fields');
    const { getRegex } = await import('$lib/services/utils/misc');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
      filter: {
        field: 'featured',
        value: true,
      },
    };

    const entries = [
      { id: '1', locales: { en: { content: { featured: true } } } },
      { id: '2', locales: { en: { content: { featured: false } } } },
      { id: '3', locales: { en: { content: { featured: true } } } },
    ];

    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(get).mockReturnValue(entries);
    // Mock getRegex to return null since we're not using pattern matching
    vi.mocked(getRegex).mockReturnValue(null);
    // Mock getAssociatedCollections to return 'posts' collection for each entry
    vi.mocked(getAssociatedCollections)
      .mockReturnValueOnce([{ name: 'posts' }]) // Entry 1
      .mockReturnValueOnce([{ name: 'posts' }]) // Entry 2
      .mockReturnValueOnce([{ name: 'posts' }]); // Entry 3
    vi.mocked(getPropertyValue)
      .mockReturnValueOnce(true) // Entry 1: featured true (included)
      .mockReturnValueOnce(false) // Entry 2: featured false (excluded)
      .mockReturnValueOnce(true); // Entry 3: featured true (included)

    const result = getEntriesByCollection('posts');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });

  test('filters entries using fullPathRegEx when collection has _file.fullPathRegEx', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');
    const fullPathRegEx = /^posts\/[^/]+\.md$/;

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
      _file: { fullPathRegEx },
    };

    const entries = [
      { id: '1', locales: { en: { path: 'posts/hello.md', content: {} } } },
      { id: '2', locales: { en: { path: 'pages/about.md', content: {} } } },
      { id: '3', locales: { en: { path: 'posts/world.md', content: {} } } },
    ];

    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(get).mockReturnValue(entries);

    const result = getEntriesByCollection('posts');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });

  test('handles entry with undefined path when using fullPathRegEx (falls back to empty string)', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');
    const fullPathRegEx = /^posts\/.+\.md$/;

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
      _file: { fullPathRegEx },
    };

    const entries = [
      // path is undefined — locales[0]?.path ?? '' gives '' which fails the regex
      { id: '1', locales: { en: { path: undefined, content: {} } } },
      { id: '2', locales: { en: { path: 'posts/hello.md', content: {} } } },
    ];

    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(get).mockReturnValue(entries);

    const result = getEntriesByCollection('posts');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  test('filters entries for a file collection using validPaths', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');

    const collection = {
      name: 'singleton',
      _type: 'file',
      _i18n: { defaultLocale: 'en' },
    };

    const folders = [
      {
        collectionName: 'singleton',
        fileName: 'about',
        filePathMap: { en: 'content/singleton/about.md', fr: 'content/singleton/about.fr.md' },
      },
      {
        collectionName: 'other',
        fileName: 'contact',
        filePathMap: { en: 'content/other/contact.md' },
      },
    ];

    const entries = [
      { id: '1', locales: { en: { path: 'content/singleton/about.md', content: {} } } },
      { id: '2', locales: { en: { path: 'content/other/contact.md', content: {} } } },
      { id: '3', locales: { en: { path: 'content/singleton/about.fr.md', content: {} } } },
    ];

    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(get)
      .mockReturnValueOnce(folders) // get(allEntryFolders)
      .mockReturnValueOnce(entries); // get(allEntries)

    const result = getEntriesByCollection('singleton');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });

  test('handles file collection folder with no filePathMap (flatMap returns [])', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');

    const collection = {
      name: 'pages',
      _type: 'file',
      _i18n: { defaultLocale: 'en' },
    };

    const folders = [
      { collectionName: 'pages', fileName: 'home', filePathMap: { en: 'content/home.md' } },
      { collectionName: 'pages', fileName: 'missing', filePathMap: undefined }, // no filePathMap
    ];

    const entries = [
      { id: '1', locales: { en: { path: 'content/home.md', content: {} } } },
      { id: '2', locales: { en: { path: 'content/other.md', content: {} } } },
    ];

    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(get).mockReturnValueOnce(folders).mockReturnValueOnce(entries);

    const result = getEntriesByCollection('pages');

    // Only entry 1 matches the validPaths (content/home.md)
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('excludes file collection entry with undefined path from validPaths', async () => {
    const { getCollection } = await import('$lib/services/contents/collection');

    const collection = {
      name: 'pages',
      _type: 'file',
      _i18n: { defaultLocale: 'en' },
    };

    const folders = [
      { collectionName: 'pages', fileName: 'home', filePathMap: { en: 'content/home.md' } },
    ];

    const entries = [
      { id: '1', locales: { en: { path: undefined, content: {} } } }, // no path
      { id: '2', locales: { en: { path: 'content/home.md', content: {} } } },
    ];

    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(get).mockReturnValueOnce(folders).mockReturnValueOnce(entries);

    const result = getEntriesByCollection('pages');

    // Entry 1 has undefined path so !!entryPath is false, excluded
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  test('uses null fallback when getPropertyValue returns undefined (line 95 branch 1)', async () => {
    // When getPropertyValue returns undefined, `?? null` converts it to null.
    // Then `filterValues.includes(null)` determines inclusion.
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');
    const { getPropertyValue } = await import('$lib/services/contents/entry/fields');
    const { getRegex } = await import('$lib/services/utils/misc');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
      filter: {
        field: 'status',
        value: null, // filtering for null (missing) values
      },
    };

    const entries = [{ id: '1', locales: { en: { content: {} } } }];

    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(get).mockReturnValue(entries);
    vi.mocked(getRegex).mockReturnValue(null);
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'posts' }]);
    // Return undefined to trigger the `?? null` fallback
    vi.mocked(getPropertyValue).mockReturnValue(undefined);

    const result = getEntriesByCollection('posts');

    // value = undefined ?? null = null, filterValues.includes(null) = true
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});

describe('hasAsset()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  test('returns false when field not found', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');

    vi.mocked(getField).mockReturnValue(undefined);

    const args = {
      assetURL: 'image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'image',
      value: 'image.jpg',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(false);
  });

  test('matches image field with direct URL', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    vi.mocked(getField).mockReturnValue({
      name: 'image',
      widget: 'image',
    });
    vi.mocked(getMediaFieldURL).mockResolvedValue('image.jpg');

    const args = {
      assetURL: 'image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'image',
      value: 'image.jpg',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
  });

  test('matches images in markdown content', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'markdown',
    });
    vi.mocked(getMediaFieldURL).mockResolvedValue('image.jpg');

    const content = {};

    const args = {
      assetURL: 'image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content,
      keyPath: 'body',
      value: 'Here is an image: ![alt](image.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
  });

  test('returns false for non-string values', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');

    vi.mocked(getField).mockReturnValue({
      name: 'number_field',
      widget: 'number',
    });

    const args = {
      assetURL: 'image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'number_field',
      value: 123, // Non-string value
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(false);
  });

  test('returns false for empty string values', async () => {
    const args = {
      assetURL: 'image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'empty_field',
      value: '', // Empty string
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(false);
  });

  test('handles newURL parameter for image fields', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    vi.mocked(getField).mockReturnValue({
      name: 'image',
      widget: 'image',
    });
    vi.mocked(getMediaFieldURL).mockResolvedValue('image.jpg');

    const content = {};

    const args = {
      assetURL: 'image.jpg',
      newURL: 'new-image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content,
      keyPath: 'image',
      value: 'image.jpg',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
    expect(content.image).toBe('new-image.jpg');
  });

  test('handles newURL parameter for markdown content', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'markdown',
    });
    vi.mocked(getMediaFieldURL).mockResolvedValue('image.jpg');

    const content = { body: 'Here is an image: ![alt](image.jpg)' };

    const args = {
      assetURL: 'image.jpg',
      newURL: 'new-image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content,
      keyPath: 'body',
      value: 'Here is an image: ![alt](image.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
    expect(content.body).toBe('Here is an image: ![alt](new-image.jpg)');
  });

  test('handles markdown with multiple images', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'markdown',
    });
    vi.mocked(getMediaFieldURL)
      .mockResolvedValueOnce('image1.jpg')
      .mockResolvedValueOnce('image2.jpg');

    const content = { body: 'First: ![alt](image1.jpg) Second: ![alt](image2.jpg)' };

    const args = {
      assetURL: 'image1.jpg',
      newURL: 'new-image1.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content,
      keyPath: 'body',
      value: 'First: ![alt](image1.jpg) Second: ![alt](image2.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
    expect(content.body).toBe('First: ![alt](new-image1.jpg) Second: ![alt](image2.jpg)');
  });

  test('handles markdown with no matching images', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'markdown',
    });
    vi.mocked(getMediaFieldURL).mockResolvedValue('other.jpg');

    const args = {
      assetURL: 'target.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'body',
      value: 'Here is an image: ![alt](other.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(false);
  });

  test('handles blob URLs in image fields', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    vi.mocked(getField).mockReturnValue({
      name: 'image',
      widget: 'image',
    });

    // For blob URLs, getMediaFieldURL should return the value as-is
    vi.mocked(getMediaFieldURL).mockResolvedValue('blob:image.jpg');

    const args = {
      assetURL: 'blob:image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'image',
      value: 'blob:image.jpg',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
  });

  test('handles blob URLs in markdown content', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'markdown',
    });

    // For blob URLs, getMediaFieldURL should return the value as-is
    vi.mocked(getMediaFieldURL).mockResolvedValue('blob:image.jpg');

    const args = {
      assetURL: 'blob:image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'body',
      value: 'Here is an image: ![alt](blob:image.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
  });

  test('matches images in richtext content', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'richtext',
    });
    vi.mocked(getMediaFieldURL).mockResolvedValue('image.jpg');

    const content = {};

    const args = {
      assetURL: 'image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content,
      keyPath: 'body',
      value: 'Here is an image: ![alt](image.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
  });

  test('handles newURL parameter for richtext content', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'richtext',
    });
    vi.mocked(getMediaFieldURL).mockResolvedValue('image.jpg');

    const content = { body: 'Here is an image: ![alt](image.jpg)' };

    const args = {
      assetURL: 'image.jpg',
      newURL: 'new-image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content,
      keyPath: 'body',
      value: 'Here is an image: ![alt](image.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
    expect(content.body).toBe('Here is an image: ![alt](new-image.jpg)');
  });

  test('handles richtext with multiple images', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'richtext',
    });
    vi.mocked(getMediaFieldURL)
      .mockResolvedValueOnce('image1.jpg')
      .mockResolvedValueOnce('image2.jpg');

    const content = { body: 'First: ![alt](image1.jpg) Second: ![alt](image2.jpg)' };

    const args = {
      assetURL: 'image1.jpg',
      newURL: 'new-image1.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content,
      keyPath: 'body',
      value: 'First: ![alt](image1.jpg) Second: ![alt](image2.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
    expect(content.body).toBe('First: ![alt](new-image1.jpg) Second: ![alt](image2.jpg)');
  });

  test('handles richtext with no matching images', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'richtext',
    });
    vi.mocked(getMediaFieldURL).mockResolvedValue('other.jpg');

    const args = {
      assetURL: 'target.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'body',
      value: 'Here is an image: ![alt](other.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(false);
  });

  test('handles blob URLs in richtext content', async () => {
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'richtext',
    });

    // For blob URLs, getMediaFieldURL should return the value as-is
    vi.mocked(getMediaFieldURL).mockResolvedValue('blob:image.jpg');

    const args = {
      assetURL: 'blob:image.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {},
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
      content: {},
      keyPath: 'body',
      value: 'Here is an image: ![alt](blob:image.jpg)',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    expect(result).toBe(true);
  });

  test('returns false for richtext field with no image syntax (line 159 false branch)', async () => {
    // When the markdown body has no images, `matches.length` = 0 → the if block
    // is NOT taken → falls through to `return false` at line 178.
    const { getField } = await import('$lib/services/contents/entry/fields');

    vi.mocked(getField).mockReturnValue({
      name: 'body',
      widget: 'richtext',
    });

    const args = {
      assetURL: 'target.jpg',
      collectionName: 'posts',
      entry: {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: { content: {}, slug: 'test', path: 'posts/test.md' },
        },
      },
      content: {},
      keyPath: 'body',
      value: 'Just plain text, no image syntax here.',
      isIndexFile: false,
    };

    const result = await hasAsset(args);

    // matches.length = 0 (no markdown image syntax) → if block skipped → returns false
    expect(result).toBe(false);
  });
});

describe('getEntriesByAssetURL()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('finds entries with asset URL', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');
    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: { image: 'test.jpg', body: 'Hello world' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'posts',
      _type: 'entry',
    };

    vi.mocked(get).mockReturnValue({ _baseURL: 'https://example.com' });
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldURL).mockResolvedValue('test.jpg');

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('returns empty array when no entries match', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');
    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: { image: 'other.jpg' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'posts',
      _type: 'entry',
    };

    vi.mocked(get).mockReturnValue({ _baseURL: 'https://example.com' });
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldURL).mockResolvedValue('other.jpg');

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(0);
  });

  test('handles blob URLs correctly', async () => {
    vi.mocked(get).mockReturnValue({ _baseURL: 'https://example.com' });

    const result = await getEntriesByAssetURL('blob:test.jpg', { entries: [] });

    expect(result).toHaveLength(0);
  });

  test('handles baseURL replacement', async () => {
    vi.mocked(get).mockReturnValue({ _baseURL: 'https://example.com/' });

    const result = await getEntriesByAssetURL('https://example.com/test.jpg', { entries: [] });

    expect(result).toHaveLength(0);
  });

  test('skips entries with non-string content values', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');
    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {
              image: 'test.jpg',
              count: 42, // Non-string value
              enabled: true, // Non-string value
            },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'posts',
      _type: 'entry',
    };

    vi.mocked(get).mockReturnValue({ _baseURL: 'https://example.com' });
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldURL).mockResolvedValue('test.jpg');

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('skips entries with empty string content values', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');
    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {
              image: 'test.jpg',
              emptyField: '', // Empty string - should be skipped
              anotherEmpty: '', // Another empty string
            },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'posts',
      _type: 'entry',
    };

    vi.mocked(get).mockReturnValue({ _baseURL: 'https://example.com' });
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldURL).mockResolvedValue('test.jpg');

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('handles file collections with collectionFiles', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');
    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: { image: 'test.jpg' },
            slug: 'test',
            path: 'config/main.yml',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'config',
      _type: 'file',
    };

    const mockCollectionFile = {
      name: 'main',
      file: 'config/main.yml',
    };

    vi.mocked(get).mockReturnValue({ _baseURL: 'https://example.com' });
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([mockCollectionFile]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldURL).mockResolvedValue('test.jpg');

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('handles multiple locales with different content', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');
    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldURL } = await import('$lib/services/assets/info');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: { image: 'test.jpg', title: 'English title' },
            slug: 'test',
            path: 'posts/test.md',
          },
          ja: {
            content: { image: 'other.jpg', title: '日本語タイトル' },
            slug: 'test',
            path: 'posts/test.ja.md',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'posts',
      _type: 'entry',
    };

    vi.mocked(get).mockReturnValue({ _baseURL: 'https://example.com' });
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldURL).mockResolvedValue('test.jpg');

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('pre-filters fields that cannot contain the asset URL', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');
    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: { image: 'test.jpg', title: 'My post', body: 'Some long body text' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = { name: 'posts', _type: 'entry' };

    vi.mocked(get).mockReturnValue({ _baseURL: '' });
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    // getField should only be called for the 'image' field, not 'title' or 'body'
    expect(vi.mocked(getField)).toHaveBeenCalledTimes(1);
  });

  test('short-circuits after first match when not replacing', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');
    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            // Two fields both containing the URL – hasAsset should only be called once
            content: { image1: 'test.jpg', image2: 'test.jpg' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = { name: 'posts', _type: 'entry' };

    vi.mocked(get).mockReturnValue({ _baseURL: '' });
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    // Short-circuits after the first matching field, so getField is only called once
    expect(vi.mocked(getField)).toHaveBeenCalledTimes(1);
  });

  test('does not short-circuit when replacing (processes all matching fields)', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');
    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const content = { image1: 'test.jpg', image2: 'test.jpg' };

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: { content, slug: 'test', path: 'posts/test.md' },
        },
      },
    ];

    const mockCollection = { name: 'posts', _type: 'entry' };

    vi.mocked(get).mockReturnValue({ _baseURL: '' });
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });

    await getEntriesByAssetURL('test.jpg', { entries: mockEntries, newURL: 'new.jpg' });

    // Both matching fields must be processed so both get replaced
    expect(vi.mocked(getField)).toHaveBeenCalledTimes(2);
    expect(content.image1).toBe('new.jpg');
    expect(content.image2).toBe('new.jpg');
  });

  test('skips non-string values that come first (line 206 branch 0)', async () => {
    // When a non-string value is the FIRST key in content, it triggers line 206’s continue
    // before the loop can break early. The numeric `count` key is processed first,
    // which forces `typeof 42 !== 'string'` = true → continue (branch 0).
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');
    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            // count (non-string) is inserted FIRST so it’s iterated before image
            content: { count: 42, image: 'target.jpg' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = { name: 'posts', _type: 'entry' };

    vi.mocked(get).mockReturnValue({ _baseURL: '' });
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });

    const result = await getEntriesByAssetURL('target.jpg', { entries: mockEntries });

    // count:42 → continue (line 206 branch 0); image:‘target.jpg’ → found
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('processes fields where hasAsset returns false before a matching field (line 238 false branch)', async () => {
    // A string field whose value contains the asset URL passes the pre-filter at
    // line 209, but `hasAsset` returns false for a non-asset widget (line 178),
    // causing `matched = false` → `if (matched)` false branch at line 238.
    // The second field (image) matches and sets found = true.
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');
    const { isCollectionIndexFile } = await import('$lib/services/contents/collection/index-file');
    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            // description contains the URL but is a string field (not image)
            content: { description: 'See target.jpg for more', image: 'target.jpg' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = { name: 'posts', _type: 'entry' };

    vi.mocked(get).mockReturnValue({ _baseURL: '' });
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockImplementation(({ keyPath }) => {
      if (keyPath === 'description') return { name: 'description', widget: 'string' };
      if (keyPath === 'image') return { name: 'image', widget: 'image' };

      return undefined;
    });

    const result = await getEntriesByAssetURL('target.jpg', { entries: mockEntries });

    // description → hasAsset returns false (string widget), matched=false (line 238 false branch)
    // image → hasAsset returns true, found=true
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});

describe('selectedEntries', () => {
  test('is exported as a writable store', () => {
    expect(selectedEntries).toBeDefined();
    expect(typeof selectedEntries.subscribe).toBe('function');
  });
});

describe('canCreateIndexFile()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns false when collection has no index file configured', async () => {
    const { getIndexFile } = await import('$lib/services/contents/collection/index-file');

    vi.mocked(getIndexFile).mockReturnValue(undefined);

    // @ts-ignore - Intentionally incomplete for testing
    const result = canCreateIndexFile({ name: 'posts' });

    expect(result).toBe(false);
  });

  test('returns true when index file does not yet exist in collection entries', async () => {
    const { getIndexFile } = await import('$lib/services/contents/collection/index-file');
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
    };

    vi.mocked(getIndexFile).mockReturnValue({ name: '_index' });
    vi.mocked(getCollection).mockReturnValue(collection);

    const entries = [
      { id: '1', slug: 'post-1', locales: { en: { content: {} } } },
      { id: '2', slug: 'post-2', locales: { en: { content: {} } } },
    ];

    vi.mocked(get).mockReturnValue(entries);
    vi.mocked(getAssociatedCollections)
      .mockReturnValueOnce([{ name: 'posts' }])
      .mockReturnValueOnce([{ name: 'posts' }]);

    // @ts-ignore - Intentionally incomplete for testing
    const result = canCreateIndexFile(collection);

    expect(result).toBe(true);
  });

  test('returns false when index file already exists in collection entries', async () => {
    const { getIndexFile } = await import('$lib/services/contents/collection/index-file');
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
    };

    vi.mocked(getIndexFile).mockReturnValue({ name: '_index' });
    vi.mocked(getCollection).mockReturnValue(collection);

    const entries = [
      { id: '1', slug: '_index', locales: { en: { content: {} } } },
      { id: '2', slug: 'post-1', locales: { en: { content: {} } } },
    ];

    vi.mocked(get).mockReturnValue(entries);
    vi.mocked(getAssociatedCollections)
      .mockReturnValueOnce([{ name: 'posts' }])
      .mockReturnValueOnce([{ name: 'posts' }]);

    // @ts-ignore - Intentionally incomplete for testing
    const result = canCreateIndexFile(collection);

    expect(result).toBe(false);
  });

  test('returns false when custom-named index file already exists', async () => {
    const { getIndexFile } = await import('$lib/services/contents/collection/index-file');
    const { getCollection } = await import('$lib/services/contents/collection');
    const { getAssociatedCollections } = await import('$lib/services/contents/entry');

    const collection = {
      name: 'posts',
      _type: 'entry',
      _i18n: { defaultLocale: 'en' },
    };

    vi.mocked(getIndexFile).mockReturnValue({ name: 'home' });
    vi.mocked(getCollection).mockReturnValue(collection);

    const entries = [
      { id: '1', slug: 'home', locales: { en: { content: {} } } },
      { id: '2', slug: 'post-1', locales: { en: { content: {} } } },
    ];

    vi.mocked(get).mockReturnValue(entries);
    vi.mocked(getAssociatedCollections)
      .mockReturnValueOnce([{ name: 'posts' }])
      .mockReturnValueOnce([{ name: 'posts' }]);

    // @ts-ignore - Intentionally incomplete for testing
    const result = canCreateIndexFile(collection);

    expect(result).toBe(false);
  });
});
