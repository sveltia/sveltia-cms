import { describe, expect, test, vi } from 'vitest';

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
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
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
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
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
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
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
      omitDefaultLocaleFromFilePath: true,
      omitDefaultLocaleFromPreviewPath: false,
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
      omitDefaultLocaleFromFilePath: true,
      omitDefaultLocaleFromPreviewPath: false,
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

  test('omit default locale from folder pattern (multiple_folders)', () => {
    const _i18n = {
      ...DEFAULT_I18N_CONFIG,
      i18nEnabled: true,
      allLocales: ['en', 'fr', 'es'],
      defaultLocale: 'en',
      omitDefaultLocaleFromFilePath: true,
      omitDefaultLocaleFromPreviewPath: false,
    };

    // Default locale: omit the {{locale}}/ folder part
    expect(getLocalePath({ _i18n, locale: 'en', path: 'content/{{locale}}/products.md' })).toBe(
      'content/products.md',
    );

    // Non-default locales: include the locale folder
    expect(getLocalePath({ _i18n, locale: 'fr', path: 'content/{{locale}}/products.md' })).toBe(
      'content/fr/products.md',
    );

    expect(getLocalePath({ _i18n, locale: 'es', path: 'content/{{locale}}/products.md' })).toBe(
      'content/es/products.md',
    );
  });

  test('omit default locale from root folder pattern (multiple_root_folders)', () => {
    const _i18n = {
      ...DEFAULT_I18N_CONFIG,
      i18nEnabled: true,
      allLocales: ['en', 'fr'],
      defaultLocale: 'en',
      omitDefaultLocaleFromFilePath: true,
      omitDefaultLocaleFromPreviewPath: false,
    };

    // Default locale: omit the {{locale}}/ folder at the beginning
    expect(getLocalePath({ _i18n, locale: 'en', path: '{{locale}}/settings.yaml' })).toBe(
      'settings.yaml',
    );

    // Non-default locales: include the locale folder
    expect(getLocalePath({ _i18n, locale: 'fr', path: '{{locale}}/settings.yaml' })).toBe(
      'fr/settings.yaml',
    );
  });

  test('omit default locale disabled', () => {
    const _i18n = {
      ...DEFAULT_I18N_CONFIG,
      i18nEnabled: true,
      allLocales: ['en', 'fr'],
      defaultLocale: 'en',
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
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
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
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
      omitDefaultLocaleFromFilePath: true,
      omitDefaultLocaleFromPreviewPath: false,
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
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
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
      omitDefaultLocaleFromFilePath: false,
      omitDefaultLocaleFromPreviewPath: false,
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
  test('returns undefined for _default locale', () => {
    expect(getLocaleLabel('_default')).toBe(undefined);
  });

  test('returns formatted locale name in default display locale (English)', () => {
    // Default displayLocale is 'en', so these should return English names
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

  test('returns native locale name when displayLocale matches locale', () => {
    expect(getLocaleLabel('en', { displayLocale: 'en' })).toBe('English');
    expect(getLocaleLabel('fr', { displayLocale: 'fr' })).toBe('français');
    expect(getLocaleLabel('es', { displayLocale: 'es' })).toBe('español');
    expect(getLocaleLabel('de', { displayLocale: 'de' })).toBe('Deutsch');
    expect(getLocaleLabel('ja', { displayLocale: 'ja' })).toBe('日本語');
    expect(getLocaleLabel('zh', { displayLocale: 'zh' })).toBe('中文');
  });

  test('handles locale variants correctly in English', () => {
    // Test locale variants in English (default display locale)
    expect(getLocaleLabel('en-US')).toBe('American English');
    expect(getLocaleLabel('en-GB')).toBe('British English');
    expect(getLocaleLabel('fr-CA')).toBe('Canadian French');
    expect(getLocaleLabel('zh-CN')).toBe('Chinese (China)');
    expect(getLocaleLabel('zh-TW')).toBe('Chinese (Taiwan)');
    expect(getLocaleLabel('pt-BR')).toBe('Brazilian Portuguese');
    expect(getLocaleLabel('es-MX')).toBe('Mexican Spanish');
  });

  test('handles locale variants correctly with custom displayLocale', () => {
    // Testing with actual output values based on system's Intl.DisplayNames behavior
    const enUSLabel = getLocaleLabel('en-US', { displayLocale: 'en-US' });
    const enGBLabel = getLocaleLabel('en-GB', { displayLocale: 'en-GB' });
    const frCALabel = getLocaleLabel('fr-CA', { displayLocale: 'fr-CA' });

    // Verify these return meaningful locale names (not just the code)
    expect(enUSLabel).not.toBe('en-US');
    expect(enGBLabel).not.toBe('en-GB');
    expect(frCALabel).not.toBe('fr-CA');

    // Verify they contain expected keywords (adjusted for actual output)
    expect(enUSLabel?.toLowerCase()).toContain('english');
    expect(enGBLabel?.toLowerCase()).toContain('english');
    expect(frCALabel?.toLowerCase()).toContain('français');
  });

  test('handles invalid canonical locale', () => {
    // Test with a locale that getCanonicalLocale returns undefined for
    expect(getLocaleLabel('INVALID_LOCALE')).toBe(undefined);
    expect(getLocaleLabel('EN_US')).toBe(undefined);
  });

  test('returns locale names in different display locales', () => {
    // Test that function works with different locale codes when using custom displayLocale
    expect(getLocaleLabel('ko', { displayLocale: 'ko' })).toBe('한국어');
    expect(getLocaleLabel('ar', { displayLocale: 'ar' })).toBe('العربية');
    expect(getLocaleLabel('ru', { displayLocale: 'ru' })).toBe('русский');
  });

  test('handles unknown locale codes', () => {
    // 'xyz-unknown' is a valid format but unknown locale, formatter will return a value
    const unknownResult = getLocaleLabel('xyz-unknown');

    // The formatter may return something like 'xyz (UNKNOWN)' for unknown but valid format
    expect(typeof unknownResult).toBe('string');
    expect(unknownResult?.length).toBeGreaterThan(0);

    // Empty string should return undefined (invalid canonical locale)
    expect(getLocaleLabel('')).toBe(undefined);
  });

  test('compares different displayLocale settings', () => {
    // Test that displayLocale affects the output
    const frenchInFrench = getLocaleLabel('fr', { displayLocale: 'fr' });
    const frenchInEnglish = getLocaleLabel('fr', { displayLocale: 'en' });

    expect(frenchInFrench).toBe('français');
    expect(frenchInEnglish).toBe('French');
    expect(frenchInFrench).not.toBe(frenchInEnglish);

    // Test with another language
    const germanInGerman = getLocaleLabel('de', { displayLocale: 'de' });
    const germanInEnglish = getLocaleLabel('de', { displayLocale: 'en' });

    expect(germanInGerman).toBe('Deutsch');
    expect(germanInEnglish).toBe('German');
    expect(germanInGerman).not.toBe(germanInEnglish);
  });

  test('handles default parameters correctly', () => {
    // When no options object is provided, should use default displayLocale ('en')
    expect(getLocaleLabel('fr')).toBe('French');
    expect(getLocaleLabel('de')).toBe('German');
    expect(getLocaleLabel('ja')).toBe('Japanese');

    // When empty options object is provided, should use defaults
    expect(getLocaleLabel('fr', {})).toBe('French');
    expect(getLocaleLabel('de', {})).toBe('German');
    expect(getLocaleLabel('ja', {})).toBe('Japanese');
  });

  test('handles formatter.of() errors gracefully (lines 53-57)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const originalDisplayNames = Intl.DisplayNames;

    /** @type {any} */
    const MockDisplayNames = class {
      /**
       * Throws test error.
       * @throws {Error} Test error.
       */
      of() {
        throw new Error('Test error');
      }
    };

    // @ts-ignore
    Intl.DisplayNames = MockDisplayNames;

    const result = getLocaleLabel('en', { displayLocale: 'en' });

    expect(result).toBe(undefined);
    expect(errorSpy).toHaveBeenCalled();

    // @ts-ignore
    Intl.DisplayNames = originalDisplayNames;
    errorSpy.mockRestore();
  });
});
