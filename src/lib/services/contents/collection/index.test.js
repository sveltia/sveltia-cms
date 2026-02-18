// @ts-nocheck

import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getCollection,
  getCollectionIndex,
  getCollectionLabel,
  getFirstCollection,
  getSingletonCollection,
  getThumbnailFieldNames,
  getValidCollections,
  isEntryCollection,
  isFileCollection,
  isSingletonCollection,
  isValidCollection,
  parseEntryCollection,
  parseFileCollection,
} from '$lib/services/contents/collection';

// Mock dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
  writable: vi.fn(),
}));
vi.mock('svelte-i18n', () => ({
  _: { subscribe: vi.fn() },
}));
vi.mock('$lib/services/config', () => ({
  cmsConfig: { subscribe: vi.fn() },
}));
vi.mock('$lib/services/contents/collection/files', () => ({
  getValidCollectionFiles: vi.fn(),
  isValidCollectionFile: vi.fn(),
}));
vi.mock('$lib/services/contents/file/config', () => ({
  getFileConfig: vi.fn(),
}));
vi.mock('$lib/services/contents/i18n', () => ({
  normalizeI18nConfig: vi.fn(),
}));

describe('isEntryCollection()', () => {
  test('returns true for collection with folder property', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isEntryCollection(collection)).toBe(true);
  });

  test('returns false for collection with files property', () => {
    const collection = {
      name: 'pages',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isEntryCollection(collection)).toBe(false);
  });

  test('returns false for collection with both folder and files', () => {
    const collection = {
      name: 'mixed',
      folder: 'content',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isEntryCollection(collection)).toBe(false);
  });

  test('returns false for collection without folder', () => {
    const collection = {
      name: 'invalid',
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isEntryCollection(collection)).toBe(false);
  });
});

describe('isFileCollection()', () => {
  test('returns true for collection with files property', () => {
    const collection = {
      name: 'pages',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isFileCollection(collection)).toBe(true);
  });

  test('returns false for collection with folder property', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isFileCollection(collection)).toBe(false);
  });

  test('returns false for collection without files', () => {
    const collection = {
      name: 'invalid',
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isFileCollection(collection)).toBe(false);
  });
});

describe('isSingletonCollection()', () => {
  test('returns true for _singletons collection with files', () => {
    const collection = {
      name: '_singletons',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isSingletonCollection(collection)).toBe(true);
  });

  test('returns false for non-singleton file collection', () => {
    const collection = {
      name: 'pages',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isSingletonCollection(collection)).toBe(false);
  });

  test('returns false for entry collection', () => {
    const collection = {
      name: '_singletons',
      folder: 'content',
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isSingletonCollection(collection)).toBe(false);
  });
});

describe('isValidCollection()', () => {
  test('returns true for valid entry collection', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isValidCollection(collection)).toBe(true);
  });

  test('returns true for valid file collection', () => {
    const collection = {
      name: 'pages',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isValidCollection(collection)).toBe(true);
  });

  test('returns false for divider', () => {
    const divider = {
      divider: true,
    };

    expect(isValidCollection(divider)).toBe(false);
  });

  test('returns false for hidden collection when visible=true', () => {
    const collection = {
      name: 'hidden',
      folder: 'content/hidden',
      hide: true,
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isValidCollection(collection, { visible: true })).toBe(false);
  });

  test('returns true for hidden collection when visible=false', () => {
    const collection = {
      name: 'hidden',
      folder: 'content/hidden',
      hide: true,
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isValidCollection(collection, { visible: false })).toBe(true);
  });

  test('filters by type=entry', () => {
    const entryCollection = {
      name: 'posts',
      folder: 'content/posts',
      fields: [{ name: 'title', widget: 'string' }],
    };

    const fileCollection = {
      name: 'pages',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isValidCollection(entryCollection, { type: 'entry' })).toBe(true);
    expect(isValidCollection(fileCollection, { type: 'entry' })).toBe(false);
  });

  test('filters by type=file', () => {
    const entryCollection = {
      name: 'posts',
      folder: 'content/posts',
      fields: [{ name: 'title', widget: 'string' }],
    };

    const fileCollection = {
      name: 'pages',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isValidCollection(entryCollection, { type: 'file' })).toBe(false);
    expect(isValidCollection(fileCollection, { type: 'file' })).toBe(true);
  });

  test('filters by type=singleton', () => {
    const singletonCollection = {
      name: '_singletons',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    const regularFileCollection = {
      name: 'pages',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isValidCollection(singletonCollection, { type: 'singleton' })).toBe(true);
    expect(isValidCollection(regularFileCollection, { type: 'singleton' })).toBe(false);
  });
});

describe('getValidCollections()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('filters out invalid collections and dividers', () => {
    const collections = [
      {
        name: 'posts',
        folder: 'content/posts',
        fields: [{ name: 'title', widget: 'string' }],
      },
      {
        divider: true,
      },
      {
        name: 'pages',
        files: [{ name: 'about', file: 'about.md', fields: [] }],
      },
      {
        name: 'invalid',
        // No folder or files
        fields: [{ name: 'title', widget: 'string' }],
      },
    ];

    vi.mocked(get).mockReturnValue({ collections });

    const validCollections = getValidCollections();

    expect(validCollections).toHaveLength(2);
    expect(validCollections[0].name).toBe('posts');
    expect(validCollections[1].name).toBe('pages');
  });

  test('filters by visible collections', () => {
    const collections = [
      {
        name: 'visible',
        folder: 'content/visible',
        fields: [{ name: 'title', widget: 'string' }],
      },
      {
        name: 'hidden',
        folder: 'content/hidden',
        hide: true,
        fields: [{ name: 'title', widget: 'string' }],
      },
    ];

    vi.mocked(get).mockReturnValue({ collections });

    const validCollections = getValidCollections({ visible: true });

    expect(validCollections).toHaveLength(1);
    expect(validCollections[0].name).toBe('visible');
  });

  test('filters by collection type', () => {
    const collections = [
      {
        name: 'posts',
        folder: 'content/posts',
        fields: [{ name: 'title', widget: 'string' }],
      },
      {
        name: 'pages',
        files: [{ name: 'about', file: 'about.md', fields: [] }],
      },
    ];

    vi.mocked(get).mockReturnValue({ collections });

    const entryCollections = getValidCollections({ type: 'entry' });
    const fileCollections = getValidCollections({ type: 'file' });

    expect(entryCollections).toHaveLength(1);
    expect(entryCollections[0].name).toBe('posts');

    expect(fileCollections).toHaveLength(1);
    expect(fileCollections[0].name).toBe('pages');
  });

  test('uses provided collections array', () => {
    const collections = [
      {
        name: 'custom',
        folder: 'content/custom',
        fields: [{ name: 'title', widget: 'string' }],
      },
    ];

    const validCollections = getValidCollections({ collections });

    expect(validCollections).toHaveLength(1);
    expect(validCollections[0].name).toBe('custom');
    expect(get).not.toHaveBeenCalled();
  });
});

describe('getFirstCollection()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns first visible collection', () => {
    const collections = [
      {
        name: 'hidden',
        folder: 'content/hidden',
        hide: true,
        fields: [{ name: 'title', widget: 'string' }],
      },
      {
        name: 'first-visible',
        folder: 'content/first',
        fields: [{ name: 'title', widget: 'string' }],
      },
      {
        name: 'second-visible',
        folder: 'content/second',
        fields: [{ name: 'title', widget: 'string' }],
      },
    ];

    vi.mocked(get).mockReturnValue({ collections });

    const firstCollection = getFirstCollection();

    expect(firstCollection?.name).toBe('first-visible');
  });

  test('returns undefined when no visible collections', () => {
    const collections = [
      {
        name: 'hidden',
        folder: 'content/hidden',
        hide: true,
        fields: [{ name: 'title', widget: 'string' }],
      },
    ];

    vi.mocked(get).mockReturnValue({ collections });

    const firstCollection = getFirstCollection();

    expect(firstCollection).toBeUndefined();
  });
});

describe('getCollectionIndex()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns high index for singleton collection', () => {
    const index = getCollectionIndex('_singletons');

    expect(index).toBe(9999999);
  });

  test('returns index of collection in collections array', () => {
    const collections = [
      { name: 'first', folder: 'content/first', fields: [] },
      { name: 'second', folder: 'content/second', fields: [] },
      { name: 'third', folder: 'content/third', fields: [] },
    ];

    vi.mocked(get).mockReturnValue({ collections });

    expect(getCollectionIndex('first')).toBe(0);
    expect(getCollectionIndex('second')).toBe(1);
    expect(getCollectionIndex('third')).toBe(2);
  });

  test('returns -1 for non-existent collection', () => {
    const collections = [{ name: 'first', folder: 'content/first', fields: [] }];

    vi.mocked(get).mockReturnValue({ collections });

    const index = getCollectionIndex('non-existent');

    expect(index).toBe(-1);
  });

  test('returns -1 for undefined collection name', () => {
    const index = getCollectionIndex(undefined);

    expect(index).toBe(-1);
  });

  test('returns -1 when cmsConfig is undefined', () => {
    vi.mocked(get).mockReturnValue(undefined);

    const index = getCollectionIndex('some-collection');

    expect(index).toBe(-1);
  });
});

describe('getThumbnailFieldNames()', () => {
  test('returns empty array for collection without folder', () => {
    const collection = {
      name: 'pages',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(getThumbnailFieldNames(collection)).toEqual([]);
  });

  test('returns single thumbnail field name', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      thumbnail: 'featuredImage',
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(getThumbnailFieldNames(collection)).toEqual(['featuredImage']);
  });

  test('returns multiple thumbnail field names', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      thumbnail: ['featuredImage', 'image', 'photo'],
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(getThumbnailFieldNames(collection)).toEqual(['featuredImage', 'image', 'photo']);
  });

  test('infers image fields when thumbnail not specified', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'featured', widget: 'image' },
        { name: 'content', widget: 'markdown' },
        { name: 'attachment', widget: 'file' },
      ],
    };

    expect(getThumbnailFieldNames(collection)).toEqual(['featured', 'attachment']);
  });

  test('infers image fields by default when thumbnail property is not specified', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'featured', widget: 'image' },
        { name: 'attachment', widget: 'file' },
      ],
    };

    expect(getThumbnailFieldNames(collection)).toEqual(['featured', 'attachment']);
  });

  test('returns empty array when no image/file fields and no explicit thumbnail', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'content', widget: 'markdown' },
      ],
    };

    expect(getThumbnailFieldNames(collection)).toEqual([]);
  });

  test('returns empty array when thumbnail is set to false', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      thumbnail: false,
      fields: [
        { name: 'featured', widget: 'image' },
        { name: 'attachment', widget: 'file' },
      ],
    };

    expect(getThumbnailFieldNames(collection)).toEqual([]);
  });

  test('infers image fields when thumbnail is set to true', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      thumbnail: true,
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'featured', widget: 'image' },
        { name: 'attachment', widget: 'file' },
      ],
    };

    expect(getThumbnailFieldNames(collection)).toEqual(['featured', 'attachment']);
  });

  test('returns empty array when folder collection has no fields (line 166)', () => {
    // thumbnail defaults to true, fields is undefined → reaches `return []` at line 166
    const collection = {
      name: 'posts',
      folder: 'content/posts',
    };

    expect(getThumbnailFieldNames(collection)).toEqual([]);
  });
});

describe('parseEntryCollection()', () => {
  beforeEach(async () => {
    const { getFileConfig } = await import('$lib/services/contents/file/config');

    vi.mocked(getFileConfig).mockReturnValue({ fullPath: '/content/posts' });
  });

  test('parses entry collection correctly', () => {
    const rawCollection = {
      name: 'posts',
      folder: 'content/posts',
      fields: [{ name: 'title', widget: 'string' }],
    };

    const i18n = { defaultLocale: 'en' };
    const result = parseEntryCollection(rawCollection, i18n);

    expect(result).toEqual({
      ...rawCollection,
      _i18n: i18n,
      _type: 'entry',
      _file: { fullPath: '/content/posts' },
      _thumbnailFieldNames: [],
    });
  });

  test('includes thumbnail field names', () => {
    const rawCollection = {
      name: 'posts',
      folder: 'content/posts',
      thumbnail: 'featuredImage',
      fields: [{ name: 'title', widget: 'string' }],
    };

    const i18n = { defaultLocale: 'en' };
    const result = parseEntryCollection(rawCollection, i18n);

    expect(result._thumbnailFieldNames).toEqual(['featuredImage']);
  });
});

describe('parseFileCollection()', () => {
  beforeEach(async () => {
    const { getFileConfig } = await import('$lib/services/contents/file/config');
    const { normalizeI18nConfig } = await import('$lib/services/contents/i18n');
    const { isValidCollectionFile } = await import('$lib/services/contents/collection/files');

    vi.mocked(getFileConfig).mockReturnValue({ fullPath: '/about.md' });
    vi.mocked(normalizeI18nConfig).mockReturnValue({ defaultLocale: 'en' });
    vi.mocked(isValidCollectionFile).mockReturnValue(true);

    // Mock cmsConfig to include i18n property for normalizeI18nConfig
    vi.mocked(get).mockReturnValue({
      name: 'Test Site',
      i18n: { locales: ['en'], defaultLocale: 'en' },
    });
  });

  test('parses file collection correctly', () => {
    const rawCollection = {
      name: 'pages',
      files: [{ name: 'about', file: 'about.md', fields: [{ name: 'title', widget: 'string' }] }],
    };

    const i18n = { defaultLocale: 'en' };
    const { files } = rawCollection;
    const result = parseFileCollection(rawCollection, i18n, files);

    expect(result).toEqual({
      ...rawCollection,
      _i18n: { defaultLocale: 'en' },
      _type: 'file',
      _fileMap: {
        about: {
          name: 'about',
          file: 'about.md',
          fields: [{ name: 'title', widget: 'string' }],
          _file: { fullPath: '/about.md' },
          _i18n: expect.objectContaining({
            defaultLocale: expect.any(String),
            i18nEnabled: expect.any(Boolean),
          }),
        },
      },
    });
  });

  test('parses singleton collection correctly', () => {
    const rawCollection = {
      name: '_singletons',
      files: [
        { name: 'config', file: 'config.yml', fields: [{ name: 'site_name', widget: 'string' }] },
      ],
    };

    const i18n = { defaultLocale: 'en' };
    const { files } = rawCollection;
    const result = parseFileCollection(rawCollection, i18n, files);

    expect(result._type).toBe('singleton');
  });
});

describe('getCollectionLabel()', () => {
  beforeEach(() => {
    vi.mocked(get).mockReturnValue((key) => {
      if (key === 'files') return 'Files';
      return key;
    });
  });

  test('returns "Files" for singleton collection', () => {
    const collection = {
      name: '_singletons',
      _type: 'singleton',
      label: 'Singleton Files',
    };

    expect(getCollectionLabel(collection)).toBe('Files');
  });

  test('returns singular label when requested', () => {
    const collection = {
      name: 'posts',
      _type: 'entry',
      label: 'Blog Posts',
      label_singular: 'Blog Post',
    };

    expect(getCollectionLabel(collection, { useSingular: true })).toBe('Blog Post');
  });

  test('returns regular label when singular not available', () => {
    const collection = {
      name: 'posts',
      _type: 'entry',
      label: 'Blog Posts',
    };

    expect(getCollectionLabel(collection, { useSingular: true })).toBe('Blog Posts');
  });

  test('returns name when label not available', () => {
    const collection = {
      name: 'posts',
      _type: 'entry',
    };

    expect(getCollectionLabel(collection)).toBe('posts');
  });
});

describe('getCollection()', () => {
  beforeEach(async () => {
    const { getFileConfig } = await import('$lib/services/contents/file/config');
    const { normalizeI18nConfig } = await import('$lib/services/contents/i18n');

    const { getValidCollectionFiles, isValidCollectionFile } =
      await import('$lib/services/contents/collection/files');

    vi.mocked(getFileConfig).mockReturnValue({ fullPath: '/content/posts' });
    vi.mocked(normalizeI18nConfig).mockReturnValue({ defaultLocale: 'en' });
    vi.mocked(getValidCollectionFiles).mockReturnValue([]);
    vi.mocked(isValidCollectionFile).mockReturnValue(true);
  });

  test('returns cached collection if available', async () => {
    const cachedCollection = { name: 'cached', _type: 'entry' };
    const { collectionCacheMap } = await import('$lib/services/contents/collection');

    collectionCacheMap.set('cached', cachedCollection);

    const result = getCollection('cached');

    expect(result).toBe(cachedCollection);
  });

  test('returns singleton collection for _singletons', async () => {
    const { getValidCollectionFiles } = await import('$lib/services/contents/collection/files');

    vi.mocked(getValidCollectionFiles).mockReturnValue([
      { name: 'config', file: 'config.yml', fields: [] },
    ]);
    vi.mocked(get).mockReturnValue({
      name: 'Test Site',
      i18n: { locales: ['en'], defaultLocale: 'en' },
      singletons: [{ name: 'config', file: 'config.yml', fields: [] }],
    });

    const result = getCollection('_singletons');

    expect(result?._type).toBe('singleton');
    expect(result?.name).toBe('_singletons');
  });

  test('returns undefined for non-existent collection', () => {
    vi.mocked(get).mockReturnValue({ collections: [] });

    const result = getCollection('non-existent');

    expect(result).toBeUndefined();
  });

  test('parses entry collection', () => {
    const collections = [
      {
        name: 'posts',
        folder: 'content/posts',
        fields: [{ name: 'title', widget: 'string' }],
      },
    ];

    vi.mocked(get).mockReturnValue({ collections });

    const result = getCollection('posts');

    expect(result?._type).toBe('entry');
    expect(result?.folder).toBe('content/posts');
  });

  test('parses file collection', () => {
    const collections = [
      {
        name: 'pages',
        files: [{ name: 'about', file: 'about.md', fields: [] }],
      },
    ];

    vi.mocked(get).mockReturnValue({ collections });

    const result = getCollection('pages');

    expect(result?._type).toBe('file');
    expect(result?._fileMap).toBeDefined();
  });

  test('strips leading/trailing slashes from entry collection folder path', () => {
    const collections = [
      {
        name: 'posts',
        folder: '/content/posts/',
        fields: [{ name: 'title', widget: 'string' }],
      },
    ];

    vi.mocked(get).mockReturnValue({ collections });

    const result = getCollection('posts');

    expect(result?.folder).toBe('content/posts');
  });

  test('handles file collection with slash-padded file paths', () => {
    const collections = [
      {
        name: 'pages',
        files: [
          { name: 'about', file: '/about.md', fields: [] },
          { name: 'contact', file: 'contact.md', fields: [] },
        ],
      },
    ];

    vi.mocked(get).mockReturnValue({ collections });

    const result = getCollection('pages');

    expect(result?._type).toBe('file');
    expect(result?._fileMap).toBeDefined();
  });
});

describe('getSingletonCollection()', () => {
  beforeEach(async () => {
    const { getValidCollectionFiles } = await import('$lib/services/contents/collection/files');
    const { normalizeI18nConfig } = await import('$lib/services/contents/i18n');

    vi.mocked(getValidCollectionFiles).mockImplementation((files) => files);
    vi.mocked(normalizeI18nConfig).mockReturnValue({ defaultLocale: 'en' });
  });

  test('returns undefined when no singletons defined', () => {
    vi.mocked(get).mockReturnValue({});

    const result = getSingletonCollection();

    expect(result).toBeUndefined();
  });

  test('returns undefined when singletons is not an array', () => {
    vi.mocked(get).mockReturnValue({ singletons: 'invalid' });

    const result = getSingletonCollection();

    expect(result).toBeUndefined();
  });

  test('returns undefined when no valid files', async () => {
    const { getValidCollectionFiles } = await import('$lib/services/contents/collection/files');

    vi.mocked(getValidCollectionFiles).mockReturnValue([]);
    vi.mocked(get).mockReturnValue({
      singletons: [{ name: 'invalid' }],
    });

    const result = getSingletonCollection();

    expect(result).toBeUndefined();
  });

  test('creates singleton collection with valid files', () => {
    vi.mocked(get).mockReturnValue({
      singletons: [{ name: 'config', file: '/config.yml', fields: [] }],
    });

    const result = getSingletonCollection();

    expect(result?.name).toBe('_singletons');
    expect(result?._type).toBe('singleton');
    expect(result?.files?.[0].file).toBe('config.yml');
  });
});
