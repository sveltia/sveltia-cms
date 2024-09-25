import { describe, expect, test } from 'vitest';
import { getEntryTitle } from '$lib/services/contents/view';

describe('Test getEntryTitle()', () => {
  /** @type {Collection} */
  const collection = {
    name: 'pages-tags',
    folder: 'content/tags',
    _parserConfig: {},
    _i18n: {
      i18nEnabled: true,
      saveAllLocales: true,
      locales: ['en', 'de'],
      defaultLocale: 'de',
      structure: 'multiple_files',
      canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
    },
    slug_length: 50,
  };

  /** @type {LocalizedEntry} */
  const localizedEntryProps = { slug: '', path: '', sha: '', content: {} };

  /** @type {Entry} */
  const entry = {
    id: '',
    sha: '',
    slug: 'net',
    locales: {
      de: {
        ...localizedEntryProps,
        content: {
          slug: 'dotnet',
          translationKey: 'tag-dotnet',
          title: '.Net',
          draft: false,
          date: '2024-01-23',
        },
        path: 'content/tags/net/index.de.md',
      },
    },
  };

  /**
   * Wrapper for {@link getEntryTitle}.
   * @param {string} summary - Summary string template.
   * @returns {string} Formatted summary.
   */
  const format = (summary) =>
    getEntryTitle({ ...collection, summary }, entry, { locale: 'de', useTemplate: true });

  test('metadata', () => {
    expect(format('{{slug}}')).toEqual('net');
    expect(format('{{dirname}}')).toEqual('net');
    expect(format('{{filename}}')).toEqual('index');
    expect(format('{{extension}}')).toEqual('md');
  });

  test('fields', () => {
    expect(format('{{title}}')).toEqual('.Net');
    expect(format('{{fields.title}}')).toEqual('.Net');
    expect(format('{{fields.slug}}')).toEqual('dotnet');
  });

  test('transformations', () => {
    expect(format("{{date | date('MMM D, YYYY')}}")).toEqual('Jan 23, 2024');
    expect(format("{{draft | ternary('Draft', 'Public')}}")).toEqual('Public');
  });
});
