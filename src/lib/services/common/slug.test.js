import { getDateTimeParts } from '@sveltia/utils/datetime';
import { writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';
import { fillSlugTemplate, slugify } from '$lib/services/common/slug';
import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';

/**
 * @import { InternalCollection } from '$lib/types/private';
 */

vi.mock('$lib/services/config');
vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));
vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(() => null),
}));
vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummaryFromContent: vi.fn(() => 'summary'),
}));
vi.mock('$lib/services/utils/file', () => ({
  renameIfNeeded: vi.fn((slug) => slug),
}));

describe('Test slugify()', () => {
  test('basic slugification with default settings', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('Hello   World')).toBe('hello-world'); // Multiple spaces
    expect(slugify('  Hello World  ')).toBe('hello-world'); // Leading/trailing spaces
    expect(slugify('HELLO WORLD')).toBe('hello-world'); // Uppercase
    expect(slugify('Hello-World')).toBe('hello-world'); // Already has hyphens
  });

  test('special characters and punctuation', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('Hello@World#2024')).toBe('hello-world-2024');
    expect(slugify('Hello & World')).toBe('hello-world');
    expect(slugify('Hello/World\\Test')).toBe('hello-world\\test');
    expect(slugify('Hello(World)[Test]')).toBe('hello-world-test');
    expect(slugify('Hello"World\'Test')).toBe('hello-world-test');
    expect(slugify('Hello:World;Test')).toBe('hello-world-test');
    expect(slugify('Hello<World>Test')).toBe('hello-world-test');
    expect(slugify('Hello?World=Test')).toBe('hello-world-test');
  });

  test('consecutive hyphen consolidation', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });

    // Test consecutive hyphens are consolidated
    expect(slugify('Hello---World')).toBe('hello-world');
    expect(slugify('Hello - - - World')).toBe('hello-world');
    expect(slugify('File - Copy')).toBe('file-copy');
    expect(slugify('My (Important) File - Copy [2023]')).toBe('my-important-file-copy-2023');

    // Test leading and trailing hyphens are handled
    expect(slugify('-Hello-World-')).toBe('hello-world');
    expect(slugify('---Hello---World---')).toBe('hello-world');

    // Test with multiple special characters that create consecutive spaces
    expect(slugify('Hello!!!World???Test')).toBe('hello-world-test');
    expect(slugify('File & Test (1)')).toBe('file-test-1');
  });

  test('consecutive hyphen consolidation with custom replacement', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '_',
      },
    });

    // Test consecutive underscores are consolidated
    expect(slugify('Hello___World')).toBe('hello_world');
    expect(slugify('Hello   World')).toBe('hello_world'); // Multiple spaces become single underscore
    expect(slugify('File & Copy')).toBe('file_copy'); // Special chars become underscores
  });

  test('unicode characters with unicode encoding', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('こんにちは 世界')).toBe('こんにちは-世界'); // Japanese
    expect(slugify('안녕하세요 세계')).toBe('안녕하세요-세계'); // Korean
    expect(slugify('Привет мир')).toBe('привет-мир'); // Russian
    expect(slugify('你好 世界')).toBe('你好-世界'); // Chinese
    expect(slugify('Hello 🌍 World')).toBe('hello-🌍-world'); // Emoji
  });

  test('ascii encoding', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      slug: {
        encoding: 'ascii',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('Hello-World_123')).toBe('hello-world_123'); // Underscores and numbers preserved
    expect(slugify('Hello~World')).toBe('hello~world'); // Tilde preserved
    expect(slugify('こんにちは 世界', { fallback: false })).toBe(''); // Non-ASCII removed, no fallback
    expect(slugify('Café')).toBe('caf'); // Non-ASCII characters removed
    expect(slugify('résumé')).toBe('r-sum'); // Accented characters replaced with spaces, trimmed
  });

  test('accent cleaning', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: true,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('Café')).toBe('cafe');
    expect(slugify('résumé')).toBe('resume');
    expect(slugify('naïve')).toBe('naive');
    expect(slugify('Zürich')).toBe('zuerich');
    expect(slugify('São Paulo')).toBe('sao-paulo');
    expect(slugify('François')).toBe('francois');
    expect(slugify('Björk')).toBe('bjoerk');
    expect(slugify('Москва')).toBe('moskva'); // Russian transliteration
  });

  test('custom sanitize replacement', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '_',
      },
    });

    expect(slugify('Hello World')).toBe('hello_world');
    expect(slugify('Hello   World  Test')).toBe('hello_world_test');

    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '',
      },
    });

    expect(slugify('Hello World')).toBe('helloworld');
    expect(slugify('Hello   World  Test')).toBe('helloworldtest');
  });

  test('empty and whitespace strings', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('', { fallback: false })).toBe('');
    expect(slugify('   ', { fallback: false })).toBe('');
    expect(slugify('\t\n\r', { fallback: false })).toBe('');
  });

  test('no site config', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable(null);

    // Should use default values
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('Café')).toBe('café'); // No accent cleaning by default
  });

  test('partial site config', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      slug: {
        clean_accents: true,
        // encoding and sanitize_replacement should use defaults
      },
    });

    expect(slugify('Hello World')).toBe('hello-world'); // Default replacement
    expect(slugify('Café')).toBe('cafe'); // Accent cleaning enabled
    expect(slugify('こんにちは')).toBe('こんにちは'); // Default unicode encoding
  });

  test('edge cases', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('---', { fallback: false })).toBe(''); // All hyphens get consolidated and trimmed, resulting in empty string
    expect(slugify('123')).toBe('123'); // Numbers only
    expect(slugify('a')).toBe('a'); // Single character
    expect(slugify('A')).toBe('a'); // Single uppercase character
    expect(slugify('Hello-World-')).toBe('hello-world'); // Trailing hyphen trimmed
    expect(slugify('-Hello-World')).toBe('hello-world'); // Leading hyphen trimmed
  });
  test('fallback parameter behavior', async () => {
    // @ts-ignore
    const siteConfigMock = (await import('$lib/services/config')).siteConfig;

    const originalConfig = {
      backend: { name: 'github' },
      media_folder: 'static/images/uploads',
      collections: [],
      _siteURL: '',
      _baseURL: '',
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    };

    // @ts-ignore
    siteConfigMock.set(originalConfig);

    // Test with fallback=true (default behavior)
    expect(slugify('', { fallback: true })).toMatch(/[0-9a-f]{12}/); // Should return UUID
    expect(slugify('   ', { fallback: true })).toMatch(/[0-9a-f]{12}/); // Whitespace only should return UUID
    expect(slugify('!!!', { fallback: true })).toMatch(/[0-9a-f]{12}/); // Special chars only should return UUID

    // Test with fallback=false
    expect(slugify('', { fallback: false })).toBe(''); // Should return empty string
    expect(slugify('   ', { fallback: false })).toBe(''); // Whitespace only should return empty string
    expect(slugify('!!!', { fallback: false })).toBe(''); // Special chars only should return empty string

    // Test default parameter (should behave like fallback=true)
    expect(slugify('')).toMatch(/[0-9a-f]{12}/); // Default should return UUID
    expect(slugify('   ')).toMatch(/[0-9a-f]{12}/); // Default should return UUID

    // Test with valid content - fallback parameter should not affect result
    expect(slugify('Hello World', { fallback: true })).toBe('hello-world');
    expect(slugify('Hello World', { fallback: false })).toBe('hello-world');
    expect(slugify('Hello World')).toBe('hello-world'); // Default parameter
  });

  test('fallback with different encodings', async () => {
    // @ts-ignore
    const siteConfigMock = (await import('$lib/services/config')).siteConfig;

    // Test fallback with ASCII encoding
    // @ts-ignore
    siteConfigMock.set({
      slug: {
        encoding: 'ascii',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('こんにちは', { fallback: true })).toMatch(/[0-9a-f]{12}/); // Non-ASCII with fallback=true
    expect(slugify('こんにちは', { fallback: false })).toBe(''); // Non-ASCII with fallback=false

    // Test fallback with accent cleaning
    // @ts-ignore
    siteConfigMock.set({
      slug: {
        encoding: 'unicode',
        clean_accents: true,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('éà', { fallback: true })).toBe('ea'); // Valid content after cleaning
    expect(slugify('', { fallback: true })).toMatch(/[0-9a-f]{12}/); // Empty with fallback=true
    expect(slugify('', { fallback: false })).toBe(''); // Empty with fallback=false
  });

  test('fallback with custom sanitize replacement', async () => {
    // @ts-ignore
    const siteConfigMock = (await import('$lib/services/config')).siteConfig;

    // @ts-ignore
    siteConfigMock.set({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '_',
      },
    });

    expect(slugify('Hello World', { fallback: true })).toBe('hello_world');
    expect(slugify('Hello World', { fallback: false })).toBe('hello_world');
    expect(slugify('   ', { fallback: true })).toMatch(/[0-9a-f]{12}/); // Fallback should still work
    expect(slugify('   ', { fallback: false })).toBe(''); // No fallback
  });
});

describe('Test fillSlugTemplate()', async () => {
  /** @type {InternalCollection} */
  const collection = {
    name: 'posts',
    slug_length: 50,
    _type: 'entry',
    _file: {
      extension: 'md',
      format: 'yaml-frontmatter',
      basePath: 'content/posts',
    },
    _i18n: DEFAULT_I18N_CONFIG,
    _thumbnailFieldNames: [],
  };

  /**
   * Setup the site config before each test to ensure consistency.
   */
  const setupSiteConfig = async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      backend: { name: 'github' },
      media_folder: 'static/images/uploads',
      collections: [collection],
      _siteURL: '',
      _baseURL: '',
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });
  };

  test('short slug', async () => {
    await setupSiteConfig();

    const title = 'Lorem ipsum dolor sit amet, consectetur';

    expect(fillSlugTemplate('{{title}}', { collection, content: { title } })).toEqual(
      'lorem-ipsum-dolor-sit-amet-consectetur',
    );
  });

  test('long slug', async () => {
    await setupSiteConfig();

    const title =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam pulvinar scelerisque';

    expect(fillSlugTemplate('{{title}}', { collection, content: { title } })).toEqual(
      'lorem-ipsum-dolor-sit-amet-consectetur-adipiscing',
    );
  });

  test('date/time', async () => {
    await setupSiteConfig();

    const template = '{{year}}-{{month}}-{{day}}-{{hour}}-{{minute}}-{{second}}';
    const dateTimeParts = getDateTimeParts({ timeZone: 'UTC' });
    const { year, month, day, hour, minute, second } = dateTimeParts;
    const result = `${year}-${month}-${day}-${hour}-${minute}-${second}`;

    // The time zone should always be UTC, not local, with or without the `dateTimeParts` option
    expect(fillSlugTemplate(template, { collection, content: {} })).toEqual(result);
    expect(fillSlugTemplate(template, { collection, content: {}, dateTimeParts })).toEqual(result);
  });

  test('random ID fallback', async () => {
    await setupSiteConfig();

    expect(fillSlugTemplate('{{title}}', { collection, content: {} })).toMatch(/[0-9a-f]{12}/);
    expect(fillSlugTemplate('{{name}}', { collection, content: {} })).toMatch(/[0-9a-f]{12}/);
  });

  test('apply filter', async () => {
    await setupSiteConfig();

    expect(
      fillSlugTemplate("{{published | date('MMM D, YYYY')}}", {
        collection,
        content: { published: '2024-01-23' },
      }),
    ).toEqual('jan-23-2024');

    expect(
      fillSlugTemplate("{{name | default('world')}}", {
        collection,
        content: { name: 'hello' },
      }),
    ).toEqual('hello');

    expect(
      fillSlugTemplate("{{name | default('world')}}", {
        collection,
        content: { name: '' },
      }),
    ).toEqual('world');

    expect(
      fillSlugTemplate("{{fields.title | default('{{fields.slug}}')}}", {
        collection,
        content: { title: '', slug: 'example' },
      }),
    ).toEqual('example');

    expect(
      fillSlugTemplate("{{draft | ternary('Draft', 'Public')}}", {
        collection,
        content: { draft: true },
      }),
    ).toEqual('draft');

    expect(
      fillSlugTemplate("{{draft | ternary('Draft', 'Public')}}", {
        collection,
        content: { draft: false },
      }),
    ).toEqual('public');

    expect(
      fillSlugTemplate('{{title | truncate(40)}}', {
        collection,
        content: {
          title: 'lorem-ipsum-dolor-sit-amet-consectetur-adipiscing',
        },
      }),
    ).toEqual('lorem-ipsum-dolor-sit-amet-consectetur-a…');
  });

  test('UUID tags', async () => {
    await setupSiteConfig();

    expect(fillSlugTemplate('{{uuid}}', { collection, content: {} })).toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    );
    expect(fillSlugTemplate('{{uuid_short}}', { collection, content: {} })).toMatch(/[0-9a-f]{12}/);
    expect(fillSlugTemplate('{{uuid_shorter}}', { collection, content: {} })).toMatch(
      /[0-9a-f]{8}/,
    );
  });

  test('fields prefix', async () => {
    await setupSiteConfig();

    const content = {
      title: 'My Title',
      category: 'Tech',
      author: 'John Doe',
    };

    expect(fillSlugTemplate('{{fields.title}}', { collection, content })).toEqual('my-title');
    expect(
      fillSlugTemplate('{{fields.category}}-{{fields.author}}', { collection, content }),
    ).toEqual('tech-john-doe');
    expect(fillSlugTemplate('{{fields.nonexistent}}', { collection, content })).toMatch(
      /[0-9a-f]{12}/,
    );
  });

  test('slug field vs slug tag', async () => {
    await setupSiteConfig();

    // When 'slug' is used as a field name, it should use getEntrySummaryFromContent
    const content = { title: 'My Title', slug: 'my-slug' };

    expect(fillSlugTemplate('{{slug}}', { collection, content })).toEqual('summary');

    // When currentSlug is provided, {{slug}} should return that value
    expect(
      fillSlugTemplate('{{slug}}', {
        collection,
        content,
        currentSlug: 'existing-slug',
      }),
    ).toEqual('existing-slug');
  });

  test('multiple field combinations', async () => {
    await setupSiteConfig();

    const content = {
      title: 'My Article',
      category: 'Tech',
      year: '2024',
    };

    expect(fillSlugTemplate('{{year}}/{{category}}/{{title}}', { collection, content })).toMatch(
      /^\d{4}\/tech\/my-article$/,
    );
    expect(
      fillSlugTemplate('{{category}}-{{title}}-{{uuid_shorter}}', { collection, content }),
    ).toMatch(/^tech-my-article-[0-9a-f]{8}$/);
  });

  test('preview path mode', async () => {
    await setupSiteConfig();

    const content = { title: 'My Article' };

    /** @type {import('$lib/types/private').FillSlugTemplateOptions} */
    const options = {
      collection,
      content,
      type: 'preview_path',
      locale: 'en',
      entryFilePath: 'content/posts/2024/my-article.md',
    };

    expect(fillSlugTemplate('{{dirname}}', options)).toEqual('/2024');
    expect(fillSlugTemplate('{{filename}}', options)).toEqual('my-article');
    expect(fillSlugTemplate('{{extension}}', options)).toEqual('md');

    // Test slug in preview path mode with index file
    expect(
      fillSlugTemplate('{{slug}}', {
        ...options,
        currentSlug: '_index',
        isIndexFile: true,
      }),
    ).toEqual('');

    // Test slug in preview path mode with regular slug
    expect(
      fillSlugTemplate('{{slug}}', {
        ...options,
        currentSlug: 'my-slug',
      }),
    ).toEqual('my-slug');
  });

  test('media folder mode', async () => {
    await setupSiteConfig();

    const content = { title: 'My Article' };

    /** @type {import('$lib/types/private').FillSlugTemplateOptions} */
    const options = {
      collection,
      content,
      type: 'media_folder',
      entryFilePath: 'content/posts/2024/my-article.md',
    };

    expect(fillSlugTemplate('{{dirname}}', options)).toEqual('/2024');
    expect(fillSlugTemplate('{{filename}}', options)).toEqual('my-article');
    expect(fillSlugTemplate('{{extension}}', options)).toEqual('md');

    // Test with no entry file path
    expect(fillSlugTemplate('{{dirname}}', { ...options, entryFilePath: undefined })).toEqual('');
    expect(fillSlugTemplate('{{filename}}', { ...options, entryFilePath: undefined })).toEqual('');
    expect(fillSlugTemplate('{{extension}}', { ...options, entryFilePath: undefined })).toEqual('');
  });

  test('dirname extraction edge cases', async () => {
    await setupSiteConfig();

    const testCases = [
      {
        entryFilePath: 'content/posts/article.md',
        basePath: 'content/posts',
        expected: '', // No directory structure after basePath removal
      },
      {
        entryFilePath: 'content/posts/2024/article.md',
        basePath: 'content/posts',
        expected: '/2024',
      },
      {
        entryFilePath: 'content/posts/2024/tech/article.md',
        basePath: 'content/posts',
        expected: '/2024/tech',
      },
      {
        entryFilePath: 'article.md',
        basePath: '',
        expected: '', // No directory separator means no dirname
      },
    ];

    testCases.forEach(({ entryFilePath, basePath, expected }) => {
      const collectionWithBasePath = {
        ...collection,
        _file: { ...collection._file, basePath },
      };

      const result = fillSlugTemplate('{{dirname}}', {
        collection: collectionWithBasePath,
        content: {},
        type: 'preview_path',
        entryFilePath,
      });

      expect(result).toEqual(expected);
    });
  });

  test('file extension extraction', async () => {
    await setupSiteConfig();

    const testCases = [
      { entryFilePath: 'article.md', expected: 'md' },
      { entryFilePath: 'article.html.erb', expected: 'erb' },
      { entryFilePath: 'article.backup.json', expected: 'json' },
      { entryFilePath: 'article', expected: 'article' }, // No extension
      { entryFilePath: 'path/to/article.txt', expected: 'txt' },
    ];

    testCases.forEach(({ entryFilePath, expected }) => {
      const result = fillSlugTemplate('{{extension}}', {
        collection,
        content: {},
        type: 'preview_path',
        entryFilePath,
      });

      expect(result).toEqual(expected);
    });
  });

  test('filename extraction', async () => {
    await setupSiteConfig();

    const testCases = [
      { entryFilePath: 'article.md', expected: 'article' },
      { entryFilePath: 'article.html.erb', expected: 'article' }, // Takes first part before first dot
      { entryFilePath: 'my-long-filename.backup.json', expected: 'my-long-filename' },
      { entryFilePath: 'path/to/article.txt', expected: 'article' },
      { entryFilePath: 'path/to/no-extension', expected: 'no-extension' },
    ];

    testCases.forEach(({ entryFilePath, expected }) => {
      const result = fillSlugTemplate('{{filename}}', {
        collection,
        content: {},
        type: 'preview_path',
        entryFilePath,
      });

      expect(result).toEqual(expected);
    });
  });

  test('custom identifier field', async () => {
    await setupSiteConfig();

    const customCollection = {
      ...collection,
      identifier_field: 'name',
    };

    const content = { title: 'My Title', name: 'custom-name' };

    // When using the slug tag without currentSlug, it should use the identifier field
    expect(
      fillSlugTemplate('{{slug}}', {
        collection: customCollection,
        content,
      }),
    ).toEqual('summary'); // Mocked getEntrySummaryFromContent returns 'summary'
  });

  test('slug length truncation', async () => {
    await setupSiteConfig();

    const longContent = {
      title:
        'This is a very long title that should be truncated when the slug length limit is applied',
    };

    const shortLengthCollection = {
      ...collection,
      slug_length: 20,
    };

    const result = fillSlugTemplate('{{title}}', {
      collection: shortLengthCollection,
      content: longContent,
    });

    expect(result.length).toBeLessThanOrEqual(20);
    expect(result).not.toMatch(/-$/); // Should remove trailing hyphens
  });

  test('slug length with no truncation', async () => {
    await setupSiteConfig();

    const content = { title: 'Short Title' };

    // Test without slug_length defined
    const noLengthCollection = {
      ...collection,
      slug_length: undefined,
    };

    expect(
      fillSlugTemplate('{{title}}', {
        collection: noLengthCollection,
        content,
      }),
    ).toEqual('short-title');
  });

  test('current slug handling', async () => {
    await setupSiteConfig();

    const content = { title: 'My Title' };
    // Without currentSlug, should process normally and call renameIfNeeded
    const resultWithoutSlug = fillSlugTemplate('{{title}}', { collection, content });

    expect(resultWithoutSlug).toEqual('my-title');

    // With currentSlug, should skip renameIfNeeded and return directly
    const resultWithSlug = fillSlugTemplate('{{title}}', {
      collection,
      content,
      currentSlug: 'existing-slug',
    });

    expect(resultWithSlug).toEqual('my-title');
  });

  test('empty template', async () => {
    await setupSiteConfig();

    expect(fillSlugTemplate('', { collection, content: {} })).toEqual('');
    expect(fillSlugTemplate('   ', { collection, content: {} })).toEqual('');
  });

  test('template with static text', async () => {
    await setupSiteConfig();

    const content = { title: 'My Article', category: 'Tech' };

    expect(fillSlugTemplate('blog-{{title}}', { collection, content })).toEqual('blog-my-article');
    expect(fillSlugTemplate('{{category}}-post-{{title}}', { collection, content })).toEqual(
      'tech-post-my-article',
    );
    expect(fillSlugTemplate('posts/{{year}}/{{title}}/index', { collection, content })).toMatch(
      /^posts\/\d{4}\/my-article\/index$/,
    );
  });

  test('malformed templates', async () => {
    await setupSiteConfig();

    const content = { title: 'My Article' };

    // Unclosed tags should be treated as literal text
    expect(fillSlugTemplate('{{title', { collection, content })).toEqual('{{title');
    expect(fillSlugTemplate('title}}', { collection, content })).toEqual('title}}');

    // Empty tags should be treated as literal text (not replaced)
    expect(fillSlugTemplate('{{}}', { collection, content })).toEqual('{{}}');

    // Nested tags (the outer ones should be processed, but parsing is limited)
    // The regex matches {{title-{{category which becomes a UUID, leaving }} as literal
    expect(fillSlugTemplate('{{title-{{category}}}}', { collection, content })).toMatch(
      /^[0-9a-f]{12}}}$/,
    );
  });

  test('transformations with undefined values', async () => {
    await setupSiteConfig();

    const content = {};

    // Should use default transformation value
    expect(fillSlugTemplate("{{title | default('fallback')}}", { collection, content })).toEqual(
      'fallback',
    );

    // Without default transformation, should use UUID fallback
    expect(fillSlugTemplate('{{title | upper}}', { collection, content })).toMatch(/[0-9a-f]{12}/);
  });

  test('preview path empty slug handling', async () => {
    await setupSiteConfig();

    const content = {};

    // In preview_path mode, empty values should return empty string, not UUID
    const result = fillSlugTemplate('{{nonexistent}}', {
      collection,
      content,
      type: 'preview_path',
    });

    expect(result).toEqual('');
  });

  test('complex nested default transformations', async () => {
    await setupSiteConfig();

    // Test simple nested template tags in default transformations
    const content = { title: '', backupSlug: 'backup-slug' };

    const result = fillSlugTemplate("{{title | default('{{backupSlug}}')}}", {
      collection,
      content,
    });

    expect(result).toEqual('backup-slug');

    // Complex nested templates with multiple tags are not supported by current implementation
    // The pattern {{backupSlug}}-{{category}} will be treated as literal text, not nested templates
    const content2 = { title: '', backupSlug: 'backup-slug', category: 'tech' };

    const result2 = fillSlugTemplate("{{title | default('{{backupSlug}}-{{category}}')}}", {
      collection,
      content: content2,
    });

    // This results in the literal string being used as default, but since it contains {{ }},
    // it gets processed again and becomes UUIDs
    expect(result2).toMatch(/^[0-9a-f]{12}-[0-9a-f]{12}$/);
  });

  test('date parts without explicit dateTimeParts', async () => {
    await setupSiteConfig();

    // Test that date/time parts work without explicitly passing dateTimeParts
    const result = fillSlugTemplate('{{year}}-{{month}}-{{day}}', {
      collection,
      content: {},
    });

    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('collection without file configuration', async () => {
    await setupSiteConfig();

    /** @type {import('$lib/types/private').InternalCollection} */
    const fileCollection = {
      ...collection,
      _type: 'file',
      // No _file property for file collections
    };

    // Should work without basePath
    const result = fillSlugTemplate('{{dirname}}', {
      collection: fileCollection,
      content: {},
      type: 'preview_path',
      entryFilePath: 'content/pages/about.md',
    });

    expect(result).toEqual('content/pages');
  });

  test('whitespace handling in template', async () => {
    await setupSiteConfig();

    const content = { title: 'My Article', category: 'Tech' };

    // Template with extra whitespace should be trimmed
    expect(fillSlugTemplate('  {{title}}  ', { collection, content })).toEqual('my-article');
    expect(fillSlugTemplate('\t{{category}}-{{title}}\n', { collection, content })).toEqual(
      'tech-my-article',
    );
  });

  test('index file handling in preview path mode', async () => {
    await setupSiteConfig();

    const content = { title: 'Home Page' };

    /** @type {import('$lib/types/private').FillSlugTemplateOptions} */
    const options = {
      collection,
      content,
      type: 'preview_path',
      locale: 'en',
      entryFilePath: 'content/posts/_index.md',
      isIndexFile: true,
    };

    // Test that dirname, filename, extension work normally for index files
    expect(fillSlugTemplate('{{dirname}}', options)).toEqual('');
    expect(fillSlugTemplate('{{filename}}', options)).toEqual('_index');
    expect(fillSlugTemplate('{{extension}}', options)).toEqual('md');
    expect(fillSlugTemplate('{{locale}}', options)).toEqual('en');

    // Test slug behavior with index files in preview path mode
    // When isIndexFile is true in preview path mode, {{slug}} should always return empty string
    expect(
      fillSlugTemplate('{{slug}}', {
        ...options,
        currentSlug: '_index',
      }),
    ).toEqual('');

    // Even with regular slug values, index files in preview mode should return empty
    expect(
      fillSlugTemplate('{{slug}}', {
        ...options,
        currentSlug: 'regular-slug',
      }),
    ).toEqual('');

    // Test with nested paths
    const nestedOptions = {
      ...options,
      entryFilePath: 'content/posts/2024/_index.md',
    };

    expect(fillSlugTemplate('{{dirname}}', nestedOptions)).toEqual('/2024');
    expect(
      fillSlugTemplate('{{slug}}', {
        ...nestedOptions,
        currentSlug: '_index',
      }),
    ).toEqual('');

    // Test template combinations with index files
    expect(
      fillSlugTemplate('{{dirname}}/{{slug}}', {
        ...nestedOptions,
        currentSlug: '_index',
      }),
    ).toEqual('/2024/');

    expect(
      fillSlugTemplate('{{dirname}}/{{slug}}', {
        ...nestedOptions,
        currentSlug: 'custom-slug',
      }),
    ).toEqual('/2024/');
  });
});
