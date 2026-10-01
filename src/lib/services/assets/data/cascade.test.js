// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  _resetAssetDeletionPlan,
  getReferenceTargets,
  planAssetDeletion,
  removeAssetReferences,
  removeMarkdownImages,
} from '$lib/services/assets/data/cascade';

vi.mock('$lib/services/assets/state', () => ({
  allAssets: { current: [] },
}));

vi.mock('$lib/services/assets/info', () => ({
  getAssetPublicURL: vi.fn((asset) => `/${asset.path}`),
}));

vi.mock('$lib/services/assets/media-field', () => ({
  getMediaFieldSource: vi.fn(() => undefined),
}));

vi.mock('$lib/services/contents', () => ({
  allEntries: { current: [] },
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: {} },
}));

vi.mock('$lib/services/assets/references', () => ({
  getAssetReferences: vi.fn(async () => []),
  getComparableAssetURL: vi.fn((url) => url.replace('https://example.com', '')),
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

vi.mock('$lib/services/contents/entry/readonly', () => ({
  isEntryReadonly: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummary: vi.fn((collection, entry) => entry.locales._default?.content?.title ?? ''),
}));

const { allAssets } = await import('$lib/services/assets/state');
const { getAssetPublicURL } = await import('$lib/services/assets/info');
const { getMediaFieldSource } = await import('$lib/services/assets/media-field');
const { cmsConfig } = await import('$lib/services/config');
const { allEntries } = await import('$lib/services/contents');
const { getAssetReferences } = await import('$lib/services/assets/references');

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
  _resetAssetDeletionPlan();
  getAssetPublicURL.mockImplementation((asset) => `/${asset.path}`);
  getMediaFieldSource.mockReturnValue(undefined);
  getAssetReferences.mockResolvedValue([]);
  isCollectionIndexFile.mockReturnValue(false);
  validateAnyField.mockReturnValue({ valid: true });
});

describe('getReferenceTargets()', () => {
  test('returns the public path of each asset', () => {
    expect(getReferenceTargets([createAsset('a.png'), createAsset('b.png')])).toEqual([
      { url: '/static/uploads/a.png' },
      { url: '/static/uploads/b.png' },
    ]);
    expect(getAssetPublicURL).toHaveBeenCalledWith(createAsset('a.png'), {
      allowSpecial: true,
      pathOnly: true,
    });
  });

  test('drops the site’s base URL, as a stored value does', () => {
    getAssetPublicURL.mockReturnValueOnce('https://example.com/uploads/a.png');

    expect(getReferenceTargets([createAsset('a.png')])).toEqual([{ url: '/uploads/a.png' }]);
  });

  test('lists a URL shared by several assets once', () => {
    getAssetPublicURL.mockReturnValue('/uploads/a.png');

    expect(getReferenceTargets([createAsset('a.png'), createAsset('b.png')])).toEqual([
      { url: '/uploads/a.png' },
    ]);
  });

  test('matches an asset without a public path by the asset itself, without loading it', () => {
    const asset = createAsset('b.png');

    getAssetPublicURL.mockImplementation((a) => (a === asset ? undefined : `/${a.path}`));

    expect(getReferenceTargets([createAsset('a.png'), asset])).toEqual([
      { url: '/static/uploads/a.png' },
      { asset },
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
    expect(getMediaFieldSource).not.toHaveBeenCalled();
  });

  test('matches an asset without a public path by the asset its images resolve to', async () => {
    getMediaFieldSource.mockImplementation(({ value }) =>
      value === 'a.png' ? { asset: { path: 'content/posts/a/a.png' } } : { url: value },
    );

    expect(
      await removeMarkdownImages({
        ...baseArgs,
        value: '![a](a.png) ![b](b.png)',
        urls: new Set(),
        paths: new Set(['content/posts/a/a.png']),
      }),
    ).toBe(' ![b](b.png)');
    expect(getMediaFieldSource).toHaveBeenCalledWith({
      entry,
      collectionName: 'posts',
      fileName: undefined,
      value: 'a.png',
    });
  });

  test('leaves an image alone that resolves to nothing', async () => {
    const value = '![a](a.png)';

    expect(
      await removeMarkdownImages({
        ...baseArgs,
        value,
        urls: new Set(),
        paths: new Set(['content/posts/a/a.png']),
      }),
    ).toBe(value);
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
    expect(getAssetReferences).toHaveBeenCalledWith([{ url: '/static/uploads/a.png' }]);
  });

  test('looks every asset up in one pass over the entries', async () => {
    await planAssetDeletion([asset, createAsset('b.png')]);

    expect(getAssetReferences).toHaveBeenCalledOnce();
    expect(getAssetReferences).toHaveBeenCalledWith([
      { url: '/static/uploads/a.png' },
      { url: '/static/uploads/b.png' },
    ]);
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

    getAssetReferences.mockResolvedValue([
      createReference(post, 'image', imageField),
      createReference(post, 'gallery.0', galleryField),
    ]);

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

describe('planAssetDeletion() with read-only entries', () => {
  const asset = createAsset('a.png');

  test('blocks the deletion of an asset used by a read-only file', async () => {
    const collectionFile = { name: 'general', readonly: true };
    const post = createPost('general', { image: '/static/uploads/a.png' });

    getAssetReferences.mockResolvedValue([
      createReference(post, 'image', imageField, { collectionFile }),
    ]);

    const { blockers } = await planAssetDeletion([asset]);

    expect(blockers).toEqual([
      expect.objectContaining({ keyPath: 'image', messages: ['readonly_reference'] }),
    ]);
  });
});

describe('planAssetDeletion() with assets without a public path', () => {
  test('removes the images resolving to the assets, without loading them', async () => {
    const asset = { name: 'a.png', path: 'content/posts/a/a.png', sha: 'a' };
    const post = createPost('a', { body: 'Hi ![a](a.png) ![b](b.png)' });

    getAssetPublicURL.mockReturnValue(undefined);
    getMediaFieldSource.mockImplementation(({ value }) =>
      value === 'a.png' ? { asset } : undefined,
    );
    getAssetReferences.mockResolvedValue([createReference(post, 'body', bodyField)]);

    const { targets } = await planAssetDeletion([asset]);

    expect(getAssetReferences).toHaveBeenCalledWith([{ asset }]);
    expect(targets[0].entry.locales._default.content).toEqual({ body: 'Hi  ![b](b.png)' });
  });
});

describe('planAssetDeletion() reuse', () => {
  const asset = createAsset('a.png');

  test('hands out the same plan again while nothing has changed', async () => {
    const plan = planAssetDeletion([asset]);

    // The selection may be a new list of the same assets, as for a folder
    expect(planAssetDeletion([createAsset('a.png')])).toBe(plan);
    await plan;
    expect(getAssetReferences).toHaveBeenCalledOnce();
  });

  test('works the plan out again once anything it depends on has changed', async () => {
    const plan = planAssetDeletion([asset]);
    const otherPlan = planAssetDeletion([asset, createAsset('b.png')]);

    expect(otherPlan).not.toBe(plan);

    allEntries.current = [];
    expect(planAssetDeletion([asset, createAsset('b.png')])).not.toBe(otherPlan);

    const plan3 = planAssetDeletion([asset]);

    allAssets.current = [];
    expect(planAssetDeletion([asset])).not.toBe(plan3);

    const plan4 = planAssetDeletion([asset]);

    cmsConfig.current = {};
    expect(planAssetDeletion([asset])).not.toBe(plan4);
  });

  test('doesn’t hand out a failed plan again', async () => {
    getAssetReferences.mockRejectedValueOnce(new Error('Failed'));

    await expect(planAssetDeletion([asset])).rejects.toThrow('Failed');
    expect(await planAssetDeletion([asset])).toEqual({ targets: [], blockers: [] });
    expect(getAssetReferences).toHaveBeenCalledTimes(2);
  });

  test('keeps a newer plan when an older one fails', async () => {
    getAssetReferences.mockRejectedValueOnce(new Error('Failed'));

    const failing = planAssetDeletion([asset]);
    const plan = planAssetDeletion([createAsset('b.png')]);

    await expect(failing).rejects.toThrow('Failed');
    expect(planAssetDeletion([createAsset('b.png')])).toBe(plan);
  });
});
