import { describe, expect, test } from 'vitest';
import { getCanonicalLocale, getLocalePath } from '$lib/services/contents/i18n';
import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';

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
