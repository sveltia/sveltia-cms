// @ts-nocheck

import { describe, expect, test, vi } from 'vitest';

import { buildSingleFileContent } from '$lib/services/contents/draft/save/content';
import { serializeContent } from '$lib/services/contents/draft/save/serialize';

vi.mock('$lib/services/contents/draft/save/serialize', () => ({
  serializeContent: vi.fn(({ valueMap }) => ({ ...valueMap })),
}));

describe('buildSingleFileContent()', () => {
  const entry = {
    slug: 'a',
    locales: {
      en: { slug: 'a', path: 'a.md', content: { title: 'Hello' } },
      fr: { slug: 'a', path: 'a.md', content: { title: 'Bonjour' } },
      de: { slug: 'a', path: 'a.md' },
    },
  };

  test('serializes the default locale only when i18n is disabled', () => {
    const config = { _i18n: { i18nEnabled: false, defaultLocale: 'en' } };
    const draft = {};

    expect(buildSingleFileContent({ config, entry, draft })).toEqual({ title: 'Hello' });
    expect(serializeContent).toHaveBeenCalledTimes(1);
    expect(serializeContent).toHaveBeenCalledWith({
      draft,
      locale: '_default',
      valueMap: { title: 'Hello' },
    });
  });

  test('nests the locales for single-file i18n, skipping locales without content', () => {
    const config = { _i18n: { i18nEnabled: true, defaultLocale: 'en' } };

    expect(buildSingleFileContent({ config, entry, draft: {} })).toEqual({
      en: { title: 'Hello' },
      fr: { title: 'Bonjour' },
    });
    expect(serializeContent).toHaveBeenCalledTimes(2);
  });

  test('puts the default locale at the root for `single_file_default_root`', () => {
    const config = {
      _i18n: {
        i18nEnabled: true,
        defaultLocale: 'en',
        structureMap: { i18nSingleFileDefaultRoot: true },
      },
    };

    expect(buildSingleFileContent({ config, entry, draft: {} })).toEqual({
      lang: ['en', 'fr'],
      title: 'Hello',
      fr: { title: 'Bonjour' },
    });
  });

  test('drops a stale root-level `lang` property', () => {
    const config = {
      _i18n: {
        i18nEnabled: true,
        defaultLocale: 'en',
        structureMap: { i18nSingleFileDefaultRoot: true },
      },
    };

    const result = buildSingleFileContent({
      config,
      entry: { locales: { en: { content: { lang: ['xx'], title: 'Hello' } } } },
      draft: {},
    });

    expect(result).toEqual({ lang: ['en'], title: 'Hello' });
  });

  test('falls back to an empty root when the default locale has no content', () => {
    const config = {
      _i18n: {
        i18nEnabled: true,
        defaultLocale: 'en',
        structureMap: { i18nSingleFileDefaultRoot: true },
      },
    };

    const result = buildSingleFileContent({
      config,
      entry: { locales: { en: { content: null }, fr: { content: { title: 'French' } } } },
      draft: {},
    });

    expect(result).toEqual({ lang: ['en', 'fr'], fr: { title: 'French' } });
  });
});
