import { describe, expect, test } from 'vitest';

import { getCanonicalLocale, getLocaleLabel, getLocalePath } from '$lib/services/contents/i18n';
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

describe('Test getLocaleLabel()', () => {
  test('returns locale code for _default locale', () => {
    expect(getLocaleLabel('_default')).toBe('_default');
  });

  test('returns formatted locale name in default app locale (native: false)', () => {
    // With the fallback to 'en', these should work when native is false
    expect(getLocaleLabel('en')).toBe('English');
    expect(getLocaleLabel('fr')).toBe('French');
    expect(getLocaleLabel('es')).toBe('Spanish');
    expect(getLocaleLabel('de')).toBe('German');
    expect(getLocaleLabel('ja')).toBe('Japanese');
    expect(getLocaleLabel('zh')).toBe('Chinese');
    expect(getLocaleLabel('ko')).toBe('Korean');
    expect(getLocaleLabel('ar')).toBe('Arabic');
    expect(getLocaleLabel('ru')).toBe('Russian');
  });

  test('returns native locale name when native option is true', () => {
    expect(getLocaleLabel('en', { native: true })).toBe('English');
    expect(getLocaleLabel('fr', { native: true })).toBe('français');
    expect(getLocaleLabel('es', { native: true })).toBe('español');
    expect(getLocaleLabel('de', { native: true })).toBe('Deutsch');
    expect(getLocaleLabel('ja', { native: true })).toBe('日本語');
    expect(getLocaleLabel('zh', { native: true })).toBe('中文');
  });

  test('handles locale variants correctly with native: false', () => {
    // Test locale variants in English (fallback locale)
    expect(getLocaleLabel('en-US')).toBe('American English');
    expect(getLocaleLabel('en-GB')).toBe('British English');
    expect(getLocaleLabel('fr-CA')).toBe('Canadian French');
    expect(getLocaleLabel('zh-CN')).toBe('Chinese (China)');
    expect(getLocaleLabel('zh-TW')).toBe('Chinese (Taiwan)');
    expect(getLocaleLabel('pt-BR')).toBe('Brazilian Portuguese');
    expect(getLocaleLabel('es-MX')).toBe('Mexican Spanish');
  });

  test('handles locale variants correctly with native option', () => {
    // Testing with actual output values based on system's Intl.DisplayNames behavior
    const enUSLabel = getLocaleLabel('en-US', { native: true });
    const enGBLabel = getLocaleLabel('en-GB', { native: true });
    const frCALabel = getLocaleLabel('fr-CA', { native: true });

    // Verify these return meaningful locale names (not just the code)
    expect(enUSLabel).not.toBe('en-US');
    expect(enGBLabel).not.toBe('en-GB');
    expect(frCALabel).not.toBe('fr-CA');

    // Verify they contain expected keywords (adjusted for actual output)
    expect(enUSLabel.toLowerCase()).toContain('english');
    expect(enGBLabel.toLowerCase()).toContain('english');
    expect(frCALabel.toLowerCase()).toContain('français');
  });

  test('handles invalid canonical locale gracefully', () => {
    // Test with a locale that getCanonicalLocale returns undefined for
    expect(getLocaleLabel('INVALID_LOCALE')).toBe('INVALID_LOCALE');
    expect(getLocaleLabel('INVALID_LOCALE', { native: false })).toBe('INVALID_LOCALE');
    expect(getLocaleLabel('INVALID_LOCALE', { native: true })).toBe('INVALID_LOCALE');
  });

  test('handles various edge cases with native option', () => {
    // Test that function works with different locale codes when using native option
    expect(getLocaleLabel('ko', { native: true })).toBe('한국어');
    expect(getLocaleLabel('ar', { native: true })).toBe('العربية');
    expect(getLocaleLabel('ru', { native: true })).toBe('русский');
  });

  test('handles unknown locale codes gracefully', () => {
    // Test that unknown locales are handled appropriately
    const unknownResult = getLocaleLabel('xyz-unknown', { native: true });
    // The function might return the original code or a formatted version

    expect(typeof unknownResult).toBe('string');
    expect(unknownResult.length).toBeGreaterThan(0);

    // Test with native: false as well
    const unknownResultNonNative = getLocaleLabel('xyz-unknown', { native: false });

    expect(typeof unknownResultNonNative).toBe('string');
    expect(unknownResultNonNative.length).toBeGreaterThan(0);

    // Empty string should return empty string
    expect(getLocaleLabel('', { native: true })).toBe('');
    expect(getLocaleLabel('', { native: false })).toBe('');
  });

  test('compares native vs non-native locale labels', () => {
    // Test that native and non-native versions can be different
    const frenchNative = getLocaleLabel('fr', { native: true });
    const frenchEnglish = getLocaleLabel('fr', { native: false });

    expect(frenchNative).toBe('français');
    expect(frenchEnglish).toBe('French');
    expect(frenchNative).not.toBe(frenchEnglish);

    // Test with another language
    const germanNative = getLocaleLabel('de', { native: true });
    const germanEnglish = getLocaleLabel('de', { native: false });

    expect(germanNative).toBe('Deutsch');
    expect(germanEnglish).toBe('German');
    expect(germanNative).not.toBe(germanEnglish);
  });

  test('handles default parameter correctly', () => {
    // When no options object is provided, should default to native: false
    expect(getLocaleLabel('fr')).toBe('French');
    expect(getLocaleLabel('de')).toBe('German');
    expect(getLocaleLabel('ja')).toBe('Japanese');

    // When empty options object is provided, should default to native: false
    expect(getLocaleLabel('fr', {})).toBe('French');
    expect(getLocaleLabel('de', {})).toBe('German');
    expect(getLocaleLabel('ja', {})).toBe('Japanese');
  });
});
