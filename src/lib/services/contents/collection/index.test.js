// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';
import {
  getCollection,
  getCollectionIndex,
  getCollectionLabel,
  getFirstCollection,
  getSingletonCollection,
  getThumbnailFieldNames,
  getValidCollections,
  parseEntryCollection,
  parseFileCollection,
} from '$lib/services/contents/collection';

// Mock dependencies
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key) => key),
}));
vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
}));
vi.mock('$lib/services/contents/collection/predicates', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getValidCollectionFiles: vi.fn(),
  isValidCollectionFile: vi.fn(),
}));
vi.mock('$lib/services/contents/file/config', () => ({
  getFileConfig: vi.fn(),
}));
vi.mock('$lib/services/contents/i18n', () => ({
  normalizeI18nConfig: vi.fn(),
}));
vi.mock('$lib/services/contents/i18n/config', () => ({
  normalizeI18nConfig: vi.fn(),
}));

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
        // No fields or files
        folder: 'content/invalid',
      },
    ];

    cmsConfig.current = /** @type {any} */ ({ collections });

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

    cmsConfig.current = /** @type {any} */ ({ collections });

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

    cmsConfig.current = /** @type {any} */ ({ collections });

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

    cmsConfig.current = /** @type {any} */ ({ collections });

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

    cmsConfig.current = /** @type {any} */ ({ collections });

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

    cmsConfig.current = /** @type {any} */ ({ collections });

    expect(getCollectionIndex('first')).toBe(0);
    expect(getCollectionIndex('second')).toBe(1);
    expect(getCollectionIndex('third')).toBe(2);
  });

  test('returns -1 for non-existent collection', () => {
    const collections = [{ name: 'first', folder: 'content/first', fields: [] }];

    cmsConfig.current = /** @type {any} */ ({ collections });

    const index = getCollectionIndex('non-existent');

    expect(index).toBe(-1);
  });

  test('returns -1 for undefined collection name', () => {
    const index = getCollectionIndex(undefined);

    expect(index).toBe(-1);
  });

  test('returns -1 when cmsConfig is undefined', () => {
    cmsConfig.current = undefined;

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

  test('appends wildcard to multiple image and file fields', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'featured', widget: 'image', multiple: true },
        { name: 'attachment', widget: 'file', multiple: false },
      ],
    };

    expect(getThumbnailFieldNames(collection)).toEqual(['featured.*', 'attachment']);
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

  test('returns empty array when folder collection has no fields', () => {
    // thumbnail defaults to true, fields is empty → reaches the last `return []`
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      fields: [],
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

    const { normalizeI18nConfig: normalizeI18nConfigFromConfig } =
      await import('$lib/services/contents/i18n/config');

    const { isValidCollectionFile } = await import('$lib/services/contents/collection/predicates');

    vi.mocked(getFileConfig).mockReturnValue({ fullPath: '/about.md' });
    vi.mocked(normalizeI18nConfig).mockReturnValue({ defaultLocale: 'en' });
    vi.mocked(normalizeI18nConfigFromConfig).mockReturnValue({
      defaultLocale: 'en',
      i18nEnabled: false,
    });
    vi.mocked(isValidCollectionFile).mockReturnValue(true);

    // Mock cmsConfig to include i18n property for normalizeI18nConfig
    cmsConfig.current = /** @type {any} */ ({
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
  beforeEach(async () => {
    const { _ } = await import('@sveltia/i18n');

    vi.mocked(_).mockImplementation((key) => (key === 'files' ? 'Files' : key));
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

    const { normalizeI18nConfig: normalizeI18nConfigFromConfig } =
      await import('$lib/services/contents/i18n/config');

    const { getValidCollectionFiles, isValidCollectionFile } =
      await import('$lib/services/contents/collection/predicates');

    vi.mocked(getFileConfig).mockReturnValue({ fullPath: '/content/posts' });
    vi.mocked(normalizeI18nConfig).mockReturnValue({ defaultLocale: 'en' });
    vi.mocked(normalizeI18nConfigFromConfig).mockReturnValue({ defaultLocale: 'en' });
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
    const { getValidCollectionFiles } =
      await import('$lib/services/contents/collection/predicates');

    vi.mocked(getValidCollectionFiles).mockReturnValue([
      { name: 'config', file: 'config.yml', fields: [] },
    ]);
    cmsConfig.current = /** @type {any} */ ({
      name: 'Test Site',
      i18n: { locales: ['en'], defaultLocale: 'en' },
      singletons: [{ name: 'config', file: 'config.yml', fields: [] }],
    });

    const result = getCollection('_singletons');

    expect(result?._type).toBe('singleton');
    expect(result?.name).toBe('_singletons');
  });

  test('returns undefined for non-existent collection', () => {
    cmsConfig.current = /** @type {any} */ ({ collections: [] });

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

    cmsConfig.current = /** @type {any} */ ({ collections });

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

    cmsConfig.current = /** @type {any} */ ({ collections });

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

    cmsConfig.current = /** @type {any} */ ({ collections });

    const result = getCollection('posts');

    expect(result?.folder).toBe('content/posts');
  });

  test('strips leading/trailing slashes from entry collection file path', () => {
    const collections = [
      {
        name: 'members',
        file: '/data/members.json/',
        fields: [{ name: 'title', widget: 'string' }],
      },
    ];

    cmsConfig.current = /** @type {any} */ ({ collections });

    const result = getCollection('members');

    expect(result?._type).toBe('entry');
    expect(result?.file).toBe('data/members.json');
    expect(result?.folder).toBeUndefined();
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

    cmsConfig.current = /** @type {any} */ ({ collections });

    const result = getCollection('pages');

    expect(result?._type).toBe('file');
    expect(result?._fileMap).toBeDefined();
  });

  test('skips file path normalization when file item has no file property (line 276 false branch)', () => {
    const collections = [
      {
        name: 'pages-no-file',
        files: [
          { name: 'about', fields: [] }, // no 'file' property → if (f.file) is false
        ],
      },
    ];

    cmsConfig.current = /** @type {any} */ ({ collections });

    // Should not throw; the file item without `file` is silently skipped
    const result = getCollection('pages-no-file');

    expect(result?._type).toBe('file');
  });
});

describe('getSingletonCollection()', () => {
  beforeEach(async () => {
    const { getValidCollectionFiles } =
      await import('$lib/services/contents/collection/predicates');

    const { normalizeI18nConfig } = await import('$lib/services/contents/i18n');

    vi.mocked(getValidCollectionFiles).mockImplementation((files) => files);
    vi.mocked(normalizeI18nConfig).mockReturnValue({ defaultLocale: 'en' });
  });

  test('returns undefined when no singletons defined', () => {
    cmsConfig.current = /** @type {any} */ ({});

    const result = getSingletonCollection();

    expect(result).toBeUndefined();
  });

  test('returns undefined when singletons is not an array', () => {
    cmsConfig.current = /** @type {any} */ ({ singletons: 'invalid' });

    const result = getSingletonCollection();

    expect(result).toBeUndefined();
  });

  test('returns undefined when no valid files', async () => {
    const { getValidCollectionFiles } =
      await import('$lib/services/contents/collection/predicates');

    vi.mocked(getValidCollectionFiles).mockReturnValue([]);
    cmsConfig.current = /** @type {any} */ ({
      singletons: [{ name: 'invalid' }],
    });

    const result = getSingletonCollection();

    expect(result).toBeUndefined();
  });

  test('creates singleton collection with valid files', () => {
    cmsConfig.current = /** @type {any} */ ({
      singletons: [{ name: 'config', file: '/config.yml', fields: [] }],
    });

    const result = getSingletonCollection();

    expect(result?.name).toBe('_singletons');
    expect(result?._type).toBe('singleton');
    expect(result?.files?.[0].file).toBe('config.yml');
  });
});
