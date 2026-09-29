// @ts-nocheck

import { describe, expect, test, vi } from 'vitest';

import {
  buildSingleFileContent,
  getFieldComments,
  getSingleFileComments,
} from '$lib/services/contents/draft/save/content';
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

describe('getFieldComments()', () => {
  test('collects the comments of the fields and the subfields of Object fields', () => {
    expect(
      getFieldComments([
        { name: 'title', comment: 'Title' },
        { name: 'draft', widget: 'boolean' },
        { name: 'layout', widget: 'hidden', comment: 'Layout' },
        {
          name: 'seo',
          widget: 'object',
          comment: 'SEO',
          fields: [
            { name: 'description', comment: 'Description' },
            { name: 'image', widget: 'object', fields: [{ name: 'alt', comment: 'Alt' }] },
          ],
        },
      ]),
    ).toEqual({
      title: 'Title',
      layout: 'Layout',
      seo: 'SEO',
      'seo.description': 'Description',
      'seo.image.alt': 'Alt',
    });
  });

  test('leaves out the subfields of a List field', () => {
    expect(
      getFieldComments([
        {
          name: 'links',
          widget: 'list',
          comment: 'Links',
          fields: [{ name: 'url', comment: 'URL' }],
        },
      ]),
    ).toEqual({ links: 'Links' });
  });

  test('ignores an empty or non-string comment', () => {
    expect(
      getFieldComments([
        { name: 'a', comment: '' },
        { name: 'b', comment: '  ' },
        { name: 'c', comment: 1 },
      ]),
    ).toEqual({});
  });

  test('returns an empty map without fields', () => {
    expect(getFieldComments()).toEqual({});
  });

  test('prefixes the key paths', () => {
    expect(getFieldComments([{ name: 'title', comment: 'Title' }], 'en.')).toEqual({
      'en.title': 'Title',
    });
  });
});

describe('getSingleFileComments()', () => {
  const fields = [{ name: 'title', comment: 'Title' }];

  test('keeps the fields at the root when i18n is disabled', () => {
    const config = { _i18n: { i18nEnabled: false, allLocales: ['_default'] } };

    expect(getSingleFileComments({ config, fields })).toEqual({ title: 'Title' });
  });

  test('nests the fields under each locale key for single-file i18n', () => {
    const config = {
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'fr'],
        defaultLocale: 'en',
        structureMap: { i18nSingleFile: true },
      },
    };

    expect(getSingleFileComments({ config, fields })).toEqual({
      'en.title': 'Title',
      'fr.title': 'Title',
    });
  });

  test('keeps the default locale at the root for `single_file_default_root`', () => {
    const config = {
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'fr'],
        defaultLocale: 'en',
        structureMap: { i18nSingleFileDefaultRoot: true },
      },
    };

    expect(getSingleFileComments({ config, fields })).toEqual({
      title: 'Title',
      'fr.title': 'Title',
    });
  });
});
