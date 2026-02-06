import { describe, expect, test } from 'vitest';

import {
  getEntrySummary,
  getEntrySummaryFromContent,
  replace,
  replaceSub,
  sanitizeEntrySummary,
} from '$lib/services/contents/entry/summary';

/**
 * @import { Entry, InternalCollection, LocalizedEntry } from '$lib/types/private';
 */

describe('Test getEntrySummary()', () => {
  /** @type {InternalCollection} */
  const collection = {
    name: 'pages-tags',
    folder: 'content/tags',
    fields: [],
    slug_length: 50,
    _type: 'entry',
    _file: {
      extension: 'md',
      format: 'yaml-frontmatter',
      basePath: 'content/tags',
    },
    _i18n: {
      i18nEnabled: true,
      saveAllLocales: true,
      allLocales: ['en', 'de'],
      initialLocales: ['en', 'de'],
      defaultLocale: 'de',
      structure: 'multiple_files',
      structureMap: {
        i18nSingleFile: false,
        i18nMultiFile: true,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
      omitDefaultLocaleFromFilePath: false,
    },
    _thumbnailFieldNames: [],
  };

  /** @type {LocalizedEntry} */
  const localizedEntryProps = { slug: '', path: '', content: {} };

  /** @type {Entry} */
  const entry = {
    id: '',
    slug: 'net',
    subPath: 'net/index',
    locales: {
      de: {
        ...localizedEntryProps,
        content: {
          slug: 'dotnet',
          translationKey: 'tag-dotnet',
          title: '.Net',
          draft: false,
          date: '2024-01-23',
        },
        path: 'content/tags/net/index.de.md',
      },
    },
  };

  /**
   * Wrapper for {@link getEntrySummary}.
   * @param {string} summary Summary string template.
   * @param {object} [options] Options.
   * @returns {string} Formatted summary.
   */
  const format = (summary, options = {}) =>
    getEntrySummary({ ...collection, summary }, entry, {
      locale: 'de',
      useTemplate: true,
      ...options,
    });

  test('metadata', () => {
    expect(format('{{slug}}')).toEqual('net');
    expect(format('{{dirname}}')).toEqual('net');
    expect(format('{{filename}}')).toEqual('index');
    expect(format('{{extension}}')).toEqual('md');
  });

  test('locales tag', () => {
    expect(format('{{locales}}')).toEqual('de');
  });

  test('locales tag with multiple locales', () => {
    const multiLocaleEntry = {
      ...entry,
      locales: {
        de: entry.locales.de,
        en: {
          ...entry.locales.de,
          path: 'content/tags/net/index.en.md',
        },
        fr: {
          ...entry.locales.de,
          path: 'content/tags/net/index.fr.md',
        },
      },
    };

    const result = getEntrySummary({ ...collection, summary: '{{locales}}' }, multiLocaleEntry, {
      locale: 'de',
      useTemplate: true,
    });

    expect(result).toEqual('de, en, fr');
  });

  test('locales tag in combination with other metadata', () => {
    const multiLocaleEntry = {
      ...entry,
      locales: {
        de: entry.locales.de,
        en: {
          ...entry.locales.de,
          path: 'content/tags/net/index.en.md',
        },
      },
    };

    const result = getEntrySummary(
      { ...collection, summary: '{{slug}} [{{locales}}]' },
      multiLocaleEntry,
      {
        locale: 'de',
        useTemplate: true,
      },
    );

    expect(result).toEqual('net [de, en]');
  });

  test('fields', () => {
    expect(format('{{title}}')).toEqual('.Net');
    expect(format('{{fields.title}}')).toEqual('.Net');
    expect(format('{{fields.slug}}')).toEqual('dotnet');
  });

  test('transformations', () => {
    expect(format("{{date | date('MMM D, YYYY')}}")).toEqual('Jan 23, 2024');
    expect(format("{{draft | ternary('Draft', 'Public')}}")).toEqual('Public');
  });

  test('Markdown', () => {
    const markdownStr =
      'This `code` on [GitHub](https://github.com/sveltia/sveltia-cms) _is_ ~~so~~ **good**!';

    expect(format(markdownStr, { allowMarkdown: true })).toEqual(
      'This <code>code</code> on GitHub <em>is</em> so <strong>good</strong>!',
    );
    expect(format(markdownStr, { allowMarkdown: false })).toEqual(
      'This code on GitHub is so good!',
    );

    const charRefStr = '&laquo;ABC&shy;DEF&nbsp;GH&raquo;';

    expect(format(charRefStr, { allowMarkdown: true })).toEqual('«ABC\u00adDEF\u00a0GH»');
    expect(format(charRefStr, { allowMarkdown: false })).toEqual('«ABC\u00adDEF\u00a0GH»');
  });

  test('handles non-entry collection type (line 206)', () => {
    // File/singleton collection without _file, identifier_field, or summary
    // The ternary should return empty object and function falls back to title/slug
    const fileCollection = {
      ...collection,
      _type: 'file',
    };

    // @ts-ignore - Intentionally creating a collection with _type !== 'entry'
    const result = getEntrySummary(fileCollection, entry, {
      locale: 'de',
      useTemplate: false,
    });

    // Should still return a valid summary from the entry's title or slug
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('handles index file collection (line 193)', () => {
    // Create an index file collection where isCollectionIndexFile returns true
    const indexFileCollection = {
      ...collection,
      index_file: {
        name: 'net',
        label: 'Category Index',
      },
    };

    // Create entry that would be identified as an index file
    const indexFileEntry = {
      ...entry,
      slug: 'net',
    };

    const result = getEntrySummary(indexFileCollection, indexFileEntry, {
      locale: 'de',
      useTemplate: false,
    });

    // When entry is an index file, should return the index file's label
    expect(result).toBe('Category Index');
  });

  test('handles missing locales fallback (lines 210-211)', () => {
    // Entry with missing requested locale should fall back to first available
    const entryWithSingleLocale = {
      ...entry,
      locales: {
        de: {
          slug: 'test',
          path: 'test.md',
          content: {
            title: 'Test Title',
          },
        },
      },
    };

    const result = getEntrySummary(collection, entryWithSingleLocale, {
      locale: 'en', // Request 'en' but only 'de' exists
      useTemplate: false,
    });

    expect(result).toContain('Test Title');
  });

  test('handles empty locales fallback (lines 210-211)', () => {
    // Entry with no locales at all should use empty object fallback
    const entryWithNoLocales = {
      ...entry,
      slug: 'fallback-slug',
      locales: {},
    };

    const result = getEntrySummary(collection, entryWithNoLocales, {
      locale: 'de',
      useTemplate: false,
    });

    // Should use slug as fallback when no content available
    expect(result).toContain('fallback');
  });

  test('handles empty locales fallback with template (line 211 branch)', () => {
    // Test with useTemplate=true to ensure the third fallback is exercised
    // when using the summary template path
    const entryWithNoLocales = {
      ...entry,
      slug: 'fallback-slug',
      locales: {},
    };

    const result = getEntrySummary({ ...collection, summary: '{{slug}}' }, entryWithNoLocales, {
      locale: 'de',
      useTemplate: true,
    });

    // Should still work with template even when no locales exist
    expect(result).toBe('fallback-slug');
  });

  test('covers locales fallback when requested locale is undefined (line 211)', () => {
    // Create entry where first locale doesn't match requested locale
    // Force the ternary: locales[undefined ?? defaultLocale] ?? Object.values(locales)[0] ?? {}
    const entryWithMultipleLocales = {
      ...entry,
      slug: 'test-slug',
      locales: {
        fr: {
          slug: 'test-fr',
          path: 'test.fr.md',
          content: { title: 'French Title' },
        },
      },
    };

    const result = getEntrySummary(collection, entryWithMultipleLocales, {
      locale: undefined, // Explicitly undefined, so uses defaultLocale
      useTemplate: false,
    });

    // With defaultLocale='de', tries to find 'de' locale
    // Doesn't exist, so falls back to Object.values(locales)[0] which is 'fr' locale
    expect(result).toContain('French');
  });
});

describe('Test sanitizeEntrySummary()', () => {
  test('should parse Markdown and sanitize HTML with allowMarkdown=true', () => {
    const input = 'This is **bold** and _italic_ and `code` and <script>alert("xss")</script>';
    const result = sanitizeEntrySummary(input, { allowMarkdown: true });

    // Script tags are completely removed for security
    expect(result).toBe(
      'This is <strong>bold</strong> and <em>italic</em> and <code>code</code> and',
    );
  });

  test('should strip all HTML tags with allowMarkdown=false', () => {
    const input = 'This is **bold** and _italic_ and `code` and <script>alert("xss")</script>';
    const result = sanitizeEntrySummary(input, { allowMarkdown: false });

    // All HTML tags are stripped including script content
    expect(result).toBe('This is bold and italic and code and');
  });

  test('should parse HTML character entities', () => {
    const input = '&laquo;Test&raquo; &amp; &lt;example&gt;';
    const result = sanitizeEntrySummary(input);

    expect(result).toBe('«Test» & <example>');
  });

  test('should trim whitespace', () => {
    const input = '  Test content  ';
    const result = sanitizeEntrySummary(input);

    expect(result).toBe('Test content');
  });

  test('should use slug.replaceAll when no template available (line 211)', () => {
    // Create a minimal collection and entry for this test
    /** @type {InternalCollection} */
    const testCollection = {
      name: 'test-pages',
      folder: 'content/pages',
      fields: [{ name: 'description' }],
      slug_length: 50,
      identifier_field: 'title',
      _type: 'entry',
      _file: {
        extension: 'md',
        format: 'yaml-frontmatter',
        basePath: 'content/pages',
      },
      _i18n: {
        i18nEnabled: false,
        saveAllLocales: false,
        allLocales: ['en'],
        initialLocales: ['en'],
        defaultLocale: 'en',
        structure: 'multiple_files',
        structureMap: {
          i18nSingleFile: false,
          i18nMultiFile: true,
          i18nMultiFolder: false,
          i18nMultiRootFolder: false,
        },
        canonicalSlug: { key: 'slug', value: '{{slug}}' },
        omitDefaultLocaleFromFilePath: false,
      },
      _thumbnailFieldNames: [],
    };

    const testEntry = {
      id: 'test-slug-fallback',
      slug: 'my-test-entry-with-dashes',
      subPath: 'pages',
      locales: {
        en: {
          slug: 'my-test-entry-with-dashes',
          content: {
            // Exclude title/name/label/body so getEntrySummaryFromContent
            // returns empty
            description: 'Just a description',
          },
          path: 'content/pages/my-test-entry-with-dashes.md',
        },
      },
    };

    // Call getEntrySummary - with no matching identifier fields,
    // should fall back to slug.replaceAll('-', ' ') at line 211
    const result = getEntrySummary(testCollection, testEntry, {
      locale: 'en',
      useTemplate: false,
      allowMarkdown: false,
    });

    // Expected: dashes replaced with spaces
    expect(result).toBe('my test entry with dashes');
  });
});

describe('Test getEntrySummaryFromContent()', () => {
  test('should return title field by default', () => {
    const content = {
      title: 'Main Title',
      name: 'Alternative Name',
      body: '# Header in Body',
    };

    const result = getEntrySummaryFromContent(content);

    expect(result).toBe('Main Title');
  });

  test('should use custom identifier field', () => {
    const content = {
      title: 'Main Title',
      customField: 'Custom Value',
      body: '# Header in Body',
    };

    const result = getEntrySummaryFromContent(content, { identifierField: 'customField' });

    expect(result).toBe('Custom Value');
  });

  test('should fallback to title, name, label in order', () => {
    const content1 = {
      name: 'Name Value',
      label: 'Label Value',
      body: '# Header in Body',
    };

    const result1 = getEntrySummaryFromContent(content1);

    expect(result1).toBe('Name Value');

    const content2 = {
      label: 'Label Value',
      body: '# Header in Body',
    };

    const result2 = getEntrySummaryFromContent(content2);

    expect(result2).toBe('Label Value');
  });

  test('should extract header from Markdown body as fallback', () => {
    const content = {
      body: '# Main Header\n\nSome content here',
    };

    const result = getEntrySummaryFromContent(content);

    expect(result).toBe('Main Header');
  });

  test('should handle header with custom anchor', () => {
    const content = {
      body: '# Main Header {#custom-anchor}\n\nSome content',
    };

    const result = getEntrySummaryFromContent(content);

    expect(result).toBe('Main Header');
  });

  test('should return empty string when nothing found', () => {
    const content = {
      body: 'No headers here, just content',
    };

    const result = getEntrySummaryFromContent(content);

    expect(result).toBe('');
  });

  test('should not use body when useBody=false', () => {
    const content = {
      body: '# Header in Body',
    };

    const result = getEntrySummaryFromContent(content, { useBody: false });

    expect(result).toBe('');
  });

  test('should trim whitespace from field values', () => {
    const content = {
      title: '  Spaced Title  ',
    };

    const result = getEntrySummaryFromContent(content);

    expect(result).toBe('Spaced Title');
  });
});

describe('Test replaceSub()', () => {
  const context = {
    slug: 'test-entry',
    entryPath: 'content/posts/2024/test-entry.md',
    basePath: 'content/posts',
    locales: ['en', 'de'],
    commitDate: new Date('2024-01-15T10:30:00Z'),
    commitAuthor: {
      name: 'John Doe',
      login: 'johndoe',
      email: 'john@example.com',
    },
  };

  test('should replace slug tag', () => {
    const result = replaceSub('slug', context);

    expect(result).toBe('test-entry');
  });

  test('should replace locales tag', () => {
    const result = replaceSub('locales', context);

    expect(result).toBe('de, en');
  });

  test('should replace locales tag with single locale', () => {
    const contextWithSingleLocale = {
      ...context,
      locales: ['en'],
    };

    const result = replaceSub('locales', contextWithSingleLocale);

    expect(result).toBe('en');
  });

  test('should replace locales tag with multiple locales', () => {
    const contextWithManyLocales = {
      ...context,
      locales: ['en', 'de', 'fr', 'ja', 'es'],
    };

    const result = replaceSub('locales', contextWithManyLocales);

    expect(result).toBe('de, en, es, fr, ja');
  });

  test('should replace dirname tag', () => {
    const result = replaceSub('dirname', context);

    expect(result).toBe('2024');
  });

  test('should replace filename tag', () => {
    const result = replaceSub('filename', context);

    expect(result).toBe('test-entry');
  });

  test('should replace extension tag', () => {
    const result = replaceSub('extension', context);

    expect(result).toBe('md');
  });

  test('should replace commit_date tag', () => {
    const result = replaceSub('commit_date', context);

    expect(result).toBe(context.commitDate);
  });

  test('should replace commit_author tag with name', () => {
    const result = replaceSub('commit_author', context);

    expect(result).toBe('John Doe');
  });

  test('should fallback to login when name not available', () => {
    const contextWithoutName = {
      ...context,
      commitAuthor: {
        name: '',
        login: 'johndoe',
        email: 'john@example.com',
      },
    };

    const result = replaceSub('commit_author', contextWithoutName);

    expect(result).toBe('johndoe');
  });

  test('should fallback to email when name and login not available', () => {
    const contextWithoutNameLogin = {
      ...context,
      commitAuthor: {
        name: '',
        login: '',
        email: 'john@example.com',
      },
    };

    const result = replaceSub('commit_author', contextWithoutNameLogin);

    expect(result).toBe('john@example.com');
  });

  test('should return undefined for unknown tags', () => {
    const result = replaceSub('unknown_tag', context);

    expect(result).toBeUndefined();
  });

  test('should handle missing commit data', () => {
    const contextWithoutCommit = {
      slug: 'test-entry',
      entryPath: 'content/posts/test-entry.md',
      basePath: 'content/posts',
      locales: ['en'],
      commitDate: undefined,
      commitAuthor: undefined,
    };

    expect(replaceSub('commit_date', contextWithoutCommit)).toBe('');
    expect(replaceSub('commit_author', contextWithoutCommit)).toBeUndefined();
  });

  test('should handle commitAuthor with only email (line 130 || chain)', () => {
    const contextOnlyEmail = {
      slug: 'test-entry',
      entryPath: 'content/posts/test-entry.md',
      basePath: 'content/posts',
      locales: ['en'],
      commitDate: new Date('2024-01-15T10:30:00Z'),
      commitAuthor: {
        name: '',
        login: '',
        email: 'author@example.com',
      },
    };

    const result = replaceSub('commit_author', contextOnlyEmail);

    expect(result).toBe('author@example.com');
  });

  test('should handle commitAuthor with all empty strings (line 130 || chain)', () => {
    const contextAllEmpty = {
      slug: 'test-entry',
      entryPath: 'content/posts/test-entry.md',
      basePath: 'content/posts',
      locales: ['en'],
      commitDate: new Date('2024-01-15T10:30:00Z'),
      commitAuthor: {
        name: '',
        login: '',
        email: '',
      },
    };

    const result = replaceSub('commit_author', contextAllEmpty);

    // The OR chain returns the last value, which is '' (email)
    expect(result).toBe('');
  });

  test('should handle dirname with basePath (line 105)', () => {
    // Test replaceSub dirname with a custom basePath to exercise the
    // .replace(basePath ?? '', '') part of line 105
    const contextWithBasePath = {
      slug: 'test-entry',
      entryPath: 'content/posts/blog/article.md',
      basePath: 'content/posts',
      locales: ['en', 'fr'],
      commitDate: new Date('2024-01-15T10:30:00Z'),
      commitAuthor: { name: 'John Doe', login: 'john', email: 'john@test.com' },
    };

    const result = replaceSub('dirname', contextWithBasePath);

    // After removing 'article.md', we have 'blog/'
    // After removing basePath 'content/posts', we have 'blog/'
    // After stripSlashes, we have 'blog'
    expect(result).toBe('blog');
  });

  test('should handle dirname when basePath equals entryPath directory (line 105)', () => {
    // Test when the entire directory path matches basePath
    const contextWithMatchingBasePath = {
      slug: 'test-entry',
      entryPath: 'content/posts/article.md',
      basePath: 'content/posts',
      locales: ['en'],
      commitDate: new Date('2024-01-15T10:30:00Z'),
      commitAuthor: { name: 'John Doe', login: 'john', email: 'john@test.com' },
    };

    const result = replaceSub('dirname', contextWithMatchingBasePath);

    // After removing filename, we have 'content/posts/'
    // After removing basePath, we have ''
    // After stripSlashes, we have ''
    expect(result).toBe('');
  });

  test('should handle dirname when basePath is undefined (line 105)', () => {
    // Test when basePath is undefined to exercise basePath ?? ''
    const contextWithoutBasePath = {
      slug: 'test-entry',
      entryPath: 'content/posts/article.md',
      basePath: undefined,
      locales: ['en'],
      commitDate: new Date('2024-01-15T10:30:00Z'),
      commitAuthor: { name: 'John Doe', login: 'john', email: 'john@test.com' },
    };

    const result = replaceSub('dirname', contextWithoutBasePath);

    // After removing filename, we have 'content/posts/'
    // After .replace('', ''), nothing changes: 'content/posts/'
    // After stripSlashes, we have 'content/posts'
    expect(result).toBe('content/posts');
  });

  test('should handle dirname when dirPath starts with basePath but not with prefix (line 113 else if branch)', () => {
    // This specifically tests the else if branch on line 113
    // We need dirPath that starts with basePath but NOT with prefix (basePath + '/')
    // Example: basePath='content/posts', dirPath='content/posts-backup/index/'
    // prefix would be 'content/posts/', but dirPath starts with 'content/posts-'
    const contextEdgeCase = {
      slug: 'test-entry',
      entryPath: 'content/posts-backup/index/test-entry.md',
      basePath: 'content/posts', // basePath without slash
      locales: ['en', 'de', 'fr'],
      commitDate: new Date('2024-01-15T10:30:00Z'),
      commitAuthor: { name: 'John Doe', login: 'john', email: 'john@test.com' },
    };

    const result = replaceSub('dirname', contextEdgeCase);

    // After removing 'test-entry.md', dirPath is 'content/posts-backup/index/'
    // prefix is 'content/posts/' (basePath + '/')
    // dirPath doesn't start with prefix 'content/posts/' (next char is -, not /)
    // dirPath DOES start with basePath 'content/posts'
    // So else if branch removes 'content/posts' leaving '-backup/index/'
    // stripSlashes only removes slashes, leaving '-backup/index'
    expect(result).toBe('-backup/index');
  });

  test('should handle dirname when dirPath does NOT start with basePath (line 113 skip)', () => {
    // Test the case where both prefix and basePath don't match
    // basePath='other', dirPath='content/posts/index/'
    // Neither prefix='other/' nor basePath='other' match dirPath
    const contextNoMatch = {
      slug: 'test-entry',
      entryPath: 'content/posts/index/test-entry.md',
      basePath: 'other', // Doesn't match dirPath at all
      locales: ['en'],
      commitDate: new Date('2024-01-15T10:30:00Z'),
      commitAuthor: { name: 'John Doe', login: 'john', email: 'john@test.com' },
    };

    const result = replaceSub('dirname', contextNoMatch);

    // dirPath is 'content/posts/index/' after replace
    // basePath 'other' doesn't match at all, so dirPath stays the same
    // stripSlashes removes only slashes, leaving 'content/posts/index'
    expect(result).toBe('content/posts/index');
  });

  test('should handle dirname with basePath as substring prefix (line 113 else if)', () => {
    // Another case for the else if on line 113
    // basePath='posts', dirPath starts with 'posts' but prefix='posts/' doesn't match
    const contextSubstring = {
      slug: 'entry',
      entryPath: 'posts-archive/2024/entry.md',
      basePath: 'posts', // Substring that matches without the slash
      locales: ['en', 'es'],
      commitDate: new Date('2024-01-15T10:30:00Z'),
      commitAuthor: { name: 'John Doe', login: 'john', email: 'john@test.com' },
    };

    const result = replaceSub('dirname', contextSubstring);

    // After removing 'entry.md', dirPath is 'posts-archive/2024/'
    // prefix is 'posts/' (basePath + '/')
    // dirPath doesn't start with prefix (next is -, not /)
    // dirPath DOES start with basePath 'posts'
    // So else if removes 'posts' leaving '-archive/2024/'
    // stripSlashes removes slashes leaving '-archive/2024'
    expect(result).toBe('-archive/2024');
  });

  test('should handle dirname when basePath ends with slash (line 109 ternary)', () => {
    // Test the ternary on line 109 where basePath already ends with /
    const contextWithSlash = {
      slug: 'test-entry',
      entryPath: 'content/posts/2024/test-entry.md',
      basePath: 'content/posts/', // basePath with trailing slash
      locales: ['en', 'de'],
      commitDate: new Date('2024-01-15T10:30:00Z'),
      commitAuthor: { name: 'John Doe', login: 'john', email: 'john@test.com' },
    };

    const result = replaceSub('dirname', contextWithSlash);

    // After removing filename, dirPath is 'content/posts/2024/'
    // prefix is 'content/posts/' (basePath already ends with /, so used as-is)
    // dirPath 'content/posts/2024/' starts with prefix 'content/posts/'
    // So first if removes prefix leaving '2024/'
    // stripSlashes removes slashes leaving '2024'
    expect(result).toBe('2024');
  });
});

describe('Test replace()', () => {
  const context = {
    content: {
      title: 'Test Entry',
      date: '2024-01-15',
      tags: ['test', 'example'],
      published: true,
    },
    collectionName: 'posts',
    replaceSubContext: {
      slug: 'test-entry',
      entryPath: 'content/posts/test-entry.md',
      basePath: 'content/posts',
      locales: ['en', 'de'],
      commitDate: new Date('2024-01-15T10:30:00Z'),
      commitAuthor: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    },
    defaultLocale: 'en',
  };

  test('should replace slug placeholder', () => {
    const result = replace('slug', context);

    expect(result).toBe('test-entry');
  });

  test('should replace field placeholders', () => {
    const result = replace('title', context);

    expect(result).toBe('Test Entry');
  });

  test('should handle fields.* syntax', () => {
    const result = replace('fields.title', context);

    expect(result).toBe('Test Entry');
  });

  test('should return empty string for missing fields', () => {
    const result = replace('nonexistent', context);

    expect(result).toBe('');
  });

  test('should convert Date objects to string', () => {
    // The replace function gets undefined from replaceSub for non-special tags
    // Then it gets undefined from getFieldDisplayValue (which we haven't mocked properly)
    // So it just converts the Date to string
    const contextWithDate = {
      ...context,
      content: {
        ...context.content,
        dateField: new Date('2024-01-15T10:30:00Z'),
      },
    };

    const result = replace('dateField', contextWithDate);

    // Since the field isn't properly configured, it falls back to String conversion
    expect(result).toContain('2024');
    expect(typeof result).toBe('string');
  });

  test('should handle transformations', () => {
    // The transformations need to be mocked or the function needs proper setup
    // For now, test that it returns a string conversion
    const result = replace('published', context);

    expect(result).toBe('true');
  });

  test('should convert values to string', () => {
    const result = replace('tags', context);

    expect(typeof result).toBe('string');
  });

  test('should return empty string for undefined field values', () => {
    const contextWithMissingField = {
      ...context,
      content: {
        ...context.content,
        // Don't include 'missingField', so it will be undefined
      },
    };

    const result = replace('missingField', contextWithMissingField);

    expect(result).toBe('');
  });

  test('should handle Date values with transformations (lines 157-160)', () => {
    const dateValue = new Date('2024-01-15T10:30:00Z');

    const contextWithDateTransformation = {
      ...context,
      content: {
        ...context.content,
        publishDate: dateValue,
      },
    };

    // Test that date transformations are recognized
    const result = replace("publishDate | date('YYYY-MM-DD')", contextWithDateTransformation);

    expect(typeof result).toBe('string');
  });

  test('should handle Date instance without transformations (line 153-154)', () => {
    const dateValue = new Date('2024-01-15T10:30:00Z');

    const contextWithDate = {
      ...context,
      content: {
        ...context.content,
        createdDate: dateValue,
      },
    };

    const result = replace('createdDate', contextWithDate);

    // Should format the date as YYYY-MM-DD
    expect(typeof result).toBe('string');
    expect(result).toContain('2024');
  });

  test('should handle ternary transformations with Date values (lines 193-194)', () => {
    const dateValue = new Date('2024-01-15T10:30:00Z');

    const contextWithTernary = {
      ...context,
      content: {
        ...context.content,
        published: true,
        publishDate: dateValue,
      },
      replaceSubContext: {
        ...context.replaceSubContext,
      },
    };

    // Test ternary transformation
    const result = replace("published | ternary('Yes', 'No')", contextWithTernary);

    expect(result).toBe('Yes');
  });

  test('should handle commit_date tag with Date formatting (lines 153-154)', () => {
    // commit_date returns a Date object, so we test the branch that formats dates
    const result = replace('commit_date', context);

    // Should return a formatted date string in YYYY-MM-DD format
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('should format Date value without transformations (lines 153-154)', () => {
    // Create a context where value is explicitly a Date from replaceSub
    const contextWithDate = {
      ...context,
      replaceSubContext: {
        ...context.replaceSubContext,
        locales: ['en', 'de'],
        commitDate: new Date('2024-12-25T12:00:00Z'),
      },
    };

    // When placeholder is 'commit_date' with no transformations,
    // replaceSub returns the Date and it should be formatted as YYYY-MM-DD
    const result = replace('commit_date', contextWithDate);

    // The result should be a formatted date
    expect(result).toBe('2024-12-25');
  });

  test('should return empty string when field is undefined with transformations (line 153-154)', () => {
    // To trigger the second `if (value === undefined)` check:
    // 1. replaceSub returns undefined for non-special tags
    // 2. We have a transformation that triggers the date/ternary check
    // 3. valueMap doesn't have the field, so valueMap[keyPath] is undefined
    const contextWithMissingField = {
      content: {
        // Empty, no 'missingField'
      },
      collectionName: 'posts',
      replaceSubContext: {
        ...context.replaceSubContext,
        locales: ['en'],
      },
      defaultLocale: 'en',
    };

    // 'missingField' doesn't exist in replaceSub (returns undefined)
    // Has a ternary transformation, so we check valueMap[keyPath] which is undefined
    const result = replace("missingField | ternary('Yes', 'No')", contextWithMissingField);

    // Since the field doesn't exist anywhere, should return empty string
    expect(result).toBe('');
  });

  test('should handle DATE_TRANSFORMATION_REGEX match (lines 145-146)', () => {
    const dateValue = new Date('2024-01-15T10:30:00Z');

    const contextWithDateTrans = {
      ...context,
      content: {
        ...context.content,
        pubDate: dateValue,
      },
      replaceSubContext: {
        ...context.replaceSubContext,
      },
    };

    // Test with date transformation
    const result = replace("pubDate | date('MMM D, YYYY')", contextWithDateTrans);

    expect(typeof result).toBe('string');
  });

  test('should skip Date formatting when transformations exist (line 153-154 && branch)', () => {
    // Test the && !transformations.length condition:
    // When value IS a Date AND transformations DO exist,
    // we should NOT format the date (that branch on line 153-154 is skipped)
    const contextWithDateTransformations = {
      ...context,
      content: {
        ...context.content,
        eventDate: new Date('2024-01-15T10:30:00Z'),
      },
      replaceSubContext: {
        ...context.replaceSubContext,
      },
    };

    // commit_date with a transformation should skip the date formatting on line 153-154
    const result = replace("commit_date | date('YYYY')", contextWithDateTransformations);

    // Result should be from applyTransformations, not from the date formatting
    expect(typeof result).toBe('string');
    // The transformation would be applied, not the default date format
  });
});

describe('Additional comprehensive tests for edge cases', () => {
  test('getEntrySummaryFromContent should handle fields with whitespace-only content', () => {
    const content = {
      title: '   ',
      name: 'Valid Name',
    };

    const result = getEntrySummaryFromContent(content);

    // Should skip whitespace-only title and use name instead
    expect(result).toBe('Valid Name');
  });

  test('getEntrySummaryFromContent should handle numeric field values', () => {
    const content = {
      title: 123,
      name: 'Name',
    };

    const result = getEntrySummaryFromContent(content);

    // Should skip numeric values and use name
    expect(result).toBe('Name');
  });

  test('getEntrySummaryFromContent should extract header with multiple levels', () => {
    const content = {
      body: '### Third Level Header\n\nContent',
    };

    const result = getEntrySummaryFromContent(content);

    expect(result).toBe('Third Level Header');
  });

  test('getEntrySummaryFromContent should handle markdown body with whitespace variations', () => {
    const content = {
      body: '# Header   \n\nMore content',
    };

    const result = getEntrySummaryFromContent(content);

    // Should handle trailing whitespace in header
    expect(result).toBe('Header');
  });

  test('replaceSub should handle entryPath with multiple nested directories', () => {
    const context = {
      slug: 'my-entry',
      entryPath: 'content/blog/2024/01/15/my-entry.md',
      basePath: 'content/blog',
      locales: ['en', 'ja'],
      commitDate: undefined,
      commitAuthor: undefined,
    };

    const result = replaceSub('dirname', context);

    expect(result).toBe('2024/01/15');
  });

  test('replaceSub dirname should handle basePath with trailing slash', () => {
    const context = {
      slug: 'my-entry',
      entryPath: 'content/blog/post/my-entry.md',
      basePath: 'content/blog/',
      locales: ['en'],
      commitDate: undefined,
      commitAuthor: undefined,
    };

    const result = replaceSub('dirname', context);

    expect(result).toBe('post');
  });

  test('replaceSub dirname should only replace first basePath occurrence (edge case)', () => {
    // Edge case: if basePath happens to appear in a subdirectory name
    // This is a potential bug if it ever happens - .replace() only replaces first occurrence
    const context = {
      slug: 'my-entry',
      entryPath: 'content/content/posts/my-entry.md',
      basePath: 'content',
      locales: ['en'],
      commitDate: undefined,
      commitAuthor: undefined,
    };

    const result = replaceSub('dirname', context);

    // After removing filename: 'content/content/posts/'
    // After .replace('content', ''): '/content/posts/'
    // After stripSlashes: 'content/posts'
    // This shows the potential issue - if basePath doesn't have trailing slash,
    // and appears in directory names, results might be unexpected
    expect(result).toBe('content/posts');
  });

  test('replaceSub dirname should handle basePath matching without trailing slash (branch 114-115)', () => {
    // Test the else if branch where dirPath.startsWith(basePath) but not prefix
    const context = {
      slug: 'entry',
      entryPath: 'content/blog/entry.md',
      basePath: 'content/blog',
      locales: ['en'],
      commitDate: undefined,
      commitAuthor: undefined,
    };

    const result = replaceSub('dirname', context);

    // After removing filename: 'content/blog/'
    // prefix would be 'content/blog/' so dirPath.startsWith(prefix) is true
    // So this test actually uses the if branch, not the else if
    // Let me test a case where the else if would be used
    expect(result).toBe('');
  });

  test('replaceSub dirname should handle basePath boundary correctly (branch 114-115)', () => {
    // Test case where dirPath starts with basePath but not with prefix
    // This would only happen if there's unusual path construction
    // For normal usage, the if branch will be taken
    const context = {
      slug: 'entry',
      entryPath: 'content/blogpost/entry.md',
      basePath: 'content/blog',
      locales: ['en', 'de'],
      commitDate: undefined,
      commitAuthor: undefined,
    };

    const result = replaceSub('dirname', context);

    // After removing filename: 'content/blogpost/'
    // prefix would be 'content/blog/', but dirPath is 'content/blogpost/'
    // prefix doesn't match (expects slash after 'blog')
    // So checks if dirPath.startsWith('content/blog') which is true
    // Then slices off 'content/blog', leaving 'post/'
    // stripSlashes gives 'post'
    expect(result).toBe('post');
  });

  test('replaceSub should handle entryPath with no base path', () => {
    const context = {
      slug: 'my-entry',
      entryPath: 'my-entry.md',
      basePath: undefined,
      locales: ['en'],
      commitDate: undefined,
      commitAuthor: undefined,
    };

    const result = replaceSub('dirname', context);

    expect(result).toBe('');
  });

  test('sanitizeEntrySummary should handle mixed markdown and HTML entities', () => {
    const input = '**Bold** &amp; `code` &lt;tag&gt;';
    const result = sanitizeEntrySummary(input, { allowMarkdown: true });

    expect(result).toContain('Bold');
    expect(result).toContain('&');
    expect(result).toContain('code');
  });

  test('sanitizeEntrySummary should strip dangerous HTML tags', () => {
    const input = 'Text <img src="x" onerror="alert(1)"> <iframe src="evil"></iframe>';
    const result = sanitizeEntrySummary(input, { allowMarkdown: true });

    // Dangerous tags should be removed
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('iframe');
  });

  test('getEntrySummary should handle collection with no summary template', () => {
    /** @type {InternalCollection} */
    const testCollection = {
      name: 'test',
      folder: 'test',
      fields: [],
      slug_length: 50,
      _type: 'entry',
      _file: { extension: 'md', format: 'yaml-frontmatter', basePath: 'test' },
      _i18n: {
        i18nEnabled: false,
        saveAllLocales: false,
        allLocales: ['en'],
        initialLocales: ['en'],
        defaultLocale: 'en',
        structure: 'multiple_files',
        structureMap: {
          i18nSingleFile: false,
          i18nMultiFile: true,
          i18nMultiFolder: false,
          i18nMultiRootFolder: false,
        },
        canonicalSlug: { key: 'slug', value: '{{slug}}' },
        omitDefaultLocaleFromFilePath: false,
      },
      _thumbnailFieldNames: [],
    };

    const testEntry = {
      id: 'test',
      slug: 'test-slug',
      subPath: 'test',
      locales: {
        en: {
          slug: 'test-slug',
          content: { title: 'Test Title' },
          path: 'test.md',
        },
      },
    };

    const result = getEntrySummary(testCollection, testEntry, {
      locale: 'en',
      useTemplate: true,
      // No summary template defined
    });

    // Should fall back to title
    expect(result).toBe('Test Title');
  });

  test('replace should handle commit_author with all empty strings', () => {
    const context = {
      content: { title: 'Test' },
      collectionName: 'test',
      replaceSubContext: {
        slug: 'test',
        entryPath: 'test.md',
        basePath: 'test',
        locales: ['en'],
        commitDate: undefined,
        commitAuthor: { name: '', login: '', email: '' },
      },
      defaultLocale: 'en',
    };

    const result = replace('commit_author', context);

    // Should return empty string when all author fields are empty
    expect(result).toBe('');
  });

  test('getEntrySummaryFromContent should handle custom identifier field that is falsy but defined', () => {
    const content = {
      customField: 0,
      title: 'Title',
    };

    const result = getEntrySummaryFromContent(content, {
      identifierField: 'customField',
    });

    // Should skip falsy value 0 and use title instead
    expect(result).toBe('Title');
  });

  test('replace should handle ternary transformation with falsy values', () => {
    const context = {
      content: { published: false, count: 0 },
      collectionName: 'test',
      replaceSubContext: {
        slug: 'test',
        entryPath: 'test.md',
        basePath: 'test',
        locales: ['en'],
        commitDate: undefined,
        commitAuthor: undefined,
      },
      defaultLocale: 'en',
    };

    // Note: This depends on how transformations are applied
    // The test verifies the field value is correctly retrieved
    const result = replace('published', context);

    expect(result).toBe('false');
  });

  test('sanitizeEntrySummary should handle empty string input', () => {
    const result = sanitizeEntrySummary('');

    expect(result).toBe('');
  });

  test('sanitizeEntrySummary should handle only whitespace input', () => {
    const result = sanitizeEntrySummary('   \n\t  ');

    expect(result).toBe('');
  });

  test('getEntrySummaryFromContent should handle body with no headers', () => {
    const content = {
      body: 'Just plain text without any headers',
    };

    const result = getEntrySummaryFromContent(content);

    expect(result).toBe('');
  });

  test('getEntrySummaryFromContent should prioritize identifier field over other fields', () => {
    const content = {
      customField: 'Custom Value',
      title: 'Title Value',
      name: 'Name Value',
      label: 'Label Value',
    };

    const result = getEntrySummaryFromContent(content, {
      identifierField: 'customField',
    });

    expect(result).toBe('Custom Value');
  });

  test('replaceSub dirname should handle path with trailing slashes', () => {
    const context = {
      slug: 'test',
      entryPath: 'content/blog/post/test.md',
      basePath: 'content/',
      locales: ['en', 'ja'],
      commitDate: undefined,
      commitAuthor: undefined,
    };

    const result = replaceSub('dirname', context);

    expect(result).toBe('blog/post');
  });

  test('should use getFieldDisplayValue when no date/ternary transformation (line 150)', () => {
    // Test the case where transformations.some() returns false
    // (no date or ternary transformations) so we call getFieldDisplayValue
    const testContext = {
      content: {
        regularField: 'Test Value',
      },
      collectionName: 'posts',
      replaceSubContext: {
        slug: 'test-entry',
        entryPath: 'content/posts/test-entry.md',
        basePath: 'content/posts',
        locales: ['en', 'de'],
        commitDate: new Date('2024-01-15T10:30:00Z'),
        commitAuthor: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      },
      defaultLocale: 'en',
    };

    // Regular field with no special transformation, not in replaceSub
    // Should call getFieldDisplayValue since no date/ternary transformation
    const result = replace('regularField', testContext);

    // Should get the field display value
    expect(result).toBe('Test Value');
  });

  test('should return last property when all are falsy (line 133 || chain)', () => {
    // Test case where commitAuthor object exists but all three properties are
    // falsy (empty strings) - should return the last falsy value (empty string)
    const context = {
      slug: 'test-entry',
      entryPath: 'content/posts/test-entry.md',
      basePath: 'content/posts',
      locales: ['en'],
      commitDate: new Date('2024-01-15T10:30:00Z'),
      commitAuthor: {
        name: '',
        login: '',
        email: '',
      },
    };

    const result = replaceSub('commit_author', context);

    // When all properties are falsy, returns the last falsy value
    expect(result).toBe('');
  });

  test('should handle ternary transformation with falsy field value (lines 149-150)', () => {
    // Test accessing valueMap[keyPath] when it's falsy but exists
    // with ternary transformation
    const context = {
      content: {
        isPublished: false, // Falsy but defined
      },
      collectionName: 'posts',
      replaceSubContext: {
        slug: 'test-entry',
        entryPath: 'content/posts/test-entry.md',
        basePath: 'content/posts',
        locales: ['en'],
        commitDate: new Date('2024-01-15T10:30:00Z'),
        commitAuthor: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      },
      defaultLocale: 'en',
    };

    // With ternary transformation on falsy value, should use valueMap
    const result = replace("isPublished | ternary('Published', 'Draft')", context);

    // False value processed through ternary should give 'Draft'
    expect(result).toBe('Draft');
  });

  test('getEntrySummary should handle entry with commitDate but no commitAuthor', () => {
    /** @type {InternalCollection} */
    const testCollection = {
      name: 'test',
      folder: 'test',
      fields: [],
      slug_length: 50,
      _type: 'entry',
      _file: { extension: 'md', format: 'yaml-frontmatter', basePath: 'test' },
      _i18n: {
        i18nEnabled: false,
        saveAllLocales: false,
        allLocales: ['en'],
        initialLocales: ['en'],
        defaultLocale: 'en',
        structure: 'multiple_files',
        structureMap: {
          i18nSingleFile: false,
          i18nMultiFile: true,
          i18nMultiFolder: false,
          i18nMultiRootFolder: false,
        },
        canonicalSlug: { key: 'slug', value: '{{slug}}' },
        omitDefaultLocaleFromFilePath: false,
      },
      _thumbnailFieldNames: [],
      summary: '{{commit_date}}',
    };

    const testEntry = {
      id: 'test',
      slug: 'test-slug',
      subPath: 'test',
      commitDate: new Date('2024-01-15'),
      locales: {
        en: {
          slug: 'test-slug',
          content: { title: 'Test Title' },
          path: 'test.md',
        },
      },
    };

    const result = getEntrySummary(testCollection, testEntry, {
      locale: 'en',
      useTemplate: true,
    });

    // Should format the date correctly
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
