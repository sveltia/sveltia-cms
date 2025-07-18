import { writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';
import {
  DEFAULT_I18N_CONFIG,
  getCanonicalLocale,
  getLocalePath,
  normalizeI18nConfig,
} from '$lib/services/contents/i18n';

/**
 * @import { Collection, CollectionFile } from '$lib/types/public';
 */

vi.mock('$lib/services/config');

describe('Test normalizeI18nConfig()', () => {
  const siteConfigBase = {
    backend: { name: 'github' },
    media_folder: 'static/images/uploads',
    _siteURL: '',
    _baseURL: '',
  };

  /** @type {Collection} */
  const collectionWithoutI18n = {
    name: 'posts',
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
    i18n: {
      structure: 'single_file',
      locales: ['fr'],
    },
  };

  /** @type {Collection} */
  const collectionWithCompleteI18nOverride = {
    name: 'posts',
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
    (await import('$lib/services/config')).siteConfig = writable({
      ...siteConfigBase,
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
    (await import('$lib/services/config')).siteConfig = writable({
      ...siteConfigBase,
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
    (await import('$lib/services/config')).siteConfig = writable({
      ...siteConfigBase,
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
        i18nRootMultiFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'fr'],
      initialLocales: ['en', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
    });

    expect(normalizeI18nConfig(collectionWithI18n, collectionFileWithI18n)).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nRootMultiFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'fr'],
      initialLocales: ['en', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
    });

    expect(normalizeI18nConfig(collectionWithI18n, collectionFileWithoutI18n)).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nRootMultiFolder: false,
      },
      i18nEnabled: false,
      allLocales: ['_default'],
      initialLocales: ['_default'],
      defaultLocale: '_default',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
    });
  });

  test('config with locales, structure and default_locale', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      ...siteConfigBase,
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
        i18nRootMultiFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'fr',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
    });

    expect(normalizeI18nConfig(collectionWithI18n, collectionFileWithI18n)).toEqual({
      structure: 'single_file', // Always single
      structureMap: {
        i18nSingleFile: true,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nRootMultiFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'fr',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
    });

    expect(normalizeI18nConfig(collectionWithI18n, collectionFileWithoutI18n)).toEqual({
      structure: 'single_file',
      structureMap: {
        i18nSingleFile: false,
        i18nMultiFile: false,
        i18nMultiFolder: false,
        i18nRootMultiFolder: false,
      },
      i18nEnabled: false,
      allLocales: ['_default'],
      initialLocales: ['_default'],
      defaultLocale: '_default',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
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
    (await import('$lib/services/config')).siteConfig = writable({
      ...siteConfigBase,
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
        i18nRootMultiFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['fr'],
      initialLocales: ['fr'],
      defaultLocale: 'fr',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
    });
  });

  test('complete config override at collection-level', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      ...siteConfigBase,
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
        i18nRootMultiFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['es'],
      initialLocales: ['es'],
      defaultLocale: 'es',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
    });
  });

  test('partial config override at file-level', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      ...siteConfigBase,
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
        i18nRootMultiFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['de'],
      initialLocales: ['de'],
      defaultLocale: 'de',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
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
        i18nRootMultiFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['de'],
      initialLocales: ['de'],
      defaultLocale: 'de',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
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
        i18nRootMultiFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['de'],
      initialLocales: ['de'],
      defaultLocale: 'de',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
    });
  });

  test('complete config override at file-level', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      ...siteConfigBase,
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
          i18nRootMultiFolder: false,
        },
        i18nEnabled: true,
        allLocales: ['es'],
        initialLocales: ['es'],
        defaultLocale: 'es',
        saveAllLocales: true,
        canonicalSlug,
        omitDefaultLocaleFromFileName: false,
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
        i18nRootMultiFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['es'],
      initialLocales: ['es'],
      defaultLocale: 'es',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
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
        i18nRootMultiFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['es'],
      initialLocales: ['es'],
      defaultLocale: 'es',
      saveAllLocales: true,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
    });
  });

  test('config with `save_all_locales: false`', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      ...siteConfigBase,
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
        i18nRootMultiFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: false,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
    });
  });

  test('config with initial locales', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      ...siteConfigBase,
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
        i18nRootMultiFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de'],
      defaultLocale: 'en',
      saveAllLocales: false,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
    });
  });

  test('config with initial locales with all locales', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      ...siteConfigBase,
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
        i18nRootMultiFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: false,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
    });
  });

  test('config with initial locales with default locale', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      ...siteConfigBase,
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
        i18nRootMultiFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en'],
      defaultLocale: 'en',
      saveAllLocales: false,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
    });
  });

  test('config with initial locales without default locale', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).siteConfig = writable({
      ...siteConfigBase,
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
        i18nRootMultiFolder: false,
      },
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de'], // `en` should be included because it’s default
      defaultLocale: 'en',
      saveAllLocales: false,
      canonicalSlug,
      omitDefaultLocaleFromFileName: false,
    });
  });
});

describe('Test getCanonicalLocale()', () => {
  test('valid locale code', () => {
    expect(getCanonicalLocale('en')).toEqual('en');
    expect(getCanonicalLocale('fr')).toEqual('fr');
    expect(getCanonicalLocale('en-us')).toEqual('en-US');
    expect(getCanonicalLocale('en-CA')).toEqual('en-CA');
  });

  test('invalid locale code', () => {
    expect(getCanonicalLocale('_default')).toEqual(undefined);
    expect(getCanonicalLocale('EN_US')).toEqual(undefined);
  });
});

describe('Test getLocalePath()', () => {
  test('basic locale replacement', () => {
    const _i18n = {
      ...DEFAULT_I18N_CONFIG,
      i18nEnabled: true,
      allLocales: ['en', 'fr', 'es'],
      defaultLocale: 'en',
      omitDefaultLocaleFromFileName: false,
    };

    expect(getLocalePath({ _i18n, locale: 'en', path: 'posts/{{locale}}/hello.md' })).toBe(
      'posts/en/hello.md',
    );

    expect(getLocalePath({ _i18n, locale: 'fr', path: 'posts/{{locale}}/hello.md' })).toBe(
      'posts/fr/hello.md',
    );

    expect(getLocalePath({ _i18n, locale: 'es', path: 'posts/{{locale}}/hello.md' })).toBe(
      'posts/es/hello.md',
    );
  });

  test('locale replacement in filename', () => {
    const _i18n = {
      ...DEFAULT_I18N_CONFIG,
      i18nEnabled: true,
      allLocales: ['en', 'fr'],
      defaultLocale: 'en',
      omitDefaultLocaleFromFileName: false,
    };

    expect(getLocalePath({ _i18n, locale: 'en', path: 'posts/hello.{{locale}}.md' })).toBe(
      'posts/hello.en.md',
    );

    expect(getLocalePath({ _i18n, locale: 'fr', path: 'posts/hello.{{locale}}.md' })).toBe(
      'posts/hello.fr.md',
    );
  });

  test('multiple locale placeholder replacements', () => {
    const _i18n = {
      ...DEFAULT_I18N_CONFIG,
      i18nEnabled: true,
      allLocales: ['en', 'fr'],
      defaultLocale: 'en',
      omitDefaultLocaleFromFileName: false,
    };

    expect(
      getLocalePath({
        _i18n,
        locale: 'en',
        path: '{{locale}}/posts/{{locale}}/hello.{{locale}}.md',
      }),
    ).toBe('en/posts/en/hello.en.md');

    expect(
      getLocalePath({
        _i18n,
        locale: 'fr',
        path: '{{locale}}/posts/{{locale}}/hello.{{locale}}.md',
      }),
    ).toBe('fr/posts/fr/hello.fr.md');
  });

  test('omit default locale from filename when enabled', () => {
    const _i18n = {
      ...DEFAULT_I18N_CONFIG,
      i18nEnabled: true,
      allLocales: ['en', 'fr', 'es'],
      defaultLocale: 'en',
      omitDefaultLocaleFromFileName: true,
    };

    // Default locale should have .{{locale}} part removed from filename
    expect(getLocalePath({ _i18n, locale: 'en', path: 'posts/hello.{{locale}}.md' })).toBe(
      'posts/hello.md',
    );

    // Non-default locales should still have the locale in filename
    expect(getLocalePath({ _i18n, locale: 'fr', path: 'posts/hello.{{locale}}.md' })).toBe(
      'posts/hello.fr.md',
    );

    expect(getLocalePath({ _i18n, locale: 'es', path: 'posts/hello.{{locale}}.md' })).toBe(
      'posts/hello.es.md',
    );
  });

  test('omit default locale from filename with different extensions', () => {
    const _i18n = {
      ...DEFAULT_I18N_CONFIG,
      i18nEnabled: true,
      allLocales: ['en', 'fr'],
      defaultLocale: 'en',
      omitDefaultLocaleFromFileName: true,
    };

    // Test with .md extension
    expect(getLocalePath({ _i18n, locale: 'en', path: 'posts/hello.{{locale}}.md' })).toBe(
      'posts/hello.md',
    );

    // Test with .json extension
    expect(getLocalePath({ _i18n, locale: 'en', path: 'data/config.{{locale}}.json' })).toBe(
      'data/config.json',
    );

    // Test with .yaml extension
    expect(getLocalePath({ _i18n, locale: 'en', path: 'data/config.{{locale}}.yaml' })).toBe(
      'data/config.yaml',
    );

    // Test with .yml extension
    expect(getLocalePath({ _i18n, locale: 'en', path: 'data/config.{{locale}}.yml' })).toBe(
      'data/config.yml',
    );
  });

  test('omit default locale disabled', () => {
    const _i18n = {
      ...DEFAULT_I18N_CONFIG,
      i18nEnabled: true,
      allLocales: ['en', 'fr'],
      defaultLocale: 'en',
      omitDefaultLocaleFromFileName: false,
    };

    // Default locale should still have the locale in filename when disabled
    expect(getLocalePath({ _i18n, locale: 'en', path: 'posts/hello.{{locale}}.md' })).toBe(
      'posts/hello.en.md',
    );

    expect(getLocalePath({ _i18n, locale: 'fr', path: 'posts/hello.{{locale}}.md' })).toBe(
      'posts/hello.fr.md',
    );
  });

  test('path without locale placeholder', () => {
    const _i18n = {
      ...DEFAULT_I18N_CONFIG,
      i18nEnabled: true,
      allLocales: ['en', 'fr'],
      defaultLocale: 'en',
      omitDefaultLocaleFromFileName: false,
    };

    // Path without locale placeholder should remain unchanged
    expect(getLocalePath({ _i18n, locale: 'en', path: 'posts/hello.md' })).toBe('posts/hello.md');

    expect(getLocalePath({ _i18n, locale: 'fr', path: 'posts/hello.md' })).toBe('posts/hello.md');
  });

  test('different default locales', () => {
    const _i18n = {
      ...DEFAULT_I18N_CONFIG,
      i18nEnabled: true,
      allLocales: ['en', 'fr', 'es'],
      defaultLocale: 'fr',
      omitDefaultLocaleFromFileName: true,
    };

    // French is the default locale, so it should be omitted
    expect(getLocalePath({ _i18n, locale: 'fr', path: 'posts/hello.{{locale}}.md' })).toBe(
      'posts/hello.md',
    );

    // Other locales should still include the locale
    expect(getLocalePath({ _i18n, locale: 'en', path: 'posts/hello.{{locale}}.md' })).toBe(
      'posts/hello.en.md',
    );

    expect(getLocalePath({ _i18n, locale: 'es', path: 'posts/hello.{{locale}}.md' })).toBe(
      'posts/hello.es.md',
    );
  });

  test('edge cases and special characters', () => {
    const _i18n = {
      ...DEFAULT_I18N_CONFIG,
      i18nEnabled: true,
      allLocales: ['en-US', 'zh-CN'],
      defaultLocale: 'en-US',
      omitDefaultLocaleFromFileName: false,
    };

    // Test with locales containing hyphens
    expect(getLocalePath({ _i18n, locale: 'en-US', path: 'posts/{{locale}}/hello.md' })).toBe(
      'posts/en-US/hello.md',
    );

    expect(getLocalePath({ _i18n, locale: 'zh-CN', path: 'posts/{{locale}}/hello.md' })).toBe(
      'posts/zh-CN/hello.md',
    );
  });

  test('_default locale handling', () => {
    const _i18n = {
      ...DEFAULT_I18N_CONFIG,
      i18nEnabled: false,
      allLocales: ['_default'],
      defaultLocale: '_default',
      omitDefaultLocaleFromFileName: false,
    };

    // _default locale should be handled normally
    expect(getLocalePath({ _i18n, locale: '_default', path: 'posts/{{locale}}/hello.md' })).toBe(
      'posts/_default/hello.md',
    );

    expect(getLocalePath({ _i18n, locale: '_default', path: 'posts/hello.{{locale}}.md' })).toBe(
      'posts/hello._default.md',
    );
  });
});
