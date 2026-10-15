// @vitest-environment happy-dom

import { beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * @import { ComplexListField } from '$lib/types/public';
 */

const {
  mockGetAssetByPath,
  mockGetAssetBlob,
  mockGetAssetPublicURL,
  mockGetDefaultAssetFolder,
  mockAllAssets,
} = vi.hoisted(() => ({
  mockGetAssetByPath: vi.fn(),
  mockGetAssetBlob: vi.fn(),
  mockGetAssetPublicURL: vi.fn(),
  mockGetDefaultAssetFolder: vi.fn(),
  mockAllAssets: { current: /** @type {any[]} */ ([]) },
}));

vi.mock('$lib/services/config');

vi.mock('$lib/services/assets', () => ({
  getAssetByPath: mockGetAssetByPath,
  /**
   * Find an asset by its repository path, like the real helper.
   * @param {string} path Path.
   * @returns {any} Asset.
   */
  getAssetByInternalPath: (path) => mockAllAssets.current.find((asset) => asset.path === path),
  /**
   * Check if a path is relative, like the real helper.
   * @param {string} path Path.
   * @returns {boolean} Result.
   */
  isRelativePath: (path) => !/^[/@]/.test(path),
}));

vi.mock('$lib/services/assets/info', () => ({
  getAssetBlob: mockGetAssetBlob,
  getAssetPublicURL: mockGetAssetPublicURL,
  // The real helper wraps an SVG image; the URL is all that matters here
  createDisplayBlobURL: vi.fn(async () => `blob:copy-${Math.random()}`),
}));

// Imported along the way; its initialization would run against the happy-dom globals
vi.mock('$lib/services/user/env.svelte', () => ({ env: {} }));

vi.mock('$lib/services/contents/fields/file/helpers', () => ({
  getAssetLibraryFolderMap: vi.fn(() => ({})),
  getDefaultAssetFolder: mockGetDefaultAssetFolder,
}));

const {
  LIST_ITEM_CLIPBOARD_FORMAT,
  copyListItem,
  createListItemClipboardData,
  parseListItemClipboardData,
  prepareListItemPaste,
  readListItem,
  resetCopiedListItem,
} = await import('./clipboard');

const folder = { internalPath: 'content/pages', publicPath: '', entryRelative: true };

/** @type {ComplexListField} */
const blocksField = {
  name: 'blocks',
  widget: 'list',
  typeKey: 'kind',
  types: [
    {
      name: 'hero',
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'image', widget: 'image' },
        { name: 'gallery', widget: 'image', multiple: true },
        { name: 'body', widget: 'markdown' },
        { name: 'html', widget: 'richtext', format: 'html' },
        {
          name: 'cta',
          widget: 'object',
          fields: [
            { name: 'label', widget: 'string' },
            { name: 'file', widget: 'file' },
          ],
        },
        {
          name: 'media',
          widget: 'object',
          types: [{ name: 'photo', fields: [{ name: 'src', widget: 'image' }] }],
        },
        { name: 'photos', widget: 'list', field: { name: 'src', widget: 'image' } },
        {
          name: 'slides',
          widget: 'list',
          fields: [{ name: 'src', widget: 'image' }],
        },
      ],
    },
    { name: 'divider' },
  ],
};

/** @type {ComplexListField} */
const tagsField = { name: 'tags', widget: 'list', field: { name: 'tag', widget: 'string' } };
/** @type {any} */
let draft;

/**
 * Create the data of a copied item.
 * @param {Record<string, any>} [props] Properties to override.
 * @returns {any} Data.
 */
const createData = (props = {}) => ({
  format: LIST_ITEM_CLIPBOARD_FORMAT,
  version: 1,
  id: 'id',
  locale: 'en',
  values: { en: {} },
  assets: {},
  ...props,
});

beforeEach(() => {
  resetCopiedListItem();
  mockAllAssets.current = [];
  mockGetDefaultAssetFolder.mockReturnValue(folder);
  mockGetAssetPublicURL.mockReturnValue(undefined);

  draft = {
    originalEntry: { id: 'about' },
    collectionName: 'pages',
    fileName: 'about',
    isIndexFile: false,
    defaultLocale: 'en',
    files: {},
    currentValues: { en: {}, ja: {} },
  };

  vi.stubGlobal('navigator', {
    clipboard: { writeText: vi.fn(async () => undefined), readText: vi.fn(async () => '') },
  });
});

describe('createListItemClipboardData()', () => {
  test('copies an item with its type and the paths of the entry-relative assets', () => {
    const file = new File(['a'], 'pending.png');

    draft.files['blob:pending'] = { file };
    draft.currentValues.en = {
      'blocks.0.kind': 'hero',
      'blocks.0.__sc_item_id': 'abc',
      'blocks.0.title': 'Hello',
      'blocks.0.image': 'hero.jpg',
      'blocks.0.gallery.0': 'blob:pending',
      'blocks.0.gallery.1': 'blob:gone',
      'blocks.0.gallery.2': '/images/absolute.jpg',
      'blocks.0.body': '![a](inline.png) ![b](https://example.com/b.png) ![c](inline.png)',
      'blocks.0.html': '<p><img src="figure.png"><!-- <img src="comment.png"> --></p>',
      'blocks.0.cta.label': 'Go',
      'blocks.0.cta.file': 'unknown.pdf',
      'blocks.0.media.type': 'photo',
      'blocks.0.media.src': 'media.jpg',
      'blocks.0.photos.0': 'photo.jpg',
      'blocks.0.photos.1': '',
      'blocks.0.slides.0.src': 'slide.jpg',
      'blocks.0.slides.0.__sc_item_id': 'def',
      'blocks.0.slides.1': 'not an object',
    };

    mockGetAssetByPath.mockImplementation(({ value }) =>
      value === 'unknown.pdf' ? undefined : { path: `content/pages/${value}` },
    );

    const { data, files } = createListItemClipboardData({
      draft,
      fieldConfig: blocksField,
      keyPath: 'blocks',
      typedKeyPath: 'blocks',
      index: 0,
      locale: 'en',
    });

    expect(data).toEqual({
      format: LIST_ITEM_CLIPBOARD_FORMAT,
      version: 1,
      id: expect.any(String),
      copiedAt: expect.any(Number),
      locale: 'en',
      type: 'hero',
      values: {
        en: {
          title: 'Hello',
          image: 'hero.jpg',
          gallery: ['blob:pending', 'blob:gone', '/images/absolute.jpg'],
          body: '![a](inline.png) ![b](https://example.com/b.png) ![c](inline.png)',
          html: '<p><img src="figure.png"><!-- <img src="comment.png"> --></p>',
          cta: { label: 'Go', file: 'unknown.pdf' },
          media: { type: 'photo', src: 'media.jpg' },
          photos: ['photo.jpg', ''],
          slides: [{ src: 'slide.jpg' }, 'not an object'],
        },
      },
      assets: {
        en: {
          'figure.png': 'content/pages/figure.png',
          'hero.jpg': 'content/pages/hero.jpg',
          'inline.png': 'content/pages/inline.png',
          'media.jpg': 'content/pages/media.jpg',
          'photo.jpg': 'content/pages/photo.jpg',
          'slide.jpg': 'content/pages/slide.jpg',
        },
      },
    });
    expect([...files]).toEqual([['blob:pending', file]]);
    // The assets are looked up with the typed key path of their field
    expect(mockGetAssetByPath).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 'media.jpg',
        typedKeyPath: 'blocks.*<hero>.media<photo>.src',
      }),
    );
    expect(mockGetAssetByPath).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'photo.jpg', typedKeyPath: 'blocks.*<hero>.photos.*.src' }),
    );
    expect(mockGetAssetByPath).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'slide.jpg', typedKeyPath: 'blocks.*<hero>.slides.*.src' }),
    );
    // A reference found twice is looked up once
    expect(
      mockGetAssetByPath.mock.calls.filter(([{ value }]) => value === 'inline.png'),
    ).toHaveLength(1);
  });

  test('copies an item of an unknown type as is', () => {
    draft.currentValues.en = { 'blocks.0.kind': 'unknown', 'blocks.0.src': 'a.jpg' };

    const { data } = createListItemClipboardData({
      draft,
      fieldConfig: blocksField,
      keyPath: 'blocks',
      typedKeyPath: 'blocks',
      index: 0,
      locale: 'en',
    });

    expect(data.type).toBe('unknown');
    expect(data.values).toEqual({ en: { src: 'a.jpg' } });
    expect(data.assets).toEqual({ en: {} });
  });

  test('copies an item of a list with a single subfield as an object', () => {
    draft.currentValues.en = { 'tags.0': 'news', 'tags.1': 'tech' };

    const { data } = createListItemClipboardData({
      draft,
      fieldConfig: tagsField,
      keyPath: 'tags',
      typedKeyPath: 'tags',
      index: 1,
      locale: 'en',
    });

    expect(data.values).toEqual({ en: { tag: 'tech' } });
    expect(data.type).toBeUndefined();
  });

  test('copies a paired item in every locale that has it', () => {
    draft.currentValues = {
      en: { 'items.0.title': 'Hello' },
      ja: { 'items.0.title': 'こんにちは' },
      fr: {},
    };
    draft.extraValues = undefined;

    const { data } = createListItemClipboardData({
      draft,
      fieldConfig: { name: 'items', widget: 'list', fields: [{ name: 'title', widget: 'string' }] },
      keyPath: 'items',
      typedKeyPath: 'items',
      index: 0,
      locale: 'ja',
      pairedItems: true,
    });

    expect(data.locale).toBe('ja');
    expect(data.values).toEqual({ en: { title: 'Hello' }, ja: { title: 'こんにちは' } });
  });

  test('copies an item from another value store', () => {
    draft.extraValues = { en: { 'items.0.title': 'Hello' } };

    const { data } = createListItemClipboardData({
      draft,
      valueStoreKey: 'extraValues',
      fieldConfig: { name: 'items', widget: 'list', fields: [{ name: 'title', widget: 'string' }] },
      keyPath: 'items',
      typedKeyPath: 'items',
      index: 0,
      locale: 'ja',
      pairedItems: true,
    });

    expect(data.values).toEqual({ en: { title: 'Hello' } });
  });
});

describe('parseListItemClipboardData()', () => {
  test('parses a copied item', () => {
    expect(parseListItemClipboardData(JSON.stringify(createData()))).toEqual(createData());
  });

  test('fills in the missing assets', () => {
    const data = createData();

    delete data.assets;

    expect(parseListItemClipboardData(JSON.stringify(data))).toEqual(createData());
  });

  test('leaves out the internal properties and a prototype', () => {
    const text = JSON.stringify(createData({ values: { en: { title: 'a', __sc_item_id: 'b' } } }));

    const result = parseListItemClipboardData(
      text.replace('"title"', '"__proto__":{"x":1},"title"'),
    );

    expect(result?.values.en).toEqual({ title: 'a' });
    expect(Object.getPrototypeOf(result?.values.en)).toBe(Object.prototype);
  });

  test.each([
    ['text', 'Hello'],
    ['another JSON value', '[1]'],
    ['another format', JSON.stringify(createData({ format: 'other' }))],
    ['another version', JSON.stringify(createData({ version: 2 }))],
    ['a missing locale', JSON.stringify(createData({ locale: 1 }))],
    ['an invalid type', JSON.stringify(createData({ type: 1 }))],
    ['an invalid time', JSON.stringify(createData({ copiedAt: 'now' }))],
    ['missing values', JSON.stringify(createData({ values: undefined }))],
    ['missing values in the locale', JSON.stringify(createData({ values: { ja: {} } }))],
    ['invalid values', JSON.stringify(createData({ values: { en: {}, ja: 'a' } }))],
    ['invalid assets', JSON.stringify(createData({ assets: 'a' }))],
    ['invalid assets in a locale', JSON.stringify(createData({ assets: { en: null } }))],
  ])('ignores %s', (_label, text) => {
    expect(parseListItemClipboardData(text)).toBeUndefined();
  });
});

describe('copyListItem() and readListItem()', () => {
  const args = {
    fieldConfig: tagsField,
    keyPath: 'tags',
    typedKeyPath: 'tags',
    index: 0,
    locale: 'en',
  };

  beforeEach(() => {
    draft.currentValues.en = { 'tags.0': 'news' };
  });

  test('reads nothing before an item is copied', async () => {
    expect(await readListItem()).toBeUndefined();
  });

  test('copies an item to the clipboard, and reads it back with the files', async () => {
    expect(await copyListItem({ draft, ...args })).toBe(true);

    const [[text]] = vi.mocked(navigator.clipboard.writeText).mock.calls;

    expect(JSON.parse(text).values).toEqual({ en: { tag: 'news' } });

    vi.mocked(navigator.clipboard.readText).mockResolvedValue(text);

    const copied = await readListItem();

    expect(copied?.data.values).toEqual({ en: { tag: 'news' } });
    expect(copied?.files).toBeInstanceOf(Map);
  });

  test('keeps the copied item if the clipboard can’t be written or read', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('Denied'));
    vi.mocked(navigator.clipboard.readText).mockRejectedValue(new Error('Denied'));

    expect(await copyListItem({ draft, ...args })).toBe(false);
    expect((await readListItem())?.data.values).toEqual({ en: { tag: 'news' } });
  });

  test('reads an item copied elsewhere over the one copied here', async () => {
    await copyListItem({ draft, ...args });

    vi.mocked(navigator.clipboard.readText).mockResolvedValue(
      JSON.stringify(
        createData({ id: 'other', copiedAt: Date.now() + 1000, values: { en: { tag: 'other' } } }),
      ),
    );

    const copied = await readListItem();

    expect(copied?.data.values).toEqual({ en: { tag: 'other' } });
    expect(copied?.files.size).toBe(0);
  });

  test('reads the item copied here over an older one the clipboard still holds', async () => {
    // The clipboard couldn’t be written, so it still holds an item copied elsewhere before
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('Denied'));
    vi.mocked(navigator.clipboard.readText).mockResolvedValue(
      JSON.stringify(createData({ id: 'other', values: { en: { tag: 'other' } } })),
    );

    await copyListItem({ draft, ...args });

    expect((await readListItem())?.data.values).toEqual({ en: { tag: 'news' } });
  });
});

describe('prepareListItemPaste()', () => {
  /**
   * Prepare a copied item to be pasted.
   * @param {Record<string, any>} data Data to override.
   * @param {object} [args] Other arguments.
   * @param {ComplexListField} [args.fieldConfig] Field configuration.
   * @param {Map<string, File>} [args.files] Unsaved files.
   * @returns {ReturnType<typeof prepareListItemPaste>} Result.
   */
  const paste = (data, { fieldConfig = blocksField, files = new Map() } = {}) =>
    prepareListItemPaste({
      draft,
      copied: { data: createData(data), files },
      fieldConfig,
      typedKeyPath: 'blocks',
    });

  describe('fits the item to the list', () => {
    test('rejects an item without a type the list has', async () => {
      expect(await paste({ type: 'gallery', values: { en: { title: 'a' } } })).toBeUndefined();
      expect(await paste({ values: { en: { title: 'a' } } })).toBeUndefined();
    });

    test('rejects an item none of whose values fit', async () => {
      expect(
        await paste({ type: 'hero', values: { en: { heading: 'a', image: true } } }),
      ).toBeUndefined();
    });

    test('pastes an item without values', async () => {
      expect(await paste({ type: 'divider' })).toEqual({
        type: 'divider',
        items: { en: {}, ja: {} },
        droppedCount: 0,
        missingFileCount: 0,
      });
    });

    test('leaves out the values that don’t fit, filling in the default values', async () => {
      const result = await paste({
        type: 'hero',
        values: {
          en: {
            title: 'Hello',
            heading: 'Dropped',
            image: ['/a.jpg'],
            gallery: '/b.jpg',
            body: null,
            cta: 'Dropped',
            media: { type: 'video', src: '/c.mp4' },
            photos: ['/d.jpg', { src: '/e.jpg' }],
            slides: [{ src: '/f.jpg', alt: 'Dropped' }, 'Dropped'],
          },
        },
      });

      expect(result?.items.en).toEqual({
        title: 'Hello',
        image: '/a.jpg',
        gallery: ['/b.jpg'],
        body: null,
        html: '',
        cta: { label: '', file: '' },
        media: null,
        photos: ['/d.jpg'],
        slides: [{ src: '/f.jpg' }],
      });
      // `heading`, `cta`, `media`, the `photos` object, the `slides` string and `alt`
      expect(result?.droppedCount).toBe(6);
    });

    test('checks the values against the field types', async () => {
      /** @type {ComplexListField} */
      const fieldConfig = {
        name: 'items',
        widget: 'list',
        fields: [
          { name: 'boolean', widget: 'boolean' },
          { name: 'number', widget: 'number' },
          { name: 'code', widget: 'code' },
          { name: 'pairs', widget: 'keyvalue' },
          { name: 'hidden', widget: 'hidden' },
          { name: 'select', widget: 'select', options: ['a'], multiple: true },
          { name: 'image', widget: 'image', multiple: true },
          { name: 'relation', widget: 'relation', collection: 'a', multiple: true },
          { name: 'strings', widget: 'list' },
          {
            name: 'object',
            widget: 'object',
            typeKey: 'kind',
            types: [{ name: 'a' }],
          },
          /** @type {any} */ ({ name: 'empty', widget: 'object' }),
        ],
      };

      const result = await paste(
        {
          values: {
            en: {
              boolean: 'true',
              number: 1,
              code: { code: 'a', lang: 'js' },
              pairs: { a: 'b' },
              hidden: [1],
              select: ['a', {}],
              image: 1,
              relation: null,
              strings: ['a', 1, {}],
              object: { kind: 'a', extra: 1 },
              empty: { a: 1 },
            },
          },
        },
        { fieldConfig },
      );

      expect(result?.items.en).toEqual({
        boolean: false,
        number: 1,
        code: { code: 'a', lang: 'js' },
        pairs: { a: 'b' },
        hidden: [1],
        select: [],
        image: [1],
        relation: null,
        strings: ['a', 1],
        object: { kind: 'a' },
        empty: {},
      });
      // `boolean`, `select`, the `strings` object, `extra` and `a`
      expect(result?.droppedCount).toBe(5);
    });

    test('rejects a value that doesn’t fit a list', async () => {
      /** @type {ComplexListField} */
      const fieldConfig = {
        name: 'items',
        widget: 'list',
        fields: [
          { name: 'title', widget: 'string' },
          { name: 'pairs', widget: 'keyvalue' },
          { name: 'code', widget: 'code' },
          { name: 'list', widget: 'list', fields: [{ name: 'a', widget: 'string' }] },
        ],
      };

      const result = await paste(
        { values: { en: { title: 'a', pairs: 'a', code: 1, list: 'a' } } },
        { fieldConfig },
      );

      // The default values of the fields
      expect(result?.items.en).toEqual({
        title: 'a',
        pairs: { '': '' },
        code: { code: '', lang: '' },
        list: [],
      });
      expect(result?.droppedCount).toBe(3);
    });

    test('pastes a value into a list with a single subfield', async () => {
      expect(
        (await paste({ values: { en: { tag: 'news' } } }, { fieldConfig: tagsField }))?.items,
      ).toEqual({ en: 'news', ja: 'news' });
      // The subfield of the source list has another name
      expect(
        (await paste({ values: { en: { label: 'news' } } }, { fieldConfig: tagsField }))?.items,
      ).toEqual({ en: 'news', ja: 'news' });
      expect(
        await paste({ values: { en: { a: 'news', b: 'tech' } } }, { fieldConfig: tagsField }),
      ).toBeUndefined();
    });

    test('pastes the item in each locale, counting the values left out once', async () => {
      const result = await paste({
        type: 'hero',
        locale: 'ja',
        values: { en: { title: 'Hello', extra: 1 }, ja: { title: 'こんにちは', extra: 1 } },
      });

      expect(result?.items.en.title).toBe('Hello');
      expect(result?.items.ja.title).toBe('こんにちは');
      expect(result?.droppedCount).toBe(1);

      draft.currentValues = { de: {}, ja: {} };

      // A locale the item doesn’t have gets the values of the locale it was copied in
      expect(
        (await paste({ type: 'hero', locale: 'ja', values: { ja: { title: 'a' } } }))?.items,
      ).toEqual({
        de: expect.objectContaining({ title: 'a' }),
        ja: expect.objectContaining({ title: 'a' }),
      });
    });

    test('fills in the default values of a rich text editor component in any locale', async () => {
      /** @type {ComplexListField} */
      const fieldConfig = {
        name: 'items',
        widget: 'list',
        fields: [
          { name: 'title', widget: 'string' },
          { name: 'kind', widget: 'string', i18n: false, default: 'a' },
        ],
      };

      const args = {
        draft,
        copied: { data: createData({ values: { en: { title: 'a' } } }), files: new Map() },
        fieldConfig,
        typedKeyPath: 'items',
      };

      const inComponent = await prepareListItemPaste({ ...args, inEditorComponent: true });
      const inEntry = await prepareListItemPaste(args);

      expect(inComponent?.items.ja).toEqual({ title: 'a', kind: 'a' });
      expect(inEntry?.items.ja).not.toEqual(inComponent?.items.ja);
    });

    test('pastes an item into another value store', async () => {
      draft.extraValues = { en: {} };

      const result = await prepareListItemPaste({
        draft,
        valueStoreKey: 'extraValues',
        copied: { data: createData({ values: { en: { tag: 'a' } } }), files: new Map() },
        fieldConfig: tagsField,
        typedKeyPath: 'tags',
        componentName: 'gallery',
      });

      expect(result?.items).toEqual({ en: 'a' });
    });
  });

  describe('rewrites the references to the assets', () => {
    const asset = { path: 'content/pages/home/hero.jpg', name: 'hero.jpg' };

    beforeEach(() => {
      mockAllAssets.current = [asset];
    });

    test('rewrites a relative path for the entry', async () => {
      mockGetAssetPublicURL.mockReturnValue('../home/hero.jpg');

      const result = await paste({
        type: 'hero',
        values: { en: { image: 'hero.jpg', title: 'hero.jpg' } },
        assets: { en: { 'hero.jpg': asset.path } },
      });

      expect(result?.items.en).toEqual(
        expect.objectContaining({ image: '../home/hero.jpg', title: 'hero.jpg' }),
      );
      expect(result?.missingFileCount).toBe(0);
      expect(mockGetAssetPublicURL).toHaveBeenCalledWith(asset, {
        pathOnly: true,
        allowSpecial: true,
        entry: draft.originalEntry,
        locale: 'en',
      });
    });

    test('leaves a path that still points at the asset', async () => {
      mockGetAssetPublicURL.mockReturnValue('hero.jpg');

      const result = await paste({
        type: 'hero',
        values: { en: { image: 'hero.jpg', gallery: ['/images/a.jpg'] } },
        assets: { en: { 'hero.jpg': asset.path } },
      });

      expect(result?.items.en).toEqual(
        expect.objectContaining({ image: 'hero.jpg', gallery: ['/images/a.jpg'] }),
      );
    });

    test('copies an asset the entry can’t reference as a pending file', async () => {
      mockGetAssetBlob.mockResolvedValue(new Blob(['a'], { type: 'image/jpeg' }));

      const result = await paste({
        type: 'hero',
        values: { en: { image: 'hero.jpg', body: 'Text ![a](hero.jpg) hero.jpg ![b](/b.png)' } },
        assets: { en: { 'hero.jpg': asset.path } },
      });

      const [blobURL] = Object.keys(draft.files);

      expect(result?.items.en).toEqual(
        expect.objectContaining({
          image: blobURL,
          body: `Text ![a](${blobURL}) hero.jpg ![b](/b.png)`,
        }),
      );
      // Copied once
      expect(Object.keys(draft.files)).toHaveLength(1);
      expect(mockGetAssetBlob).toHaveBeenCalledTimes(1);
      expect(draft.files[blobURL]).toEqual({ file: expect.any(File), folder, replace: false });
      expect(draft.files[blobURL].file.name).toBe('hero.jpg');
      expect(result?.missingFileCount).toBe(0);
    });

    test('reuses the copy of an asset pending from an earlier paste', async () => {
      mockGetAssetBlob.mockImplementation(async () => new Blob(['a'], { type: 'image/jpeg' }));

      const data = {
        type: 'hero',
        values: { en: { image: 'hero.jpg' } },
        assets: { en: { 'hero.jpg': asset.path } },
      };

      const first = await paste(data);
      const second = await paste(data);

      expect(Object.keys(draft.files)).toHaveLength(1);
      expect(second?.items.en.image).toBe(first?.items.en.image);
    });

    test('copies an asset embedded in an HTML body as a pending file', async () => {
      mockGetAssetBlob.mockResolvedValue(new Blob(['a'], { type: 'image/jpeg' }));

      const result = await paste({
        type: 'hero',
        values: {
          en: { html: '<p><a href="hero.jpg">hero.jpg</a> <img src="hero.jpg" alt="a"></p>' },
        },
        assets: { en: { 'hero.jpg': asset.path } },
      });

      const [blobURL] = Object.keys(draft.files);

      expect(result?.items.en).toEqual(
        expect.objectContaining({
          // The link to the same file is left alone
          html: `<p><a href="hero.jpg">hero.jpg</a> <img src="${blobURL}" alt="a"></p>`,
        }),
      );
      expect(draft.files[blobURL].file.name).toBe('hero.jpg');
      expect(result?.missingFileCount).toBe(0);
    });

    test('counts the assets that can’t be found or copied', async () => {
      mockGetAssetBlob.mockRejectedValue(new Error('Not found'));

      const result = await paste({
        type: 'hero',
        values: {
          en: { image: 'hero.jpg', body: '![a](gone.jpg)', html: "<img src='lost.jpg'>" },
        },
        assets: {
          en: {
            'hero.jpg': asset.path,
            'gone.jpg': 'content/pages/home/gone.jpg',
            'lost.jpg': 'content/pages/home/lost.jpg',
          },
        },
      });

      expect(result?.items.en).toEqual(
        expect.objectContaining({
          image: 'hero.jpg',
          body: '![a](gone.jpg)',
          // Not even serialized again
          html: "<img src='lost.jpg'>",
        }),
      );
      expect(result?.missingFileCount).toBe(3);
      expect(draft.files).toEqual({});
    });

    test('counts an asset that can’t be copied without a folder', async () => {
      mockGetDefaultAssetFolder.mockReturnValue(undefined);

      const result = await paste({
        type: 'hero',
        values: { en: { image: 'hero.jpg' } },
        assets: { en: { 'hero.jpg': asset.path } },
      });

      expect(result?.missingFileCount).toBe(1);
      expect(mockGetAssetBlob).not.toHaveBeenCalled();
    });

    test('carries over the pending files', async () => {
      const file = new File(['a'], 'new.png');

      draft.files['blob:own'] = { file };

      const result = await paste(
        {
          type: 'hero',
          values: { en: { image: 'blob:copied', gallery: ['blob:own', 'blob:gone'] } },
        },
        { files: new Map([['blob:copied', file]]) },
      );

      const blobURL = /** @type {string} */ (
        Object.keys(draft.files).find((u) => u !== 'blob:own')
      );

      expect(result?.items.en).toEqual(
        expect.objectContaining({ image: blobURL, gallery: ['blob:own', ''] }),
      );
      expect(draft.files[blobURL]).toEqual({ file, folder, replace: false });
      expect(result?.missingFileCount).toBe(1);
    });
  });
});
