import { get } from 'svelte/store';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { getCollection, getValidCollections } from '$lib/services/contents/collection';
import {
  isValidCollectionFile,
  getValidCollectionFiles,
  getCollectionFile,
  getCollectionFileLabel,
  getCollectionFilesByEntry,
  getCollectionFileEntry,
  getCollectionFileIndex,
} from '$lib/services/contents/collection/files';
import { getAssociatedCollections } from '$lib/services/contents/entry';

// Mock dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
}));
vi.mock('$lib/services/config', () => ({
  siteConfig: { subscribe: vi.fn() },
}));
vi.mock('$lib/services/contents', () => ({
  allEntries: { subscribe: vi.fn() },
}));
vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
  getValidCollections: vi.fn(),
}));
vi.mock('$lib/services/contents/entry', () => ({
  getAssociatedCollections: vi.fn(),
}));

describe('isValidCollectionFile()', () => {
  test('returns true for valid collection file', () => {
    const validFile = {
      name: 'test-file',
      file: 'test.md',
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isValidCollectionFile(validFile)).toBe(true);
  });

  test('returns false for divider', () => {
    const divider = {
      divider: true,
    };

    expect(isValidCollectionFile(divider)).toBe(false);
  });

  test('returns false for file without string file property', () => {
    const invalidFile = {
      name: 'test-file',
      file: 123, // Not a string
      fields: [{ name: 'title', widget: 'string' }],
    };

    // Cast to any to test the type validation
    expect(isValidCollectionFile(/** @type {any} */ (invalidFile))).toBe(false);
  });

  test('returns false for file without fields array', () => {
    const invalidFile = {
      name: 'test-file',
      file: 'test.md',
      fields: 'not-an-array',
    };

    // Cast to any to test the type validation
    expect(isValidCollectionFile(/** @type {any} */ (invalidFile))).toBe(false);
  });

  test('returns false for file without fields', () => {
    const invalidFile = {
      name: 'test-file',
      file: 'test.md',
    };

    // Cast to any to test the type validation
    expect(isValidCollectionFile(/** @type {any} */ (invalidFile))).toBe(false);
  });
});

describe('getValidCollectionFiles()', () => {
  test('filters out dividers and invalid files', () => {
    const files = [
      {
        name: 'valid-file-1',
        file: 'test1.md',
        fields: [{ name: 'title', widget: 'string' }],
      },
      {
        divider: true,
      },
      {
        name: 'valid-file-2',
        file: 'test2.md',
        fields: [{ name: 'content', widget: 'markdown' }],
      },
      {
        name: 'invalid-file',
        file: 123, // Invalid file property
        fields: [{ name: 'title', widget: 'string' }],
      },
    ];

    const validFiles = getValidCollectionFiles(/** @type {any} */ (files));

    expect(validFiles).toHaveLength(2);
    expect(validFiles[0].name).toBe('valid-file-1');
    expect(validFiles[1].name).toBe('valid-file-2');
  });

  test('returns empty array for no valid files', () => {
    const files = [
      { divider: true },
      {
        name: 'invalid-file',
        file: 123,
        fields: 'not-an-array',
      },
    ];

    const validFiles = getValidCollectionFiles(/** @type {any} */ (files));

    expect(validFiles).toHaveLength(0);
  });

  test('returns all files when all are valid', () => {
    const files = [
      {
        name: 'file-1',
        file: 'test1.md',
        fields: [{ name: 'title', widget: 'string' }],
      },
      {
        name: 'file-2',
        file: 'test2.md',
        fields: [{ name: 'content', widget: 'markdown' }],
      },
    ];

    const validFiles = getValidCollectionFiles(files);

    expect(validFiles).toHaveLength(2);
    expect(validFiles).toEqual(files);
  });
});

describe('getCollectionFile()', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  test('returns file from collection by name', () => {
    const mockFile = {
      name: 'test-file',
      file: 'test.md',
      fields: [{ name: 'title', widget: 'string' }],
      _file: { extension: 'md', format: 'frontmatter' },
      _i18n: { defaultLocale: 'en' },
    };

    const mockCollection = {
      name: 'test-collection',
      _type: /** @type {'file'} */ ('file'),
      _i18n: { defaultLocale: 'en' },
      _fileMap: {
        'test-file': mockFile,
      },
    };

    vi.mocked(getCollection).mockReturnValue(/** @type {any} */ (mockCollection));

    const result = getCollectionFile('test-collection', 'test-file');

    expect(result).toBe(mockFile);
    expect(getCollection).toHaveBeenCalledWith('test-collection');
  });

  test('returns file from collection object', () => {
    const mockFile = {
      name: 'test-file',
      file: 'test.md',
      fields: [{ name: 'title', widget: 'string' }],
      _file: { extension: 'md', format: 'frontmatter' },
      _i18n: { defaultLocale: 'en' },
    };

    const mockCollection = {
      name: 'test-collection',
      _type: /** @type {'file'} */ ('file'),
      _i18n: { defaultLocale: 'en' },
      _fileMap: {
        'test-file': mockFile,
      },
    };

    const result = getCollectionFile(/** @type {any} */ (mockCollection), 'test-file');

    expect(result).toBe(mockFile);
    expect(getCollection).not.toHaveBeenCalled();
  });

  test('returns undefined for non-existent collection', () => {
    vi.mocked(getCollection).mockReturnValue(undefined);

    const result = getCollectionFile('non-existent', 'test-file');

    expect(result).toBeUndefined();
  });

  test('returns undefined for entry collection (no _fileMap)', () => {
    const mockCollection = {
      name: 'entry-collection',
      _type: 'entry',
      folder: 'posts',
    };

    vi.mocked(getCollection).mockReturnValue(/** @type {any} */ (mockCollection));

    const result = getCollectionFile('entry-collection', 'test-file');

    expect(result).toBeUndefined();
  });

  test('returns undefined for non-existent file', () => {
    const mockCollection = {
      name: 'test-collection',
      _type: 'file',
      _fileMap: {},
    };

    vi.mocked(getCollection).mockReturnValue(/** @type {any} */ (mockCollection));

    const result = getCollectionFile('test-collection', 'non-existent-file');

    expect(result).toBeUndefined();
  });
});

describe('getCollectionFileLabel()', () => {
  test('returns label when provided', () => {
    const file = {
      name: 'test-file',
      label: 'Test File Label',
      file: 'test.md',
      fields: [],
      _file: { extension: 'md', format: 'frontmatter' },
      _i18n: { defaultLocale: 'en' },
    };

    expect(getCollectionFileLabel(/** @type {any} */ (file))).toBe('Test File Label');
  });

  test('returns name when label is not provided', () => {
    const file = {
      name: 'test-file',
      file: 'test.md',
      fields: [],
      _file: { extension: 'md', format: 'frontmatter' },
      _i18n: { defaultLocale: 'en' },
    };

    expect(getCollectionFileLabel(/** @type {any} */ (file))).toBe('test-file');
  });

  test('returns name when label is empty string', () => {
    const file = {
      name: 'test-file',
      label: '',
      file: 'test.md',
      fields: [],
      _file: { extension: 'md', format: 'frontmatter' },
      _i18n: { defaultLocale: 'en' },
    };

    expect(getCollectionFileLabel(/** @type {any} */ (file))).toBe('test-file');
  });
});

describe('getCollectionFilesByEntry()', () => {
  test('returns matching files for file/singleton collection', () => {
    const entry = {
      slug: 'test-entry',
      subPath: '',
      locales: {
        en: {
          path: 'content/test.md',
          slug: 'test-entry',
          content: {},
        },
      },
      i18n: { defaultLocale: 'en' },
      id: 'test-id',
    };

    const matchingFile = {
      name: 'matching-file',
      file: 'test.md',
      fields: [],
      _file: { fullPath: 'content/test.md' },
      _i18n: { defaultLocale: 'en' },
    };

    const nonMatchingFile = {
      name: 'non-matching-file',
      file: 'other.md',
      fields: [],
      _file: { fullPath: 'content/other.md' },
      _i18n: { defaultLocale: 'en' },
    };

    const collection = {
      name: 'test-collection',
      _type: 'file',
      _i18n: { defaultLocale: 'en' },
      _fileMap: {
        'matching-file': matchingFile,
        'non-matching-file': nonMatchingFile,
      },
    };

    const result = getCollectionFilesByEntry(
      /** @type {any} */ (collection),
      /** @type {any} */ (entry),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(matchingFile);
  });

  test('returns empty array for entry collection', () => {
    const entry = {
      slug: 'test-entry',
      subPath: '',
      locales: {
        en: {
          path: 'content/test.md',
          slug: 'test-entry',
          content: {},
        },
      },
      i18n: { defaultLocale: 'en' },
      id: 'test-id',
    };

    const collection = {
      name: 'entry-collection',
      _type: 'entry',
      folder: 'posts',
    };

    const result = getCollectionFilesByEntry(
      /** @type {any} */ (collection),
      /** @type {any} */ (entry),
    );

    expect(result).toHaveLength(0);
  });

  test('returns empty array when no files match', () => {
    const entry = {
      slug: 'test-entry',
      subPath: '',
      locales: {
        en: {
          path: 'content/test.md',
          slug: 'test-entry',
          content: {},
        },
      },
      i18n: { defaultLocale: 'en' },
      id: 'test-id',
    };

    const nonMatchingFile = {
      name: 'non-matching-file',
      file: 'other.md',
      fields: [],
      _file: { fullPath: 'content/other.md' },
      _i18n: { defaultLocale: 'en' },
    };

    const collection = {
      name: 'test-collection',
      _type: 'file',
      _i18n: { defaultLocale: 'en' },
      _fileMap: {
        'non-matching-file': nonMatchingFile,
      },
    };

    const result = getCollectionFilesByEntry(
      /** @type {any} */ (collection),
      /** @type {any} */ (entry),
    );

    expect(result).toHaveLength(0);
  });
});

describe('getCollectionFileEntry()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns entry that matches collection and file name', () => {
    const mockEntry = {
      slug: 'test-entry',
      locales: {
        en: {
          path: 'content/test.md',
          slug: 'test-entry',
          content: {},
        },
      },
      i18n: { defaultLocale: 'en' },
      id: 'test-id',
    };

    const mockFile = {
      name: 'test-file',
      file: 'test.md',
      fields: [],
      _file: { fullPath: 'content/test.md' },
      _i18n: { defaultLocale: 'en' },
    };

    const mockCollection = {
      name: 'test-collection',
      _type: 'file',
      _i18n: { defaultLocale: 'en' },
      _fileMap: {
        'test-file': mockFile,
      },
    };

    vi.mocked(get).mockReturnValue([mockEntry]);
    vi.mocked(getAssociatedCollections).mockReturnValue([/** @type {any} */ (mockCollection)]);

    const result = getCollectionFileEntry('test-collection', 'test-file');

    expect(result).toBe(mockEntry);
  });

  test('returns undefined when no entry matches', () => {
    vi.mocked(get).mockReturnValue([]);

    const result = getCollectionFileEntry('test-collection', 'test-file');

    expect(result).toBeUndefined();
  });

  test('returns undefined when collection name does not match', () => {
    const mockEntry = {
      slug: 'test-entry',
      locales: {
        en: {
          path: 'content/test.md',
          slug: 'test-entry',
          content: {},
        },
      },
      i18n: { defaultLocale: 'en' },
      id: 'test-id',
    };

    const mockCollection = {
      name: 'different-collection',
      _type: 'file',
      _i18n: { defaultLocale: 'en' },
      _fileMap: {},
    };

    vi.mocked(get).mockReturnValue([mockEntry]);
    vi.mocked(getAssociatedCollections).mockReturnValue([/** @type {any} */ (mockCollection)]);

    const result = getCollectionFileEntry('test-collection', 'test-file');

    expect(result).toBeUndefined();
  });
});

describe('getCollectionFileIndex()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns index for singleton collection file', () => {
    const mockSingletons = [
      {
        name: 'about',
        file: 'about.md',
        fields: [{ name: 'title', widget: 'string' }],
      },
      {
        name: 'contact',
        file: 'contact.md',
        fields: [{ name: 'title', widget: 'string' }],
      },
    ];

    vi.mocked(get).mockReturnValue({
      collections: [],
      singletons: mockSingletons,
    });

    const result = getCollectionFileIndex('_singletons', 'contact');

    expect(result).toBe(1);
  });

  test('returns -1 for singleton collection when singletons is not array', () => {
    vi.mocked(get).mockReturnValue({
      collections: [],
      singletons: null,
    });

    const result = getCollectionFileIndex('_singletons', 'contact');

    expect(result).toBe(-1);
  });

  test('returns index for regular collection file', () => {
    const mockCollection = {
      name: 'test-collection',
      files: [
        { name: 'file1', file: 'file1.md', fields: [] },
        { name: 'file2', file: 'file2.md', fields: [] },
        { name: 'target-file', file: 'target.md', fields: [] },
      ],
    };

    vi.mocked(get).mockReturnValue({
      collections: [mockCollection],
      singletons: [],
    });
    vi.mocked(getValidCollections).mockReturnValue([mockCollection]);

    const result = getCollectionFileIndex('test-collection', 'target-file');

    expect(result).toBe(2);
  });

  test('returns -1 for non-existent collection', () => {
    vi.mocked(get).mockReturnValue({
      collections: [],
      singletons: [],
    });
    vi.mocked(getValidCollections).mockReturnValue([]);

    const result = getCollectionFileIndex('non-existent-collection', 'test-file');

    expect(result).toBe(-1);
  });

  test('returns -1 for non-existent file in collection', () => {
    const mockCollection = {
      name: 'test-collection',
      files: [
        { name: 'file1', file: 'file1.md', fields: [] },
        { name: 'file2', file: 'file2.md', fields: [] },
      ],
    };

    vi.mocked(get).mockReturnValue({
      collections: [mockCollection],
      singletons: [],
    });
    vi.mocked(getValidCollections).mockReturnValue([mockCollection]);

    const result = getCollectionFileIndex('test-collection', 'non-existent-file');

    expect(result).toBe(-1);
  });

  test('returns -1 when collection name is undefined', () => {
    const result = getCollectionFileIndex(undefined, 'test-file');

    expect(result).toBe(-1);
  });

  test('returns -1 when file name is undefined', () => {
    const result = getCollectionFileIndex('test-collection', undefined);

    expect(result).toBe(-1);
  });

  test('returns -1 when both collection and file names are undefined', () => {
    const result = getCollectionFileIndex(undefined, undefined);

    expect(result).toBe(-1);
  });
});
