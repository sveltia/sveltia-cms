import { describe, expect, test, vi } from 'vitest';

import { customFileFormatRegistry } from '$lib/services/api/registries';
import {
  detectFileExtension,
  detectFileFormat,
  getEntryPathRegEx,
  getFileConfig,
  getFrontMatterDelimiters,
  getIndexFileFormat,
  resolveFileConfig,
} from '$lib/services/contents/file/config';

/**
 * @import { InternalI18nOptions } from '$lib/types/private';
 */

// Mock dependencies
vi.mock('$lib/services/config/deprecations');

describe('Test detectFileExtension()', () => {
  test('returns custom extension from format', () => {
    // Mock custom file format
    customFileFormatRegistry.set('custom', { extension: 'custom' });

    expect(detectFileExtension({ format: /** @type {any} */ ('custom') })).toBe('custom');

    // Clean up
    customFileFormatRegistry.delete('custom');
  });

  test('returns provided extension', () => {
    expect(detectFileExtension({ extension: 'txt' })).toBe('txt');
  });

  test('returns yml for yaml format', () => {
    expect(detectFileExtension({ format: 'yaml' })).toBe('yml');
    expect(detectFileExtension({ format: 'yml' })).toBe('yml');
  });

  test('returns toml for toml format', () => {
    expect(detectFileExtension({ format: 'toml' })).toBe('toml');
  });

  test('returns json for json format', () => {
    expect(detectFileExtension({ format: 'json' })).toBe('json');
  });

  test('returns txt for raw format', () => {
    expect(detectFileExtension({ format: /** @type {any} */ ('raw') })).toBe('txt');
  });

  test('returns md as default', () => {
    expect(detectFileExtension({})).toBe('md');
    expect(detectFileExtension({ format: /** @type {any} */ ('unknown') })).toBe('md');
  });

  test('prioritizes custom extension over provided extension', () => {
    customFileFormatRegistry.set('custom', { extension: 'custom' });

    expect(detectFileExtension({ extension: 'txt', format: /** @type {any} */ ('custom') })).toBe(
      'custom',
    );

    // Clean up
    customFileFormatRegistry.delete('custom');
  });

  test('prioritizes provided extension over format', () => {
    expect(detectFileExtension({ extension: 'txt', format: 'yaml' })).toBe('txt');
  });
});

describe('Test detectFileFormat()', () => {
  test('returns provided format', () => {
    expect(detectFileFormat({ extension: 'md', format: 'json' })).toBe('json');
    expect(
      detectFileFormat({ extension: 'md', format: /** @type {any} */ ('custom-format') }),
    ).toBe('custom-format');
  });

  test('detects yaml from extension', () => {
    expect(detectFileFormat({ extension: 'yaml' })).toBe('yaml');
    expect(detectFileFormat({ extension: 'yml' })).toBe('yaml');
  });

  test('detects toml from extension', () => {
    expect(detectFileFormat({ extension: 'toml' })).toBe('toml');
  });

  test('detects json from extension', () => {
    expect(detectFileFormat({ extension: 'json' })).toBe('json');
  });

  test('detects raw from astro extension', () => {
    expect(detectFileFormat({ extension: 'astro' })).toBe('raw');
  });

  test('detects frontmatter from markdown extensions', () => {
    const markdownExtensions = ['md', 'mkd', 'mkdn', 'mdwn', 'mdown', 'markdown'];

    markdownExtensions.forEach((ext) => {
      expect(detectFileFormat({ extension: ext })).toBe('frontmatter');
    });
  });

  test('returns yaml-frontmatter as default', () => {
    expect(detectFileFormat({ extension: 'txt' })).toBe('yaml-frontmatter');
    expect(detectFileFormat({ extension: 'unknown' })).toBe('yaml-frontmatter');
  });
});

describe('Test getEntryPathRegEx()', () => {
  const baseI18nOptions = {
    i18nEnabled: false,
    allLocales: ['en', 'fr'],
    initialLocales: ['en', 'fr'],
    defaultLocale: 'en',
    structure: /** @type {'single_file'} */ ('single_file'),
    omitDefaultLocaleFromFilePath: false,
    omitDefaultLocaleFromPreviewPath: false,
    canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
  };

  test('generates regex without i18n', () => {
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      _i18n,
    });

    expect(regex.source).toBe('^content\\/posts\\/(?<subPath>[^/]+?)\\.md$');
    expect('content/posts/my-post.md'.match(regex)?.groups?.subPath).toBe('my-post');
  });

  test('generates regex for a nested collection with an unlimited depth', () => {
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/pages',
      nestedDepth: Infinity,
      _i18n,
    });

    expect(regex.source).toBe('^content\\/pages\\/(?<subPath>[^/]+?(?:\\/[^/]+?)*)\\.md$');
    expect('content/pages/_index.md'.match(regex)?.groups?.subPath).toBe('_index');
    expect('content/pages/a/b/c/_index.md'.match(regex)?.groups?.subPath).toBe('a/b/c/_index');
  });

  test('generates regex for a nested collection with a limited depth', () => {
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/pages',
      nestedDepth: 2,
      _i18n,
    });

    expect(regex.source).toBe('^content\\/pages\\/(?<subPath>[^/]+?(?:\\/[^/]+?){0,1})\\.md$');
    expect('content/pages/a/_index.md'.match(regex)?.groups?.subPath).toBe('a/_index');
    expect('content/pages/a/b/_index.md'.match(regex)).toBe(null);
  });

  test('generates regex for a nested collection with a subPath template', () => {
    // A page bundle collection puts each entry in its own folder, and nesting means that folder can
    // itself sit below others
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/pages',
      subPath: '{{slug}}/_index',
      nestedDepth: Infinity,
      _i18n,
    });

    expect('content/pages/about/_index.md'.match(regex)?.groups?.subPath).toBe('about/_index');
    expect('content/pages/about/team/_index.md'.match(regex)?.groups?.subPath).toBe(
      'about/team/_index',
    );
    expect('content/pages/a/b/c/_index.md'.match(regex)?.groups?.subPath).toBe('a/b/c/_index');
    // The template still excludes the files that don’t follow it
    expect('content/pages/about/notes.md'.match(regex)).toBe(null);
  });

  test('counts the subPath template segments against the nested depth', () => {
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/pages',
      subPath: '{{slug}}/_index',
      nestedDepth: 4,
      _i18n,
    });

    expect('content/pages/a/b/c/_index.md'.match(regex)?.groups?.subPath).toBe('a/b/c/_index');
    expect('content/pages/a/b/c/d/_index.md'.match(regex)).toBe(null);
  });

  test('generates regex with subPath template', () => {
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      subPath: '{{year}}/{{slug}}',
      _i18n,
    });

    expect(regex.source).toBe('^content\\/posts\\/(?<subPath>[^/]+?\\/[^/]+?)\\.md$');
    expect('content/posts/2023/my-post.md'.match(regex)?.groups?.subPath).toBe('2023/my-post');
  });

  test('generates regex with index file name', () => {
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      subPath: '{{slug}}/index',
      indexFileName: '_index',
      _i18n,
    });

    expect(regex.source).toBe('^content\\/posts\\/(?<subPath>[^/]+?\\/index|_index)\\.md$');
    expect('content/posts/my-post/index.md'.match(regex)?.groups?.subPath).toBe('my-post/index');
    expect('content/posts/_index.md'.match(regex)?.groups?.subPath).toBe('_index');
  });

  test('generates regex with multi-file i18n', () => {
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: true,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      _i18n,
    });

    expect(regex.source).toBe('^content\\/posts\\/(?<subPath>[^/]+?)\\.(?<locale>en|fr)\\.md$');
    expect('content/posts/my-post.en.md'.match(regex)?.groups?.locale).toBe('en');
    expect('content/posts/my-post.fr.md'.match(regex)?.groups?.locale).toBe('fr');
  });

  test('generates regex with omitDefaultLocaleFromFilePath', () => {
    const _i18n = {
      ...baseI18nOptions,
      omitDefaultLocaleFromFilePath: true,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: true,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      _i18n,
    });

    expect(regex.source).toBe('^content\\/posts\\/(?<subPath>[^/]+?)(?:\\.(?<locale>fr))?\\.md$');
    expect('content/posts/my-post.md'.match(regex)?.groups?.locale).toBeUndefined();
    expect('content/posts/my-post.fr.md'.match(regex)?.groups?.locale).toBe('fr');
  });

  test('generates regex with multi-folder i18n', () => {
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: true,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      _i18n,
    });

    expect(regex.source).toBe('^content\\/posts\\/(?<locale>en|fr)\\/(?<subPath>[^/]+?)\\.md$');
    expect('content/posts/en/my-post.md'.match(regex)?.groups?.locale).toBe('en');
    expect('content/posts/fr/my-post.md'.match(regex)?.groups?.locale).toBe('fr');
  });

  test('generates regex with root multi-folder i18n', () => {
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: true,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      _i18n,
    });

    expect(regex.source).toBe('^(?<locale>en|fr)\\/content\\/posts\\/(?<subPath>[^/]+?)\\.md$');
    expect('en/content/posts/my-post.md'.match(regex)?.groups?.locale).toBe('en');
    expect('fr/content/posts/my-post.md'.match(regex)?.groups?.locale).toBe('fr');
  });

  test('handles empty basePath', () => {
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: '',
      _i18n,
    });

    expect(regex.source).toBe('^(?<subPath>[^/]+?)\\.md$');
    expect('my-post.md'.match(regex)?.groups?.subPath).toBe('my-post');
  });

  test('handles brackets in subPath', () => {
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'app/(content)/(writing)',
      subPath: '{{slug}}/page',
      _i18n,
    });

    // Brackets should be escaped literally in the regex
    expect(regex.source).toBe(
      '^app\\/\\(content\\)\\/\\(writing\\)\\/(?<subPath>[^/]+?\\/page)\\.md$',
    );
    expect('app/(content)/(writing)/my-post/page.md'.match(regex)?.groups?.subPath).toBe(
      'my-post/page',
    );
    // Should not match without the brackets
    expect('app/content/writing/my-post/page.md'.match(regex)).toBeNull();
  });

  test('handles mixed brackets and placeholders in subPath', () => {
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content',
      subPath: '(draft)/{{status}}/{{slug}}',
      _i18n,
    });

    // Brackets should be escaped, placeholders should become wildcard patterns
    expect(regex.source).toBe('^content\\/(?<subPath>\\(draft\\)\\/[^/]+?\\/[^/]+?)\\.md$');
    expect('content/(draft)/published/my-post.md'.match(regex)?.groups?.subPath).toBe(
      '(draft)/published/my-post',
    );
    // Should not match with different structure
    expect('content/draft/published/my-post.md'.match(regex)).toBeNull();
  });

  test('handles brackets in both basePath and subPath', () => {
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'mdx',
      format: 'frontmatter',
      basePath: 'app/(pages)',
      subPath: '{{slug}}/page',
      _i18n,
    });

    // Both basePath and subPath brackets should be escaped
    expect(regex.source).toBe('^app\\/\\(pages\\)\\/(?<subPath>[^/]+?\\/page)\\.mdx$');
    expect('app/(pages)/my-article/page.mdx'.match(regex)?.groups?.subPath).toBe('my-article/page');
    // Should not match without brackets in basePath
    expect('app/pages/my-article/page.md'.match(regex)).toBeNull();
  });

  test('generates regex with omitDefaultLocaleFromFilePath and multi-folder i18n', () => {
    const _i18n = {
      ...baseI18nOptions,
      omitDefaultLocaleFromFilePath: true,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: true,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      _i18n,
    });

    // Locale folder becomes optional, allowing both 'en/...' and '...' patterns
    expect(regex.source).toBe('^content\\/posts\\/(?:(?<locale>fr)\\/)?(?<subPath>[^/]+?)\\.md$');
    // Default locale (en) - no folder
    expect('content/posts/my-post.md'.match(regex)?.groups?.locale).toBeUndefined();
    expect('content/posts/my-post.md'.match(regex)?.groups?.subPath).toBe('my-post');
    // Non-default locale (fr) - with folder
    expect('content/posts/fr/my-post.md'.match(regex)?.groups?.locale).toBe('fr');
    expect('content/posts/fr/my-post.md'.match(regex)?.groups?.subPath).toBe('my-post');
  });

  test('generates regex with omitDefaultLocaleFromFilePath and root multi-folder i18n', () => {
    const _i18n = {
      ...baseI18nOptions,
      omitDefaultLocaleFromFilePath: true,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: true,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      _i18n,
    });

    // Root locale folder becomes optional, allowing both 'en/...' and '...' patterns
    expect(regex.source).toBe('^(?:(?<locale>fr)\\/)?content\\/posts\\/(?<subPath>[^/]+?)\\.md$');
    // Default locale (en) - no root folder
    expect('content/posts/my-post.md'.match(regex)?.groups?.locale).toBeUndefined();
    expect('content/posts/my-post.md'.match(regex)?.groups?.subPath).toBe('my-post');
    // Non-default locale (fr) - with root folder
    expect('fr/content/posts/my-post.md'.match(regex)?.groups?.locale).toBe('fr');
    expect('fr/content/posts/my-post.md'.match(regex)?.groups?.subPath).toBe('my-post');
  });

  test('generates regex with the locale placeholder in basePath', () => {
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: true,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/{{locale}}/posts',
      subPath: '{{year}}/{{slug}}/index',
      indexFileName: '_index',
      _i18n,
    });

    // The locale folder goes where the placeholder is, not after the base path
    expect(regex.source).toBe(
      '^content\\/(?<locale>en|fr)\\/posts\\/(?<subPath>[^/]+?\\/[^/]+?\\/index|_index)\\.md$',
    );
    expect('content/en/posts/2026/my-post/index.md'.match(regex)?.groups).toEqual({
      locale: 'en',
      subPath: '2026/my-post/index',
    });
    expect('content/fr/posts/_index.md'.match(regex)?.groups).toEqual({
      locale: 'fr',
      subPath: '_index',
    });
    expect(regex.test('content/posts/en/2026/my-post/index.md')).toBe(false);
    expect(regex.test('en/content/posts/2026/my-post/index.md')).toBe(false);
    expect(regex.test('content/en/_index.md')).toBe(false);
  });

  test('generates regex with the locale placeholder at the start or end of basePath', () => {
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: true,
        i18nMultiRootFolder: false,
      },
    };

    expect(
      getEntryPathRegEx({ extension: 'md', format: 'frontmatter', basePath: '{{locale}}', _i18n })
        .source,
    ).toBe('^(?<locale>en|fr)\\/(?<subPath>[^/]+?)\\.md$');

    expect(
      getEntryPathRegEx({
        extension: 'md',
        format: 'frontmatter',
        basePath: 'content/{{locale}}',
        _i18n,
      }).source,
    ).toBe('^content\\/(?<locale>en|fr)\\/(?<subPath>[^/]+?)\\.md$');
  });

  test('ignores the structure when basePath has the locale placeholder', () => {
    const _i18n = {
      ...baseI18nOptions,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: true,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/{{locale}}/posts',
      _i18n,
    });

    expect(regex.source).toBe('^content\\/(?<locale>en|fr)\\/posts\\/(?<subPath>[^/]+?)\\.md$');
  });

  test('generates regex with omitDefaultLocaleFromFilePath and the locale placeholder', () => {
    const _i18n = {
      ...baseI18nOptions,
      omitDefaultLocaleFromFilePath: true,
      structureMap: {
        i18nSingleFile: false,
        i18nSingleFileDefaultRoot: false,
        i18nMultiFile: false,
        i18nMultiFolder: true,
        i18nMultiRootFolder: false,
      },
    };

    const regex = getEntryPathRegEx({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/{{locale}}/posts',
      _i18n,
    });

    // The locale folder becomes optional, allowing both 'content/fr/posts' and 'content/posts'
    expect(regex.source).toBe('^content\\/(?:(?<locale>fr)\\/)?posts\\/(?<subPath>[^/]+?)\\.md$');
    expect('content/posts/my-post.md'.match(regex)?.groups?.locale).toBeUndefined();
    expect('content/posts/my-post.md'.match(regex)?.groups?.subPath).toBe('my-post');
    expect('content/fr/posts/my-post.md'.match(regex)?.groups?.locale).toBe('fr');
    expect(regex.test('content/en/posts/my-post.md')).toBe(false);
  });

  describe('with an index file extension of its own', () => {
    const structureMap = {
      i18nSingleFile: false,
      i18nSingleFileDefaultRoot: false,
      i18nMultiFile: false,
      i18nMultiFolder: false,
      i18nMultiRootFolder: false,
    };

    test('ignores the index file extension if it’s the same as the entries’', () => {
      const _i18n = { ...baseI18nOptions, structureMap };

      expect(
        getEntryPathRegEx({
          extension: 'md',
          format: 'frontmatter',
          basePath: 'posts',
          indexFileName: '_index',
          indexFileExtension: 'md',
          _i18n,
        }).source,
      ).toBe('^posts\\/(?<subPath>[^/]+?)\\.md$');
    });

    test('matches the index file by its own extension, right under the folder', () => {
      const _i18n = { ...baseI18nOptions, structureMap };

      const regex = getEntryPathRegEx({
        extension: 'md',
        format: 'frontmatter',
        basePath: 'posts',
        indexFileName: 'posts',
        indexFileExtension: 'json',
        _i18n,
      });

      expect(regex.source).toBe(
        '^posts\\/(?<subPath>(?!posts(?=\\.md$))(?:[^/]+?)(?=\\.md$)|posts(?=\\.json$))\\.(?:md|json)$',
      );
      expect('posts/hello.md'.match(regex)?.groups?.subPath).toBe('hello');
      expect('posts/posts.json'.match(regex)?.groups?.subPath).toBe('posts');
      // An unrelated file with either extension is out
      expect(regex.test('posts/hello.json')).toBe(false);
      expect(regex.test('posts/sub/posts.json')).toBe(false);
      // So is an entry going by the index file’s name, which is reserved, but not one that merely
      // starts with it
      expect(regex.test('posts/posts.md')).toBe(false);
      expect(regex.test('posts/posts-2.md')).toBe(true);
    });

    test('escapes the index file name', () => {
      const _i18n = { ...baseI18nOptions, structureMap };

      const regex = getEntryPathRegEx({
        extension: 'md',
        format: 'frontmatter',
        basePath: 'posts',
        subPath: '{{slug}}',
        indexFileName: 'posts.data',
        indexFileExtension: 'json',
        _i18n,
      });

      expect(regex.test('posts/posts.data.json')).toBe(true);
      expect(regex.test('posts/postsXdata.json')).toBe(false);
    });

    test('works with the path option and a nested collection', () => {
      const _i18n = { ...baseI18nOptions, structureMap };

      const regex = getEntryPathRegEx({
        extension: 'md',
        format: 'frontmatter',
        basePath: 'posts',
        subPath: '{{slug}}/index',
        indexFileName: 'posts',
        indexFileExtension: 'json',
        _i18n,
      });

      expect(regex.source).toBe(
        '^posts\\/(?<subPath>(?!posts(?=\\.md$))(?:[^/]+?\\/index)(?=\\.md$)|posts(?=\\.json$))\\.(?:md|json)$',
      );
      expect('posts/hello/index.md'.match(regex)?.groups?.subPath).toBe('hello/index');
      expect('posts/posts.json'.match(regex)?.groups?.subPath).toBe('posts');
      expect(regex.test('posts/hello/index.json')).toBe(false);

      const nestedRegex = getEntryPathRegEx({
        extension: 'md',
        format: 'frontmatter',
        basePath: 'posts',
        indexFileName: 'posts',
        indexFileExtension: 'json',
        nestedDepth: 3,
        _i18n,
      });

      expect('posts/a/b/c.md'.match(nestedRegex)?.groups?.subPath).toBe('a/b/c');
      expect('posts/posts.json'.match(nestedRegex)?.groups?.subPath).toBe('posts');
      // Only the collection’s own index file has the other extension
      expect(nestedRegex.test('posts/a/posts.json')).toBe(false);
      // The reserved name only applies right under the collection folder
      expect(nestedRegex.test('posts/posts.md')).toBe(false);
      expect(nestedRegex.test('posts/a/posts.md')).toBe(true);
      expect(nestedRegex.test('posts/posts/a.md')).toBe(true);
    });

    test('works with a locale in the file name', () => {
      const _i18n = {
        ...baseI18nOptions,
        structureMap: { ...structureMap, i18nMultiFile: true },
      };

      const regex = getEntryPathRegEx({
        extension: 'md',
        format: 'frontmatter',
        basePath: 'posts',
        indexFileName: 'posts',
        indexFileExtension: 'json',
        _i18n,
      });

      expect(regex.source).toBe(
        '^posts\\/(?<subPath>(?!posts(?=\\.(?:en|fr)\\.md$))(?:[^/]+?)(?=\\.(?:en|fr)\\.md$)' +
          '|posts(?=\\.(?:en|fr)\\.json$))' +
          '\\.(?<locale>en|fr)\\.(?:md|json)$',
      );
      expect('posts/hello.fr.md'.match(regex)?.groups).toEqual({ subPath: 'hello', locale: 'fr' });
      expect('posts/posts.en.json'.match(regex)?.groups).toEqual({
        subPath: 'posts',
        locale: 'en',
      });
      expect(regex.test('posts/hello.fr.json')).toBe(false);
      expect(regex.test('posts/posts.json')).toBe(false);
      expect(regex.test('posts/posts.en.md')).toBe(false);

      const omitRegex = getEntryPathRegEx({
        extension: 'md',
        format: 'frontmatter',
        basePath: 'posts',
        indexFileName: 'posts',
        indexFileExtension: 'json',
        _i18n: { ..._i18n, omitDefaultLocaleFromFilePath: true },
      });

      expect('posts/posts.json'.match(omitRegex)?.groups?.subPath).toBe('posts');
      expect('posts/posts.fr.json'.match(omitRegex)?.groups?.locale).toBe('fr');
      expect(omitRegex.test('posts/posts.en.json')).toBe(false);
    });
  });
});

describe('Test getFrontMatterDelimiters()', () => {
  test('returns custom string delimiter as pair', () => {
    expect(getFrontMatterDelimiters({ format: 'frontmatter', delimiter: '###' })).toEqual([
      '###',
      '###',
    ]);
  });

  test('returns custom array delimiter', () => {
    expect(getFrontMatterDelimiters({ format: 'frontmatter', delimiter: ['<<<', '>>>'] })).toEqual([
      '<<<',
      '>>>',
    ]);
  });

  test('returns JSON delimiters for json-frontmatter', () => {
    expect(getFrontMatterDelimiters({ format: 'json-frontmatter' })).toEqual(['{', '}']);
  });

  test('returns TOML delimiters for toml-frontmatter', () => {
    expect(getFrontMatterDelimiters({ format: 'toml-frontmatter' })).toEqual(['+++', '+++']);
  });

  test('returns YAML delimiters for yaml-frontmatter', () => {
    expect(getFrontMatterDelimiters({ format: 'yaml-frontmatter' })).toEqual(['---', '---']);
  });

  test('returns undefined for unknown format', () => {
    expect(getFrontMatterDelimiters({ format: /** @type {any} */ ('unknown') })).toBeUndefined();
  });

  test('handles empty string delimiter', () => {
    expect(getFrontMatterDelimiters({ format: 'frontmatter', delimiter: '' })).toBeUndefined();
  });

  test('handles whitespace-only delimiter', () => {
    expect(getFrontMatterDelimiters({ format: 'frontmatter', delimiter: '   ' })).toBeUndefined();
  });

  test('handles array with wrong length', () => {
    expect(
      getFrontMatterDelimiters({ format: 'frontmatter', delimiter: ['only-one'] }),
    ).toBeUndefined();
    expect(
      getFrontMatterDelimiters({ format: 'frontmatter', delimiter: ['one', 'two', 'three'] }),
    ).toBeUndefined();
  });
});

describe('Test getFileConfig()', () => {
  const rawFolderCollection = {
    name: 'posts',
    folder: '/content/posts',
    fields: [],
  };

  const rawFileCollection = {
    name: 'data',
    files: [],
  };

  const rawFileCollectionFrontMatterFile = {
    name: 'members',
    file: 'data/members.md',
    fields: [],
  };

  const rawFileCollectionYamlFile = {
    name: 'members',
    file: 'data/members.yml',
    fields: [],
  };

  const rawFileCollectionJsonFile = {
    name: 'members',
    file: 'data/members.json',
    fields: [],
  };

  /** @type {InternalI18nOptions} */
  const i18nDisabled = {
    i18nEnabled: false,
    allLocales: ['_default'],
    initialLocales: ['_default'],
    defaultLocale: '_default',
    structure: 'single_file',
    structureMap: {
      i18nSingleFile: false,
      i18nSingleFileDefaultRoot: false,
      i18nMultiFile: false,
      i18nMultiFolder: false,
      i18nMultiRootFolder: false,
    },
    canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
    omitDefaultLocaleFromFilePath: false,
    omitDefaultLocaleFromPreviewPath: false,
  };

  /** @type {InternalI18nOptions} */
  const i18nSingleFile = {
    i18nEnabled: false,
    allLocales: ['en', 'fr'],
    initialLocales: ['en', 'fr'],
    defaultLocale: 'en',
    structure: 'single_file',
    structureMap: {
      i18nSingleFile: true,
      i18nSingleFileDefaultRoot: false,
      i18nMultiFile: false,
      i18nMultiFolder: false,
      i18nMultiRootFolder: false,
    },
    canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
    omitDefaultLocaleFromFilePath: false,
    omitDefaultLocaleFromPreviewPath: false,
  };

  /** @type {InternalI18nOptions} */
  const i18nMultiFile = {
    i18nEnabled: true,
    allLocales: ['en', 'fr'],
    initialLocales: ['en', 'fr'],
    defaultLocale: 'en',
    structure: 'multiple_files',
    structureMap: {
      i18nSingleFile: false,
      i18nSingleFileDefaultRoot: false,
      i18nMultiFile: true,
      i18nMultiFolder: false,
      i18nMultiRootFolder: false,
    },
    canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
    omitDefaultLocaleFromFilePath: false,
    omitDefaultLocaleFromPreviewPath: false,
  };

  /** @type {InternalI18nOptions} */
  const i18nMultiFolder = {
    i18nEnabled: true,
    allLocales: ['en', 'fr'],
    initialLocales: ['en', 'fr'],
    defaultLocale: 'en',
    structure: 'multiple_folders',
    structureMap: {
      i18nSingleFile: false,
      i18nSingleFileDefaultRoot: false,
      i18nMultiFile: false,
      i18nMultiFolder: true,
      i18nMultiRootFolder: false,
    },
    canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
    omitDefaultLocaleFromFilePath: false,
    omitDefaultLocaleFromPreviewPath: false,
  };

  /** @type {InternalI18nOptions} */
  const i18nMultiRootFolder = {
    i18nEnabled: true,
    allLocales: ['en', 'fr'],
    initialLocales: ['en', 'fr'],
    defaultLocale: 'en',
    structure: 'multiple_folders_i18n_root',
    structureMap: {
      i18nSingleFile: false,
      i18nSingleFileDefaultRoot: false,
      i18nMultiFile: false,
      i18nMultiFolder: false,
      i18nMultiRootFolder: true,
    },
    canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
    omitDefaultLocaleFromFilePath: false,
    omitDefaultLocaleFromPreviewPath: false,
  };

  test('entry collection without i18n', () => {
    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
        },
        _i18n: i18nDisabled,
      }),
    ).toEqual({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      subPath: undefined,
      fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?)\.md$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          path: '{{slug}}/index',
        },
        _i18n: i18nDisabled,
      }),
    ).toEqual({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      subPath: '{{slug}}/index',
      fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?\/index)\.md$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          path: '{{slug}}/index',
          format: 'yaml-frontmatter',
        },
        _i18n: i18nDisabled,
      }),
    ).toEqual({
      extension: 'md',
      format: 'yaml-frontmatter',
      basePath: 'content/posts',
      subPath: '{{slug}}/index',
      fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?\/index)\.md$/,
      fullPath: undefined,
      fmDelimiters: ['---', '---'],
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          extension: 'yml',
          yaml_quote: true,
        },
        _i18n: i18nDisabled,
      }),
    ).toEqual({
      extension: 'yml',
      format: 'yaml',
      basePath: 'content/posts',
      subPath: undefined,
      fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?)\.yml$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: true,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          extension: 'json',
        },
        _i18n: i18nDisabled,
      }),
    ).toEqual({
      extension: 'json',
      format: 'json',
      basePath: 'content/posts',
      subPath: undefined,
      fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?)\.json$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: false,
    });
  });

  test('entry collection with single-file i18n', () => {
    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
        },
        _i18n: i18nSingleFile,
      }),
    ).toEqual({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      subPath: undefined,
      fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?)\.md$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          path: '{{slug}}/index',
        },
        _i18n: i18nSingleFile,
      }),
    ).toEqual({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      subPath: '{{slug}}/index',
      fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?\/index)\.md$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          path: '{{slug}}/index',
          format: 'yaml-frontmatter',
        },
        _i18n: i18nSingleFile,
      }),
    ).toEqual({
      extension: 'md',
      format: 'yaml-frontmatter',
      basePath: 'content/posts',
      subPath: '{{slug}}/index',
      fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?\/index)\.md$/,
      fullPath: undefined,
      fmDelimiters: ['---', '---'],
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          extension: 'yml',
          yaml_quote: true,
        },
        _i18n: i18nSingleFile,
      }),
    ).toEqual({
      extension: 'yml',
      format: 'yaml',
      basePath: 'content/posts',
      subPath: undefined,
      fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?)\.yml$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: true,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          extension: 'json',
        },
        _i18n: i18nSingleFile,
      }),
    ).toEqual({
      extension: 'json',
      format: 'json',
      basePath: 'content/posts',
      subPath: undefined,
      fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?)\.json$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: false,
    });
  });

  test('entry collection with multi-file i18n', () => {
    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
        },
        _i18n: i18nMultiFile,
      }),
    ).toEqual({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      subPath: undefined,
      fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?)\.(?<locale>en|fr)\.md$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          path: '{{slug}}/index',
        },
        _i18n: i18nMultiFile,
      }),
    ).toEqual({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      subPath: '{{slug}}/index',
      fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?\/index)\.(?<locale>en|fr)\.md$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          path: '{{slug}}/index',
          format: 'yaml-frontmatter',
        },
        _i18n: i18nMultiFile,
      }),
    ).toEqual({
      extension: 'md',
      format: 'yaml-frontmatter',
      basePath: 'content/posts',
      subPath: '{{slug}}/index',
      fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?\/index)\.(?<locale>en|fr)\.md$/,
      fullPath: undefined,
      fmDelimiters: ['---', '---'],
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          extension: 'yml',
          yaml_quote: true,
        },
        _i18n: i18nMultiFile,
      }),
    ).toEqual({
      extension: 'yml',
      format: 'yaml',
      basePath: 'content/posts',
      subPath: undefined,
      fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?)\.(?<locale>en|fr)\.yml$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: true,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          extension: 'json',
        },
        _i18n: i18nMultiFile,
      }),
    ).toEqual({
      extension: 'json',
      format: 'json',
      basePath: 'content/posts',
      subPath: undefined,
      fullPathRegEx: /^content\/posts\/(?<subPath>[^/]+?)\.(?<locale>en|fr)\.json$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: false,
    });
  });

  test('entry collection with multi-folder i18n', () => {
    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
        },
        _i18n: i18nMultiFolder,
      }),
    ).toEqual({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      subPath: undefined,
      fullPathRegEx: /^content\/posts\/(?<locale>en|fr)\/(?<subPath>[^/]+?)\.md$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          path: '{{slug}}/index',
        },
        _i18n: i18nMultiFolder,
      }),
    ).toEqual({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      subPath: '{{slug}}/index',
      fullPathRegEx: /^content\/posts\/(?<locale>en|fr)\/(?<subPath>[^/]+?\/index)\.md$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          path: '{{slug}}/index',
          format: 'yaml-frontmatter',
        },
        _i18n: i18nMultiFolder,
      }),
    ).toEqual({
      extension: 'md',
      format: 'yaml-frontmatter',
      basePath: 'content/posts',
      subPath: '{{slug}}/index',
      fullPathRegEx: /^content\/posts\/(?<locale>en|fr)\/(?<subPath>[^/]+?\/index)\.md$/,
      fullPath: undefined,
      fmDelimiters: ['---', '---'],
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          extension: 'yml',
          yaml_quote: true,
        },
        _i18n: i18nMultiFolder,
      }),
    ).toEqual({
      extension: 'yml',
      format: 'yaml',
      basePath: 'content/posts',
      subPath: undefined,
      fullPathRegEx: /^content\/posts\/(?<locale>en|fr)\/(?<subPath>[^/]+?)\.yml$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: true,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          extension: 'json',
        },
        _i18n: i18nMultiFolder,
      }),
    ).toEqual({
      extension: 'json',
      format: 'json',
      basePath: 'content/posts',
      subPath: undefined,
      fullPathRegEx: /^content\/posts\/(?<locale>en|fr)\/(?<subPath>[^/]+?)\.json$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: false,
    });
  });

  test('entry collection with multi-folder-at-root i18n', () => {
    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
        },
        _i18n: i18nMultiRootFolder,
      }),
    ).toEqual({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      subPath: undefined,
      fullPathRegEx: /^(?<locale>en|fr)\/content\/posts\/(?<subPath>[^/]+?)\.md$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          path: '{{slug}}/index',
        },
        _i18n: i18nMultiRootFolder,
      }),
    ).toEqual({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      subPath: '{{slug}}/index',
      fullPathRegEx: /^(?<locale>en|fr)\/content\/posts\/(?<subPath>[^/]+?\/index)\.md$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          path: '{{slug}}/index',
          format: 'yaml-frontmatter',
        },
        _i18n: i18nMultiRootFolder,
      }),
    ).toEqual({
      extension: 'md',
      format: 'yaml-frontmatter',
      basePath: 'content/posts',
      subPath: '{{slug}}/index',
      fullPathRegEx: /^(?<locale>en|fr)\/content\/posts\/(?<subPath>[^/]+?\/index)\.md$/,
      fullPath: undefined,
      fmDelimiters: ['---', '---'],
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          extension: 'yml',
          yaml_quote: true,
        },
        _i18n: i18nMultiRootFolder,
      }),
    ).toEqual({
      extension: 'yml',
      format: 'yaml',
      basePath: 'content/posts',
      subPath: undefined,
      fullPathRegEx: /^(?<locale>en|fr)\/content\/posts\/(?<subPath>[^/]+?)\.yml$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: true,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFolderCollection,
          extension: 'json',
        },
        _i18n: i18nMultiRootFolder,
      }),
    ).toEqual({
      extension: 'json',
      format: 'json',
      basePath: 'content/posts',
      subPath: undefined,
      fullPathRegEx: /^(?<locale>en|fr)\/content\/posts\/(?<subPath>[^/]+?)\.json$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      yamlQuote: false,
    });
  });

  test('file collection without i18n', () => {
    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
        },
        file: {
          ...rawFileCollectionFrontMatterFile,
        },
        _i18n: i18nDisabled,
      }),
    ).toEqual({
      extension: 'md',
      format: 'frontmatter',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/members.md',
      fmDelimiters: undefined,
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
          format: 'yaml-frontmatter',
        },
        file: {
          ...rawFileCollectionYamlFile,
        },
        _i18n: i18nDisabled,
      }),
    ).toEqual({
      extension: 'yml',
      format: 'yaml-frontmatter',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/members.yml',
      fmDelimiters: ['---', '---'],
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
          extension: 'yml',
          yaml_quote: true,
        },
        file: {
          ...rawFileCollectionYamlFile,
        },
        _i18n: i18nDisabled,
      }),
    ).toEqual({
      extension: 'yml',
      format: 'yaml',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/members.yml',
      fmDelimiters: undefined,
      yamlQuote: true,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
          extension: 'json',
        },
        file: {
          ...rawFileCollectionJsonFile,
        },
        _i18n: i18nDisabled,
      }),
    ).toEqual({
      extension: 'json',
      format: 'json',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/members.json',
      fmDelimiters: undefined,
      yamlQuote: false,
    });
  });

  test('file collection with single-file i18n', () => {
    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
        },
        file: {
          ...rawFileCollectionFrontMatterFile,
        },
        _i18n: i18nSingleFile,
      }),
    ).toEqual({
      extension: 'md',
      format: 'frontmatter',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/members.md',
      fmDelimiters: undefined,
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
          format: 'yaml-frontmatter',
        },
        file: {
          ...rawFileCollectionYamlFile,
        },
        _i18n: i18nSingleFile,
      }),
    ).toEqual({
      extension: 'yml',
      format: 'yaml-frontmatter',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/members.yml',
      fmDelimiters: ['---', '---'],
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
          extension: 'yml',
          yaml_quote: true,
        },
        file: {
          ...rawFileCollectionYamlFile,
        },
        _i18n: i18nSingleFile,
      }),
    ).toEqual({
      extension: 'yml',
      format: 'yaml',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/members.yml',
      fmDelimiters: undefined,
      yamlQuote: true,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
          extension: 'json',
        },
        file: {
          ...rawFileCollectionJsonFile,
        },
        _i18n: i18nSingleFile,
      }),
    ).toEqual({
      extension: 'json',
      format: 'json',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/members.json',
      fmDelimiters: undefined,
      yamlQuote: false,
    });
  });

  test('file collection with multi-file i18n', () => {
    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
        },
        file: {
          ...rawFileCollectionFrontMatterFile,
          file: 'data/members.{{locale}}.md',
        },
        _i18n: i18nMultiFile,
      }),
    ).toEqual({
      extension: 'md',
      format: 'frontmatter',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/members.en.md',
      fmDelimiters: undefined,
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
          format: 'yaml-frontmatter',
        },
        file: {
          ...rawFileCollectionYamlFile,
          file: 'data/members.{{locale}}.yml',
        },
        _i18n: i18nMultiFile,
      }),
    ).toEqual({
      extension: 'yml',
      format: 'yaml-frontmatter',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/members.en.yml',
      fmDelimiters: ['---', '---'],
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
          extension: 'yml',
          yaml_quote: true,
        },
        file: {
          ...rawFileCollectionYamlFile,
          file: 'data/members.{{locale}}.yml',
        },
        _i18n: i18nMultiFile,
      }),
    ).toEqual({
      extension: 'yml',
      format: 'yaml',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/members.en.yml',
      fmDelimiters: undefined,
      yamlQuote: true,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
          extension: 'json',
        },
        file: {
          ...rawFileCollectionJsonFile,
          file: 'data/members.{{locale}}.json',
        },
        _i18n: i18nMultiFile,
      }),
    ).toEqual({
      extension: 'json',
      format: 'json',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/members.en.json',
      fmDelimiters: undefined,
      yamlQuote: false,
    });
  });

  test('file collection with multi-folder i18n', () => {
    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
        },
        file: {
          ...rawFileCollectionFrontMatterFile,
          file: 'data/{{locale}}/members.md',
        },
        _i18n: i18nMultiFile,
      }),
    ).toEqual({
      extension: 'md',
      format: 'frontmatter',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/en/members.md',
      fmDelimiters: undefined,
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
          format: 'yaml-frontmatter',
        },
        file: {
          ...rawFileCollectionYamlFile,
          file: 'data/{{locale}}/members.yml',
        },
        _i18n: i18nMultiFile,
      }),
    ).toEqual({
      extension: 'yml',
      format: 'yaml-frontmatter',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/en/members.yml',
      fmDelimiters: ['---', '---'],
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
          extension: 'yml',
          yaml_quote: true,
        },
        file: {
          ...rawFileCollectionYamlFile,
          file: 'data/{{locale}}/members.yml',
        },
        _i18n: i18nMultiFile,
      }),
    ).toEqual({
      extension: 'yml',
      format: 'yaml',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/en/members.yml',
      fmDelimiters: undefined,
      yamlQuote: true,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
          extension: 'json',
        },
        file: {
          ...rawFileCollectionJsonFile,
          file: 'data/{{locale}}/members.json',
        },
        _i18n: i18nMultiFile,
      }),
    ).toEqual({
      extension: 'json',
      format: 'json',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/en/members.json',
      fmDelimiters: undefined,
      yamlQuote: false,
    });
  });

  test('file collection with format override', () => {
    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
        },
        file: {
          ...rawFileCollectionFrontMatterFile,
          format: 'yaml-frontmatter',
        },
        _i18n: i18nDisabled,
      }),
    ).toEqual({
      extension: 'md',
      format: 'yaml-frontmatter',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/members.md',
      fmDelimiters: ['---', '---'],
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
          format: 'yaml-frontmatter',
        },
        file: {
          ...rawFileCollectionFrontMatterFile,
          format: 'toml-frontmatter',
        },
        _i18n: i18nDisabled,
      }),
    ).toEqual({
      extension: 'md',
      format: 'toml-frontmatter',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/members.md',
      fmDelimiters: ['+++', '+++'],
      yamlQuote: false,
    });

    expect(
      getFileConfig({
        rawCollection: {
          ...rawFileCollection,
          format: 'yaml-frontmatter',
        },
        file: {
          ...rawFileCollectionJsonFile,
          format: 'json',
        },
        _i18n: i18nDisabled,
      }),
    ).toEqual({
      extension: 'json',
      format: 'json',
      basePath: undefined,
      subPath: undefined,
      fullPathRegEx: undefined,
      fullPath: 'data/members.json',
      fmDelimiters: undefined,
      yamlQuote: false,
    });
  });

  test('warns about deprecated yaml_quote option (line 207)', async () => {
    const { warnDeprecation } = await import('$lib/services/config/deprecations');
    const mockWarn = vi.mocked(warnDeprecation);

    mockWarn.mockClear();

    // Call getFileConfig with yaml_quote defined (should trigger deprecation warning)
    getFileConfig({
      rawCollection: {
        ...rawFolderCollection,
        yaml_quote: true,
      },
      _i18n: i18nDisabled,
    });

    // Verify warnDeprecation was called with 'yaml_quote'
    expect(mockWarn).toHaveBeenCalledWith('yaml_quote');
  });

  test('does not warn when yaml_quote is undefined', async () => {
    const { warnDeprecation } = await import('$lib/services/config/deprecations');
    const mockWarn = vi.mocked(warnDeprecation);

    mockWarn.mockClear();

    // Call getFileConfig without yaml_quote (should not trigger warning)
    getFileConfig({
      rawCollection: {
        ...rawFolderCollection,
        // yaml_quote is undefined
      },
      _i18n: i18nDisabled,
    });

    // Verify warnDeprecation was not called
    expect(mockWarn).not.toHaveBeenCalled();
  });

  test('handles index_file name property (line 207)', () => {
    // Test with index_file that has a name property
    const result = getFileConfig({
      rawCollection: {
        ...rawFolderCollection,
        path: '{{slug}}',
        index_file: {
          name: '_index',
          label: 'Index',
        },
      },
      _i18n: i18nDisabled,
    });

    // When index_file is defined, indexFileName should be added to the regex as an alternative
    // The regex should contain the pattern: (?<subPath>{{slug}}|_index)
    expect(result.fullPathRegEx?.toString()).toContain('_index');
  });

  test('gives the index file a configuration of its own with its own extension', () => {
    const result = getFileConfig({
      rawCollection: {
        ...rawFolderCollection,
        index_file: { name: 'posts', extension: 'json' },
      },
      _i18n: i18nDisabled,
    });

    const { indexFile, ...entryConfig } = result;

    expect(entryConfig).toEqual({
      extension: 'md',
      format: 'frontmatter',
      basePath: 'content/posts',
      subPath: undefined,
      fullPathRegEx:
        /^content\/posts\/(?<subPath>(?!posts(?=\.md$))(?:[^/]+?)(?=\.md$)|posts(?=\.json$))\.(?:md|json)$/,
      fullPath: undefined,
      fmDelimiters: undefined,
      bodyField: undefined,
      yamlQuote: false,
    });

    // The index file shares the path matcher and the rest, but not the extension and format
    expect(indexFile).toEqual({ ...entryConfig, extension: 'json', format: 'json' });
    expect(indexFile?.fullPathRegEx).toBe(entryConfig.fullPathRegEx);
  });

  test('gives the index file a configuration of its own with its own format', () => {
    const result = getFileConfig({
      rawCollection: {
        ...rawFolderCollection,
        index_file: { format: 'yaml' },
      },
      _i18n: i18nDisabled,
    });

    expect(result.fullPathRegEx?.source).toBe(
      '^content\\/posts\\/(?<subPath>(?!_index(?=\\.md$))(?:[^/]+?)(?=\\.md$)|_index(?=\\.yml$))\\.(?:md|yml)$',
    );
    expect(result.indexFile?.extension).toBe('yml');
    expect(result.indexFile?.format).toBe('yaml');

    // The front matter delimiters follow the index file’s format
    const tomlResult = getFileConfig({
      rawCollection: {
        ...rawFolderCollection,
        index_file: { format: 'toml-frontmatter' },
      },
      _i18n: i18nDisabled,
    });

    expect(tomlResult.fmDelimiters).toBeUndefined();
    expect(tomlResult.indexFile?.extension).toBe('md');
    expect(tomlResult.indexFile?.fmDelimiters).toEqual(['+++', '+++']);
  });

  test('leaves the index file configuration off when it matches the entries’', () => {
    expect(
      getFileConfig({
        rawCollection: { ...rawFolderCollection, index_file: { extension: 'md' } },
        _i18n: i18nDisabled,
      }).indexFile,
    ).toBeUndefined();

    expect(
      getFileConfig({
        rawCollection: { ...rawFolderCollection, index_file: true },
        _i18n: i18nDisabled,
      }).indexFile,
    ).toBeUndefined();
  });

  test('entry collection with empty folder (root)', () => {
    const result = getFileConfig({
      rawCollection: {
        name: 'root-posts',
        folder: '',
        fields: [],
      },
      _i18n: i18nDisabled,
    });

    // Should generate regex that matches files at root
    expect(result.basePath).toBe('');
    expect(result.fullPathRegEx).toBeDefined();
    // The regex pattern for empty basePath should be: ^(?<subPath>[^/]+?)\.md$
    expect(result.fullPathRegEx?.source).toBe('^(?<subPath>[^/]+?)\\.md$');
    // The regex should match root-level files
    expect(result.fullPathRegEx?.test('my-post.md')).toBe(true);
    expect(result.fullPathRegEx?.test('index.md')).toBe(true);
  });

  test('body_field option from collection', () => {
    const result = getFileConfig({
      rawCollection: {
        ...rawFolderCollection,
        body_field: { key: 'content', inline: true },
      },
      _i18n: i18nDisabled,
    });

    expect(result.bodyField).toEqual({ key: 'content', inline: true });
  });

  test('body_field option from collection file', () => {
    const result = getFileConfig({
      rawCollection: {
        ...rawFileCollection,
      },
      file: {
        ...rawFileCollectionFrontMatterFile,
        body_field: { key: 'description', inline: false },
      },
      _i18n: i18nDisabled,
    });

    expect(result.bodyField).toEqual({ key: 'description', inline: false });
  });

  test('body_field from file overrides collection', () => {
    const result = getFileConfig({
      rawCollection: {
        ...rawFileCollection,
        body_field: { key: 'content', inline: true },
      },
      file: {
        ...rawFileCollectionFrontMatterFile,
        body_field: { key: 'text', inline: false },
      },
      _i18n: i18nDisabled,
    });

    expect(result.bodyField).toEqual({ key: 'text', inline: false });
  });

  test('body_field undefined when not specified', () => {
    const result = getFileConfig({
      rawCollection: {
        ...rawFolderCollection,
      },
      _i18n: i18nDisabled,
    });

    expect(result.bodyField).toBeUndefined();
  });
});

describe('Test getIndexFileFormat()', () => {
  test('returns undefined without an index file or an extension or format of its own', () => {
    expect(getIndexFileFormat({ indexFile: undefined, extension: 'md' })).toBeUndefined();
    expect(getIndexFileFormat({ indexFile: { name: '_index' }, extension: 'md' })).toBeUndefined();
  });

  test('returns undefined when the index file matches the entries', () => {
    expect(
      getIndexFileFormat({ indexFile: { name: '_index', extension: 'md' }, extension: 'md' }),
    ).toBeUndefined();
    expect(
      getIndexFileFormat({ indexFile: { name: '_index', format: 'frontmatter' } }),
    ).toBeUndefined();
    expect(
      getIndexFileFormat({ indexFile: { name: 'data', format: 'yaml' }, extension: 'yml' }),
    ).toBeUndefined();
  });

  test('detects the format from the extension and vice versa', () => {
    expect(getIndexFileFormat({ indexFile: { name: 'posts', extension: 'json' } })).toEqual({
      extension: 'json',
      format: 'json',
    });
    expect(getIndexFileFormat({ indexFile: { name: 'posts', format: 'toml' } })).toEqual({
      extension: 'toml',
      format: 'toml',
    });
    expect(
      getIndexFileFormat({
        indexFile: { name: 'posts', extension: 'yaml', format: 'yaml' },
        extension: 'md',
        format: 'frontmatter',
      }),
    ).toEqual({ extension: 'yaml', format: 'yaml' });
  });

  test('returns a different format for the same extension', () => {
    expect(
      getIndexFileFormat({
        indexFile: { name: '_index', format: 'toml-frontmatter' },
        extension: 'md',
      }),
    ).toEqual({ extension: 'md', format: 'toml-frontmatter' });
  });
});

describe('Test resolveFileConfig()', () => {
  /** @type {any} */
  const indexFileConfig = { extension: 'json', format: 'json' };

  /** @type {any} */
  const collection = {
    _file: { extension: 'md', format: 'frontmatter', indexFile: indexFileConfig },
  };

  /** @type {any} */
  const plainCollection = { _file: { extension: 'md', format: 'frontmatter' } };
  /** @type {any} */
  const collectionFile = { _file: { extension: 'yml', format: 'yaml' } };

  test('returns the collection file’s configuration', () => {
    expect(resolveFileConfig({ collection, collectionFile })).toBe(collectionFile._file);
    expect(resolveFileConfig({ collection, collectionFile, isIndexFile: true })).toBe(
      collectionFile._file,
    );
  });

  test('returns the index file’s configuration for the index file', () => {
    expect(resolveFileConfig({ collection, isIndexFile: true })).toBe(indexFileConfig);
    expect(resolveFileConfig({ collection })).toBe(collection._file);
    expect(resolveFileConfig({ collection, isIndexFile: false })).toBe(collection._file);
  });

  test('falls back to the collection’s configuration', () => {
    expect(resolveFileConfig({ collection: plainCollection, isIndexFile: true })).toBe(
      plainCollection._file,
    );
  });
});
