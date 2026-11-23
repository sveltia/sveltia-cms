import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getEarlierEntryPaths } from '$lib/services/contents/entry/earlier-paths';

vi.mock('$lib/services/contents/collection/entries', () => ({ getEntriesByCollection: vi.fn() }));

/**
 * Create the arguments for an entry renamed from `hello` to `hi` outside the CMS.
 * @param {object} [options] Options.
 * @param {Record<string, any>} [options.collection] Collection options to change.
 * @param {string} [options.subPath] Sub path.
 * @param {Record<string, any>} [options.locales] Localized entries.
 * @returns {any} Arguments.
 */
const createArgs = ({
  collection = {},
  subPath = 'hi',
  locales = {
    en: {
      slug: 'hi',
      path: 'content/posts/hi.md',
      content: { title: 'Hi', 'aliases.0': '/posts/hello/' },
    },
  },
} = {}) => ({
  collection: {
    name: 'posts',
    _type: 'entry',
    preview_path: '/posts/{{slug}}',
    _i18n: { defaultLocale: 'en' },
    ...collection,
  },
  fields: [{ name: 'title', widget: 'string' }],
  entry: { subPath, locales },
});

beforeEach(() => {
  vi.mocked(getEntriesByCollection).mockReturnValue(/** @type {any} */ ([{ subPath: 'hi' }]));
});

describe('getEarlierEntryPaths', () => {
  test('reads the earlier slug from the URL the entry redirects from', () => {
    expect(getEarlierEntryPaths(createArgs())).toEqual([
      { subPath: 'hello', paths: ['content/posts/hello.md'] },
    ]);
  });

  test('matches the other tags of the URL, e.g. a date or a locale', () => {
    expect(
      getEarlierEntryPaths(
        createArgs({
          collection: { preview_path: '{{locale}}/{{year}}/{{month}}/{{slug}}/' },
          locales: {
            en: {
              slug: 'hi',
              path: 'content/posts/hi.en.md',
              content: { 'aliases.0': '/en/2024/05/hello', 'aliases.1': '/en/2024/05/hey/' },
            },
            fr: {
              slug: 'hi',
              path: 'content/posts/hi.fr.md',
              content: { 'aliases.0': '/fr/2024/05/hello' },
            },
          },
        }),
      ),
    ).toEqual([
      { subPath: 'hello', paths: ['content/posts/hello.en.md', 'content/posts/hello.fr.md'] },
      { subPath: 'hey', paths: ['content/posts/hey.en.md'] },
    ]);
  });

  test('reads a single redirect stored as a string, as Jekyll takes it', () => {
    expect(
      getEarlierEntryPaths(
        createArgs({
          collection: { aliases_field: 'redirect_from' },
          locales: {
            en: {
              slug: 'hi',
              path: 'content/posts/hi.md',
              content: { redirect_from: '/posts/hello/' },
            },
          },
        }),
      ),
    ).toEqual([{ subPath: 'hello', paths: ['content/posts/hello.md'] }]);
  });

  test('lists the entries only once an alias gives an earlier location', () => {
    getEarlierEntryPaths(
      createArgs({ locales: { en: { slug: 'hi', path: 'content/posts/hi.md', content: {} } } }),
    );
    expect(getEntriesByCollection).not.toHaveBeenCalled();
  });

  test('changes the file name rather than a folder of the same name', () => {
    expect(
      getEarlierEntryPaths(
        createArgs({
          collection: { preview_path: '/news/{{slug}}' },
          subPath: 'news',
          locales: {
            en: {
              slug: 'news',
              path: 'content/news/news.md',
              content: { 'aliases.0': '/news/hello' },
            },
          },
        }),
      ),
    ).toEqual([{ subPath: 'hello', paths: ['content/news/hello.md'] }]);
  });

  test('keeps the folder of a slug made of the last segment of the path', () => {
    expect(
      getEarlierEntryPaths(
        createArgs({
          subPath: 'blog/hi',
          locales: {
            en: {
              slug: 'hi',
              path: 'content/posts/blog/hi.md',
              content: { 'aliases.0': '/posts/hello' },
            },
          },
        }),
      ),
    ).toEqual([{ subPath: 'blog/hello', paths: ['content/posts/blog/hello.md'] }]);
  });

  test('leaves out an entry that is there again, the current path and unmatched aliases', () => {
    vi.mocked(getEntriesByCollection).mockReturnValue(
      /** @type {any} */ ([{ subPath: 'hi' }, { subPath: 'hello' }]),
    );
    expect(getEarlierEntryPaths(createArgs())).toEqual([]);

    vi.mocked(getEntriesByCollection).mockReturnValue(/** @type {any} */ ([{ subPath: 'hi' }]));
    expect(
      getEarlierEntryPaths(
        createArgs({
          locales: {
            en: {
              slug: 'hi',
              path: 'content/posts/hi.md',
              content: { 'aliases.0': '/posts/hi', 'aliases.1': '/news/hello', 'aliases.2': '' },
            },
          },
        }),
      ),
    ).toEqual([]);
  });

  test('refuses a slug that would point outside the entry’s folder', () => {
    ['/posts/../news/hello', '/posts/./hello', '/posts/a//b'].forEach((alias) => {
      expect(
        getEarlierEntryPaths(
          createArgs({
            locales: {
              en: { slug: 'hi', path: 'content/posts/hi.md', content: { 'aliases.0': alias } },
            },
          }),
        ),
      ).toEqual([]);
    });
  });

  test('needs aliases, a slug in the URL, and a slug made of the path', () => {
    expect(getEarlierEntryPaths(createArgs({ collection: { aliases_field: false } }))).toEqual([]);
    expect(getEarlierEntryPaths(createArgs({ collection: { preview_path: '' } }))).toEqual([]);
    expect(
      getEarlierEntryPaths(createArgs({ collection: { preview_path: '/posts/{{fields.id}}' } })),
    ).toEqual([]);
    // A translated slug, or a file path without the slug
    expect(
      getEarlierEntryPaths(
        createArgs({
          locales: {
            fr: { slug: 'salut', path: 'content/posts/hi.fr.md', content: { 'aliases.0': '/x' } },
            en: { slug: 'hi', path: 'content/posts/index.md', content: { 'aliases.0': '/x' } },
          },
        }),
      ),
    ).toEqual([]);
  });
});
