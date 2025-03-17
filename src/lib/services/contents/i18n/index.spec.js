import { writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';
import { defaultI18nConfig, getCanonicalLocale, getI18nConfig } from '$lib/services/contents/i18n';

vi.mock('$lib/services/config');

describe('Test getI18nConfig()', () => {
  const siteConfigBase = {
    backend: { name: 'github' },
    media_folder: 'static/images/uploads',
    _siteURL: '',
    _baseURL: '',
  };

  /** @type {import('$lib/typedefs/public').Collection} */
  const collectionWithoutI18n = {
    name: 'posts',
    fields: [],
  };

  /** @type {import('$lib/typedefs/public').Collection} */
  const collectionWithI18n = {
    ...collectionWithoutI18n,
    i18n: true,
  };

  /** @type {import('$lib/typedefs/public').Collection} */
  const collectionWithPartialI18nOverride = {
    name: 'posts',
    i18n: {
      structure: 'single_file',
      locales: ['fr'],
    },
  };

  /** @type {import('$lib/typedefs/public').Collection} */
  const collectionWithCompleteI18nOverride = {
    name: 'posts',
    i18n: {
      structure: 'multiple_folders',
      locales: ['es'],
    },
  };

  /** @type {import('$lib/typedefs/public').CollectionFile} */
  const collectionFileWithoutI18n = {
    name: 'home',
    file: 'data/home.json',
    fields: [],
  };

  /** @type {import('$lib/typedefs/public').CollectionFile} */
  const collectionFileWithI18n = {
    ...collectionFileWithoutI18n,
    i18n: true,
  };

  /** @type {import('$lib/typedefs/public').CollectionFile} */
  const collectionFileWithPartialI18nOverride = {
    ...collectionFileWithoutI18n,
    i18n: {
      structure: 'single_file',
      locales: ['de'],
    },
  };

  /** @type {import('$lib/typedefs/public').CollectionFile} */
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

    expect(getI18nConfig(collectionWithoutI18n)).toEqual(defaultI18nConfig);

    expect(getI18nConfig(collectionWithoutI18n, collectionFileWithI18n)).toEqual(defaultI18nConfig);

    expect(getI18nConfig(collectionWithoutI18n, collectionFileWithoutI18n)).toEqual(
      defaultI18nConfig,
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

    expect(getI18nConfig(collectionWithoutI18n)).toEqual(defaultI18nConfig);

    expect(getI18nConfig(collectionWithoutI18n, collectionFileWithI18n)).toEqual(defaultI18nConfig);

    expect(getI18nConfig(collectionWithoutI18n, collectionFileWithoutI18n)).toEqual(
      defaultI18nConfig,
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

    expect(getI18nConfig(collectionWithI18n)).toEqual({
      structure: 'single_file',
      i18nEnabled: true,
      allLocales: ['en', 'fr'],
      initialLocales: ['en', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
    });

    expect(getI18nConfig(collectionWithI18n, collectionFileWithI18n)).toEqual({
      structure: 'single_file',
      i18nEnabled: true,
      allLocales: ['en', 'fr'],
      initialLocales: ['en', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
    });

    expect(getI18nConfig(collectionWithI18n, collectionFileWithoutI18n)).toEqual({
      structure: 'single_file',
      i18nEnabled: false,
      allLocales: ['_default'],
      initialLocales: ['_default'],
      defaultLocale: '_default',
      saveAllLocales: true,
      canonicalSlug,
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

    expect(getI18nConfig(collectionWithI18n)).toEqual({
      structure: 'multiple_folders',
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'fr',
      saveAllLocales: true,
      canonicalSlug,
    });

    expect(getI18nConfig(collectionWithI18n, collectionFileWithI18n)).toEqual({
      structure: 'single_file', // Always single
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'fr',
      saveAllLocales: true,
      canonicalSlug,
    });

    expect(getI18nConfig(collectionWithI18n, collectionFileWithoutI18n)).toEqual({
      structure: 'single_file',
      i18nEnabled: false,
      allLocales: ['_default'],
      initialLocales: ['_default'],
      defaultLocale: '_default',
      saveAllLocales: true,
      canonicalSlug,
    });

    expect(getI18nConfig(collectionWithoutI18n, collectionFileWithI18n)).toEqual(defaultI18nConfig);

    expect(getI18nConfig(collectionWithoutI18n, collectionFileWithoutI18n)).toEqual(
      defaultI18nConfig,
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

    expect(getI18nConfig(collectionWithPartialI18nOverride)).toEqual({
      structure: 'single_file',
      i18nEnabled: true,
      allLocales: ['fr'],
      initialLocales: ['fr'],
      defaultLocale: 'fr',
      saveAllLocales: true,
      canonicalSlug,
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

    expect(getI18nConfig(collectionWithCompleteI18nOverride)).toEqual({
      structure: 'multiple_folders',
      i18nEnabled: true,
      allLocales: ['es'],
      initialLocales: ['es'],
      defaultLocale: 'es',
      saveAllLocales: true,
      canonicalSlug,
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

    expect(getI18nConfig(collectionWithI18n, collectionFileWithPartialI18nOverride)).toEqual({
      structure: 'single_file',
      i18nEnabled: true,
      allLocales: ['de'],
      initialLocales: ['de'],
      defaultLocale: 'de',
      saveAllLocales: true,
      canonicalSlug,
    });

    expect(getI18nConfig(collectionWithoutI18n, collectionFileWithPartialI18nOverride)).toEqual(
      defaultI18nConfig,
    );

    expect(
      getI18nConfig(collectionWithPartialI18nOverride, collectionFileWithPartialI18nOverride),
    ).toEqual({
      structure: 'single_file',
      i18nEnabled: true,
      allLocales: ['de'],
      initialLocales: ['de'],
      defaultLocale: 'de',
      saveAllLocales: true,
      canonicalSlug,
    });

    expect(
      getI18nConfig(collectionWithCompleteI18nOverride, collectionFileWithPartialI18nOverride),
    ).toEqual({
      structure: 'single_file',
      i18nEnabled: true,
      allLocales: ['de'],
      initialLocales: ['de'],
      defaultLocale: 'de',
      saveAllLocales: true,
      canonicalSlug,
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

    expect(getI18nConfig(collectionWithI18n, collectionFileWithCompleteI18nOverride)).toEqual({
      structure: 'single_file', // Always single
      i18nEnabled: true,
      allLocales: ['es'],
      initialLocales: ['es'],
      defaultLocale: 'es',
      saveAllLocales: true,
      canonicalSlug,
    });

    expect(getI18nConfig(collectionWithoutI18n, collectionFileWithCompleteI18nOverride)).toEqual(
      defaultI18nConfig,
    );

    expect(
      getI18nConfig(collectionWithPartialI18nOverride, collectionFileWithCompleteI18nOverride),
    ).toEqual({
      structure: 'single_file', // Always single
      i18nEnabled: true,
      allLocales: ['es'],
      initialLocales: ['es'],
      defaultLocale: 'es',
      saveAllLocales: true,
      canonicalSlug,
    });

    expect(
      getI18nConfig(collectionWithCompleteI18nOverride, collectionFileWithCompleteI18nOverride),
    ).toEqual({
      structure: 'single_file', // Always single
      i18nEnabled: true,
      allLocales: ['es'],
      initialLocales: ['es'],
      defaultLocale: 'es',
      saveAllLocales: true,
      canonicalSlug,
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

    expect(getI18nConfig(collectionWithI18n)).toEqual({
      structure: 'single_file',
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: false,
      canonicalSlug,
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

    expect(getI18nConfig(collectionWithI18n)).toEqual({
      structure: 'single_file',
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de'],
      defaultLocale: 'en',
      saveAllLocales: false,
      canonicalSlug,
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

    expect(getI18nConfig(collectionWithI18n)).toEqual({
      structure: 'single_file',
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: false,
      canonicalSlug,
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

    expect(getI18nConfig(collectionWithI18n)).toEqual({
      structure: 'single_file',
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en'],
      defaultLocale: 'en',
      saveAllLocales: false,
      canonicalSlug,
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

    expect(getI18nConfig(collectionWithI18n)).toEqual({
      structure: 'single_file',
      i18nEnabled: true,
      allLocales: ['en', 'de', 'fr'],
      initialLocales: ['en', 'de'], // `en` should be included because it’s default
      defaultLocale: 'en',
      saveAllLocales: false,
      canonicalSlug,
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
