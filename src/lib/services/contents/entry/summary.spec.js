import { describe, expect, test } from 'vitest';
import { getEntrySummary } from '$lib/services/contents/entry/summary';

describe('Test getEntrySummary()', () => {
  /** @type {Collection} */
  const collection = {
    name: 'pages-tags',
    folder: 'content/tags',
    _type: 'entry',
    _file: {
      extension: 'md',
      format: 'yaml-frontmatter',
      basePath: 'content/tags',
    },
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
    subPath: 'net/index',
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
   * Wrapper for {@link getEntrySummary}.
   * @param {string} summary - Summary string template.
   * @param {object} [options] - Options.
   * @returns {string} Formatted summary.
   */
  const format = (summary, options = {}) =>
    getEntrySummary({ ...collection, summary }, entry, {
      locale: 'de',
      useTemplate: true,
      ...options,
    });

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

  test('Markdown', () => {
    const markdownStr =
      'This `code` on [GitHub](https://github.com/sveltia/sveltia-cms) _is_ ~~so~~ **good**!';

    expect(format(markdownStr, { allowMarkdown: true })).toEqual(
      'This <code>code</code> on GitHub <em>is</em> so <strong>good</strong>!',
    );
    expect(format(markdownStr, { allowMarkdown: false })).toEqual(
      'This code on GitHub is so good!',
    );

    const charRefStr = '&laquo;ABC&shy;DEF&nbsp;GH&raquo;';

    expect(format(charRefStr, { allowMarkdown: true })).toEqual('«ABC\u00adDEF\u00a0GH»');
    expect(format(charRefStr, { allowMarkdown: false })).toEqual('«ABC\u00adDEF\u00a0GH»');
  });
});
