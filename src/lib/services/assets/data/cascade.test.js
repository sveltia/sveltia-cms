// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getReferenceURLs,
  planAssetDeletion,
  removeAssetReferences,
  removeMarkdownImages,
} from '$lib/services/assets/data/cascade';

vi.mock('$lib/services/assets/details', () => ({
  getAssetReferenceURL: vi.fn(async (asset) => `/${asset.path}`),
}));

vi.mock('$lib/services/assets/info', () => ({
  getMediaFieldURL: vi.fn(async () => undefined),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: {} },
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getAssetReferences: vi.fn(async () => []),
  MARKDOWN_IMAGE_REGEX: /!\[.*?\]\((.+?)(?:\s+".*?")?\)/g,
}));

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  isCollectionIndexFile: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/draft/validate/fields', () => ({
  validateAnyField: vi.fn(() => ({ valid: true })),
}));

vi.mock('$lib/services/contents/draft/validate/messages', () => ({
  getFieldValidationMessages: vi.fn(() => ['This field is required.']),
}));

vi.mock('$lib/services/contents/entry/changes', () => ({
  createSyntheticDraft: vi.fn((args) => ({ synthetic: true, ...args })),
  buildEntryUpdateChanges: vi.fn(),
  resolveCacheDB: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummary: vi.fn((collection, entry) => entry.locales._default?.content?.title ?? ''),
}));

const { getAssetReferenceURL } = await import('$lib/services/assets/details');
const { getMediaFieldURL } = await import('$lib/services/assets/info');
const { cmsConfig } = await import('$lib/services/config');
const { getAssetReferences } = await import('$lib/services/contents/collection/entries');

const { isCollectionIndexFile } =
  await import('$lib/services/contents/collection/entries/index-file');

const { validateAnyField } = await import('$lib/services/contents/draft/validate/fields');
const { createSyntheticDraft } = await import('$lib/services/contents/entry/changes');

const postsCollection = {
  name: 'posts',
  label: 'Blog Posts',
  _type: 'entry',
  _i18n: { defaultLocale: '_default', allLocales: ['_default'] },
};

const imageField = { name: 'image', label: 'Image', widget: 'image' };
const galleryField = { name: 'gallery', label: 'Gallery', widget: 'image', multiple: true };
const bodyField = { name: 'body', label: 'Body', widget: 'markdown' };
/**
 * Create an asset.
 * @param {string} name File name.
 * @returns {object} Asset.
 */
const createAsset = (name) => ({ name, path: `static/uploads/${name}`, sha: name });

/**
 * Create a blog post entry.
 * @param {string} id Entry ID and slug.
 * @param {Record<string, any>} content Flattened content.
 * @returns {object} Entry.
 */
const createPost = (id, content) => ({
  id,
  slug: id,
  subPath: id,
  locales: { _default: { slug: id, path: `content/posts/${id}.md`, content } },
});

/**
 * Create a reference.
 * @param {object} entry Entry.
 * @param {string} keyPath Key path.
 * @param {object} fieldConfig Field config.
 * @param {object} [props] Other properties.
 * @returns {object} Reference.
 */
const createReference = (entry, keyPath, fieldConfig, props = {}) => ({
  entry,
  collection: postsCollection,
  collectionFile: undefined,
  locale: '_default',
  keyPath,
  fieldConfig,
  ...props,
});

beforeEach(() => {
  vi.clearAllMocks();
  cmsConfig.current = {};
  getAssetReferenceURL.mockImplementation(async (asset) => `/${asset.path}`);
  getMediaFieldURL.mockResolvedValue(undefined);
  getAssetReferences.mockResolvedValue([]);
  isCollectionIndexFile.mockReturnValue(false);
  validateAnyField.mockReturnValue({ valid: true });
});

describe('getReferenceURLs()', () => {
  test('returns the public path of each asset', async () => {
    expect(await getReferenceURLs([createAsset('a.png'), createAsset('b.png')])).toEqual([
      '/static/uploads/a.png',
      '/static/uploads/b.png',
    ]);
  });

  test('drops the site’s base URL, as a stored value does', async () => {
    cmsConfig.current = { _baseURL: 'https://example.com' };
    getAssetReferenceURL.mockResolvedValueOnce('https://example.com/uploads/a.png');

    expect(await getReferenceURLs([createAsset('a.png')])).toEqual(['/uploads/a.png']);
  });

  test('leaves a blob URL alone', async () => {
    cmsConfig.current = { _baseURL: 'https://example.com' };
    getAssetReferenceURL.mockResolvedValueOnce('blob:https://example.com/abc');

    expect(await getReferenceURLs([createAsset('a.png')])).toEqual([
      'blob:https://example.com/abc',
    ]);
  });

  test('skips an asset that can’t be located', async () => {
    getAssetReferenceURL.mockResolvedValueOnce(undefined);

    expect(await getReferenceURLs([createAsset('a.png'), createAsset('b.png')])).toEqual([
      '/static/uploads/b.png',
    ]);
  });
});

describe('removeMarkdownImages()', () => {
  const entry = createPost('a', {});
  const baseArgs = { entry, collectionName: 'posts', fileName: undefined };

  test('removes the images pointing at the deleted assets', async () => {
    expect(
      await removeMarkdownImages({
        ...baseArgs,
        value: 'Hi ![a](/uploads/a.png) and ![b](/uploads/b.png "B") and ![c](/uploads/c.png)',
        urls: new Set(['/uploads/a.png', '/uploads/b.png']),
      }),
    ).toBe('Hi  and  and ![c](/uploads/c.png)');
  });

  test('takes the empty paragraph with the image', async () => {
    const urls = new Set(['/uploads/a.png']);

    expect(
      await removeMarkdownImages({
        ...baseArgs,
        value: 'Hello\n\n![a](/uploads/a.png)\n\nBye\n',
        urls,
      }),
    ).toBe('Hello\n\nBye\n');

    // At the start, at the end, and with nothing else
    expect(
      await removeMarkdownImages({ ...baseArgs, value: '![a](/uploads/a.png)\n\nBye', urls }),
    ).toBe('Bye');
    expect(
      await removeMarkdownImages({ ...baseArgs, value: 'Hello\n\n![a](/uploads/a.png)', urls }),
    ).toBe('Hello\n');
    expect(await removeMarkdownImages({ ...baseArgs, value: '![a](/uploads/a.png)', urls })).toBe(
      '',
    );

    // Consecutive images each on a line of their own
    expect(
      await removeMarkdownImages({
        ...baseArgs,
        value: 'Hello\n\n![a](/uploads/a.png)\n![a](/uploads/a.png)\n\nBye',
        urls,
      }),
    ).toBe('Hello\n\nBye');
  });

  test('cuts an image sharing its line with text', async () => {
    expect(
      await removeMarkdownImages({
        ...baseArgs,
        value: 'Hello\n![a](/uploads/a.png) there\nBye',
        urls: new Set(['/uploads/a.png']),
      }),
    ).toBe('Hello\n there\nBye');
  });

  test('cuts an image on a line of its own between paragraphs without blank lines', async () => {
    expect(
      await removeMarkdownImages({
        ...baseArgs,
        value: 'Hello\n![a](/uploads/a.png)\nBye',
        urls: new Set(['/uploads/a.png']),
      }),
    ).toBe('Hello\nBye');

    // On the last line
    expect(
      await removeMarkdownImages({
        ...baseArgs,
        value: 'Hello\n![a](/uploads/a.png)',
        urls: new Set(['/uploads/a.png']),
      }),
    ).toBe('Hello');
  });

  test('leaves the author’s blank lines alone', async () => {
    const value = 'Hello\n\n\n\n![a](/uploads/a.png)\n\n```\nfoo\n\n\nbar\n```\n';

    expect(
      await removeMarkdownImages({ ...baseArgs, value, urls: new Set(['/uploads/a.png']) }),
    ).toBe('Hello\n\n\n\n```\nfoo\n\n\nbar\n```\n');
  });

  test('leaves the text alone when no image points at them', async () => {
    const value = '![c](/uploads/c.png)';

    expect(
      await removeMarkdownImages({ ...baseArgs, value, urls: new Set(['/uploads/a.png']) }),
    ).toBe(value);
    expect(getMediaFieldURL).not.toHaveBeenCalled();
  });

  test('matches an asset without a public path by its blob URL', async () => {
    getMediaFieldURL.mockImplementation(async ({ value }) =>
      value === 'a.png' ? 'blob:https://example.com/abc' : undefined,
    );

    expect(
      await removeMarkdownImages({
        ...baseArgs,
        value: '![a](a.png) ![b](b.png)',
        urls: new Set(['blob:https://example.com/abc']),
      }),
    ).toBe(' ![b](b.png)');
    expect(getMediaFieldURL).toHaveBeenCalledWith({
      entry,
      collectionName: 'posts',
      fileName: undefined,
      value: 'a.png',
    });
  });
});

describe('removeAssetReferences()', () => {
  const urls = new Set(['/static/uploads/a.png']);

  test('empties a single-file field', async () => {
    const entry = createPost('a', { title: 'A', image: '/static/uploads/a.png' });

    expect(
      await removeAssetReferences({
        content: entry.locales._default.content,
        references: [createReference(entry, 'image', imageField)],
        urls,
      }),
    ).toEqual({
      content: { title: 'A', image: '' },
      fields: new Map([['image', imageField]]),
    });
    // The original is left alone
    expect(entry.locales._default.content.image).toBe('/static/uploads/a.png');
  });

  test('removes the items of a multi-file field and renumbers the rest', async () => {
    const content = {
      'gallery.0': '/static/uploads/a.png',
      'gallery.1': '/static/uploads/b.png',
      'gallery.2': '/static/uploads/a.png',
    };

    const entry = createPost('a', content);

    expect(
      await removeAssetReferences({
        content,
        references: [
          createReference(entry, 'gallery.0', galleryField),
          createReference(entry, 'gallery.2', galleryField),
        ],
        urls,
      }),
    ).toEqual({
      content: { 'gallery.0': '/static/uploads/b.png' },
      fields: new Map([['gallery', galleryField]]),
    });
  });

  test('removes the images from a Markdown field', async () => {
    const content = { body: 'Hi ![a](/static/uploads/a.png) there' };
    const entry = createPost('a', content);

    expect(
      await removeAssetReferences({
        content,
        references: [createReference(entry, 'body', bodyField)],
        urls,
      }),
    ).toEqual({
      content: { body: 'Hi  there' },
      fields: new Map([['body', bodyField]]),
    });
  });

  test('handles several fields at once', async () => {
    const content = {
      image: '/static/uploads/a.png',
      'gallery.0': '/static/uploads/a.png',
      body: '![a](/static/uploads/a.png)',
    };

    const entry = createPost('a', content);

    const { content: updated, fields } = await removeAssetReferences({
      content,
      references: [
        createReference(entry, 'image', imageField),
        createReference(entry, 'gallery.0', galleryField),
        createReference(entry, 'body', bodyField),
      ],
      urls,
    });

    expect(updated).toEqual({ image: '', gallery: [], body: '' });
    expect([...fields.keys()].sort()).toEqual(['body', 'gallery', 'image']);
  });
});

describe('planAssetDeletion()', () => {
  const asset = createAsset('a.png');

  test('does nothing when no entry uses the assets', async () => {
    expect(await planAssetDeletion([asset])).toEqual({ targets: [], blockers: [] });
    expect(getAssetReferences).toHaveBeenCalledWith('/static/uploads/a.png');
  });

  test('looks each asset up once', async () => {
    await planAssetDeletion([asset, createAsset('b.png')]);

    expect(getAssetReferences).toHaveBeenCalledTimes(2);
  });

  test('rewrites the entries using the assets', async () => {
    const post = createPost('a', { title: 'A', image: '/static/uploads/a.png' });

    getAssetReferences.mockResolvedValue([createReference(post, 'image', imageField)]);

    const { targets, blockers } = await planAssetDeletion([asset]);

    expect(blockers).toEqual([]);
    expect(targets).toEqual([
      {
        entry: createPost('a', { title: 'A', image: '' }),
        collection: postsCollection,
        collectionFile: undefined,
      },
    ]);
    expect(createSyntheticDraft).toHaveBeenCalledWith({
      collection: postsCollection,
      collectionFile: undefined,
      isIndexFile: false,
    });
  });

  test('writes an entry using several of the assets once', async () => {
    const post = createPost('a', {
      image: '/static/uploads/a.png',
      'gallery.0': '/static/uploads/b.png',
    });

    getAssetReferences.mockImplementation(async (url) =>
      url === '/static/uploads/a.png'
        ? [createReference(post, 'image', imageField)]
        : [createReference(post, 'gallery.0', galleryField)],
    );

    const { targets } = await planAssetDeletion([asset, createAsset('b.png')]);

    expect(targets).toHaveLength(1);
    expect(targets[0].entry.locales._default.content).toEqual({ image: '', gallery: [] });
  });

  test('rewrites every locale using the assets', async () => {
    const post = {
      ...createPost('a', {}),
      locales: {
        en: { slug: 'a', path: 'en/a.md', content: { image: '/static/uploads/a.png' } },
        fr: { slug: 'a', path: 'fr/a.md', content: { image: '/static/uploads/a.png' } },
        de: { slug: 'a', path: 'de/a.md', content: { image: '/static/uploads/b.png' } },
      },
    };

    getAssetReferences.mockResolvedValue([
      createReference(post, 'image', imageField, { locale: 'en' }),
      createReference(post, 'image', imageField, { locale: 'fr' }),
    ]);

    const { targets } = await planAssetDeletion([asset]);

    expect(targets[0].entry.locales).toEqual({
      en: { slug: 'a', path: 'en/a.md', content: { image: '' } },
      fr: { slug: 'a', path: 'fr/a.md', content: { image: '' } },
      de: { slug: 'a', path: 'de/a.md', content: { image: '/static/uploads/b.png' } },
    });
  });

  test('reports a field that would be left invalid', async () => {
    const post = createPost('a', { title: 'Post A', image: '/static/uploads/a.png' });

    getAssetReferences.mockResolvedValue([createReference(post, 'image', imageField)]);
    validateAnyField.mockReturnValue({ valid: false, valueMissing: true });

    const { targets, blockers } = await planAssetDeletion([asset]);

    expect(targets).toHaveLength(1);
    expect(blockers).toEqual([
      {
        collectionName: 'posts',
        collectionLabel: 'Blog Posts',
        fieldLabel: 'Image',
        entry: post,
        summary: 'Post A',
        locale: '_default',
        keyPath: 'image',
        messages: ['This field is required.'],
      },
    ]);
    expect(validateAnyField).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({ synthetic: true }),
        keyPath: 'image',
        value: '',
        valueMap: { title: 'Post A', image: '' },
      }),
    );
  });

  test('reports a field invalid in several locales once', async () => {
    const post = {
      ...createPost('a', {}),
      locales: {
        en: { slug: 'a', path: 'en/a.md', content: { image: '/static/uploads/a.png' } },
        fr: { slug: 'a', path: 'fr/a.md', content: { image: '/static/uploads/a.png' } },
      },
    };

    getAssetReferences.mockResolvedValue([
      createReference(post, 'image', imageField, { locale: 'en' }),
      createReference(post, 'image', imageField, { locale: 'fr' }),
    ]);
    validateAnyField.mockReturnValue({ valid: false });

    const { blockers } = await planAssetDeletion([asset]);

    expect(blockers).toHaveLength(1);
  });

  test('writes an entry belonging to several collections under the first one', async () => {
    const post = createPost('a', { image: '/static/uploads/a.png' });
    const otherCollection = { ...postsCollection, name: 'articles' };

    getAssetReferences.mockResolvedValue([
      createReference(post, 'image', imageField),
      createReference(post, 'image', imageField, { collection: otherCollection }),
    ]);

    const { targets } = await planAssetDeletion([asset]);

    expect(targets).toHaveLength(1);
    expect(targets[0].collection).toBe(postsCollection);
    expect(validateAnyField).toHaveBeenCalledTimes(1);
  });

  test('passes the collection file and index file along', async () => {
    const collectionFile = { name: 'general' };
    const post = createPost('general', { image: '/static/uploads/a.png' });

    isCollectionIndexFile.mockReturnValue(true);
    getAssetReferences.mockResolvedValue([
      createReference(post, 'image', imageField, { collectionFile }),
    ]);

    const { targets } = await planAssetDeletion([asset]);

    expect(targets[0].collectionFile).toBe(collectionFile);
    expect(createSyntheticDraft).toHaveBeenCalledWith({
      collection: postsCollection,
      collectionFile,
      isIndexFile: true,
    });
  });
});
