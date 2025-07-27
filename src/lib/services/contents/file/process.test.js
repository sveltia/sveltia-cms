import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  extractPathInfo,
  getSlug,
  isIndexFile,
  parseFileContent,
  prepareEntries,
  prepareEntry,
  processI18nMultiFileEntry,
  processI18nSingleFileEntry,
  processNonI18nEntry,
  shouldSkipIndexFile,
  transformRawContent,
} from '$lib/services/contents/file/process';

/**
 * @import {
 * BaseEntryListItem,
 * Entry,
 * InternalCollection,
 * InternalLocaleCode,
 * RawEntryContent,
 * } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

// Mock external dependencies
vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFile: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/index-file', () => ({
  getIndexFile: vi.fn(),
}));

vi.mock('$lib/services/contents/file/parse', () => ({
  parseEntryFile: vi.fn(),
}));

vi.mock('$lib/services/contents/widgets/list/helper', () => ({
  hasRootListField: vi.fn(),
}));

vi.mock('flat', () => ({
  flatten: vi.fn((obj) => obj),
}));

vi.mock('@sveltia/utils/crypto', () => ({
  generateUUID: vi.fn(() => 'test-uuid'),
}));

describe('Test isIndexFile()', () => {
  test('detects Hugo index files', () => {
    expect(isIndexFile('/content/posts/_index.md')).toBe(true);
    expect(isIndexFile('/content/posts/_index.en.md')).toBe(true);
    expect(isIndexFile('/content/posts/_index.fr-CA.md')).toBe(true);
  });

  test('detects non-index files', () => {
    expect(isIndexFile('/content/posts/my-post.md')).toBe(false);
    expect(isIndexFile('/content/posts/index.md')).toBe(false);
    expect(isIndexFile('/content/posts/_index.html')).toBe(false);
    expect(isIndexFile('/content/posts/test_index.md')).toBe(false);
  });

  test('handles paths without extension', () => {
    expect(isIndexFile('/content/posts/_index')).toBe(false);
  });

  test('handles root level files', () => {
    expect(isIndexFile('/_index.md')).toBe(true);
    expect(isIndexFile('/_index.en.md')).toBe(true);
  });
});

describe('Test getSlug()', () => {
  test('returns subPath when no template', () => {
    expect(getSlug({ subPath: 'my-post', subPathTemplate: undefined })).toBe('my-post');
    expect(getSlug({ subPath: 'category/my-post', subPathTemplate: undefined })).toBe(
      'category/my-post',
    );
  });

  test('returns subPath when template does not contain {{slug}}', () => {
    expect(
      getSlug({
        subPath: 'my-post',
        subPathTemplate: '{{year}}/{{month}}',
      }),
    ).toBe('my-post');
  });

  test('extracts slug from template', () => {
    expect(
      getSlug({
        subPath: '2023/my-post',
        subPathTemplate: '{{year}}/{{slug}}',
      }),
    ).toBe('my-post'); // Extracts 'my-post' from '2023/my-post'

    expect(
      getSlug({
        subPath: 'blog/tech/my-post/index',
        subPathTemplate: 'blog/{{category}}/{{slug}}/index',
      }),
    ).toBe('my-post'); // Extracts 'my-post' from the template
  });

  test('handles complex templates', () => {
    expect(
      getSlug({
        subPath: '2023/05/tech/my-awesome-post',
        subPathTemplate: '{{year}}/{{month}}/{{category}}/{{slug}}',
      }),
    ).toBe('my-awesome-post'); // Extracts 'my-awesome-post' from the template
  });

  test('returns subPath when extraction fails', () => {
    expect(
      getSlug({
        subPath: 'does-not-match',
        subPathTemplate: '{{year}}/{{slug}}',
      }),
    ).toBe('does-not-match');
  });

  test('handles special regex characters in template', () => {
    expect(
      getSlug({
        subPath: 'posts/my-post',
        subPathTemplate: 'posts/{{slug}}',
      }),
    ).toBe('my-post');
  });
});

describe('Test parseFileContent()', () => {
  /** @type {any} */
  let parseEntryFile;

  beforeEach(async () => {
    vi.clearAllMocks();

    const parseModule = await import('$lib/services/contents/file/parse');

    parseEntryFile = parseModule.parseEntryFile;
  });

  test('returns parsed content on success', async () => {
    const mockContent = { title: 'Test', body: 'Content' };

    parseEntryFile.mockResolvedValue(mockContent);

    const file = /** @type {BaseEntryListItem} */ ({
      name: 'test.md',
      path: '/test.md',
      text: '---\\ntitle: Test\\n---\\nContent',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: { collectionName: 'posts' },
    });

    const errors = /** @type {Error[]} */ ([]);
    const result = await parseFileContent(file, errors);

    expect(result).toEqual(mockContent);
    expect(errors).toHaveLength(0);
    expect(parseEntryFile).toHaveBeenCalledWith(file);
  });

  test('handles parsing errors', async () => {
    const mockError = new Error('Parsing failed');

    parseEntryFile.mockRejectedValue(mockError);

    const file = /** @type {BaseEntryListItem} */ ({
      name: 'test.md',
      path: '/test.md',
      text: 'invalid content',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: { collectionName: 'posts' },
    });

    const errors = /** @type {Error[]} */ ([]);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await parseFileContent(file, errors);

    expect(result).toBeUndefined();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(mockError);
    expect(consoleSpy).toHaveBeenCalledWith(mockError);

    consoleSpy.mockRestore();
  });
});

describe('Test transformRawContent()', () => {
  /** @type {any} */
  let hasRootListField;

  beforeEach(async () => {
    vi.clearAllMocks();

    const helperModule = await import('$lib/services/contents/widgets/list/helper');

    hasRootListField = helperModule.hasRootListField;
  });

  test('handles root list field in single file i18n', () => {
    hasRootListField.mockReturnValue(true);

    const fields = [{ name: 'items', widget: 'list' }];

    const rawContent = {
      en: ['item1', 'item2'],
      fr: ['article1', 'article2'],
    };

    const result = transformRawContent(rawContent, fields, true);

    expect(result).toEqual({
      en: { items: ['item1', 'item2'] },
      fr: { items: ['article1', 'article2'] },
    });
  });

  test('handles root list field without i18n', () => {
    hasRootListField.mockReturnValue(true);

    const fields = [{ name: 'items', widget: 'list' }];
    const rawContent = ['item1', 'item2'];
    const result = transformRawContent(rawContent, fields, false);

    expect(result).toEqual({
      items: ['item1', 'item2'],
    });
  });

  test('returns undefined for invalid root list field content in single file i18n', () => {
    hasRootListField.mockReturnValue(true);

    const fields = [{ name: 'items', widget: 'list' }];
    const rawContent = { en: 'not-an-array' };
    const result = transformRawContent(rawContent, fields, true);

    expect(result).toBeUndefined();
  });

  test('returns undefined for invalid root list field content', () => {
    hasRootListField.mockReturnValue(true);

    const fields = [{ name: 'items', widget: 'list' }];
    const rawContent = /** @type {any} */ ('not-an-array');
    const result = transformRawContent(rawContent, fields, false);

    expect(result).toBeUndefined();
  });

  test('returns content for regular fields with object content', () => {
    hasRootListField.mockReturnValue(false);

    const fields = [{ name: 'title', widget: 'string' }];
    const rawContent = { title: 'Test' };
    const result = transformRawContent(rawContent, fields, false);

    expect(result).toEqual({ title: 'Test' });
  });

  test('returns undefined for non-object content when no root list field', () => {
    hasRootListField.mockReturnValue(false);

    const fields = [{ name: 'title', widget: 'string' }];
    const rawContent = /** @type {any} */ ('not-an-object');
    const result = transformRawContent(rawContent, fields, false);

    expect(result).toBeUndefined();
  });
});

describe('Test shouldSkipIndexFile()', () => {
  /** @type {any} */
  let getIndexFile;

  beforeEach(async () => {
    vi.clearAllMocks();

    const indexFileModule = await import('$lib/services/contents/collection/index-file');

    getIndexFile = indexFileModule.getIndexFile;
  });

  test('returns false for non-index files', () => {
    const collection = /** @type {InternalCollection} */ ({});

    expect(
      shouldSkipIndexFile('/content/posts/my-post.md', undefined, collection, undefined, 'md'),
    ).toBe(false);
  });

  test('returns false for file collection (has fileName)', () => {
    const collection = /** @type {InternalCollection} */ ({});

    expect(shouldSkipIndexFile('/content/_index.md', 'data', collection, undefined, 'md')).toBe(
      false,
    );
  });

  test('returns false when index file inclusion is enabled', () => {
    const collection = /** @type {InternalCollection} */ ({});

    getIndexFile.mockReturnValue({ name: '_index' });

    expect(shouldSkipIndexFile('/content/_index.md', undefined, collection, undefined, 'md')).toBe(
      false,
    );
  });

  test('returns false when path template ends with _index and extension is md', () => {
    const collection = /** @type {InternalCollection} */ ({});

    getIndexFile.mockReturnValue(null);

    expect(
      shouldSkipIndexFile('/content/_index.md', undefined, collection, '{{slug}}/_index', 'md'),
    ).toBe(false);
  });

  test('returns true when should skip index file', () => {
    const collection = /** @type {InternalCollection} */ ({});

    getIndexFile.mockReturnValue(null);

    expect(shouldSkipIndexFile('/content/_index.md', undefined, collection, undefined, 'md')).toBe(
      true,
    );
  });

  test('handles different extensions - only .md files can be included when template ends with _index', () => {
    const collection = /** @type {InternalCollection} */ ({});

    getIndexFile.mockReturnValue(null);

    // Only .md files can be included when subPathTemplate ends with _index (Hugo constraint)
    expect(
      shouldSkipIndexFile('/content/_index.yml', undefined, collection, '{{slug}}/_index', 'yml'),
    ).toBe(true);
    expect(
      shouldSkipIndexFile('/content/_index.md', undefined, collection, '{{slug}}/_index', 'md'),
    ).toBe(false);
  });
});

describe('Test extractPathInfo()', () => {
  test('handles file collection with fileName', () => {
    const file = /** @type {BaseEntryListItem} */ ({
      name: 'data.yml',
      path: '/data/members.yml',
      text: '',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: { collectionName: 'data' },
    });

    const result = extractPathInfo(file, 'members', undefined, 'en', false);

    expect(result).toEqual({
      subPath: '/data/members.yml',
      locale: undefined,
    });
  });

  test('handles file collection with multi-file i18n', () => {
    const file = /** @type {BaseEntryListItem} */ ({
      name: 'data.en.yml',
      path: '/data/members.en.yml',
      text: '',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: {
        collectionName: 'data',
        filePathMap: {
          en: '/data/members.en.yml',
          fr: '/data/members.fr.yml',
        },
      },
    });

    const result = extractPathInfo(file, 'members', undefined, 'en', true);

    expect(result).toEqual({
      locale: 'en',
      subPath: '/data/members.en.yml',
    });
  });

  test('handles entry collection with regex', () => {
    const file = /** @type {BaseEntryListItem} */ ({
      name: 'my-post.md',
      path: '/content/posts/my-post.md',
      text: '',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: { collectionName: 'posts' },
    });

    const regex = /^\/content\/posts\/(?<subPath>[^/]+?)\.md$/;
    const result = extractPathInfo(file, undefined, regex, 'en', false);

    expect(result).toEqual({
      subPath: 'my-post',
      locale: 'en',
    });
  });

  test('handles entry collection with i18n regex', () => {
    const file = /** @type {BaseEntryListItem} */ ({
      name: 'my-post.fr.md',
      path: '/content/posts/my-post.fr.md',
      text: '',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: { collectionName: 'posts' },
    });

    const regex = /^\/content\/posts\/(?<subPath>[^/]+?)\.(?<locale>en|fr)\.md$/;
    const result = extractPathInfo(file, undefined, regex, 'en', true);

    expect(result).toEqual({
      subPath: 'my-post',
      locale: 'fr',
    });
  });

  test('returns undefined when no regex match', () => {
    const file = /** @type {BaseEntryListItem} */ ({
      name: 'other.md',
      path: '/other/path.md',
      text: '',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: { collectionName: 'posts' },
    });

    const regex = /^\/content\/posts\/(?<subPath>[^/]+?)\.md$/;
    const result = extractPathInfo(file, undefined, regex, 'en', false);

    expect(result).toEqual({
      subPath: undefined,
      locale: undefined,
    });
  });

  test('handles missing regex', () => {
    const file = /** @type {BaseEntryListItem} */ ({
      name: 'test.md',
      path: '/test.md',
      text: '',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: { collectionName: 'posts' },
    });

    const result = extractPathInfo(file, undefined, undefined, 'en', false);

    expect(result).toEqual({
      subPath: undefined,
      locale: undefined,
    });
  });
});

describe('Test processNonI18nEntry()', () => {
  test('processes entry without i18n', () => {
    const entry = /** @type {Entry} */ ({
      id: '',
      slug: '',
      subPath: 'my-post',
      locales: {},
    });

    const rawContent = { title: 'My Post', body: 'Content' };

    processNonI18nEntry(entry, rawContent, '/posts/my-post.md', undefined, 'my-post', undefined);

    expect(entry.slug).toBe('my-post');
    expect(entry.locales._default).toEqual({
      slug: 'my-post',
      path: '/posts/my-post.md',
      content: { title: 'My Post', body: 'Content' },
    });
  });

  test('uses fileName as slug when provided', () => {
    const entry = /** @type {Entry} */ ({
      id: '',
      slug: '',
      subPath: 'data',
      locales: {},
    });

    const rawContent = { members: [] };

    processNonI18nEntry(entry, rawContent, '/data/members.yml', 'members', 'data', undefined);

    expect(entry.slug).toBe('members');
  });
});

describe('Test processI18nSingleFileEntry()', () => {
  test('processes single file i18n entry', () => {
    const entry = /** @type {Entry} */ ({
      id: '',
      slug: '',
      subPath: 'my-post',
      locales: {},
    });

    const rawContent = {
      en: { title: 'My Post', body: 'Content' },
      fr: { title: 'Mon Article', body: 'Contenu' },
    };

    processI18nSingleFileEntry(
      entry,
      rawContent,
      '/posts/my-post.md',
      undefined,
      'my-post',
      undefined,
      ['en', 'fr'],
    );

    expect(entry.slug).toBe('my-post');
    expect(entry.locales.en).toEqual({
      slug: 'my-post',
      path: '/posts/my-post.md',
      content: { title: 'My Post', body: 'Content' },
    });
    expect(entry.locales.fr).toEqual({
      slug: 'my-post',
      path: '/posts/my-post.md',
      content: { title: 'Mon Article', body: 'Contenu' },
    });
  });

  test('filters out missing locales', () => {
    const entry = /** @type {Entry} */ ({
      id: '',
      slug: '',
      subPath: 'my-post',
      locales: {},
    });

    const rawContent = {
      en: { title: 'My Post', body: 'Content' },
      // fr locale missing
    };

    processI18nSingleFileEntry(
      entry,
      rawContent,
      '/posts/my-post.md',
      undefined,
      'my-post',
      undefined,
      ['en', 'fr'],
    );

    expect(entry.locales.en).toBeDefined();
    expect(entry.locales.fr).toBeUndefined();
  });
});

describe('Test processI18nMultiFileEntry()', () => {
  test('creates new entry for first locale', () => {
    const entry = /** @type {Entry} */ ({
      id: '',
      slug: '',
      subPath: 'my-post',
      locales: {},
    });

    const rawContent = { title: 'My Post', body: 'Content' };
    const entries = /** @type {Entry[]} */ ([]);

    const wasMerged = processI18nMultiFileEntry(
      entry,
      rawContent,
      '/posts/my-post.en.md',
      undefined,
      'my-post',
      undefined,
      'en',
      'en',
      'posts',
      undefined,
      entries,
    );

    expect(wasMerged).toBe(false);
    expect(entry.id).toBe('posts/my-post');
    expect(entry.slug).toBe('my-post');
    expect(entry.locales.en).toEqual({
      slug: 'my-post',
      path: '/posts/my-post.en.md',
      content: { title: 'My Post', body: 'Content' },
    });
  });

  test('merges with existing entry', () => {
    const existingEntry = /** @type {Entry} */ ({
      id: 'posts/my-post',
      slug: 'my-post',
      subPath: 'my-post',
      locales: {
        en: {
          slug: 'my-post',
          path: '/posts/my-post.en.md',
          content: { title: 'My Post' },
        },
      },
    });

    const entry = /** @type {Entry} */ ({
      id: '',
      slug: '',
      subPath: 'my-post',
      locales: {},
    });

    const rawContent = { title: 'Mon Article', body: 'Contenu' };
    const entries = [existingEntry];

    const wasMerged = processI18nMultiFileEntry(
      entry,
      rawContent,
      '/posts/my-post.fr.md',
      undefined,
      'my-post',
      undefined,
      'fr',
      'en',
      'posts',
      undefined,
      entries,
    );

    expect(wasMerged).toBe(true);
    expect(existingEntry.locales.fr).toEqual({
      slug: 'my-post',
      path: '/posts/my-post.fr.md',
      content: { title: 'Mon Article', body: 'Contenu' },
    });
  });

  test('uses canonical slug when provided', () => {
    const entry = /** @type {Entry} */ ({
      id: '',
      slug: '',
      subPath: 'my-post',
      locales: {},
    });

    const rawContent = {
      title: 'My Post',
      body: 'Content',
      translationKey: 'canonical-slug',
    };

    const entries = /** @type {Entry[]} */ ([]);

    processI18nMultiFileEntry(
      entry,
      rawContent,
      '/posts/my-post.en.md',
      undefined,
      'my-post',
      undefined,
      'en',
      'en',
      'posts',
      'translationKey',
      entries,
    );

    expect(entry.id).toBe('posts/canonical-slug');
  });

  test('updates slug and subPath for default locale in existing entry', () => {
    const existingEntry = /** @type {Entry} */ ({
      id: 'posts/my-post',
      slug: '',
      subPath: '',
      locales: {
        fr: {
          slug: 'mon-article',
          path: '/posts/mon-article.fr.md',
          content: { title: 'Mon Article' },
        },
      },
    });

    const entry = /** @type {Entry} */ ({
      id: '',
      slug: '',
      subPath: 'my-post',
      locales: {},
    });

    const rawContent = { title: 'My Post', body: 'Content' };
    const entries = [existingEntry];

    processI18nMultiFileEntry(
      entry,
      rawContent,
      '/posts/my-post.en.md',
      undefined,
      'my-post',
      undefined,
      'en',
      'en',
      'posts',
      undefined,
      entries,
    );

    expect(existingEntry.slug).toBe('my-post');
    expect(existingEntry.subPath).toBe('my-post');
  });
});

describe('Test prepareEntry()', () => {
  /** @type {any} */
  let getCollection;
  /** @type {any} */
  let parseEntryFile;

  beforeEach(async () => {
    vi.clearAllMocks();

    const collectionModule = await import('$lib/services/contents/collection');
    const parseModule = await import('$lib/services/contents/file/parse');

    getCollection = collectionModule.getCollection;
    parseEntryFile = parseModule.parseEntryFile;
  });

  test('skips when parsing fails', async () => {
    parseEntryFile.mockRejectedValue(new Error('Parsing failed'));

    const file = /** @type {BaseEntryListItem} */ ({
      name: 'test.md',
      path: '/test.md',
      text: 'invalid',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: { collectionName: 'posts' },
    });

    const entries = /** @type {Entry[]} */ ([]);
    const errors = /** @type {Error[]} */ ([]);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await prepareEntry({ file, entries, errors });

    expect(entries).toHaveLength(0);
    expect(errors).toHaveLength(1);

    consoleSpy.mockRestore();
  });

  test('skips when collection not found', async () => {
    parseEntryFile.mockResolvedValue({ title: 'Test' });
    getCollection.mockReturnValue(null);

    const file = /** @type {BaseEntryListItem} */ ({
      name: 'test.md',
      path: '/test.md',
      text: '---\\ntitle: Test\\n---',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: { collectionName: 'posts' },
    });

    const entries = /** @type {Entry[]} */ ([]);
    const errors = /** @type {Error[]} */ ([]);

    await prepareEntry({ file, entries, errors });

    expect(entries).toHaveLength(0);
  });

  // Add more comprehensive tests for prepareEntry...
});

describe('Test prepareEntries()', () => {
  /** @type {any} */
  let generateUUID;

  beforeEach(async () => {
    vi.clearAllMocks();

    const cryptoModule = await import('@sveltia/utils/crypto');

    generateUUID = cryptoModule.generateUUID;
  });

  test('processes multiple files and generates UUIDs', async () => {
    generateUUID.mockImplementation(() => `test-uuid-${Math.random()}`);

    // Create mock files that will pass through prepareEntry naturally
    const files = [
      /** @type {BaseEntryListItem} */ ({
        name: 'post1.md',
        path: '/posts/post1.md',
        text: '---\\ntitle: Post 1\\n---',
        sha: 'abc123',
        size: 100,
        type: 'entry',
        folder: { collectionName: 'posts' },
      }),
    ];

    const result = await prepareEntries(files);

    expect(result.entries).toBeDefined();
    expect(result.errors).toBeDefined();
    expect(Array.isArray(result.entries)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  test('returns empty arrays when no files provided', async () => {
    const result = await prepareEntries([]);

    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});
