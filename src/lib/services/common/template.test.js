import { getDateTimeParts } from '@sveltia/utils/datetime';
import { writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';

import { fillTemplate } from '$lib/services/common/template';
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

describe('Test fillTemplate()', async () => {
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

    expect(fillTemplate('{{title}}', { collection, content: { title } })).toEqual(
      'lorem-ipsum-dolor-sit-amet-consectetur',
    );
  });

  test('long slug', async () => {
    await setupSiteConfig();

    const title =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam pulvinar scelerisque';

    expect(fillTemplate('{{title}}', { collection, content: { title } })).toEqual(
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
    expect(fillTemplate(template, { collection, content: {} })).toEqual(result);
    expect(fillTemplate(template, { collection, content: {}, dateTimeParts })).toEqual(result);
  });

  test('random ID fallback', async () => {
    await setupSiteConfig();

    expect(fillTemplate('{{title}}', { collection, content: {} })).toMatch(/[0-9a-f]{12}/);
    expect(fillTemplate('{{name}}', { collection, content: {} })).toMatch(/[0-9a-f]{12}/);
  });

  test('apply filter', async () => {
    await setupSiteConfig();

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
    await setupSiteConfig();

    expect(fillTemplate('{{uuid}}', { collection, content: {} })).toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    );
    expect(fillTemplate('{{uuid_short}}', { collection, content: {} })).toMatch(/[0-9a-f]{12}/);
    expect(fillTemplate('{{uuid_shorter}}', { collection, content: {} })).toMatch(/[0-9a-f]{8}/);
  });

  test('fields prefix', async () => {
    await setupSiteConfig();

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
    await setupSiteConfig();

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
    await setupSiteConfig();

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
    await setupSiteConfig();

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
    await setupSiteConfig();

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
    await setupSiteConfig();

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
    await setupSiteConfig();

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
    await setupSiteConfig();

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
    await setupSiteConfig();

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
    await setupSiteConfig();

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
    await setupSiteConfig();

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
    await setupSiteConfig();

    expect(fillTemplate('', { collection, content: {} })).toEqual('');
    expect(fillTemplate('   ', { collection, content: {} })).toEqual('');
  });

  test('template with static text', async () => {
    await setupSiteConfig();

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
    await setupSiteConfig();

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
    await setupSiteConfig();

    const content = {};

    // Should use default transformation value
    expect(fillTemplate("{{title | default('fallback')}}", { collection, content })).toEqual(
      'fallback',
    );

    // Without default transformation, should use UUID fallback
    expect(fillTemplate('{{title | upper}}', { collection, content })).toMatch(/[0-9a-f]{12}/);
  });

  test('preview path empty slug handling', async () => {
    await setupSiteConfig();

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
    await setupSiteConfig();

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
    await setupSiteConfig();

    // Test that date/time parts work without explicitly passing dateTimeParts
    const result = fillTemplate('{{year}}-{{month}}-{{day}}', {
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
    const result = fillTemplate('{{dirname}}', {
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
    expect(fillTemplate('  {{title}}  ', { collection, content })).toEqual('my-article');
    expect(fillTemplate('\t{{category}}-{{title}}\n', { collection, content })).toEqual(
      'tech-my-article',
    );
  });

  test('index file handling in preview path mode', async () => {
    await setupSiteConfig();

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
});
