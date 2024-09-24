import { describe, expect, test } from 'vitest';
import { formatSummary } from '$lib/services/contents/view';

describe('Test formatSummary()', () => {
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
   * Wrapper for {@link formatSummary}.
   * @param {string} summary - Summary string template.
   * @returns {string} Formatted summary.
   */
  const _formatSummary = (summary) => formatSummary({ ...collection, summary }, entry, 'de');

  test('metadata', () => {
    expect(_formatSummary('{{slug}}')).toEqual('net');
    expect(_formatSummary('{{dirname}}')).toEqual('net');
    expect(_formatSummary('{{filename}}')).toEqual('index');
    expect(_formatSummary('{{extension}}')).toEqual('md');
  });

  test('fields', () => {
    expect(_formatSummary('{{title}}')).toEqual('.Net');
    expect(_formatSummary('{{fields.title}}')).toEqual('.Net');
    expect(_formatSummary('{{fields.slug}}')).toEqual('dotnet');
  });

  test('transformations', () => {
    expect(_formatSummary("{{date | date('MMM D, YYYY')}}")).toEqual('Jan 23, 2024');
    expect(_formatSummary("{{draft | ternary('Draft', 'Public')}}")).toEqual('Public');
  });
});
