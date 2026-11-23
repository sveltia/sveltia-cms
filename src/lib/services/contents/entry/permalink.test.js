// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getPreviewPath } from '$lib/services/contents/entry';
import {
  DEFAULT_PERMALINK_KEY,
  fillPermalink,
  getPermalinkKey,
  refreshPermalinks,
} from '$lib/services/contents/entry/permalink';

vi.mock('$lib/services/contents/entry', () => ({
  getPreviewPath: vi.fn(),
}));

/**
 * Create a mock entry collection storing permalinks.
 * @param {object} [overrides] Properties to override the defaults.
 * @returns {object} Mock collection.
 */
const createCollection = (overrides = {}) => ({
  name: 'portfolio',
  _type: 'entry',
  preview_path: 'portfolio/{{slug}}/index.html',
  permalink_field: true,
  fields: [{ name: 'title' }],
  _i18n: { defaultLocale: 'en' },
  ...overrides,
});

/**
 * Create the arguments for {@link fillPermalink}.
 * @param {object} [overrides] Arguments to override the defaults.
 * @param {object} [collectionOverrides] Collection properties to override the defaults.
 * @returns {object} Arguments.
 */
const createArgs = (overrides = {}, collectionOverrides = {}) => ({
  collection: createCollection(collectionOverrides),
  fields: [{ name: 'title' }],
  locale: 'en',
  slug: 'foo',
  path: 'content/portfolio/foo.md',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPreviewPath).mockImplementation(({ slug }) => `portfolio/${slug}/index.html`);
});

describe('Test getPermalinkKey()', () => {
  /**
   * Create a mock entry collection.
   * @param {any} [permalinkField] The `permalink_field` option value.
   * @returns {any} Mock collection.
   */
  const createKeyCollection = (permalinkField) => ({
    name: 'portfolio',
    _type: 'entry',
    ...(permalinkField === undefined ? {} : { permalink_field: permalinkField }),
  });

  test('should return `undefined` when the option is not defined', () => {
    expect(getPermalinkKey({ collection: createKeyCollection() })).toBeUndefined();
  });

  test('should return the default property name when the option is `true`', () => {
    expect(getPermalinkKey({ collection: createKeyCollection(true) })).toBe(DEFAULT_PERMALINK_KEY);
  });

  test('should return the `permalink_field` option value', () => {
    expect(getPermalinkKey({ collection: createKeyCollection('url_path') })).toBe('url_path');
  });

  test('should return `undefined` when the option is `false` or an empty string', () => {
    expect(getPermalinkKey({ collection: createKeyCollection(false) })).toBeUndefined();
    expect(getPermalinkKey({ collection: createKeyCollection('') })).toBeUndefined();
  });

  test('should return `undefined` for a non-entry collection', () => {
    expect(
      getPermalinkKey({ collection: { ...createKeyCollection(true), _type: 'file' } }),
    ).toBeUndefined();
    expect(getPermalinkKey({ collection: undefined })).toBeUndefined();
  });

  test('should return `undefined` when a field with the same name is configured', () => {
    expect(
      getPermalinkKey({ collection: createKeyCollection(true), fields: [{ name: 'permalink' }] }),
    ).toBeUndefined();
  });
});

describe('Test fillPermalink()', () => {
  test('should store a site-relative path for a new entry', () => {
    const content = { title: 'Foo' };

    fillPermalink(createArgs({ content }));

    expect(content).toEqual({ title: 'Foo', permalink: '/portfolio/foo/index.html' });
    expect(getPreviewPath).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'foo',
        path: 'content/portfolio/foo.md',
        content,
        locale: 'en',
      }),
    );
  });

  test('should not double the leading slash of the path', () => {
    vi.mocked(getPreviewPath).mockReturnValue('/portfolio/foo/');

    const content = {};

    fillPermalink(createArgs({ content }));

    expect(content.permalink).toBe('/portfolio/foo/');
  });

  test('should replace the path stored by an earlier save', () => {
    const content = { permalink: '/portfolio/old/index.html' };

    fillPermalink(createArgs({ content }));

    expect(content.permalink).toBe('/portfolio/foo/index.html');
  });

  test('should use the `permalink_field` option value as the property name', () => {
    const content = {};

    fillPermalink(createArgs({ content }, { permalink_field: 'url_path' }));

    expect(content).toEqual({ url_path: '/portfolio/foo/index.html' });
  });

  test('should remove an outdated path when the path can’t be determined', () => {
    vi.mocked(getPreviewPath).mockReturnValue(undefined);

    const content = { title: 'Foo', permalink: '/portfolio/old/index.html' };

    fillPermalink(createArgs({ content }));

    expect(content).toEqual({ title: 'Foo' });
  });

  test('should leave Eleventy’s `permalink: false` untouched', () => {
    const content = { permalink: false };

    fillPermalink(createArgs({ content }));

    expect(content).toEqual({ permalink: false });
    expect(getPreviewPath).not.toHaveBeenCalled();
  });

  test('should leave an object value untouched', () => {
    const content = { 'permalink.build': '/portfolio/foo/' };

    fillPermalink(createArgs({ content }));

    expect(content).toEqual({ 'permalink.build': '/portfolio/foo/' });
  });

  test('should do nothing by default', () => {
    const content = { title: 'Foo' };

    fillPermalink(createArgs({ content }, { permalink_field: undefined }));

    expect(content).toEqual({ title: 'Foo' });
  });

  test('should do nothing without the `preview_path` option', () => {
    const content = {};

    fillPermalink(createArgs({ content }, { preview_path: undefined }));

    expect(content).toEqual({});
  });

  test('should do nothing for the index file', () => {
    const content = {};

    fillPermalink(createArgs({ content, isIndexFile: true }));

    expect(content).toEqual({});
  });

  test('should do nothing when a field with the same name is configured', () => {
    const content = { permalink: 'custom/' };

    fillPermalink(createArgs({ content, fields: [{ name: 'permalink' }] }));

    expect(content).toEqual({ permalink: 'custom/' });
  });
});

describe('Test refreshPermalinks()', () => {
  /**
   * Create a mock entry with an English and a French file, and a disabled German locale.
   * @returns {object} Mock entry.
   */
  const createEntry = () => ({
    id: 'foo',
    locales: {
      en: { slug: 'foo', path: 'content/en/foo.md', content: { title: 'Foo', date: 'today' } },
      fr: { slug: 'truc', path: 'content/fr/truc.md', content: { title: 'Truc' } },
      de: { path: 'content/de/foo.md' },
    },
  });

  test('should update every locale that has content without changing the given entry', () => {
    const entry = createEntry();
    const result = refreshPermalinks({ collection: createCollection(), entry });

    expect(result.locales.en.content.permalink).toBe('/portfolio/foo/index.html');
    expect(result.locales.fr.content.permalink).toBe('/portfolio/truc/index.html');
    expect(result.locales.de).toEqual(entry.locales.de);
    // The content is shared with the entry in the store
    expect(entry).toEqual(createEntry());
  });

  test('should fill in a shared value from the default locale', () => {
    refreshPermalinks({ collection: createCollection(), entry: createEntry() });

    expect(getPreviewPath).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'fr',
        defaultContent: expect.objectContaining({ date: 'today' }),
      }),
    );
  });

  test('should return the given entry when the collection doesn’t store permalinks', () => {
    const entry = createEntry();

    expect(
      refreshPermalinks({ collection: createCollection({ permalink_field: false }), entry }),
    ).toBe(entry);
  });

  test('should return the given index file as is', () => {
    const entry = createEntry();

    expect(refreshPermalinks({ collection: createCollection(), isIndexFile: true, entry })).toBe(
      entry,
    );
  });
});
