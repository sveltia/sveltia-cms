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
});
