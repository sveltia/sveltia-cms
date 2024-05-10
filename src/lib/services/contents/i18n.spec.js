import { describe, expect, test } from 'vitest';
import { siteConfig } from '$lib/services/config';
import { defaultI18nConfig, getCanonicalLocale, getI18nConfig } from '$lib/services/contents/i18n';

describe('Test getI18nConfig()', () => {
  const mediaFolder = 'static/images/uploads';

  /** @type {RawCollection} */
  const collectionWithoutI18n = {
    name: 'posts',
    fields: [],
  };

  /** @type {RawCollection} */
  const collectionWithI18n = {
    ...collectionWithoutI18n,
    i18n: true,
  };

  /** @type {RawCollection} */
  const collectionWithPartialI18nOverride = {
    name: 'posts',
    i18n: {
      structure: 'single_file',
      locales: ['fr'],
    },
  };

  /** @type {RawCollection} */
  const collectionWithCompleteI18nOverride = {
    name: 'posts',
    i18n: {
      structure: 'multiple_folders',
      locales: ['es'],
    },
  };

  /** @type {RawCollectionFile} */
  const collectionFileWithoutI18n = {
    name: 'home',
    file: 'data/home.json',
    fields: [],
  };

  /** @type {RawCollectionFile} */
  const collectionFileWithI18n = {
    ...collectionFileWithoutI18n,
    i18n: true,
  };

  /** @type {RawCollectionFile} */
  const collectionFileWithPartialI18nOverride = {
    ...collectionFileWithoutI18n,
    i18n: {
      structure: 'single_file',
      locales: ['de'],
    },
  };

  /** @type {RawCollectionFile} */
  const collectionFileWithCompleteI18nOverride = {
    ...collectionFileWithoutI18n,
    i18n: {
      structure: 'multiple_folders',
      locales: ['es'],
    },
  };

  const canonicalSlug = { key: 'translationKey', value: '{{slug}}' };

  test('no i18n defined at top-level or collection-level', () => {
    siteConfig.set({
      backend: { name: 'github' },
      media_folder: mediaFolder,
      collections: [collectionWithoutI18n],
    });

    expect(getI18nConfig(collectionWithoutI18n)).toEqual(defaultI18nConfig);

    expect(getI18nConfig(collectionWithoutI18n, collectionFileWithI18n)).toEqual(defaultI18nConfig);

    expect(getI18nConfig(collectionWithoutI18n, collectionFileWithoutI18n)).toEqual(
      defaultI18nConfig,
    );
  });

  test('no i18n defined at collection-level', () => {
    siteConfig.set({
      backend: { name: 'github' },
      media_folder: mediaFolder,
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

  test('config with locales, no structure, no default_locale', () => {
    siteConfig.set({
      backend: { name: 'github' },
      media_folder: mediaFolder,
      i18n: {
        locales: ['en', 'fr'],
      },
      collections: [collectionWithI18n],
    });

    expect(getI18nConfig(collectionWithI18n)).toEqual({
      structure: 'single_file',
      i18nEnabled: true,
      locales: ['en', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
    });

    expect(getI18nConfig(collectionWithI18n, collectionFileWithI18n)).toEqual({
      structure: 'single_file',
      i18nEnabled: true,
      locales: ['en', 'fr'],
      defaultLocale: 'en',
      saveAllLocales: true,
      canonicalSlug,
    });

    expect(getI18nConfig(collectionWithI18n, collectionFileWithoutI18n)).toEqual({
      structure: 'single_file',
      i18nEnabled: false,
      locales: ['_default'],
      defaultLocale: '_default',
      saveAllLocales: true,
      canonicalSlug,
    });
  });

  test('config with locales, structure and default_locale', () => {
    siteConfig.set({
      backend: { name: 'github' },
      media_folder: mediaFolder,
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
      locales: ['en', 'de', 'fr'],
      defaultLocale: 'fr',
      saveAllLocales: true,
      canonicalSlug,
    });

    expect(getI18nConfig(collectionWithI18n, collectionFileWithI18n)).toEqual({
      structure: 'single_file', // Always single
      i18nEnabled: true,
      locales: ['en', 'de', 'fr'],
      defaultLocale: 'fr',
      saveAllLocales: true,
      canonicalSlug,
    });

    expect(getI18nConfig(collectionWithI18n, collectionFileWithoutI18n)).toEqual({
      structure: 'single_file',
      i18nEnabled: false,
      locales: ['_default'],
      defaultLocale: '_default',
      saveAllLocales: true,
      canonicalSlug,
    });

    expect(getI18nConfig(collectionWithoutI18n, collectionFileWithI18n)).toEqual(defaultI18nConfig);

    expect(getI18nConfig(collectionWithoutI18n, collectionFileWithoutI18n)).toEqual(
      defaultI18nConfig,
    );
  });

  test('partial config override at collection-level', () => {
    siteConfig.set({
      backend: { name: 'github' },
      media_folder: mediaFolder,
      i18n: {
        structure: 'multiple_folders',
        locales: ['en', 'de', 'fr'],
        default_locale: 'fr',
      },
      collections: [collectionWithPartialI18nOverride],
    });

    expect(getI18nConfig(collectionWithPartialI18nOverride)).toEqual({
      structure: 'single_file',
      i18nEnabled: true,
      locales: ['fr'],
      defaultLocale: 'fr',
      saveAllLocales: true,
      canonicalSlug,
    });
  });

  test('complete config override at collection-level', () => {
    siteConfig.set({
      backend: { name: 'github' },
      media_folder: mediaFolder,
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
      locales: ['es'],
      defaultLocale: 'es',
      saveAllLocales: true,
      canonicalSlug,
    });
  });

  test('partial config override at file-level', () => {
    siteConfig.set({
      backend: { name: 'github' },
      media_folder: mediaFolder,
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
      locales: ['de'],
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
      locales: ['de'],
      defaultLocale: 'de',
      saveAllLocales: true,
      canonicalSlug,
    });

    expect(
      getI18nConfig(collectionWithCompleteI18nOverride, collectionFileWithPartialI18nOverride),
    ).toEqual({
      structure: 'single_file',
      i18nEnabled: true,
      locales: ['de'],
      defaultLocale: 'de',
      saveAllLocales: true,
      canonicalSlug,
    });
  });

  test('complete config override at file-level', () => {
    siteConfig.set({
      backend: { name: 'github' },
      media_folder: mediaFolder,
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
      locales: ['es'],
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
      locales: ['es'],
      defaultLocale: 'es',
      saveAllLocales: true,
      canonicalSlug,
    });

    expect(
      getI18nConfig(collectionWithCompleteI18nOverride, collectionFileWithCompleteI18nOverride),
    ).toEqual({
      structure: 'single_file', // Always single
      i18nEnabled: true,
      locales: ['es'],
      defaultLocale: 'es',
      saveAllLocales: true,
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
