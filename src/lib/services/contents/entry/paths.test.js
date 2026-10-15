import { describe, expect, it } from 'vitest';

import {
  getEntryDirName,
  getEntryFolderPath,
  getEntryLocaleFile,
  getEntryPaths,
} from '$lib/services/contents/entry/paths';
import { getEntryPathRegEx } from '$lib/services/contents/file/config';

/**
 * @import { Entry, InternalI18nOptions, UnpublishedEntry } from '$lib/types/private';
 * @import { I18nFileStructure } from '$lib/types/public';
 */

describe('getEntryPaths()', () => {
  const entry = /** @type {UnpublishedEntry} */ (
    /** @type {unknown} */ ({
      locales: {
        en: { path: 'posts/new.en.md' },
        fr: { path: 'posts/new.fr.md' },
      },
      workflow: { previousPaths: ['posts/old.en.md', 'posts/new.fr.md'] },
    })
  );

  it('lists the current paths only by default', () => {
    expect(getEntryPaths(entry)).toEqual(['posts/new.en.md', 'posts/new.fr.md']);
  });

  it('includes the previous paths without duplicates when asked', () => {
    expect(getEntryPaths(entry, { includePrevious: true })).toEqual([
      'posts/new.en.md',
      'posts/new.fr.md',
      'posts/old.en.md',
    ]);
  });

  it('deduplicates the path shared by every locale of a single-file entry', () => {
    const singleFile = /** @type {Entry} */ (
      /** @type {unknown} */ ({
        locales: { en: { path: 'posts/a.md' }, fr: { path: 'posts/a.md' } },
      })
    );

    expect(getEntryPaths(singleFile)).toEqual(['posts/a.md']);
  });

  it('handles an entry without workflow details or previous paths', () => {
    const published = /** @type {Entry} */ (
      /** @type {unknown} */ ({ locales: { en: { path: 'posts/a.md' } } })
    );

    const noPrevious = /** @type {UnpublishedEntry} */ (
      /** @type {unknown} */ ({ locales: { en: { path: 'posts/a.md' } }, workflow: {} })
    );

    expect(getEntryPaths(published, { includePrevious: true })).toEqual(['posts/a.md']);
    expect(getEntryPaths(noPrevious, { includePrevious: true })).toEqual(['posts/a.md']);
  });
});

describe('getEntryLocaleFile()', () => {
  const en = { slug: 'hello', path: 'posts/en/hello.md', content: { title: 'Hello' } };
  const fr = { slug: 'bonjour', path: 'posts/fr/hello.md', content: { title: 'Bonjour' } };
  const de = { slug: 'hallo', path: 'posts/de/hello.md', content: { title: 'Hallo' } };
  const entry = /** @type {Entry} */ (/** @type {unknown} */ ({ locales: { de, en, fr } }));

  it('returns the given locale’s file', () => {
    expect(getEntryLocaleFile(entry, { locale: 'fr', defaultLocale: 'en' })).toBe(fr);
  });

  it('falls back to the default locale’s file', () => {
    expect(getEntryLocaleFile(entry, { locale: 'ja', defaultLocale: 'en' })).toBe(en);
    expect(getEntryLocaleFile(entry, { defaultLocale: 'en' })).toBe(en);
  });

  it('falls back to the first file', () => {
    expect(getEntryLocaleFile(entry, { locale: 'ja', defaultLocale: 'ko' })).toBe(de);
    expect(getEntryLocaleFile(entry, { locale: 'ja' })).toBe(de);
    expect(getEntryLocaleFile(entry)).toBe(de);
  });

  it('returns `undefined` for an entry without files', () => {
    const empty = /** @type {Entry} */ (/** @type {unknown} */ ({ locales: {} }));

    expect(getEntryLocaleFile(empty, { defaultLocale: 'en' })).toBeUndefined();
  });
});

describe('getEntryFolderPath()', () => {
  it('returns the folder of the first locale’s file', () => {
    const entry = /** @type {Entry} */ (
      /** @type {unknown} */ ({
        locales: { en: { path: 'posts/new.en.md' }, fr: { path: 'posts/fr/new.md' } },
      })
    );

    expect(getEntryFolderPath(entry)).toBe('posts');
  });

  it('returns the folder of the given locale’s file', () => {
    const entry = /** @type {Entry} */ (
      /** @type {unknown} */ ({
        locales: {
          en: { path: 'posts/en/hello/index.md' },
          fr: { path: 'posts/fr/hello/index.md' },
        },
      })
    );

    expect(getEntryFolderPath(entry, 'fr')).toBe('posts/fr/hello');
    expect(getEntryFolderPath(entry, 'en')).toBe('posts/en/hello');
    // The entry doesn’t have the locale yet
    expect(getEntryFolderPath(entry, 'de')).toBe('posts/en/hello');
  });

  it('returns an empty string for an entry at the repository root', () => {
    const entry = /** @type {Entry} */ (
      /** @type {unknown} */ ({ locales: { en: { path: 'index.md' } } })
    );

    expect(getEntryFolderPath(entry)).toBe('');
  });
});

describe('getEntryDirName()', () => {
  /**
   * Get the file configuration of an entry collection with the given options.
   * @param {object} args Arguments.
   * @param {string} args.basePath Normalized `folder` option.
   * @param {I18nFileStructure} [args.structure] I18n structure. Omit to disable i18n.
   * @param {boolean} [args.omitDefaultLocaleFromFilePath] Whether to omit the default locale.
   * @param {number} [args.nestedDepth] Nested collection depth.
   * @param {string} [args.subPath] Normalized `path` option.
   * @returns {{ basePath: string, fullPathRegEx: RegExp }} File configuration.
   */
  const getFileConfig = ({
    basePath,
    structure,
    omitDefaultLocaleFromFilePath = false,
    nestedDepth,
    subPath,
  }) => {
    const _i18n = /** @type {InternalI18nOptions} */ (
      /** @type {unknown} */ ({
        i18nEnabled: !!structure,
        allLocales: structure ? ['en', 'fr'] : ['_default'],
        defaultLocale: structure ? 'en' : '_default',
        omitDefaultLocaleFromFilePath,
        structureMap: {
          i18nSingleFile: structure === 'single_file',
          i18nMultiFile: structure === 'multiple_files',
          i18nMultiFolder: structure === 'multiple_folders',
          i18nMultiRootFolder: structure === 'multiple_root_folders',
        },
      })
    );

    return {
      basePath,
      fullPathRegEx: getEntryPathRegEx({
        extension: 'md',
        format: 'frontmatter',
        basePath,
        subPath,
        nestedDepth,
        _i18n,
      }),
    };
  };

  it('returns the folder below the collection folder without i18n', () => {
    const config = getFileConfig({ basePath: 'content/posts', nestedDepth: Infinity });

    expect(getEntryDirName('content/posts/2024/foo.md', config)).toBe('2024');
    expect(getEntryDirName('content/posts/2024/04/foo.md', config)).toBe('2024/04');
    expect(getEntryDirName('content/posts/foo.md', config)).toBe('');
  });

  it('returns the same folder for every locale with a folder per locale', () => {
    const multiFolder = getFileConfig({
      basePath: 'content/posts',
      structure: 'multiple_folders',
      nestedDepth: Infinity,
    });

    const multiRootFolder = getFileConfig({
      basePath: 'content/posts',
      structure: 'multiple_root_folders',
      nestedDepth: Infinity,
    });

    expect(getEntryDirName('content/posts/en/2024/foo.md', multiFolder)).toBe('2024');
    expect(getEntryDirName('content/posts/fr/2024/foo.md', multiFolder)).toBe('2024');
    expect(getEntryDirName('content/posts/en/foo.md', multiFolder)).toBe('');
    expect(getEntryDirName('en/content/posts/2024/foo.md', multiRootFolder)).toBe('2024');
    expect(getEntryDirName('fr/content/posts/2024/foo.md', multiRootFolder)).toBe('2024');
    expect(getEntryDirName('fr/content/posts/foo.md', multiRootFolder)).toBe('');
  });

  it('handles the default locale omitted from the file path', () => {
    const multiFolder = getFileConfig({
      basePath: 'content/posts',
      structure: 'multiple_folders',
      omitDefaultLocaleFromFilePath: true,
      nestedDepth: Infinity,
    });

    const multiRootFolder = getFileConfig({
      basePath: 'content/posts',
      structure: 'multiple_root_folders',
      omitDefaultLocaleFromFilePath: true,
      nestedDepth: Infinity,
    });

    expect(getEntryDirName('content/posts/2024/foo.md', multiFolder)).toBe('2024');
    expect(getEntryDirName('content/posts/fr/2024/foo.md', multiFolder)).toBe('2024');
    expect(getEntryDirName('content/posts/2024/foo.md', multiRootFolder)).toBe('2024');
    expect(getEntryDirName('fr/content/posts/2024/foo.md', multiRootFolder)).toBe('2024');
  });

  it('ignores the locale in the file name or in the `folder` option', () => {
    const multiFile = getFileConfig({
      basePath: 'content/posts',
      structure: 'multiple_files',
      nestedDepth: Infinity,
    });

    const placeholder = getFileConfig({
      basePath: 'content/{{locale}}/posts',
      structure: 'multiple_folders',
      omitDefaultLocaleFromFilePath: true,
      nestedDepth: Infinity,
    });

    expect(getEntryDirName('content/posts/2024/foo.fr.md', multiFile)).toBe('2024');
    expect(getEntryDirName('content/fr/posts/2024/foo.md', placeholder)).toBe('2024');
    expect(getEntryDirName('content/posts/2024/foo.md', placeholder)).toBe('2024');
  });

  it('returns the folder of an entry matched by the `path` option', () => {
    const config = getFileConfig({
      basePath: 'content/posts',
      structure: 'multiple_root_folders',
      subPath: '{{year}}/{{slug}}/index',
    });

    expect(getEntryDirName('fr/content/posts/2024/foo/index.md', config)).toBe('2024/foo');
  });

  it('falls back to removing the base path from a path the matcher does not cover', () => {
    const config = getFileConfig({ basePath: 'content/posts' });

    // A regular collection only takes files right under its folder
    expect(getEntryDirName('content/posts/2024/foo.md', config)).toBe('2024');
    // Not below the collection folder
    expect(getEntryDirName('content/posts-archive/2024/foo.md', config)).toBe(
      'content/posts-archive/2024',
    );
    // The `{{locale}}` placeholder stands for any locale folder, or none
    expect(
      getEntryDirName('content/fr/posts/2024/foo.md', { basePath: 'content/{{locale}}/posts' }),
    ).toBe('2024');
    expect(
      getEntryDirName('content/posts/2024/foo.md', { basePath: 'content/{{locale}}/posts' }),
    ).toBe('2024');
    // A base path with a trailing slash
    expect(getEntryDirName('content/posts/2024/foo.md', { basePath: 'content/posts/' })).toBe(
      '2024',
    );
  });

  it('returns the folder of the file path without a base path', () => {
    expect(getEntryDirName('content/posts/foo.md')).toBe('content/posts');
    expect(getEntryDirName('content/posts/foo.md', { basePath: '' })).toBe('content/posts');
    expect(getEntryDirName('foo.md')).toBe('');
  });
});
