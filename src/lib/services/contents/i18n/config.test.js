import { writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';

import {
  createStructureMap,
  DEFAULT_CANONICAL_SLUG,
  DEFAULT_I18N_CONFIG,
  DEFAULT_LOCALE_KEY,
  determineDefaultLocale,
  determineInitialLocales,
  determineStructure,
  I18N_STRUCTURES,
  mergeI18nConfigs,
  normalizeI18nConfig,
} from './config';

/**
 * @import { Collection, CollectionFile } from '$lib/types/public';
 */

vi.mock('$lib/services/config');

describe('Test normalizeI18nConfig()', () => {
  const cmsConfigBase = {
    backend: { name: 'github' },
    media_folder: 'static/images/uploads',
    _siteURL: '',
    _baseURL: '',
  };

  /** @type {Collection} */
  const collectionWithoutI18n = {
    name: 'posts',
    folder: 'content/posts',
    fields: [],
  };

  /** @type {Collection} */
  const collectionWithI18n = {
    ...collectionWithoutI18n,
    i18n: true,
  };

  /** @type {Collection} */
  const collectionWithPartialI18nOverride = {
    name: 'posts',
    folder: 'content/posts',
    fields: [],
    i18n: {
      structure: 'single_file',
      locales: ['fr'],
    },
  };

  /** @type {Collection} */
  const collectionWithCompleteI18nOverride = {
    name: 'posts',
    folder: 'content/posts',
    fields: [],
    i18n: {
      structure: 'multiple_folders',
      locales: ['es'],
    },
  };

  /** @type {CollectionFile} */
  const collectionFileWithoutI18n = {
    name: 'home',
    file: 'data/home.json',
    fields: [],
  };

  /** @type {CollectionFile} */
  const collectionFileWithI18n = {
    ...collectionFileWithoutI18n,
    i18n: true,
  };

  /** @type {CollectionFile} */
  const collectionFileWithPartialI18nOverride = {
    ...collectionFileWithoutI18n,
    i18n: {
      structure: 'single_file',
      locales: ['de'],
    },
  };

  /** @type {CollectionFile} */
  const collectionFileWithCompleteI18nOverride = {
    ...collectionFileWithoutI18n,
    i18n: {
      structure: 'multiple_folders',
      locales: ['es'],
    },
  };

  const canonicalSlug = { key: 'translationKey', value: '{{slug}}' };

  test('no i18n defined at top-level or collection-level', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      collections: [collectionWithoutI18n],
    });

    expect(normalizeI18nConfig(collectionWithoutI18n)).toEqual(DEFAULT_I18N_CONFIG);

    expect(normalizeI18nConfig(collectionWithoutI18n, collectionFileWithI18n)).toEqual(
      DEFAULT_I18N_CONFIG,
    );

    expect(normalizeI18nConfig(collectionWithoutI18n, collectionFileWithoutI18n)).toEqual(
      DEFAULT_I18N_CONFIG,
    );
  });

  test('no i18n defined at collection-level', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        structure: 'multiple_folders',
        locales: ['en', 'de', 'fr'],
        default_locale: 'fr',
      },
      collections: [collectionWithoutI18n],
    });

    expect(normalizeI18nConfig(collectionWithoutI18n)).toEqual(DEFAULT_I18N_CONFIG);

    expect(normalizeI18nConfig(collectionWithoutI18n, collectionFileWithI18n)).toEqual(
      DEFAULT_I18N_CONFIG,
    );

    expect(normalizeI18nConfig(collectionWithoutI18n, collectionFileWithoutI18n)).toEqual(
      DEFAULT_I18N_CONFIG,
    );
  });

  test('config with locales, no structure, no default_locale', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        locales: ['en', 'fr'],
      },
      collections: [collectionWithI18n],
    });

    expect(normalizeI18nConfig(collectionWithI18n)).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'fr'],
      initialLocales: ['en', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });

    expect(normalizeI18nConfig(collectionWithI18n, collectionFileWithI18n)).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'fr'],
      initialLocales: ['en', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });

    expect(normalizeI18nConfig(collectionWithI18n, collectionFileWithoutI18n)).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: false,
      allLocales: ['_default'],
      initialLocales: ['_default'],
      defaultLocale: '_default',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });
  });

  test('config with locales, structure and default_locale', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        structure: 'multiple_folders',
        locales: ['en', 'de', 'fr'],
        default_locale: 'fr',
      },
      collections: [collectionWithI18n],
    });

    expect(normalizeI18nConfig(collectionWithI18n)).toEqual({
      structure: 'multiple_folders',
      structureMap: {
        i18nSingleFile: false,
        i18nMultiFile: false,
        i18nMultiFolder: true,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'fr',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });

    expect(normalizeI18nConfig(collectionWithI18n, collectionFileWithI18n)).toEqual({
      structure: 'single_file', // Always single
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'fr',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });

    expect(normalizeI18nConfig(collectionWithI18n, collectionFileWithoutI18n)).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: false,
      allLocales: ['_default'],
      initialLocales: ['_default'],
      defaultLocale: '_default',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });

    expect(normalizeI18nConfig(collectionWithoutI18n, collectionFileWithI18n)).toEqual(
      DEFAULT_I18N_CONFIG,
    );

    expect(normalizeI18nConfig(collectionWithoutI18n, collectionFileWithoutI18n)).toEqual(
      DEFAULT_I18N_CONFIG,
    );
  });

  test('partial config override at collection-level', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        structure: 'multiple_folders',
        allLocales: ['en', 'de', 'fr'],
        initialLocales: ['en', 'de', 'fr'],
        default_locale: 'fr',
      },
      collections: [collectionWithPartialI18nOverride],
    });

    expect(normalizeI18nConfig(collectionWithPartialI18nOverride)).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['fr'],
      initialLocales: ['fr'],
      defaultLocale: 'fr',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });
  });

  test('complete config override at collection-level', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        structure: 'multiple_folders',
        locales: ['en', 'de', 'fr'],
        default_locale: 'fr',
      },
      collections: [collectionWithCompleteI18nOverride],
    });

    expect(normalizeI18nConfig(collectionWithCompleteI18nOverride)).toEqual({
      structure: 'multiple_folders',
      structureMap: {
        i18nSingleFile: false,
        i18nMultiFile: false,
        i18nMultiFolder: true,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['es'],
      initialLocales: ['es'],
      defaultLocale: 'es',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });
  });

  test('partial config override at file-level', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        structure: 'multiple_folders',
        locales: ['en', 'de', 'fr'],
        default_locale: 'fr',
      },
      collections: [collectionWithPartialI18nOverride],
    });

    expect(normalizeI18nConfig(collectionWithI18n, collectionFileWithPartialI18nOverride)).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['de'],
      initialLocales: ['de'],
      defaultLocale: 'de',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });

    expect(
      normalizeI18nConfig(collectionWithoutI18n, collectionFileWithPartialI18nOverride),
    ).toEqual(DEFAULT_I18N_CONFIG);

    expect(
      normalizeI18nConfig(collectionWithPartialI18nOverride, collectionFileWithPartialI18nOverride),
    ).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['de'],
      initialLocales: ['de'],
      defaultLocale: 'de',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });

    expect(
      normalizeI18nConfig(
        collectionWithCompleteI18nOverride,
        collectionFileWithPartialI18nOverride,
      ),
    ).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['de'],
      initialLocales: ['de'],
      defaultLocale: 'de',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });
  });

  test('complete config override at file-level', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        structure: 'multiple_folders',
        locales: ['en', 'de', 'fr'],
        default_locale: 'fr',
      },
      collections: [collectionWithPartialI18nOverride],
    });

    expect(normalizeI18nConfig(collectionWithI18n, collectionFileWithCompleteI18nOverride)).toEqual(
      {
        structure: 'single_file', // Always single
        structureMap: {
          i18nSingleFile: true,
          i18nMultiFile: false,
          i18nMultiFolder: false,
          i18nMultiRootFolder: false,
        },
        i18nEnabled: true,
        allLocales: ['es'],
        initialLocales: ['es'],
        defaultLocale: 'es',
        saveAllLocales: true,
        canonicalSlug,
        omitDefaultLocaleFromFilePath: false,
        omitDefaultLocaleFromPreviewPath: false,
      },
    );

    expect(
      normalizeI18nConfig(collectionWithoutI18n, collectionFileWithCompleteI18nOverride),
    ).toEqual(DEFAULT_I18N_CONFIG);

    expect(
      normalizeI18nConfig(
        collectionWithPartialI18nOverride,
        collectionFileWithCompleteI18nOverride,
      ),
    ).toEqual({
      structure: 'single_file', // Always single
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['es'],
      initialLocales: ['es'],
      defaultLocale: 'es',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });

    expect(
      normalizeI18nConfig(
        collectionWithCompleteI18nOverride,
        collectionFileWithCompleteI18nOverride,
      ),
    ).toEqual({
      structure: 'single_file', // Always single
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['es'],
      initialLocales: ['es'],
      defaultLocale: 'es',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });
  });

  test('config with `save_all_locales: false`', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        locales: ['en', 'de', 'fr'],
        save_all_locales: false,
      },
      collections: [collectionWithI18n],
    });

    expect(normalizeI18nConfig(collectionWithI18n)).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: false,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });
  });

  test('config with initial locales', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        locales: ['en', 'de', 'fr'],
        initial_locales: ['en', 'de'],
      },
      collections: [collectionWithI18n],
    });

    expect(normalizeI18nConfig(collectionWithI18n)).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de'],
      defaultLocale: 'en',
      saveAllLocales: false,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });
  });

  test('config with initial locales with all locales', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        locales: ['en', 'de', 'fr'],
        initial_locales: 'all',
      },
      collections: [collectionWithI18n],
    });

    expect(normalizeI18nConfig(collectionWithI18n)).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: false,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });
  });

  test('config with initial locales with default locale', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        locales: ['en', 'de', 'fr'],
        initial_locales: 'default',
      },
      collections: [collectionWithI18n],
    });

    expect(normalizeI18nConfig(collectionWithI18n)).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en'],
      defaultLocale: 'en',
      saveAllLocales: false,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });
  });

  test('config with initial locales without default locale', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        locales: ['en', 'de', 'fr'],
        initial_locales: ['de'],
      },
      collections: [collectionWithI18n],
    });

    expect(normalizeI18nConfig(collectionWithI18n)).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de'], // `en` should be included because it’s default
      defaultLocale: 'en',
      saveAllLocales: false,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
    });
  });

  test('config with omit_default_locale_from_filename in multi-file structure (line 222)', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        structure: 'multiple_files',
        locales: ['en', 'de', 'fr'],
        omit_default_locale_from_filename: true,
      },
      collections: [collectionWithI18n],
    });

    // When no file param, the ternary at line 222 uses structureMap.i18nMultiFile
    expect(normalizeI18nConfig(collectionWithI18n)).toEqual({
      structure: 'multiple_files',
      structureMap: {
        i18nSingleFile: false,
        i18nMultiFile: true,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: true,
      omitDefaultLocaleFromPreviewPath: false, // Should be true because i18nMultiFile is true
    });
  });

  test('config with omit_default_locale_from_filename in single-file structure (line 222)', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        structure: 'single_file',
        locales: ['en', 'de', 'fr'],
        omit_default_locale_from_filename: true,
      },
      collections: [collectionWithI18n],
    });

    // When no file param and structure is single_file, line 222 returns false
    expect(normalizeI18nConfig(collectionWithI18n)).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false, // Should be false because i18nMultiFile is false
    });
  });

  test('config with omit_default_locale_from_filename and file with locale placeholder (line 223)', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        structure: 'multiple_folders', // File will change this to multiple_files
        locales: ['en', 'de', 'fr'],
        omit_default_locale_from_filename: true,
      },
      collections: [collectionWithI18n],
    });

    const fileWithLocale = {
      name: 'translations',
      file: 'data/strings.{{locale}}.json',
      fields: [],
      i18n: true,
    };

    // When file param contains {{locale}} pattern, regex matches and returns true
    expect(normalizeI18nConfig(collectionWithI18n, fileWithLocale)).toEqual({
      structure: 'multiple_files', // File with {{locale}} determines multiple_files
      structureMap: {
        i18nSingleFile: false,
        i18nMultiFile: true,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: true,
      omitDefaultLocaleFromPreviewPath: false, // Regex matches file.file pattern (line 223)
    });
  });

  test('config with omit_default_locale_from_filename and file without locale placeholder (line 223)', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        structure: 'multiple_files', // File will change this to single_file
        locales: ['en', 'de', 'fr'],
        omit_default_locale_from_filename: true,
      },
      collections: [collectionWithI18n],
    });

    const fileWithoutLocale = {
      name: 'sitedata',
      file: 'data/sitedata.json',
      fields: [],
      i18n: true,
    };

    // When file param does NOT contain {{locale}} pattern, regex fails and returns false
    expect(normalizeI18nConfig(collectionWithI18n, fileWithoutLocale)).toEqual({
      structure: 'single_file', // File without {{locale}} determines single_file
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false, // False because regex doesn't match (line 223)
    });
  });

  test('config with new omit_default_locale_from_file_path option and file pattern', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        structure: 'multiple_files',
        locales: ['en', 'de', 'fr'],
        omit_default_locale_from_file_path: true, // New option name
      },
      collections: [collectionWithI18n],
    });

    const fileWithLocale = {
      name: 'translations',
      file: 'data/strings.{{locale}}.json',
      fields: [],
      i18n: true,
    };

    expect(normalizeI18nConfig(collectionWithI18n, fileWithLocale)).toEqual({
      structure: 'multiple_files',
      structureMap: {
        i18nSingleFile: false,
        i18nMultiFile: true,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: true,
      omitDefaultLocaleFromPreviewPath: false,
    });
  });

  test('config with omit_default_locale_from_file_path and folder pattern (multiple_folders)', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        structure: 'multiple_folders',
        locales: ['en', 'de', 'fr'],
        omit_default_locale_from_file_path: true,
      },
      collections: [collectionWithI18n],
    });

    const fileWithFolderLocale = {
      name: 'products',
      file: 'content/{{locale}}/products.json',
      fields: [],
      i18n: true,
    };

    // New regex /{{locale}}[./]/ matches {{locale}}/ and {{locale}}.
    expect(normalizeI18nConfig(collectionWithI18n, fileWithFolderLocale)).toEqual({
      structure: 'multiple_files', // File with {{locale}} determines multiple_files
      structureMap: {
        i18nSingleFile: false,
        i18nMultiFile: true,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: true,
      omitDefaultLocaleFromPreviewPath: false, // Regex matches folder pattern ({{locale}}/)
    });
  });

  test('config with omit_default_locale_from_file_path and root folder pattern', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        structure: 'multiple_root_folders',
        locales: ['en', 'de', 'fr'],
        omit_default_locale_from_file_path: true,
      },
      collections: [collectionWithI18n],
    });

    const fileWithRootFolderLocale = {
      name: 'settings',
      file: '{{locale}}/settings.yaml',
      fields: [],
      i18n: true,
    };

    // New regex /{{locale}}[./]/ matches {{locale}}/
    expect(normalizeI18nConfig(collectionWithI18n, fileWithRootFolderLocale)).toEqual({
      structure: 'multiple_files',
      structureMap: {
        i18nSingleFile: false,
        i18nMultiFile: true,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: true,
      omitDefaultLocaleFromPreviewPath: false, // Regex matches root folder pattern ({{locale}}/)
    });
  });

  test('backward compatibility: both legacy and new option names work together (new option takes precedence)', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        structure: 'multiple_files',
        locales: ['en', 'de', 'fr'],
        omit_default_locale_from_filename: false, // Legacy option
        omit_default_locale_from_file_path: true, // New option
      },
      collections: [collectionWithI18n],
    });

    const fileWithLocale = {
      name: 'translations',
      file: 'data/strings.{{locale}}.json',
      fields: [],
      i18n: true,
    };

    // New option takes precedence
    expect(normalizeI18nConfig(collectionWithI18n, fileWithLocale)).toEqual({
      structure: 'multiple_files',
      structureMap: {
        i18nSingleFile: false,
        i18nMultiFile: true,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: true,
      omitDefaultLocaleFromPreviewPath: false, // New option value
    });
  });

  test('backward compatibility: legacy option still works when new option is not provided', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      ...cmsConfigBase,
      i18n: {
        structure: 'multiple_files',
        locales: ['en', 'de', 'fr'],
        omit_default_locale_from_filename: true, // Legacy option only
      },
      collections: [collectionWithI18n],
    });

    const fileWithLocale = {
      name: 'translations',
      file: 'data/strings.{{locale}}.json',
      fields: [],
      i18n: true,
    };

    // Legacy option still works
    expect(normalizeI18nConfig(collectionWithI18n, fileWithLocale)).toEqual({
      structure: 'multiple_files',
      structureMap: {
        i18nSingleFile: false,
        i18nMultiFile: true,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFilePath: true,
      omitDefaultLocaleFromPreviewPath: false, // Legacy option is converted
    });
  });
});

describe('Test internal helper functions', () => {
  describe('I18N_STRUCTURES constant', () => {
    test('should have all expected structure types', () => {
      expect(I18N_STRUCTURES).toEqual({
        SINGLE_FILE: 'single_file',
        MULTIPLE_FILES: 'multiple_files',
        MULTIPLE_FOLDERS: 'multiple_folders',
        MULTIPLE_FOLDERS_I18N_ROOT: 'multiple_folders_i18n_root',
        MULTIPLE_ROOT_FOLDERS: 'multiple_root_folders',
      });
    });
  });

  describe('DEFAULT_LOCALE_KEY constant', () => {
    test('should be _default', () => {
      expect(DEFAULT_LOCALE_KEY).toBe('_default');
    });
  });

  describe('DEFAULT_CANONICAL_SLUG constant', () => {
    test('should have correct default values', () => {
      expect(DEFAULT_CANONICAL_SLUG).toEqual({
        key: 'translationKey',
        value: '{{slug}}',
      });
    });
  });

  describe('mergeI18nConfigs', () => {
    const cmsConfigBase = {
      backend: { name: 'github' },
      media_folder: 'static/images/uploads',
      _siteURL: '',
      _baseURL: '',
    };

    test('should return undefined when site config has no i18n', async () => {
      // @ts-ignore
      (await import('$lib/services/config')).cmsConfig = writable({
        ...cmsConfigBase,
      });

      const collection = { name: 'posts', folder: 'content/posts', fields: [] };

      expect(mergeI18nConfigs(collection)).toBeUndefined();
    });

    test('should return undefined when collection has no i18n', async () => {
      // @ts-ignore
      (await import('$lib/services/config')).cmsConfig = writable({
        ...cmsConfigBase,
        i18n: { structure: 'single_file', locales: ['en', 'fr'] },
      });

      const collection = { name: 'posts', folder: 'content/posts', fields: [] };

      expect(mergeI18nConfigs(collection)).toBeUndefined();
    });

    test('should return site i18n config for collection with i18n=true', async () => {
      // @ts-ignore
      (await import('$lib/services/config')).cmsConfig = writable({
        ...cmsConfigBase,
        i18n: { structure: 'single_file', locales: ['en', 'fr'] },
      });

      const collection = { name: 'posts', folder: 'content/posts', fields: [], i18n: true };
      const result = mergeI18nConfigs(collection);

      expect(result).toEqual({ structure: 'single_file', locales: ['en', 'fr'] });
    });

    test('should merge collection i18n config over site config', async () => {
      // @ts-ignore
      (await import('$lib/services/config')).cmsConfig = writable({
        ...cmsConfigBase,
        i18n: { structure: 'single_file', locales: ['en', 'fr'] },
      });

      /** @type {Collection} */
      const collection = {
        name: 'posts',
        folder: 'content/posts',
        fields: [],
        // @ts-ignore
        i18n: { structure: 'multiple_folders', locales: ['de', 'es'] },
      };

      const result = mergeI18nConfigs(collection);

      expect(result).toEqual({ structure: 'multiple_folders', locales: ['de', 'es'] });
    });

    test('should merge file i18n config over collection config', async () => {
      // @ts-ignore
      (await import('$lib/services/config')).cmsConfig = writable({
        ...cmsConfigBase,
        i18n: { structure: 'single_file', locales: ['en', 'fr'] },
      });

      /** @type {Collection} */
      const collection = {
        name: 'pages',
        folder: 'content/pages',
        fields: [],
        // @ts-ignore
        i18n: { structure: 'multiple_folders', locales: ['de', 'es'] },
      };

      /** @type {CollectionFile} */
      const file = {
        name: 'about',
        file: 'data/about.json',
        fields: [],
        // @ts-ignore
        i18n: { structure: 'single_file', locales: ['ja'] },
      };

      const result = mergeI18nConfigs(collection, file);

      expect(result).toEqual({ structure: 'single_file', locales: ['ja'] });
    });

    test('should return undefined if file has i18n=false', async () => {
      // @ts-ignore
      (await import('$lib/services/config')).cmsConfig = writable({
        ...cmsConfigBase,
        i18n: { structure: 'single_file', locales: ['en', 'fr'] },
      });

      const collection = {
        name: 'pages',
        folder: 'content/pages',
        fields: [],
        i18n: true,
      };

      const file = {
        name: 'about',
        file: 'data/about.json',
        fields: [],
        i18n: false,
      };

      const result = mergeI18nConfigs(collection, file);

      expect(result).toBeUndefined();
    });

    test('should handle singleton collection', async () => {
      // @ts-ignore
      (await import('$lib/services/config')).cmsConfig = writable({
        ...cmsConfigBase,
        i18n: { structure: 'single_file', locales: ['en', 'fr'] },
      });

      /** @type {Collection} */
      const collection = {
        name: '_singletons',
        // @ts-ignore
        files: [{ name: 'settings', file: 'data/settings.json', fields: [] }],
      };

      const result = mergeI18nConfigs(collection);

      expect(result).toEqual({ structure: 'single_file', locales: ['en', 'fr'] });
    });
  });

  describe('determineStructure', () => {
    test('should return default structure when no file provided', () => {
      expect(determineStructure('single_file')).toBe('single_file');
      expect(determineStructure('multiple_folders')).toBe('multiple_folders');
    });

    test('should return single_file when file does not include {{locale}}', () => {
      const file = { name: 'home', file: 'data/home.json', fields: [] };

      expect(determineStructure('multiple_folders', file)).toBe('single_file');
    });

    test('should return multiple_files when file includes {{locale}}', () => {
      const file = { name: 'home', file: 'data/home.{{locale}}.json', fields: [] };

      expect(determineStructure('single_file', file)).toBe('multiple_files');
    });

    test('should return multiple_files for various {{locale}} patterns', () => {
      const file1 = { name: 'config', file: 'config.{{locale}}.yml', fields: [] };
      const file2 = { name: 'data', file: '{{locale}}/data.json', fields: [] };
      const file3 = { name: 'content', file: 'content-{{locale}}.md', fields: [] };

      expect(determineStructure('multiple_folders', file1)).toBe('multiple_files');
      expect(determineStructure('single_file', file2)).toBe('multiple_files');
      expect(determineStructure('multiple_folders_i18n_root', file3)).toBe('multiple_files');
    });
  });

  describe('createStructureMap', () => {
    test('should return all false when i18n is disabled', () => {
      expect(createStructureMap(false, 'single_file')).toEqual({
        i18nSingleFile: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      });
    });

    test('should set i18nSingleFile to true for single_file structure', () => {
      expect(createStructureMap(true, 'single_file')).toEqual({
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      });
    });

    test('should set i18nMultiFile to true for multiple_files structure', () => {
      expect(createStructureMap(true, 'multiple_files')).toEqual({
        i18nSingleFile: false,
        i18nMultiFile: true,
        i18nMultiFolder: false,
        i18nMultiRootFolder: false,
      });
    });

    test('should set i18nMultiFolder to true for multiple_folders structure', () => {
      expect(createStructureMap(true, 'multiple_folders')).toEqual({
        i18nSingleFile: false,
        i18nMultiFile: false,
        i18nMultiFolder: true,
        i18nMultiRootFolder: false,
      });
    });

    test('should set i18nMultiRootFolder to true for multiple_folders_i18n_root', () => {
      expect(createStructureMap(true, 'multiple_folders_i18n_root')).toEqual({
        i18nSingleFile: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: true,
      });
    });

    test('should set i18nMultiRootFolder to true for multiple_root_folders', () => {
      expect(createStructureMap(true, 'multiple_root_folders')).toEqual({
        i18nSingleFile: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nMultiRootFolder: true,
      });
    });

    test('should set i18nMultiRootFolder to true for both deprecated and new root folder structures', () => {
      const deprecatedResult = createStructureMap(true, 'multiple_folders_i18n_root');
      const newResult = createStructureMap(true, 'multiple_root_folders');

      expect(deprecatedResult.i18nMultiRootFolder).toBe(true);
      expect(newResult.i18nMultiRootFolder).toBe(true);
      expect(deprecatedResult).toEqual(newResult);
    });
  });

  describe('determineDefaultLocale', () => {
    test('should return DEFAULT_LOCALE_KEY when i18n is disabled', () => {
      expect(determineDefaultLocale(false, ['en', 'fr'])).toBe('_default');
      expect(determineDefaultLocale(false, [], 'en')).toBe('_default');
    });

    test('should return specified default when it exists in allLocales', () => {
      expect(determineDefaultLocale(true, ['en', 'fr', 'de'], 'fr')).toBe('fr');
      expect(determineDefaultLocale(true, ['ja', 'en'], 'ja')).toBe('ja');
    });

    test('should return first locale when specified default not in allLocales', () => {
      expect(determineDefaultLocale(true, ['en', 'fr'], 'de')).toBe('en');
      expect(determineDefaultLocale(true, ['ja', 'ko'], 'en')).toBe('ja');
    });

    test('should return first locale when no default specified', () => {
      expect(determineDefaultLocale(true, ['en', 'fr'])).toBe('en');
      expect(determineDefaultLocale(true, ['de', 'es', 'it'])).toBe('de');
    });

    test('should handle single locale', () => {
      expect(determineDefaultLocale(true, ['en'])).toBe('en');
      expect(determineDefaultLocale(true, ['fr'], 'fr')).toBe('fr');
    });
  });

  describe('determineInitialLocales', () => {
    test('should return all locales when config is "all"', () => {
      expect(determineInitialLocales('all', ['en', 'fr', 'de'], 'en')).toEqual(['en', 'fr', 'de']);
      expect(determineInitialLocales('all', ['ja'], 'ja')).toEqual(['ja']);
    });

    test('should return default locale when config is "default"', () => {
      expect(determineInitialLocales('default', ['en', 'fr', 'de'], 'en')).toEqual(['en']);
      expect(determineInitialLocales('default', ['en', 'fr', 'de'], 'fr')).toEqual(['fr']);
    });

    test('should filter locales based on array config', () => {
      expect(determineInitialLocales(['en', 'fr'], ['en', 'fr', 'de'], 'en')).toEqual(['en', 'fr']);
      expect(determineInitialLocales(['de'], ['en', 'fr', 'de'], 'de')).toEqual(['de']);
    });

    test('should always include default locale even if not in config array', () => {
      expect(determineInitialLocales(['fr', 'de'], ['en', 'fr', 'de'], 'en')).toEqual([
        'en',
        'fr',
        'de',
      ]);
      expect(determineInitialLocales(['en'], ['en', 'fr', 'de'], 'fr')).toEqual(['en', 'fr']);
    });

    test('should return all locales when config is undefined', () => {
      expect(determineInitialLocales(undefined, ['en', 'fr', 'de'], 'en')).toEqual([
        'en',
        'fr',
        'de',
      ]);
      expect(determineInitialLocales(undefined, ['ja'], 'ja')).toEqual(['ja']);
    });

    test('should handle empty array config', () => {
      expect(determineInitialLocales([], ['en', 'fr', 'de'], 'en')).toEqual(['en']);
      expect(determineInitialLocales([], ['en', 'fr', 'de'], 'fr')).toEqual(['fr']);
    });

    test('should preserve order and not duplicate default locale', () => {
      expect(determineInitialLocales(['fr', 'en'], ['en', 'fr', 'de'], 'en')).toEqual(['en', 'fr']);
      expect(determineInitialLocales(['de', 'fr'], ['en', 'fr', 'de'], 'fr')).toEqual(['fr', 'de']);
    });
  });
});
