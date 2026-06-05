import { getDateTimeParts } from '@sveltia/utils/datetime';
import { writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';

import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';

import { fillTemplate, hasTemplateTags } from '.';

/**
 * @import { InternalEntryCollection, InternalFileCollection } from '$lib/types/private';
 */

vi.mock('$lib/services/config');
vi.mock('$lib/services/config/deprecations', () => ({
  warnDeprecation: vi.fn(),
}));
vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));
vi.mock('$lib/services/contents/entry/fields', () => ({
  LIST_KEY_PATH_REGEX: /\.\d+$/,
  getField: vi.fn(() => null),
}));
vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummaryFromContent: vi.fn(() => 'summary'),
}));
vi.mock('$lib/services/utils/file', () => ({
  renameIfNeeded: vi.fn((slug) => slug),
}));

describe('fillTemplate()', async () => {
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

    // UTC is the default when `slug.timezone` is not set, with or without explicit `dateTimeParts`
    expect(fillTemplate(template, { collection, content: {} })).toEqual(result);
    expect(fillTemplate(template, { collection, content: {}, dateTimeParts })).toEqual(result);
  });

  test('date/time with explicit utc timezone config', async () => {
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
        timezone: 'utc',
      },
    });

    const template = '{{year}}-{{month}}-{{day}}-{{hour}}-{{minute}}-{{second}}';
    const dateTimeParts = getDateTimeParts({ timeZone: 'UTC' });
    const { year, month, day, hour, minute, second } = dateTimeParts;
    const expected = `${year}-${month}-${day}-${hour}-${minute}-${second}`;

    // Explicitly setting `timezone: 'utc'` should produce the same result as the default
    expect(fillTemplate(template, { collection, content: {} })).toEqual(expected);
  });

  test('date/time with local timezone config', async () => {
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
        timezone: 'local',
      },
    });

    const template = '{{year}}-{{month}}-{{day}}-{{hour}}-{{minute}}-{{second}}';
    // Should produce a valid date/time format using the local timezone
    const result = fillTemplate(template, { collection, content: {} });

    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/);

    // Explicitly provided `dateTimeParts` should always be used, regardless of timezone config
    const customParts = {
      year: '2025',
      month: '06',
      day: '15',
      hour: '10',
      minute: '30',
      second: '45',
    };

    expect(fillTemplate(template, { collection, content: {}, dateTimeParts: customParts })).toEqual(
      '2025-06-15-10-30-45',
    );
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
        expected: '',
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
        expected: '',
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
      { entryFilePath: 'article', expected: 'article' },
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
      { entryFilePath: 'article.html.erb', expected: 'article' },
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

    expect(
      fillTemplate('{{slug}}', {
        collection: customCollection,
        content,
      }),
    ).toEqual('summary');
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
    expect(result).not.toMatch(/-$/);
  });

  test('slug length with no truncation', async () => {
    await setupCmsConfig();

    const content = { title: 'Short Title' };

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

  test('legacy slug_length option triggers deprecation warning', async () => {
    await setupCmsConfig();

    vi.clearAllMocks();

    const longContent = {
      title:
        'This is a very long title that should be truncated when the slug length limit is applied',
    };

    const legacyCollection = {
      ...collection,
      slug_length: 25,
    };

    fillTemplate('{{title}}', {
      collection: legacyCollection,
      content: longContent,
    });

    const result = fillTemplate('{{title}}', {
      collection: legacyCollection,
      content: longContent,
    });

    expect(result.length).toBeLessThanOrEqual(25);
  });

  test('slug max length from config when legacy option not defined', async () => {
    await setupCmsConfig();

    const { warnDeprecation } = await import('$lib/services/config/deprecations');

    vi.clearAllMocks();

    const longContent = {
      title:
        'This is a very long title that should be truncated when the slug length limit is applied',
    };

    const collectionWithoutLegacy = {
      ...collection,
      slug_length: undefined,
    };

    const result = fillTemplate('{{title}}', {
      collection: collectionWithoutLegacy,
      content: longContent,
    });

    expect(warnDeprecation).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  test('slug max length from new maxlength config option', async () => {
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
        maxlength: 30,
      },
    });

    const longContent = {
      title:
        'This is a very long title that should be truncated when the slug length limit is applied',
    };

    const collectionWithoutLegacy = {
      ...collection,
      slug_length: undefined,
    };

    const result = fillTemplate('{{title}}', {
      collection: collectionWithoutLegacy,
      content: longContent,
    });

    expect(result.length).toBeLessThanOrEqual(30);
    expect(result).not.toMatch(/-$/);
  });

  test('legacy slug_length overrides config maxlength option', async () => {
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
        maxlength: 50,
      },
    });

    vi.clearAllMocks();

    const longContent = {
      title:
        'This is a very long title that should be truncated when the slug length limit is applied',
    };

    const legacyCollection = {
      ...collection,
      slug_length: 20,
    };

    const result = fillTemplate('{{title}}', {
      collection: legacyCollection,
      content: longContent,
    });

    expect(result.length).toBeLessThanOrEqual(20);
    expect(result).not.toMatch(/-$/);
  });

  test('current slug handling', async () => {
    await setupCmsConfig();

    const content = { title: 'My Title' };
    const resultWithoutSlug = fillTemplate('{{title}}', { collection, content });

    expect(resultWithoutSlug).toEqual('my-title');

    const resultWithSlug = fillTemplate('{{title}}', {
      collection,
      content,
      currentSlug: 'existing-slug',
    });

    expect(resultWithSlug).toEqual('my-title');
  });

  test('path template with currentSlug is not truncated by maxlength', async () => {
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
        maxlength: 64,
      },
    });

    const longSlug = 'a'.repeat(64);
    const content = { title: 'Some Title' };

    const result = fillTemplate('{{slug}}/+page', {
      collection: { ...collection, slug_length: undefined },
      content,
      currentSlug: longSlug,
    });

    expect(result).toEqual(`${longSlug}/+page`);
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

    expect(fillTemplate('{{title', { collection, content })).toEqual('{{title');
    expect(fillTemplate('title}}', { collection, content })).toEqual('title}}');
    expect(fillTemplate('{{}}', { collection, content })).toEqual('{{}}');
    expect(fillTemplate('{{title-{{category}}}}', { collection, content })).toMatch(
      /^[0-9a-f]{12}}}$/,
    );
  });

  test('transformations with undefined values', async () => {
    await setupCmsConfig();

    const content = {};

    expect(fillTemplate("{{title | default('fallback')}}", { collection, content })).toEqual(
      'fallback',
    );
    expect(fillTemplate('{{title | upper}}', { collection, content })).toMatch(/[0-9a-f]{12}/);
  });

  test('preview path empty slug handling', async () => {
    await setupCmsConfig();

    const content = {};

    const result = fillTemplate('{{nonexistent}}', {
      collection,
      content,
      type: 'preview_path',
    });

    expect(result).toEqual('');
  });

  test('complex nested default transformations', async () => {
    await setupCmsConfig();

    const content = { title: '', backupSlug: 'backup-slug' };

    const result = fillTemplate("{{title | default('{{backupSlug}}')}}", {
      collection,
      content,
    });

    expect(result).toEqual('backup-slug');

    const content2 = { title: '', backupSlug: 'backup-slug', category: 'tech' };

    const result2 = fillTemplate("{{title | default('{{backupSlug}}-{{category}}')}}", {
      collection,
      content: content2,
    });

    expect(result2).toMatch(/^[0-9a-f]{12}-[0-9a-f]{12}$/);
  });

  test('date parts without explicit dateTimeParts', async () => {
    await setupCmsConfig();

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
    };

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

    expect(fillTemplate('{{dirname}}', options)).toEqual('');
    expect(fillTemplate('{{filename}}', options)).toEqual('_index');
    expect(fillTemplate('{{extension}}', options)).toEqual('md');
    expect(fillTemplate('{{locale}}', options)).toEqual('en');

    expect(
      fillTemplate('{{slug}}', {
        ...options,
        currentSlug: '_index',
      }),
    ).toEqual('');

    expect(
      fillTemplate('{{slug}}', {
        ...options,
        currentSlug: 'regular-slug',
      }),
    ).toEqual('');

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

    const result = fillTemplate("{{emptyField | default('{{fallbackField}}')}}", {
      collection,
      content: { emptyField: '', fallbackField: 'Fallback Text' },
    });

    expect(result).toBe('fallback-text');
  });

  test('DATE_TIME_FIELDS constant is used correctly', async () => {
    await setupCmsConfig();

    const dateTimeParts = getDateTimeParts({ timeZone: 'UTC' });

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

  test('TEMPLATE_TAG_REPLACE_REGEX correctly matches template tags', async () => {
    await setupCmsConfig();

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

    expect(uuidResult).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(uuidShortResult).toMatch(/^[0-9a-f]{12}$/);
    expect(uuidShorterResult).toMatch(/^[0-9a-f]{8}$/);
  });

  test('getFieldValue handles fields.* pattern', async () => {
    await setupCmsConfig();

    expect(fillTemplate('{{fields.title}}', { collection, content: { title: 'My Title' } })).toBe(
      'my-title',
    );
    expect(fillTemplate('{{fields.author}}', { collection, content: { author: 'John Doe' } })).toBe(
      'john-doe',
    );
  });

  test('getFieldValue handles slug tag specially', async () => {
    await setupCmsConfig();

    const result = fillTemplate('{{slug}}', { collection, content: { title: 'Test' } });

    expect(result).toBe('summary');
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

    const result = fillTemplate("{{missing | default('{{fields.fallback}}')}}", {
      collection,
      content: { fallback: 'Fallback Value' },
    });

    expect(result).toBe('fallback-value');
  });

  test('replaceTemplatePlaceholder falls back to random ID', async () => {
    await setupCmsConfig();

    const result = fillTemplate('{{nonexistent}}', { collection, content: {} });

    expect(result).toMatch(/^[0-9a-f]{12}$/);
  });

  test('getExistingSlugs filters and maps slugs correctly', async () => {
    await setupCmsConfig();

    const { getEntriesByCollection } = await import('$lib/services/contents/collection/entries');

    vi.mocked(getEntriesByCollection).mockReturnValueOnce([
      // @ts-ignore
      { slug: 'existing-1', locales: { en: { slug: 'existing-en-1' } } },
      // @ts-ignore
      { slug: 'existing-2', locales: { en: { slug: 'existing-en-2' } } },
      // @ts-ignore
      { slug: 'existing-3', locales: {} },
    ]);

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

    vi.mocked(getEntriesByCollection).mockReturnValueOnce([
      // @ts-ignore
      { slug: 'entry-1', locales: { en: { slug: 'entry-1-en' }, ja: { slug: 'entry-1-ja' } } },
      // @ts-ignore
      { slug: 'entry-2', locales: { en: { slug: 'entry-2-en' }, ja: { slug: 'entry-2-ja' } } },
      // @ts-ignore
      { slug: 'entry-3', locales: { en: { slug: 'entry-3-en' } } },
    ]);

    vi.mocked(renameIfNeeded).mockImplementation((slug, existingSlugs) => {
      if (existingSlugs.includes('entry-1-ja')) {
        expect(existingSlugs).toEqual(['entry-1-ja', 'entry-2-ja']);
      } else if (existingSlugs.includes('entry-1-en')) {
        expect(existingSlugs).toEqual(['entry-1-en', 'entry-2-en', 'entry-3-en']);
      }

      return slug;
    });

    fillTemplate('{{title}}', {
      collection,
      content: { title: 'New Post' },
      locale: 'en',
    });

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

    const content = { title: '', backupSlug: 'backup-slug' };

    const result = fillTemplate("{{title | default('{{backupSlug}}')}}", {
      collection,
      content,
    });

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

    const content = { author: '', name: 'John Doe' };

    const result = fillTemplate("{{author | default('{{name}}')}}", {
      collection,
      content,
    });

    expect(result).toBe('john-doe');
  });

  test('processTransformations nested tag fallback when primary value is undefined', async () => {
    await setupCmsConfig();

    const content = { fallback: 'fallback-value' };

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

  test('fillTemplate falls through to field value when tag is not a file path tag in preview_path with entryFilePath', async () => {
    await setupCmsConfig();

    const result = fillTemplate('{{title}}', {
      collection,
      content: { title: 'My Post Title' },
      type: 'preview_path',
      entryFilePath: 'content/posts/2024/my-post.md',
    });

    expect(result).toBe('My Post Title');
  });

  test('fillTemplate falls through to field value for media_folder with non-filepath tag and entryFilePath', async () => {
    await setupCmsConfig();

    const result = fillTemplate('{{category}}', {
      collection,
      content: { category: 'photography' },
      type: 'media_folder',
      entryFilePath: 'content/posts/2024/my-post.md',
    });

    expect(result).toBe('photography');
  });

  test('processTransformations uses empty string when inner default tag resolves to undefined', async () => {
    await setupCmsConfig();

    const result = fillTemplate("{{missingOuter | default('{{missingInner}}')}}", {
      collection,
      content: {},
    });

    expect(typeof result).toBe('string');
  });

  test('fillTemplate returns value as-is for preview_path type', async () => {
    await setupCmsConfig();

    const result1 = fillTemplate('{{locale}}', {
      collection,
      content: {},
      type: 'preview_path',
      locale: 'en-US',
    });

    expect(result1).toBe('en-US');

    const result2 = fillTemplate('{{dirname}}/article', {
      collection,
      content: {},
      type: 'preview_path',
      entryFilePath: 'content/posts/2024/my-post.md',
    });

    expect(result2).toBe('/2024/article');
  });
});

describe('hasTemplateTags()', () => {
  test('should return true for simple template tag', () => {
    expect(hasTemplateTags('{{title}}')).toBe(true);
    expect(hasTemplateTags('{{slug}}')).toBe(true);
    expect(hasTemplateTags('{{year}}')).toBe(true);
  });

  test('should return true for template tag with content prefix', () => {
    expect(hasTemplateTags('prefix-{{title}}')).toBe(true);
    expect(hasTemplateTags('blog-{{slug}}')).toBe(true);
    expect(hasTemplateTags('Hello {{name}}')).toBe(true);
  });

  test('should return true for template tag with content suffix', () => {
    expect(hasTemplateTags('{{title}}-suffix')).toBe(true);
    expect(hasTemplateTags('{{slug}}/index')).toBe(true);
    expect(hasTemplateTags('{{year}}-post')).toBe(true);
  });

  test('should return true for multiple template tags', () => {
    expect(hasTemplateTags('{{year}}-{{month}}-{{day}}')).toBe(true);
    expect(hasTemplateTags('{{category}}/{{slug}}')).toBe(true);
    expect(hasTemplateTags('{{fields.title}}-{{uuid}}')).toBe(true);
  });

  test('should return true for template tag with nested content', () => {
    expect(hasTemplateTags('{{fields.title}}')).toBe(true);
    expect(hasTemplateTags('{{fields.author | default("fallback")}}')).toBe(true);
    expect(hasTemplateTags("{{title | date('YYYY-MM-DD')}}")).toBe(true);
  });

  test('should return false for string without template tags', () => {
    expect(hasTemplateTags('just a plain string')).toBe(false);
    expect(hasTemplateTags('no-templates-here')).toBe(false);
    expect(hasTemplateTags('Hello World')).toBe(false);
  });

  test('should return false for empty string', () => {
    expect(hasTemplateTags('')).toBe(false);
  });

  test('should return false for whitespace only', () => {
    expect(hasTemplateTags('   ')).toBe(false);
    expect(hasTemplateTags('\t')).toBe(false);
    expect(hasTemplateTags('\n')).toBe(false);
  });

  test('should return false for incomplete template tags', () => {
    expect(hasTemplateTags('{{title')).toBe(false);
    expect(hasTemplateTags('title}}')).toBe(false);
    expect(hasTemplateTags('{title}')).toBe(false);
  });

  test('should return false for empty braces', () => {
    expect(hasTemplateTags('{{}}')).toBe(false);
    expect(hasTemplateTags('prefix-{{}}')).toBe(false);
  });

  test('should handle the negative lookahead case correctly', () => {
    expect(hasTemplateTags("{{fields.slug | default('{{fields.title}}')}}")).toBe(true);
    expect(hasTemplateTags("test')")).toBe(false);
  });

  test('should handle special characters in template tags', () => {
    expect(hasTemplateTags('{{slug-with-dash}}')).toBe(true);
    expect(hasTemplateTags('{{slug_with_underscore}}')).toBe(true);
    expect(hasTemplateTags('{{slug.with.dots}}')).toBe(true);
  });

  test('should handle spaces inside template tags', () => {
    expect(hasTemplateTags('{{ title }}')).toBe(true);
    expect(hasTemplateTags('{{  slug  }}')).toBe(true);
    expect(hasTemplateTags('{{ fields.author }}')).toBe(true);
  });

  test('should return true for paths with template tags', () => {
    expect(hasTemplateTags('content/{{year}}/{{month}}/post.md')).toBe(true);
    expect(hasTemplateTags('{{dirname}}/{{filename}}.{{extension}}')).toBe(true);
  });

  test('should return true for template tags with transformations', () => {
    expect(hasTemplateTags('{{title | upper}}')).toBe(true);
    expect(hasTemplateTags("{{published | date('MMM D, YYYY')}}")).toBe(true);
    expect(hasTemplateTags('{{name | truncate(20)}}')).toBe(true);
    expect(hasTemplateTags("{{author | default('Unknown')}}")).toBe(true);
  });

  test('should return false for single braces', () => {
    expect(hasTemplateTags('{title}')).toBe(false);
    expect(hasTemplateTags('{slug}')).toBe(false);
  });

  test('should return false for mismatched braces', () => {
    expect(hasTemplateTags('{{title}')).toBe(false);
    expect(hasTemplateTags('{slug}}')).toBe(false);
  });

  test('should handle mixed content with and without tags', () => {
    expect(hasTemplateTags('static-{{dynamic}}-static')).toBe(true);
    expect(hasTemplateTags('2024-{{month}}-{{day}}')).toBe(true);
  });

  test('should return true for UUID tags', () => {
    expect(hasTemplateTags('{{uuid}}')).toBe(true);
    expect(hasTemplateTags('{{uuid_short}}')).toBe(true);
    expect(hasTemplateTags('{{uuid_shorter}}')).toBe(true);
  });

  test('should return true for datetime tags', () => {
    expect(hasTemplateTags('{{year}}')).toBe(true);
    expect(hasTemplateTags('{{month}}')).toBe(true);
    expect(hasTemplateTags('{{day}}')).toBe(true);
    expect(hasTemplateTags('{{hour}}')).toBe(true);
    expect(hasTemplateTags('{{minute}}')).toBe(true);
    expect(hasTemplateTags('{{second}}')).toBe(true);
  });

  test('should return true for file path tags', () => {
    expect(hasTemplateTags('{{dirname}}')).toBe(true);
    expect(hasTemplateTags('{{filename}}')).toBe(true);
    expect(hasTemplateTags('{{extension}}')).toBe(true);
  });

  test('should return true for locale tag', () => {
    expect(hasTemplateTags('{{locale}}')).toBe(true);
  });

  test('should return false for literal brace patterns', () => {
    expect(hasTemplateTags('{{{')).toBe(false);
    expect(hasTemplateTags('}}}')).toBe(false);
    expect(hasTemplateTags('{{}}')).toBe(false);
  });

  test('should handle very long template tags', () => {
    const longTag = `{{${'a'.repeat(1000)}}}`;

    expect(hasTemplateTags(longTag)).toBe(true);
  });

  test('should handle regex special characters in surrounding text', () => {
    expect(hasTemplateTags('file.name-{{slug}}.txt')).toBe(true);
    expect(hasTemplateTags('path/to/{{title}}/index')).toBe(true);
    expect(hasTemplateTags('[{{slug}}]')).toBe(true);
  });

  test('should work with newlines and special whitespace', () => {
    expect(hasTemplateTags('line1\n{{title}}\nline2')).toBe(true);
    expect(hasTemplateTags('tab\t{{slug}}\ttab')).toBe(true);
  });
});
