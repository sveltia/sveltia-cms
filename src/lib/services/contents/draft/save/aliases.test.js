// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { addAlias } from '$lib/services/contents/draft/save/aliases';
import { getPreviewPath } from '$lib/services/contents/entry';

vi.mock('$lib/services/contents/entry', () => ({
  getPreviewPath: vi.fn(),
}));

/**
 * Create a mock entry draft.
 * @param {object} [overrides] Properties to override the defaults.
 * @returns {object} Mock draft.
 */
const createDraft = (overrides = {}) => ({
  isNew: false,
  isIndexFile: false,
  collection: { name: 'posts', _type: 'entry', preview_path: '/posts/{{slug}}' },
  collectionFile: undefined,
  originalEntry: {
    id: 'posts/old-slug',
    slug: 'old-slug',
    subPath: 'old-slug',
    locales: {
      en: {
        slug: 'old-slug',
        path: 'content/posts/old-slug.md',
        content: { title: 'Old Title' },
      },
    },
  },
  ...overrides,
});

/**
 * Make {@link getPreviewPath} return a path based on the given slug.
 * @param {string} [prefix] Path prefix.
 */
const mockPreviewPathBySlug = (prefix = '/posts/') => {
  vi.mocked(getPreviewPath).mockImplementation(({ slug }) => `${prefix}${slug}`);
};

describe('Test addAlias()', () => {
  const baseArgs = { locale: 'en', slug: 'new-slug', path: 'content/posts/new-slug.md' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPreviewPathBySlug();
  });

  test('should add the previous path when the property doesn’t exist', () => {
    const content = { title: 'New Title' };

    addAlias({ ...baseArgs, draft: createDraft(), content });

    expect(content).toEqual({ title: 'New Title', 'aliases.0': '/posts/old-slug' });
  });

  test('should append the previous path to an existing list', () => {
    const content = { title: 'New Title', 'aliases.0': '/posts/older-slug' };

    addAlias({ ...baseArgs, draft: createDraft(), content });

    expect(content).toEqual({
      title: 'New Title',
      'aliases.0': '/posts/older-slug',
      'aliases.1': '/posts/old-slug',
    });
  });

  test('should keep the existing list order and skip blank and non-string items', () => {
    const content = {
      title: 'New Title',
      'aliases.0': '/posts/a',
      'aliases.1': '  ',
      'aliases.2': 123,
      'aliases.3': '/posts/b',
    };

    addAlias({ ...baseArgs, draft: createDraft(), content });

    expect(content).toEqual({
      title: 'New Title',
      'aliases.0': '/posts/a',
      'aliases.1': '/posts/b',
      'aliases.2': '/posts/old-slug',
    });
  });

  test('should not duplicate the previous path or alias the entry’s own current path', () => {
    const content = {
      title: 'New Title',
      'aliases.0': '/posts/old-slug',
      'aliases.1': '/posts/new-slug',
      'aliases.2': '/posts/older-slug',
    };

    addAlias({ ...baseArgs, draft: createDraft(), content });

    expect(content).toEqual({
      title: 'New Title',
      'aliases.0': '/posts/older-slug',
      'aliases.1': '/posts/old-slug',
    });
  });

  test('should treat an empty list, `null` and an empty string as a missing property', () => {
    [[], null, ''].forEach((value) => {
      const content = { title: 'New Title', aliases: value };

      addAlias({ ...baseArgs, draft: createDraft(), content });

      expect(content).toEqual({ title: 'New Title', 'aliases.0': '/posts/old-slug' });
    });
  });

  test('should leave an unsupported property shape untouched', () => {
    const content = { title: 'New Title', aliases: '/posts/older-slug' };

    addAlias({ ...baseArgs, draft: createDraft(), content });

    expect(content).toEqual({ title: 'New Title', aliases: '/posts/older-slug' });
  });

  test('should make the path site-relative', () => {
    mockPreviewPathBySlug('posts/');

    const content = { title: 'New Title' };

    addAlias({ ...baseArgs, draft: createDraft(), content });

    expect(content).toEqual({ title: 'New Title', 'aliases.0': '/posts/old-slug' });
  });

  test('should generate the previous path from the original slug, path and content', () => {
    addAlias({ ...baseArgs, draft: createDraft(), content: { title: 'New Title' } });

    expect(getPreviewPath).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'en',
        slug: 'old-slug',
        path: 'content/posts/old-slug.md',
        content: { title: 'Old Title' },
      }),
    );
  });

  test('should do nothing for a collection file, whose slug is fixed', () => {
    const draft = createDraft({
      collection: { name: 'pages', _type: 'file' },
      collectionFile: { name: 'about', preview_path: '/{{slug}}' },
    });

    const content = { title: 'New Title' };

    addAlias({ ...baseArgs, draft, content });

    expect(content).toEqual({ title: 'New Title' });
    expect(getPreviewPath).not.toHaveBeenCalled();
  });

  test('should use the `aliases_field` option to name the property', () => {
    const draft = createDraft({
      collection: {
        name: 'posts',
        _type: 'entry',
        preview_path: '/posts/{{slug}}',
        aliases_field: 'redirect_from',
      },
    });

    const content = { title: 'New Title', 'redirect_from.0': '/posts/older-slug' };

    addAlias({ ...baseArgs, draft, content });

    expect(content).toEqual({
      title: 'New Title',
      'redirect_from.0': '/posts/older-slug',
      'redirect_from.1': '/posts/old-slug',
    });
  });

  test('should do nothing when the `aliases_field` option is `false`', () => {
    const draft = createDraft({
      collection: {
        name: 'posts',
        _type: 'entry',
        preview_path: '/posts/{{slug}}',
        aliases_field: false,
      },
    });

    const content = { title: 'New Title' };

    addAlias({ ...baseArgs, draft, content });

    expect(content).toEqual({ title: 'New Title' });
    expect(getPreviewPath).not.toHaveBeenCalled();
  });

  test('should do nothing for a new entry', () => {
    const content = { title: 'New Title' };

    addAlias({ ...baseArgs, draft: createDraft({ isNew: true }), content });

    expect(content).toEqual({ title: 'New Title' });
  });

  test('should do nothing for an index file', () => {
    const content = { title: 'New Title' };

    addAlias({ ...baseArgs, draft: createDraft({ isIndexFile: true }), content });

    expect(content).toEqual({ title: 'New Title' });
  });

  test('should do nothing when the original entry is unavailable', () => {
    const content = { title: 'New Title' };

    addAlias({ ...baseArgs, draft: createDraft({ originalEntry: undefined }), content });

    expect(content).toEqual({ title: 'New Title' });
  });

  test('should do nothing when the `preview_path` option is not defined', () => {
    const draft = createDraft({ collection: { name: 'posts', _type: 'entry' } });
    const content = { title: 'New Title' };

    addAlias({ ...baseArgs, draft, content });

    expect(content).toEqual({ title: 'New Title' });
    expect(getPreviewPath).not.toHaveBeenCalled();
  });

  test('should do nothing when the locale has just been enabled', () => {
    const content = { title: 'New Title' };

    addAlias({ ...baseArgs, locale: 'fr', draft: createDraft(), content });

    expect(content).toEqual({ title: 'New Title' });
  });

  test('should do nothing when the slug is unchanged', () => {
    const content = { title: 'New Title' };

    addAlias({ ...baseArgs, slug: 'old-slug', draft: createDraft(), content });

    expect(content).toEqual({ title: 'New Title' });
  });

  test('should do nothing when the previous path cannot be determined', () => {
    vi.mocked(getPreviewPath).mockReturnValue(undefined);

    const content = { title: 'New Title' };

    addAlias({ ...baseArgs, draft: createDraft(), content });

    expect(content).toEqual({ title: 'New Title' });
  });

  test('should do nothing when the path doesn’t contain the slug', () => {
    vi.mocked(getPreviewPath).mockReturnValue('/posts');

    const content = { title: 'New Title' };

    addAlias({ ...baseArgs, draft: createDraft(), content });

    expect(content).toEqual({ title: 'New Title' });
  });
});
