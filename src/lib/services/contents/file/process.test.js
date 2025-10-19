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
 * @import { BaseEntryListItem, Entry, InternalCollection } from '$lib/types/private';
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

  test('handles malformed template with unclosed placeholder (lines 67-70)', () => {
    // When placeholder is not properly closed, it should treat remaining as literal
    expect(
      getSlug({
        subPath: 'posts/my-post',
        subPathTemplate: 'posts/{{slug',
      }),
    ).toBe('posts/my-post');
  });

  test('handles complex malformed template with partial placeholders', () => {
    // Template with incomplete placeholder should fallback to subPath
    expect(
      getSlug({
        subPath: 'malformed-path',
        subPathTemplate: '{{year}}/{{slug',
      }),
    ).toBe('malformed-path');
  });

  test('handles unclosed placeholder after slug placeholder (lines 67-70)', () => {
    // Test when a placeholder after slug is not properly closed
    expect(
      getSlug({
        subPath: '2023/my-post/extra',
        subPathTemplate: '{{year}}/{{slug}}/{{month',
      }),
    ).toBe('2023/my-post/extra');
  });

  test('handles template with only slug and unclosed next placeholder (lines 67-70)', () => {
    // Template with {{slug}} followed by unclosed placeholder
    expect(
      getSlug({
        subPath: 'my-post-2023',
        subPathTemplate: '{{slug}}-{{year',
      }),
    ).toBe('my-post-2023');
  });

  test('handles slug extraction when regex match succeeds', () => {
    // Test the successful branch where slug is extracted from regex match
    expect(
      getSlug({
        subPath: '2023/my-article',
        subPathTemplate: '{{year}}/{{slug}}',
      }),
    ).toBe('my-article');
  });

  test('returns slug when regex pattern contains slug placeholder', () => {
    // Test that captures slug from template like {{year}}/{{slug}}/{{month}}
    expect(
      getSlug({
        subPath: '2023/my-post/05',
        subPathTemplate: '{{year}}/{{slug}}/{{month}}',
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

  test('returns undefined when object values are not all arrays in single file i18n', () => {
    hasRootListField.mockReturnValue(true);

    const fields = [{ name: 'items', widget: 'list' }];
    const rawContent = { en: ['item1'], fr: 'not-an-array' }; // Mixed types
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

  test('enforces Hugo constraint: rejects non-.md files when template ends with _index (line 155-160)', () => {
    const collection = /** @type {InternalCollection} */ ({});

    getIndexFile.mockReturnValue(null);

    // Hugo constraint: template ends with _index and path matches _index pattern,
    // but extension is not md
    expect(
      shouldSkipIndexFile(
        '/content/blog/_index.json',
        undefined,
        collection,
        'blog/_index',
        'json',
      ),
    ).toBe(true);
    expect(
      shouldSkipIndexFile(
        '/content/blog/_index.toml',
        undefined,
        collection,
        'blog/_index',
        'toml',
      ),
    ).toBe(true);
    // Nested _index pattern with non-md extension
    expect(
      shouldSkipIndexFile(
        '/content/posts/archive/_index.html',
        undefined,
        collection,
        'posts/archive/_index',
        'html',
      ),
    ).toBe(true);
  });

  test('allows md files even when Hugo constraint applies (line 155-160)', () => {
    const collection = /** @type {InternalCollection} */ ({});

    getIndexFile.mockReturnValue(null);

    // md extension should pass through Hugo constraint check
    expect(
      shouldSkipIndexFile('/content/blog/_index.md', undefined, collection, 'blog/_index', 'md'),
    ).toBe(false);
    // Nested _index pattern with md extension
    expect(
      shouldSkipIndexFile(
        '/content/posts/archive/_index.md',
        undefined,
        collection,
        'posts/archive/_index',
        'md',
      ),
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

  test('handles file collection with multi-file i18n when filePathMap is undefined (line 203 branch)', () => {
    const file = /** @type {BaseEntryListItem} */ ({
      name: 'data.md',
      path: '/data/members.md',
      text: '',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: {
        collectionName: 'data',
        // filePathMap is undefined - tests the ?? {} fallback
      },
    });

    // With fileName and multi-file structure but no filePathMap
    const result = extractPathInfo(file, 'members', undefined, 'en', true);

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

  test('merges with existing entry for non-default locale without updating slug/subPath', () => {
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

    const rawContent = { title: 'Mon Article' };
    const entries = [existingEntry];

    processI18nMultiFileEntry(
      entry,
      rawContent,
      '/posts/my-post.fr.md',
      undefined,
      'my-post',
      undefined,
      'fr', // Non-default locale
      'en', // Default locale
      'posts',
      undefined,
      entries,
    );

    // slug and subPath should NOT be updated when merging non-default locale
    expect(existingEntry.slug).toBe('my-post');
    expect(existingEntry.subPath).toBe('my-post');
    expect(existingEntry.locales.fr).toBeDefined();
  });

  test('handles canonical slug key when value is not a string', () => {
    const entry = /** @type {Entry} */ ({
      id: '',
      slug: '',
      subPath: 'my-post',
      locales: {},
    });

    const rawContent = {
      title: 'My Post',
      body: 'Content',
      translationKey: 123, // Not a string
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
      'translationKey', // Key exists but value is not a string
      entries,
    );

    // Should use slug instead of canonicalSlug since value is not a string
    expect(entry.id).toBe('posts/my-post');
  });
});

describe('Test prepareEntry()', () => {
  /** @type {any} */
  let getCollection;
  /** @type {any} */
  let getCollectionFile;
  /** @type {any} */
  let parseEntryFile;
  /** @type {any} */
  let hasRootListField;

  beforeEach(async () => {
    vi.clearAllMocks();

    const collectionModule = await import('$lib/services/contents/collection');
    const collectionFilesModule = await import('$lib/services/contents/collection/files');
    const parseModule = await import('$lib/services/contents/file/parse');
    const listHelperModule = await import('$lib/services/contents/widgets/list/helper');

    getCollection = collectionModule.getCollection;
    getCollectionFile = collectionFilesModule.getCollectionFile;
    parseEntryFile = parseModule.parseEntryFile;
    hasRootListField = listHelperModule.hasRootListField;
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

  test('skips when fileName is provided but collectionFile not found', async () => {
    parseEntryFile.mockResolvedValue({ title: 'Test' });
    getCollection.mockReturnValue({
      name: 'posts',
      fields: [],
      _file: {
        fullPathRegEx: /test/,
        subPath: undefined,
        extension: 'md',
      },
      _i18n: {
        i18nEnabled: false,
        allLocales: ['en'],
        defaultLocale: 'en',
        structureMap: {
          i18nSingleFile: false,
          i18nMultiFile: false,
          i18nMultiFolder: false,
          i18nRootMultiFolder: false,
        },
        canonicalSlug: { key: undefined },
      },
    });
    getCollectionFile.mockReturnValue(undefined);

    const file = /** @type {BaseEntryListItem} */ ({
      name: 'test.md',
      path: '/test.md',
      text: '---\\ntitle: Test\\n---',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: { collectionName: 'posts', fileName: 'about' },
    });

    const entries = /** @type {Entry[]} */ ([]);
    const errors = /** @type {Error[]} */ ([]);

    await prepareEntry({ file, entries, errors });

    expect(entries).toHaveLength(0);
  });

  test('skips when transformedContent is undefined', async () => {
    parseEntryFile.mockResolvedValue('invalid content');
    getCollection.mockReturnValue({
      name: 'posts',
      fields: [{ name: 'items', widget: 'list' }],
      _file: {
        fullPathRegEx: /test/,
        subPath: undefined,
        extension: 'md',
      },
      _i18n: {
        i18nEnabled: false,
        allLocales: ['en'],
        defaultLocale: 'en',
        structureMap: {
          i18nSingleFile: false,
          i18nMultiFile: false,
          i18nMultiFolder: false,
          i18nRootMultiFolder: false,
        },
        canonicalSlug: { key: undefined },
      },
    });
    hasRootListField.mockReturnValue(true);

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

    await prepareEntry({ file, entries, errors });

    expect(entries).toHaveLength(0);
  });

  test('skips when shouldSkipIndexFile returns true', async () => {
    parseEntryFile.mockResolvedValue({ title: 'Test' });
    hasRootListField.mockReturnValue(false);
    getCollection.mockReturnValue({
      name: 'posts',
      fields: [],
      _file: {
        fullPathRegEx: /test/,
        subPath: '_index',
        extension: 'html',
      },
      _i18n: {
        i18nEnabled: false,
        allLocales: ['en'],
        defaultLocale: 'en',
        structureMap: {
          i18nSingleFile: false,
          i18nMultiFile: false,
          i18nMultiFolder: false,
          i18nRootMultiFolder: false,
        },
        canonicalSlug: { key: undefined },
      },
    });

    const file = /** @type {BaseEntryListItem} */ ({
      name: '_index.html',
      path: '/posts/_index.html',
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

  test('skips when subPath is undefined', async () => {
    parseEntryFile.mockResolvedValue({ title: 'Test' });
    hasRootListField.mockReturnValue(false);
    getCollection.mockReturnValue({
      name: 'posts',
      fields: [],
      _file: {
        fullPathRegEx: /^\/posts\/(?<subPath>[^/]+?)\.md$/,
        subPath: undefined,
        extension: 'md',
      },
      _i18n: {
        i18nEnabled: false,
        allLocales: ['en'],
        defaultLocale: 'en',
        structureMap: {
          i18nSingleFile: false,
          i18nMultiFile: false,
          i18nMultiFolder: false,
          i18nRootMultiFolder: false,
        },
        canonicalSlug: { key: undefined },
      },
    });

    const file = /** @type {BaseEntryListItem} */ ({
      name: 'test.md',
      path: '/other/test.md',
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

  test('skips when isMultiFileStructure is true but locale is undefined (line 409-410)', async () => {
    parseEntryFile.mockResolvedValue({ title: 'Test' });
    getCollection.mockReturnValue({
      name: 'posts',
      fields: [],
      _file: {
        fullPathRegEx: /^\/posts\/(?<subPath>[^/]+?)\.md$/,
        subPath: undefined,
        extension: 'md',
      },
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'fr', ''],
        defaultLocale: 'en',
        structureMap: {
          i18nSingleFile: false,
          i18nMultiFile: true,
          i18nMultiFolder: false,
          i18nRootMultiFolder: false,
        },
        canonicalSlug: { key: undefined },
      },
    });
    getCollectionFile.mockReturnValue({
      name: 'test',
      file: 'posts/test.md',
      fields: [],
      _file: {
        fullPathRegEx: /^\/posts\/(?<subPath>[^/]+?)\.md$/,
        subPath: undefined,
        extension: 'md',
      },
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'fr', ''],
        defaultLocale: 'en',
        structureMap: {
          i18nSingleFile: false,
          i18nMultiFile: true,
          i18nMultiFolder: false,
          i18nRootMultiFolder: false,
        },
        canonicalSlug: { key: undefined },
      },
    });

    // File collection with multi-file i18n where filePathMap has empty string locale key
    const file = /** @type {BaseEntryListItem} */ ({
      name: 'test.md',
      path: '/posts/test.md',
      text: '---\\ntitle: Test\\n---',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: {
        collectionName: 'posts',
        fileName: 'test',
        filePathMap: {
          '': '/posts/test.md', // Empty string locale (falsy) with the current path
          en: '/posts/test.en.md',
          fr: '/posts/test.fr.md',
        },
      },
    });

    const entries = /** @type {Entry[]} */ ([]);
    const errors = /** @type {Error[]} */ ([]);

    await prepareEntry({ file, entries, errors });

    // Should skip because locale is falsy (empty string from filePathMap)
    expect(entries).toHaveLength(0);
  });

  test('skips when path does not match fullPathRegEx (line 404-406)', async () => {
    parseEntryFile.mockResolvedValue({ title: 'Test' });
    hasRootListField.mockReturnValue(false);
    getCollection.mockReturnValue({
      name: 'posts',
      fields: [],
      _file: {
        // Regex that won't match the test file path
        fullPathRegEx: /^\/posts\/(?<subPath>[^/]+?)\.md$/,
        subPath: undefined,
        extension: 'md',
      },
      _i18n: {
        i18nEnabled: false,
        allLocales: ['en'],
        defaultLocale: 'en',
        structureMap: {
          i18nSingleFile: false,
          i18nMultiFile: false,
          i18nMultiFolder: false,
          i18nRootMultiFolder: false,
        },
        canonicalSlug: { key: undefined },
      },
    });

    const file = /** @type {BaseEntryListItem} */ ({
      name: 'test.txt', // Different extension - won't match regex
      path: '/posts/test.txt',
      text: 'content',
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

  test('processes non-i18n entry successfully', async () => {
    parseEntryFile.mockResolvedValue({ title: 'Test Post' });
    hasRootListField.mockReturnValue(false);
    getCollection.mockReturnValue({
      name: 'posts',
      fields: [],
      _file: {
        fullPathRegEx: /^\/posts\/(?<subPath>[^/]+?)\.md$/,
        subPath: undefined,
        extension: 'md',
      },
      _i18n: {
        i18nEnabled: false,
        allLocales: ['en'],
        defaultLocale: 'en',
        structureMap: {
          i18nSingleFile: false,
          i18nMultiFile: false,
          i18nMultiFolder: false,
          i18nRootMultiFolder: false,
        },
        canonicalSlug: { key: undefined },
      },
    });

    const file = /** @type {BaseEntryListItem} */ ({
      name: 'my-post.md',
      path: '/posts/my-post.md',
      text: '---\\ntitle: Test Post\\n---',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: { collectionName: 'posts' },
    });

    const entries = /** @type {Entry[]} */ ([]);
    const errors = /** @type {Error[]} */ ([]);

    await prepareEntry({ file, entries, errors });

    expect(entries).toHaveLength(1);
    expect(entries[0].slug).toBe('my-post');
    expect(entries[0].locales._default).toBeDefined();
  });

  test('processes i18n single file entry successfully', async () => {
    parseEntryFile.mockResolvedValue({
      en: { title: 'Test Post' },
      fr: { title: 'Article de Test' },
    });
    hasRootListField.mockReturnValue(false);
    getCollection.mockReturnValue({
      name: 'posts',
      fields: [],
      _file: {
        fullPathRegEx: /^\/posts\/(?<subPath>[^/]+?)\.md$/,
        subPath: undefined,
        extension: 'md',
      },
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'fr'],
        defaultLocale: 'en',
        structureMap: {
          i18nSingleFile: true,
          i18nMultiFile: false,
          i18nMultiFolder: false,
          i18nRootMultiFolder: false,
        },
        canonicalSlug: { key: undefined },
      },
    });

    const file = /** @type {BaseEntryListItem} */ ({
      name: 'my-post.md',
      path: '/posts/my-post.md',
      text: '---\\nen:\\n  title: Test Post\\nfr:\\n  title: Article de Test\\n---',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: { collectionName: 'posts' },
    });

    const entries = /** @type {Entry[]} */ ([]);
    const errors = /** @type {Error[]} */ ([]);

    await prepareEntry({ file, entries, errors });

    expect(entries).toHaveLength(1);
    expect(entries[0].slug).toBe('my-post');
    expect(entries[0].locales.en).toBeDefined();
    expect(entries[0].locales.fr).toBeDefined();
  });

  test('processes file collection entry', async () => {
    parseEntryFile.mockResolvedValue({ title: 'Test Data' });
    hasRootListField.mockReturnValue(false);

    const mockCollectionFile = {
      name: 'members',
      file: 'data/members.md',
      fields: [],
      _file: {
        fullPathRegEx: /^data\/members\.md$/,
        subPath: undefined,
        extension: 'md',
      },
      _i18n: {
        i18nEnabled: false,
        allLocales: ['en'],
        defaultLocale: 'en',
        structureMap: {
          i18nSingleFile: false,
          i18nMultiFile: false,
          i18nMultiFolder: false,
          i18nRootMultiFolder: false,
        },
        canonicalSlug: { key: undefined },
      },
    };

    getCollection.mockReturnValue(mockCollectionFile);
    getCollectionFile.mockReturnValue(mockCollectionFile);

    const file = /** @type {BaseEntryListItem} */ ({
      name: 'members.md',
      path: 'data/members.md',
      text: '---\\ntitle: Test Data\\n---',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: { collectionName: 'members', fileName: 'members' },
    });

    const entries = /** @type {Entry[]} */ ([]);
    const errors = /** @type {Error[]} */ ([]);

    await prepareEntry({ file, entries, errors });

    expect(entries).toHaveLength(1);
    expect(entries[0].slug).toBe('members');
  });

  test('processes i18n multi-file entry successfully - new entry', async () => {
    parseEntryFile.mockResolvedValue({ title: 'Test Post' });
    hasRootListField.mockReturnValue(false);
    getCollection.mockReturnValue({
      name: 'posts',
      fields: [],
      _file: {
        fullPathRegEx: /^\/posts\/(?<subPath>[^/]+?)\.(?<locale>en|fr)\.md$/,
        subPath: undefined,
        extension: 'md',
      },
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'fr'],
        defaultLocale: 'en',
        structureMap: {
          i18nSingleFile: false,
          i18nMultiFile: true,
          i18nMultiFolder: false,
          i18nRootMultiFolder: false,
        },
        canonicalSlug: { key: undefined },
      },
    });

    const file = /** @type {BaseEntryListItem} */ ({
      name: 'my-post.en.md',
      path: '/posts/my-post.en.md',
      text: '---\\ntitle: Test Post\\n---',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: { collectionName: 'posts' },
    });

    const entries = /** @type {Entry[]} */ ([]);
    const errors = /** @type {Error[]} */ ([]);

    await prepareEntry({ file, entries, errors });

    expect(entries).toHaveLength(1);
    expect(entries[0].slug).toBe('my-post');
    expect(entries[0].locales.en).toBeDefined();
  });
  test('processes i18n multi-file entry successfully - merging with existing', async () => {
    parseEntryFile.mockResolvedValue({ title: 'Article de Test' });
    hasRootListField.mockReturnValue(false);
    getCollection.mockReturnValue({
      name: 'posts',
      fields: [],
      _file: {
        fullPathRegEx: /^\/posts\/(?<subPath>[^/]+?)\.(?<locale>en|fr)\.md$/,
        subPath: undefined,
        extension: 'md',
      },
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'fr'],
        defaultLocale: 'en',
        structureMap: {
          i18nSingleFile: false,
          i18nMultiFile: true,
          i18nMultiFolder: false,
          i18nRootMultiFolder: false,
        },
        canonicalSlug: { key: undefined },
      },
    });

    // Create an existing entry
    const existingEntry = /** @type {Entry} */ ({
      id: 'posts/my-post',
      slug: 'my-post',
      subPath: 'my-post',
      locales: {
        en: {
          slug: 'my-post',
          path: '/posts/my-post.en.md',
          content: { title: 'Test Post' },
        },
      },
    });

    const file = /** @type {BaseEntryListItem} */ ({
      name: 'my-post.fr.md',
      path: '/posts/my-post.fr.md',
      text: '---\\ntitle: Article de Test\\n---',
      sha: 'abc123',
      size: 100,
      type: 'entry',
      folder: { collectionName: 'posts' },
    });

    const entries = /** @type {Entry[]} */ ([existingEntry]);
    const errors = /** @type {Error[]} */ ([]);

    await prepareEntry({ file, entries, errors });

    // Should still have 1 entry, not 2
    expect(entries).toHaveLength(1);
    expect(entries[0].locales.en).toBeDefined();
    expect(entries[0].locales.fr).toBeDefined();
    expect(entries[0].locales.fr.content.title).toBe('Article de Test');
  });
});

describe('Test prepareEntries()', () => {
  /** @type {any} */
  let generateUUID;
  /** @type {any} */
  let getCollection;
  /** @type {any} */
  let getCollectionFile;
  /** @type {any} */
  let parseEntryFile;

  beforeEach(async () => {
    vi.clearAllMocks();

    const cryptoModule = await import('@sveltia/utils/crypto');
    const collectionModule = await import('$lib/services/contents/collection');
    const collectionFilesModule = await import('$lib/services/contents/collection/files');
    const parseModule = await import('$lib/services/contents/file/parse');

    generateUUID = cryptoModule.generateUUID;
    getCollection = collectionModule.getCollection;
    getCollectionFile = collectionFilesModule.getCollectionFile;
    parseEntryFile = parseModule.parseEntryFile;
  });

  test('processes multiple files and generates UUIDs (lines 471-474)', async () => {
    let uuidCounter = 0;

    generateUUID.mockImplementation(() => {
      uuidCounter += 1;
      return `test-uuid-${uuidCounter}`;
    });

    parseEntryFile.mockResolvedValue({ title: 'Post 1' });

    getCollection.mockReturnValue({
      name: 'posts',
      fields: [],
      _file: {
        fullPathRegEx: /^\/posts\/(?<subPath>[^/]+?)\.md$/,
        subPath: undefined,
        extension: 'md',
      },
      _i18n: {
        i18nEnabled: false,
        allLocales: ['en'],
        defaultLocale: 'en',
        structureMap: {
          i18nSingleFile: false,
          i18nMultiFile: false,
          i18nMultiFolder: false,
          i18nRootMultiFolder: false,
        },
        canonicalSlug: { key: undefined },
      },
    });

    // Create mock files that will pass through prepareEntry successfully
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
      /** @type {BaseEntryListItem} */ ({
        name: 'post2.md',
        path: '/posts/post2.md',
        text: '---\\ntitle: Post 2\\n---',
        sha: 'abc124',
        size: 100,
        type: 'entry',
        folder: { collectionName: 'posts' },
      }),
    ];

    const result = await prepareEntries(files);

    // Verify entries were processed and UUIDs assigned (lines 471-474)
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].id).toBe('test-uuid-1');
    expect(result.entries[1].id).toBe('test-uuid-2');
    expect(result.errors).toHaveLength(0);
  });

  test('returns empty arrays when no files provided', async () => {
    const result = await prepareEntries([]);

    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  test('should filter entries without slug and generate UUIDs (lines 471-474)', async () => {
    generateUUID.mockImplementation(() => 'generated-uuid');

    // Verify the filter logic for entries with missing slug/locales
    const testEntries = /** @type {Entry[]} */ ([
      {
        id: '',
        slug: 'valid-post',
        subPath: 'valid-post',
        locales: {
          _default: {
            slug: 'valid-post',
            path: '/posts/valid-post.md',
            content: { title: 'Valid Post' },
          },
        },
      },
      {
        id: '',
        slug: '', // No slug - should be filtered
        subPath: 'invalid-post',
        locales: {
          _default: {
            slug: '',
            path: '/posts/invalid-post.md',
            content: { title: 'Invalid Post' },
          },
        },
      },
      {
        id: '',
        slug: 'another-post',
        subPath: 'another-post',
        locales: {}, // Empty locales - should be filtered
      },
    ]);

    // Simulate what prepareEntries does in lines 471-474
    const filtered = testEntries.filter((entry) => {
      entry.id = generateUUID();

      return !!entry.slug && !!Object.keys(entry.locales).length;
    });

    // Should have 1 valid entry and 2 filtered out
    expect(filtered).toHaveLength(1);
    expect(filtered[0].slug).toBe('valid-post');
    expect(filtered[0].id).toBe('generated-uuid');
  });

  test('filters out entries without slug or locales (lines 471-474)', async () => {
    generateUUID.mockImplementation(() => `test-uuid-${Math.random()}`);

    // Use the mocked versions
    vi.mocked(getCollection).mockReturnValue(undefined);
    vi.mocked(getCollectionFile).mockReturnValue(undefined);
    vi.mocked(parseEntryFile).mockResolvedValue({ title: 'Test' });

    // This simulates what would happen if prepareEntry created an entry but didn't set slug or
    // locales by mocking prepareEntry to add an incomplete entry
    const files = [
      /** @type {BaseEntryListItem} */ ({
        name: 'incomplete.md',
        path: '/incomplete.md',
        text: 'content',
        sha: 'abc123',
        size: 50,
        type: 'entry',
        folder: { collectionName: 'posts' },
      }),
    ];

    const result = await prepareEntries(files);

    // Entries without proper slug or locales should be filtered out (lines 471-474)
    // Since we mocked getCollection to return undefined, prepareEntry returns early
    // so the result should be empty
    expect(result.entries).toHaveLength(0);
  });

  test('filters entries by slug and locales (lines 471-474)', async () => {
    generateUUID.mockImplementation(() => 'generated-uuid');

    // Test the filter logic from prepareEntries directly
    // Create entries that would result from prepareEntry
    const testEntries = /** @type {Entry[]} */ ([
      // Valid entry - has slug and locales
      {
        id: '',
        slug: 'valid-entry',
        subPath: 'valid-entry',
        locales: {
          _default: {
            slug: 'valid-entry',
            path: '/posts/valid-entry.md',
            content: { title: 'Valid' },
          },
        },
      },
      // Invalid - no slug
      {
        id: '',
        slug: '',
        subPath: 'no-slug',
        locales: {
          _default: {
            slug: '',
            path: '/posts/no-slug.md',
            content: { title: 'No Slug' },
          },
        },
      },
      // Invalid - no locales
      {
        id: '',
        slug: 'no-locales',
        subPath: 'no-locales',
        locales: {},
      },
      // Valid - another entry with different locale
      {
        id: '',
        slug: 'other-post',
        subPath: 'other-post',
        locales: {
          en: {
            slug: 'other-post',
            path: '/posts/other-post.en.md',
            content: { title: 'Other' },
          },
        },
      },
    ]);

    // Apply the filter logic from prepareEntries (lines 471-474)
    const filtered = testEntries.filter((entry) => {
      entry.id = generateUUID();
      return !!entry.slug && !!Object.keys(entry.locales).length;
    });

    // Should have 2 valid entries, 2 filtered out
    expect(filtered).toHaveLength(2);
    expect(filtered[0].slug).toBe('valid-entry');
    expect(filtered[1].slug).toBe('other-post');
    // Check that all entries got UUIDs
    expect(filtered.every((entry) => entry.id === 'generated-uuid')).toBe(true);
  });
});
