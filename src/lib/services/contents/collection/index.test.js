import { get } from 'svelte/store';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import {
  isEntryCollection,
  isFileCollection,
  isSingletonCollection,
  isValidCollection,
  getValidCollections,
  getFirstCollection,
  getCollectionIndex,
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
  siteConfig: { subscribe: vi.fn() },
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

  test('returns -1 when siteConfig is undefined', () => {
    vi.mocked(get).mockReturnValue(undefined);

    const index = getCollectionIndex('some-collection');

    expect(index).toBe(-1);
  });
});
