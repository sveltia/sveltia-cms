import { getDateTimeParts } from '@sveltia/utils/datetime';
import { writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';

import {
  fillTemplate,
  handleDateTimeTag,
  handleFilePathTag,
  handleSlugTag,
  handleUuidTag,
  // Note: These are internal functions tested indirectly through fillTemplate
  // but we test them directly for comprehensive coverage
} from '$lib/services/common/template';
import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';

/**
 * @import { InternalEntryCollection, InternalFileCollection } from '$lib/types/private';
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

describe('Test fillTemplate()', async () => {
  /** @type {InternalEntryCollection} */
  const collection = {
    name: 'posts',
    folder: 'content/posts',
    fields: [],
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
  const setupCmsConfig = async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
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
    await setupCmsConfig();

    const title = 'Lorem ipsum dolor sit amet, consectetur';

    expect(fillTemplate('{{title}}', { collection, content: { title } })).toEqual(
      'lorem-ipsum-dolor-sit-amet-consectetur',
    );
  });

  test('long slug', async () => {
    await setupCmsConfig();

    const title =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam pulvinar scelerisque';

    expect(fillTemplate('{{title}}', { collection, content: { title } })).toEqual(
      'lorem-ipsum-dolor-sit-amet-consectetur-adipiscing',
    );
  });

  test('date/time', async () => {
    await setupCmsConfig();

    const template = '{{year}}-{{month}}-{{day}}-{{hour}}-{{minute}}-{{second}}';
    const dateTimeParts = getDateTimeParts({ timeZone: 'UTC' });
    const { year, month, day, hour, minute, second } = dateTimeParts;
    const result = `${year}-${month}-${day}-${hour}-${minute}-${second}`;

    // The time zone should always be UTC, not local, with or without the `dateTimeParts` option
    expect(fillTemplate(template, { collection, content: {} })).toEqual(result);
    expect(fillTemplate(template, { collection, content: {}, dateTimeParts })).toEqual(result);
  });

  test('random ID fallback', async () => {
    await setupCmsConfig();

    expect(fillTemplate('{{title}}', { collection, content: {} })).toMatch(/[0-9a-f]{12}/);
    expect(fillTemplate('{{name}}', { collection, content: {} })).toMatch(/[0-9a-f]{12}/);
  });

  test('apply filter', async () => {
    await setupCmsConfig();

    expect(
      fillTemplate("{{published | date('MMM D, YYYY')}}", {
        collection,
        content: { published: '2024-01-23' },
      }),
    ).toEqual('jan-23-2024');

    expect(
      fillTemplate("{{name | default('world')}}", {
        collection,
        content: { name: 'hello' },
      }),
    ).toEqual('hello');

    expect(
      fillTemplate("{{name | default('world')}}", {
        collection,
        content: { name: '' },
      }),
    ).toEqual('world');

    expect(
      fillTemplate("{{fields.title | default('{{fields.slug}}')}}", {
        collection,
        content: { title: '', slug: 'example' },
      }),
    ).toEqual('example');

    expect(
      fillTemplate("{{draft | ternary('Draft', 'Public')}}", {
        collection,
        content: { draft: true },
      }),
    ).toEqual('draft');

    expect(
      fillTemplate("{{draft | ternary('Draft', 'Public')}}", {
        collection,
        content: { draft: false },
      }),
    ).toEqual('public');

    expect(
      fillTemplate('{{title | truncate(40)}}', {
        collection,
        content: {
          title: 'lorem-ipsum-dolor-sit-amet-consectetur-adipiscing',
        },
      }),
    ).toEqual('lorem-ipsum-dolor-sit-amet-consectetur-a…');
  });

  test('UUID tags', async () => {
    await setupCmsConfig();

    expect(fillTemplate('{{uuid}}', { collection, content: {} })).toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    );
    expect(fillTemplate('{{uuid_short}}', { collection, content: {} })).toMatch(/[0-9a-f]{12}/);
    expect(fillTemplate('{{uuid_shorter}}', { collection, content: {} })).toMatch(/[0-9a-f]{8}/);
  });

  test('fields prefix', async () => {
    await setupCmsConfig();

    const content = {
      title: 'My Title',
      category: 'Tech',
      author: 'John Doe',
    };

    expect(fillTemplate('{{fields.title}}', { collection, content })).toEqual('my-title');
    expect(fillTemplate('{{fields.category}}-{{fields.author}}', { collection, content })).toEqual(
      'tech-john-doe',
    );
    expect(fillTemplate('{{fields.nonexistent}}', { collection, content })).toMatch(/[0-9a-f]{12}/);
  });

  test('slug field vs slug tag', async () => {
    await setupCmsConfig();

    // When 'slug' is used as a field name, it should use getEntrySummaryFromContent
    const content = { title: 'My Title', slug: 'my-slug' };

    expect(fillTemplate('{{slug}}', { collection, content })).toEqual('summary');

    // When currentSlug is provided, {{slug}} should return that value
    expect(
      fillTemplate('{{slug}}', {
        collection,
        content,
        currentSlug: 'existing-slug',
      }),
    ).toEqual('existing-slug');
  });

  test('multiple field combinations', async () => {
    await setupCmsConfig();

    const content = {
      title: 'My Article',
      category: 'Tech',
      year: '2024',
    };

    expect(fillTemplate('{{year}}/{{category}}/{{title}}', { collection, content })).toMatch(
      /^\d{4}\/tech\/my-article$/,
    );
    expect(
      fillTemplate('{{category}}-{{title}}-{{uuid_shorter}}', { collection, content }),
    ).toMatch(/^tech-my-article-[0-9a-f]{8}$/);
  });

  test('preview path mode', async () => {
    await setupCmsConfig();

    const content = { title: 'My Article' };

    /** @type {import('$lib/types/private').FillTemplateOptions} */
    const options = {
      collection,
      content,
      type: 'preview_path',
      locale: 'en',
      entryFilePath: 'content/posts/2024/my-article.md',
    };

    expect(fillTemplate('{{dirname}}', options)).toEqual('/2024');
    expect(fillTemplate('{{filename}}', options)).toEqual('my-article');
    expect(fillTemplate('{{extension}}', options)).toEqual('md');

    // Test slug in preview path mode with index file
    expect(
      fillTemplate('{{slug}}', {
        ...options,
        currentSlug: '_index',
        isIndexFile: true,
      }),
    ).toEqual('');

    // Test slug in preview path mode with regular slug
    expect(
      fillTemplate('{{slug}}', {
        ...options,
        currentSlug: 'my-slug',
      }),
    ).toEqual('my-slug');
  });

  test('media folder mode', async () => {
    await setupCmsConfig();

    const content = { title: 'My Article' };

    /** @type {import('$lib/types/private').FillTemplateOptions} */
    const options = {
      collection,
      content,
      type: 'media_folder',
      entryFilePath: 'content/posts/2024/my-article.md',
    };

    expect(fillTemplate('{{dirname}}', options)).toEqual('/2024');
    expect(fillTemplate('{{filename}}', options)).toEqual('my-article');
    expect(fillTemplate('{{extension}}', options)).toEqual('md');

    // Test with no entry file path
    expect(fillTemplate('{{dirname}}', { ...options, entryFilePath: undefined })).toEqual('');
    expect(fillTemplate('{{filename}}', { ...options, entryFilePath: undefined })).toEqual('');
    expect(fillTemplate('{{extension}}', { ...options, entryFilePath: undefined })).toEqual('');
  });

  test('dirname extraction edge cases', async () => {
    await setupCmsConfig();

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

      const result = fillTemplate('{{dirname}}', {
        collection: collectionWithBasePath,
        content: {},
        type: 'preview_path',
        entryFilePath,
      });

      expect(result).toEqual(expected);
    });
  });

  test('file extension extraction', async () => {
    await setupCmsConfig();

    const testCases = [
      { entryFilePath: 'article.md', expected: 'md' },
      { entryFilePath: 'article.html.erb', expected: 'erb' },
      { entryFilePath: 'article.backup.json', expected: 'json' },
      { entryFilePath: 'article', expected: 'article' }, // No extension
      { entryFilePath: 'path/to/article.txt', expected: 'txt' },
    ];

    testCases.forEach(({ entryFilePath, expected }) => {
      const result = fillTemplate('{{extension}}', {
        collection,
        content: {},
        type: 'preview_path',
        entryFilePath,
      });

      expect(result).toEqual(expected);
    });
  });

  test('filename extraction', async () => {
    await setupCmsConfig();

    const testCases = [
      { entryFilePath: 'article.md', expected: 'article' },
      { entryFilePath: 'article.html.erb', expected: 'article' }, // Takes first part before first dot
      { entryFilePath: 'my-long-filename.backup.json', expected: 'my-long-filename' },
      { entryFilePath: 'path/to/article.txt', expected: 'article' },
      { entryFilePath: 'path/to/no-extension', expected: 'no-extension' },
    ];

    testCases.forEach(({ entryFilePath, expected }) => {
      const result = fillTemplate('{{filename}}', {
        collection,
        content: {},
        type: 'preview_path',
        entryFilePath,
      });

      expect(result).toEqual(expected);
    });
  });

  test('custom identifier field', async () => {
    await setupCmsConfig();

    const customCollection = {
      ...collection,
      identifier_field: 'name',
    };

    const content = { title: 'My Title', name: 'custom-name' };

    // When using the slug tag without currentSlug, it should use the identifier field
    expect(
      fillTemplate('{{slug}}', {
        collection: customCollection,
        content,
      }),
    ).toEqual('summary'); // Mocked getEntrySummaryFromContent returns 'summary'
  });

  test('slug length truncation', async () => {
    await setupCmsConfig();

    const longContent = {
      title:
        'This is a very long title that should be truncated when the slug length limit is applied',
    };

    const shortLengthCollection = {
      ...collection,
      slug_length: 20,
    };

    const result = fillTemplate('{{title}}', {
      collection: shortLengthCollection,
      content: longContent,
    });

    expect(result.length).toBeLessThanOrEqual(20);
    expect(result).not.toMatch(/-$/); // Should remove trailing hyphens
  });

  test('slug length with no truncation', async () => {
    await setupCmsConfig();

    const content = { title: 'Short Title' };

    // Test without slug_length defined
    const noLengthCollection = {
      ...collection,
      slug_length: undefined,
    };

    expect(
      fillTemplate('{{title}}', {
        collection: noLengthCollection,
        content,
      }),
    ).toEqual('short-title');
  });

  test('current slug handling', async () => {
    await setupCmsConfig();

    const content = { title: 'My Title' };
    // Without currentSlug, should process normally and call renameIfNeeded
    const resultWithoutSlug = fillTemplate('{{title}}', { collection, content });

    expect(resultWithoutSlug).toEqual('my-title');

    // With currentSlug, should skip renameIfNeeded and return directly
    const resultWithSlug = fillTemplate('{{title}}', {
      collection,
      content,
      currentSlug: 'existing-slug',
    });

    expect(resultWithSlug).toEqual('my-title');
  });

  test('empty template', async () => {
    await setupCmsConfig();

    expect(fillTemplate('', { collection, content: {} })).toEqual('');
    expect(fillTemplate('   ', { collection, content: {} })).toEqual('');
  });

  test('template with static text', async () => {
    await setupCmsConfig();

    const content = { title: 'My Article', category: 'Tech' };

    expect(fillTemplate('blog-{{title}}', { collection, content })).toEqual('blog-my-article');
    expect(fillTemplate('{{category}}-post-{{title}}', { collection, content })).toEqual(
      'tech-post-my-article',
    );
    expect(fillTemplate('posts/{{year}}/{{title}}/index', { collection, content })).toMatch(
      /^posts\/\d{4}\/my-article\/index$/,
    );
  });

  test('malformed templates', async () => {
    await setupCmsConfig();

    const content = { title: 'My Article' };

    // Unclosed tags should be treated as literal text
    expect(fillTemplate('{{title', { collection, content })).toEqual('{{title');
    expect(fillTemplate('title}}', { collection, content })).toEqual('title}}');

    // Empty tags should be treated as literal text (not replaced)
    expect(fillTemplate('{{}}', { collection, content })).toEqual('{{}}');

    // Nested tags (the outer ones should be processed, but parsing is limited)
    // The regex matches {{title-{{category which becomes a UUID, leaving }} as literal
    expect(fillTemplate('{{title-{{category}}}}', { collection, content })).toMatch(
      /^[0-9a-f]{12}}}$/,
    );
  });

  test('transformations with undefined values', async () => {
    await setupCmsConfig();

    const content = {};

    // Should use default transformation value
    expect(fillTemplate("{{title | default('fallback')}}", { collection, content })).toEqual(
      'fallback',
    );

    // Without default transformation, should use UUID fallback
    expect(fillTemplate('{{title | upper}}', { collection, content })).toMatch(/[0-9a-f]{12}/);
  });

  test('preview path empty slug handling', async () => {
    await setupCmsConfig();

    const content = {};

    // In preview_path mode, empty values should return empty string, not UUID
    const result = fillTemplate('{{nonexistent}}', {
      collection,
      content,
      type: 'preview_path',
    });

    expect(result).toEqual('');
  });

  test('complex nested default transformations', async () => {
    await setupCmsConfig();

    // Test simple nested template tags in default transformations
    const content = { title: '', backupSlug: 'backup-slug' };

    const result = fillTemplate("{{title | default('{{backupSlug}}')}}", {
      collection,
      content,
    });

    expect(result).toEqual('backup-slug');

    // Complex nested templates with multiple tags are not supported by current implementation
    // The pattern {{backupSlug}}-{{category}} will be treated as literal text, not nested templates
    const content2 = { title: '', backupSlug: 'backup-slug', category: 'tech' };

    const result2 = fillTemplate("{{title | default('{{backupSlug}}-{{category}}')}}", {
      collection,
      content: content2,
    });

    // This results in the literal string being used as default, but since it contains {{ }},
    // it gets processed again and becomes UUIDs
    expect(result2).toMatch(/^[0-9a-f]{12}-[0-9a-f]{12}$/);
  });

  test('date parts without explicit dateTimeParts', async () => {
    await setupCmsConfig();

    // Test that date/time parts work without explicitly passing dateTimeParts
    const result = fillTemplate('{{year}}-{{month}}-{{day}}', {
      collection,
      content: {},
    });

    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('collection without file configuration', async () => {
    await setupCmsConfig();

    /** @type {InternalFileCollection} */
    const fileCollection = {
      ...collection,
      files: [],
      _type: 'file',
      _fileMap: {},
      // No _file property for file collections
    };

    // Should work without basePath
    const result = fillTemplate('{{dirname}}', {
      collection: fileCollection,
      content: {},
      type: 'preview_path',
      entryFilePath: 'content/pages/about.md',
    });

    expect(result).toEqual('content/pages');
  });

  test('whitespace handling in template', async () => {
    await setupCmsConfig();

    const content = { title: 'My Article', category: 'Tech' };

    // Template with extra whitespace should be trimmed
    expect(fillTemplate('  {{title}}  ', { collection, content })).toEqual('my-article');
    expect(fillTemplate('\t{{category}}-{{title}}\n', { collection, content })).toEqual(
      'tech-my-article',
    );
  });

  test('index file handling in preview path mode', async () => {
    await setupCmsConfig();

    const content = { title: 'Home Page' };

    /** @type {import('$lib/types/private').FillTemplateOptions} */
    const options = {
      collection,
      content,
      type: 'preview_path',
      locale: 'en',
      entryFilePath: 'content/posts/_index.md',
      isIndexFile: true,
    };

    // Test that dirname, filename, extension work normally for index files
    expect(fillTemplate('{{dirname}}', options)).toEqual('');
    expect(fillTemplate('{{filename}}', options)).toEqual('_index');
    expect(fillTemplate('{{extension}}', options)).toEqual('md');
    expect(fillTemplate('{{locale}}', options)).toEqual('en');

    // Test slug behavior with index files in preview path mode
    // When isIndexFile is true in preview path mode, {{slug}} should always return empty string
    expect(
      fillTemplate('{{slug}}', {
        ...options,
        currentSlug: '_index',
      }),
    ).toEqual('');

    // Even with regular slug values, index files in preview mode should return empty
    expect(
      fillTemplate('{{slug}}', {
        ...options,
        currentSlug: 'regular-slug',
      }),
    ).toEqual('');

    // Test with nested paths
    const nestedOptions = {
      ...options,
      entryFilePath: 'content/posts/2024/_index.md',
    };

    expect(fillTemplate('{{dirname}}', nestedOptions)).toEqual('/2024');
    expect(
      fillTemplate('{{slug}}', {
        ...nestedOptions,
        currentSlug: '_index',
      }),
    ).toEqual('');

    // Test template combinations with index files
    expect(
      fillTemplate('{{dirname}}/{{slug}}', {
        ...nestedOptions,
        currentSlug: '_index',
      }),
    ).toEqual('/2024/');

    expect(
      fillTemplate('{{dirname}}/{{slug}}', {
        ...nestedOptions,
        currentSlug: 'custom-slug',
      }),
    ).toEqual('/2024/');
  });

  test('default transformation with nested template tag', async () => {
    await setupCmsConfig();

    // Test with a field that exists but is empty
    const result = fillTemplate("{{emptyField | default('{{fallbackField}}')}}", {
      collection,
      content: { emptyField: '', fallbackField: 'Fallback Text' },
    });

    // When emptyField is empty, the default should use the fallback template tag
    expect(result).toBe('fallback-text');
  });

  describe('Internal helper functions coverage', () => {
    test('DATE_TIME_FIELDS constant is used correctly', async () => {
      await setupCmsConfig();

      const dateTimeParts = getDateTimeParts({ timeZone: 'UTC' });

      // Test that all date-time fields work
      expect(fillTemplate('{{year}}', { collection, content: {}, dateTimeParts })).toBe(
        dateTimeParts.year,
      );
      expect(fillTemplate('{{month}}', { collection, content: {}, dateTimeParts })).toBe(
        dateTimeParts.month,
      );
      expect(fillTemplate('{{day}}', { collection, content: {}, dateTimeParts })).toBe(
        dateTimeParts.day,
      );
      expect(fillTemplate('{{hour}}', { collection, content: {}, dateTimeParts })).toBe(
        dateTimeParts.hour,
      );
      expect(fillTemplate('{{minute}}', { collection, content: {}, dateTimeParts })).toBe(
        dateTimeParts.minute,
      );
      expect(fillTemplate('{{second}}', { collection, content: {}, dateTimeParts })).toBe(
        dateTimeParts.second,
      );
    });

    test('TEMPLATE_REGEX correctly matches template tags', async () => {
      await setupCmsConfig();

      // Test various template patterns
      expect(fillTemplate('{{title}}-{{slug}}', { collection, content: { title: 'Hello' } })).toBe(
        'hello-summary',
      );
      expect(
        fillTemplate('prefix-{{title}}-suffix', { collection, content: { title: 'Test' } }),
      ).toBe('prefix-test-suffix');
    });

    test('UUID_TYPES generates UUIDs correctly', async () => {
      await setupCmsConfig();

      const uuidResult = fillTemplate('{{uuid}}', { collection, content: {} });
      const uuidShortResult = fillTemplate('{{uuid_short}}', { collection, content: {} });
      const uuidShorterResult = fillTemplate('{{uuid_shorter}}', { collection, content: {} });

      // UUID should be 36 characters (including hyphens)
      expect(uuidResult).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      // UUID short should be 12 hex characters
      expect(uuidShortResult).toMatch(/^[0-9a-f]{12}$/);
      // UUID shorter should be 8 hex characters
      expect(uuidShorterResult).toMatch(/^[0-9a-f]{8}$/);
    });

    test('getFieldValue handles fields.* pattern', async () => {
      await setupCmsConfig();

      // Test fields.* pattern
      expect(fillTemplate('{{fields.title}}', { collection, content: { title: 'My Title' } })).toBe(
        'my-title',
      );
      expect(
        fillTemplate('{{fields.author}}', { collection, content: { author: 'John Doe' } }),
      ).toBe('john-doe');
    });

    test('getFieldValue handles slug tag specially', async () => {
      await setupCmsConfig();

      // When tag is 'slug', it should call getEntrySummaryFromContent
      const result = fillTemplate('{{slug}}', { collection, content: { title: 'Test' } });

      expect(result).toBe('summary'); // Mocked to return 'summary'
    });

    test('replaceTemplateTag handles locale for preview_path', async () => {
      await setupCmsConfig();

      const result = fillTemplate('{{locale}}', {
        collection,
        content: {},
        type: 'preview_path',
        locale: 'en',
      });

      expect(result).toBe('en');
    });

    test('processTransformations handles default transformation with nested tag', async () => {
      await setupCmsConfig();

      // Test nested template tag in default transformation
      const result = fillTemplate("{{missing | default('{{fields.fallback}}')}}", {
        collection,
        content: { fallback: 'Fallback Value' },
      });

      expect(result).toBe('fallback-value');
    });

    test('replaceTemplatePlaceholder falls back to random ID', async () => {
      await setupCmsConfig();

      // When a field is missing and no default is provided, should generate UUID
      const result = fillTemplate('{{nonexistent}}', { collection, content: {} });

      expect(result).toMatch(/^[0-9a-f]{12}$/);
    });

    test('getExistingSlugs filters and maps slugs correctly', async () => {
      await setupCmsConfig();

      const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');

      // Mock with some existing entries
      vi.mocked(getEntriesByCollection).mockReturnValueOnce([
        // @ts-ignore
        { slug: 'existing-1', locales: { en: { slug: 'existing-en-1' } } },
        // @ts-ignore
        { slug: 'existing-2', locales: { en: { slug: 'existing-en-2' } } },
        // @ts-ignore
        { slug: 'existing-3', locales: {} },
      ]);

      // The renameIfNeeded function should be called with existing slugs
      const { renameIfNeeded } = await import('$lib/services/utils/file');

      vi.mocked(renameIfNeeded).mockImplementationOnce((slug, existingSlugs) => {
        expect(existingSlugs).toEqual(['existing-1', 'existing-2', 'existing-3']);

        return slug;
      });

      fillTemplate('{{title}}', { collection, content: { title: 'New Post' } });
    });

    test('getExistingSlugs with locale returns locale-specific slugs', async () => {
      await setupCmsConfig();

      const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');
      const { renameIfNeeded } = await import('$lib/services/utils/file');

      // Mock with entries that have locale-specific slugs
      vi.mocked(getEntriesByCollection).mockReturnValueOnce([
        // @ts-ignore
        { slug: 'entry-1', locales: { en: { slug: 'entry-1-en' }, ja: { slug: 'entry-1-ja' } } },
        // @ts-ignore
        { slug: 'entry-2', locales: { en: { slug: 'entry-2-en' }, ja: { slug: 'entry-2-ja' } } },
        // @ts-ignore
        { slug: 'entry-3', locales: { en: { slug: 'entry-3-en' } } }, // No ja locale
      ]);

      vi.mocked(renameIfNeeded).mockImplementation((slug, existingSlugs) => {
        // When locale is 'ja', should only include entries with ja locale
        if (existingSlugs.includes('entry-1-ja')) {
          expect(existingSlugs).toEqual(['entry-1-ja', 'entry-2-ja']);
        } else if (existingSlugs.includes('entry-1-en')) {
          // When locale is 'en', should include all entries with en locale
          expect(existingSlugs).toEqual(['entry-1-en', 'entry-2-en', 'entry-3-en']);
        }

        return slug;
      });

      // Test with en locale
      fillTemplate('{{title}}', {
        collection,
        content: { title: 'New Post' },
        locale: 'en',
      });

      // Test with ja locale
      vi.mocked(renameIfNeeded).mockClear();
      vi.mocked(getEntriesByCollection).mockReturnValueOnce([
        // @ts-ignore
        { slug: 'entry-1', locales: { en: { slug: 'entry-1-en' }, ja: { slug: 'entry-1-ja' } } },
        // @ts-ignore
        { slug: 'entry-2', locales: { en: { slug: 'entry-2-en' }, ja: { slug: 'entry-2-ja' } } },
        // @ts-ignore
        { slug: 'entry-3', locales: { en: { slug: 'entry-3-en' } } },
      ]);

      vi.mocked(renameIfNeeded).mockImplementationOnce((slug, existingSlugs) => {
        expect(existingSlugs).toEqual(['entry-1-ja', 'entry-2-ja']);

        return slug;
      });

      fillTemplate('{{title}}', {
        collection,
        content: { title: 'New Post' },
        locale: 'ja',
      });
    });

    test('processTransformations with nested template tag generates correct default value', async () => {
      await setupCmsConfig();

      // This test ensures that line 227 is covered by testing the specific case
      // where a nested template tag exists in a default transformation
      const content = { title: '', backupSlug: 'backup-slug' };

      const result = fillTemplate("{{title | default('{{backupSlug}}')}}", {
        collection,
        content,
      });

      // The nested tag {{backupSlug}} should be replaced with 'backup-slug'
      // And then the default transformation should use it
      expect(result).toBe('backup-slug');
    });

    test('processTransformations with nested fields. prefix in default', async () => {
      await setupCmsConfig();

      const content = { title: '', slug: 'example-slug' };

      const result = fillTemplate("{{title | default('{{fields.slug}}')}}", {
        collection,
        content,
      });

      expect(result).toBe('example-slug');
    });

    test('processTransformations nested tag with author field', async () => {
      await setupCmsConfig();

      // Test that the nested template tag in default transformation is processed
      const content = { author: '', name: 'John Doe' };

      const result = fillTemplate("{{author | default('{{name}}')}}", {
        collection,
        content,
      });

      expect(result).toBe('john-doe');
    });

    test('processTransformations nested tag fallback when primary value is undefined', async () => {
      await setupCmsConfig();

      // Test explicitly with a field that doesn't exist, ensuring the default is used
      const content = { fallback: 'fallback-value' };

      // When 'missing' field doesn't exist, value will be undefined
      // The transformation should use the fallback value
      const result = fillTemplate("{{missing | default('{{fallback}}')}}", {
        collection,
        content,
      });

      expect(result).toBe('fallback-value');
    });

    test('fillTemplate handles file path tags in media_folder context', async () => {
      await setupCmsConfig();

      const result = fillTemplate('{{dirname}}/uploads', {
        collection,
        content: {},
        type: 'media_folder',
        entryFilePath: 'content/posts/2024/my-post.md',
      });

      expect(result).toBe('/2024/uploads');
    });

    test('fillTemplate returns value as-is for preview_path type', async () => {
      await setupCmsConfig();

      // Test that values are not slugified in preview_path mode
      const result1 = fillTemplate('{{locale}}', {
        collection,
        content: {},
        type: 'preview_path',
        locale: 'en-US',
      });

      expect(result1).toBe('en-US');

      // Test with dirname (already covered but included for completeness)
      const result2 = fillTemplate('{{dirname}}/article', {
        collection,
        content: {},
        type: 'preview_path',
        entryFilePath: 'content/posts/2024/my-post.md',
      });

      expect(result2).toBe('/2024/article');
    });
  });
});

describe('Test template helper functions', () => {
  describe('handleDateTimeTag()', () => {
    test('should return date-time field value when tag matches', () => {
      const dateTimeParts = {
        year: '2024',
        month: '10',
        day: '02',
        hour: '14',
        minute: '30',
        second: '45',
      };

      expect(handleDateTimeTag('year', dateTimeParts)).toBe('2024');
      expect(handleDateTimeTag('month', dateTimeParts)).toBe('10');
      expect(handleDateTimeTag('day', dateTimeParts)).toBe('02');
      expect(handleDateTimeTag('hour', dateTimeParts)).toBe('14');
      expect(handleDateTimeTag('minute', dateTimeParts)).toBe('30');
      expect(handleDateTimeTag('second', dateTimeParts)).toBe('45');
    });

    test('should return undefined for non-date-time tags', () => {
      const dateTimeParts = { year: '2024', month: '10', day: '02' };

      expect(handleDateTimeTag('slug', dateTimeParts)).toBeUndefined();
      expect(handleDateTimeTag('title', dateTimeParts)).toBeUndefined();
      expect(handleDateTimeTag('unknown', dateTimeParts)).toBeUndefined();
    });
  });

  describe('handleUuidTag()', () => {
    test('should return UUID for uuid tag', () => {
      const result = handleUuidTag('uuid');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result?.length).toBeGreaterThan(0);
    });

    test('should return short UUID for uuid_short tag', () => {
      const result = handleUuidTag('uuid_short');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result?.length).toBeGreaterThan(0);
    });

    test('should return shorter UUID for uuid_shorter tag', () => {
      const result = handleUuidTag('uuid_shorter');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result?.length).toBeGreaterThan(0);
    });

    test('should return undefined for non-UUID tags', () => {
      expect(handleUuidTag('slug')).toBeUndefined();
      expect(handleUuidTag('title')).toBeUndefined();
      expect(handleUuidTag('unknown')).toBeUndefined();
    });
  });

  describe('handleSlugTag()', () => {
    test('should return slug when tag is slug and currentSlug exists', () => {
      expect(handleSlugTag('slug', 'my-post', 'path', false)).toBe('my-post');
      expect(handleSlugTag('slug', 'another-slug', 'filename', false)).toBe('another-slug');
    });

    test('should return undefined when tag is not slug', () => {
      expect(handleSlugTag('title', 'my-post', 'path', false)).toBeUndefined();
      expect(handleSlugTag('year', 'my-post', 'path', false)).toBeUndefined();
    });

    test('should return undefined when currentSlug is undefined', () => {
      expect(handleSlugTag('slug', undefined, 'path', false)).toBeUndefined();
    });

    test('should return empty string for preview_path with index file', () => {
      expect(handleSlugTag('slug', '_index', 'preview_path', true)).toBe('');
      expect(handleSlugTag('slug', 'any-slug', 'preview_path', true)).toBe('');
    });

    test('should return slug for preview_path with non-index file', () => {
      expect(handleSlugTag('slug', 'my-post', 'preview_path', false)).toBe('my-post');
    });

    test('should return slug for non-preview_path types even with index file', () => {
      expect(handleSlugTag('slug', '_index', 'path', true)).toBe('_index');
      expect(handleSlugTag('slug', '_index', 'filename', true)).toBe('_index');
    });
  });

  describe('handleFilePathTag()', () => {
    test('should return dirname from entry file path', () => {
      expect(handleFilePathTag('dirname', 'content/posts/2024/my-post.md', 'content/posts')).toBe(
        '/2024',
      );
      expect(handleFilePathTag('dirname', 'content/blog/article.md', 'content/blog')).toBe('');
      expect(
        handleFilePathTag('dirname', 'content/posts/nested/folder/file.md', 'content/posts'),
      ).toBe('/nested/folder');
    });

    test('should return filename without extension', () => {
      expect(handleFilePathTag('filename', 'content/posts/my-post.md', 'content/posts')).toBe(
        'my-post',
      );
      expect(handleFilePathTag('filename', 'path/to/article.html', 'path/to')).toBe('article');
      expect(handleFilePathTag('filename', 'file.component.tsx', undefined)).toBe('file');
    });

    test('should return file extension', () => {
      expect(handleFilePathTag('extension', 'content/posts/my-post.md', 'content/posts')).toBe(
        'md',
      );
      expect(handleFilePathTag('extension', 'path/to/article.html', 'path/to')).toBe('html');
      expect(handleFilePathTag('extension', 'file.component.tsx', undefined)).toBe('tsx');
    });

    test('should return empty string when entry file path is undefined', () => {
      expect(handleFilePathTag('dirname', undefined, 'content/posts')).toBe('');
      expect(handleFilePathTag('filename', undefined, 'content/posts')).toBe('');
      expect(handleFilePathTag('extension', undefined, 'content/posts')).toBe('');
    });

    test('should return undefined for unknown tags', () => {
      expect(
        handleFilePathTag('slug', 'content/posts/my-post.md', 'content/posts'),
      ).toBeUndefined();
      expect(
        handleFilePathTag('title', 'content/posts/my-post.md', 'content/posts'),
      ).toBeUndefined();
    });

    test('should handle paths without base path', () => {
      expect(handleFilePathTag('dirname', 'posts/2024/my-post.md', undefined)).toBe('posts/2024');
      expect(handleFilePathTag('filename', 'my-post.md', undefined)).toBe('my-post');
    });
  });
});
