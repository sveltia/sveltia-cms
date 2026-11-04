// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { setPermalink } from '$lib/services/contents/draft/save/permalink';
import { getPreviewPath } from '$lib/services/contents/entry';

vi.mock('$lib/services/contents/entry', () => ({
  getPreviewPath: vi.fn(),
}));

/**
 * Create a mock entry draft.
 * @param {object} [overrides] Properties to override the defaults.
 * @param {object} [collectionOverrides] Collection properties to override the defaults.
 * @returns {object} Mock draft.
 */
const createDraft = (overrides = {}, collectionOverrides = {}) => ({
  isNew: true,
  isIndexFile: false,
  collection: {
    name: 'portfolio',
    _type: 'entry',
    preview_path: 'portfolio/{{slug}}/index.html',
    permalink_field: true,
    _i18n: { defaultLocale: 'en' },
    ...collectionOverrides,
  },
  fields: [{ name: 'title' }],
  currentValues: {},
  ...overrides,
});

describe('Test setPermalink()', () => {
  const baseArgs = { locale: 'en', slug: 'foo', path: 'content/portfolio/foo.md' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPreviewPath).mockImplementation(({ slug }) => `portfolio/${slug}/index.html`);
  });

  test('should store a site-relative path for a new entry', () => {
    const content = { title: 'Foo' };

    setPermalink({ ...baseArgs, draft: createDraft(), content });

    expect(content).toEqual({ title: 'Foo', permalink: '/portfolio/foo/index.html' });
    expect(getPreviewPath).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'foo', path: baseArgs.path, content, locale: 'en' }),
    );
  });

  test('should not double the leading slash of the path', () => {
    vi.mocked(getPreviewPath).mockReturnValue('/portfolio/foo/');

    const content = {};

    setPermalink({ ...baseArgs, draft: createDraft(), content });

    expect(content.permalink).toBe('/portfolio/foo/');
  });

  test('should replace the path stored by an earlier save', () => {
    const content = { permalink: '/portfolio/old/index.html' };

    setPermalink({ ...baseArgs, draft: createDraft({ isNew: false }), content });

    expect(content.permalink).toBe('/portfolio/foo/index.html');
  });

  test('should use the `permalink_field` option value as the property name', () => {
    const content = {};

    setPermalink({
      ...baseArgs,
      draft: createDraft({}, { permalink_field: 'url_path' }),
      content,
    });

    expect(content).toEqual({ url_path: '/portfolio/foo/index.html' });
  });

  test('should remove an outdated path when the path can’t be determined', () => {
    vi.mocked(getPreviewPath).mockReturnValue(undefined);

    const content = { title: 'Foo', permalink: '/portfolio/old/index.html' };

    setPermalink({ ...baseArgs, draft: createDraft({ isNew: false }), content });

    expect(content).toEqual({ title: 'Foo' });
  });

  test('should leave Eleventy’s `permalink: false` untouched', () => {
    const content = { permalink: false };

    setPermalink({ ...baseArgs, draft: createDraft({ isNew: false }), content });

    expect(content).toEqual({ permalink: false });
    expect(getPreviewPath).not.toHaveBeenCalled();
  });

  test('should leave an object value untouched', () => {
    const content = { 'permalink.build': '/portfolio/foo/' };

    setPermalink({ ...baseArgs, draft: createDraft({ isNew: false }), content });

    expect(content).toEqual({ 'permalink.build': '/portfolio/foo/' });
  });

  test('should do nothing by default', () => {
    const content = { title: 'Foo' };

    setPermalink({
      ...baseArgs,
      draft: createDraft({}, { permalink_field: undefined }),
      content,
    });

    expect(content).toEqual({ title: 'Foo' });
  });

  test('should do nothing without the `preview_path` option', () => {
    const content = {};

    setPermalink({ ...baseArgs, draft: createDraft({}, { preview_path: undefined }), content });

    expect(content).toEqual({});
  });

  test('should do nothing for the index file', () => {
    const content = {};

    setPermalink({ ...baseArgs, draft: createDraft({ isIndexFile: true }), content });

    expect(content).toEqual({});
  });

  test('should do nothing when a field with the same name is configured', () => {
    const content = { permalink: 'custom/' };

    setPermalink({
      ...baseArgs,
      draft: createDraft({ fields: [{ name: 'permalink' }] }),
      content,
    });

    expect(content).toEqual({ permalink: 'custom/' });
  });
});
