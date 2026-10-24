// @vitest-environment happy-dom
// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getAssetReferences,
  getComparableAssetURL,
  getEntriesByAssets,
  getEntriesByAssetURL,
} from '$lib/services/assets/references';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';

// Mock dependencies
vi.mock('$lib/services/assets/media-field', () => {
  const getMediaFieldSource = vi.fn();

  return {
    getMediaFieldSource,
    // Like the real one, fall back to the field’s own folder when no component folder applies
    getRichTextMediaSource: vi.fn(({ componentNames, ...args }) => getMediaFieldSource(args)),
  };
});

vi.mock('$lib/services/contents/fields/rich-text/options', () => ({
  getEditorComponentNames: vi.fn(() => ['image']),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
}));

vi.mock('$lib/services/contents', () => ({
  allEntries: { current: undefined },
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFilesByEntry: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  isCollectionIndexFile: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/collections', () => ({
  getAssociatedCollections: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(),
  getTypedKeyPath: vi.fn(({ keyPath }) => keyPath.replace(/\.\d+/g, '.*')),
}));

describe('getEntriesByAssetURL()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('finds entries with asset URL', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: { image: 'test.jpg', body: 'Hello world' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'posts',
      _type: 'entry',
    };

    cmsConfig.current = { _baseURL: 'https://example.com' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'test.jpg' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('skips a value whose field is not configured or cannot hold an asset', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: { content: { unknown: 'test.jpg' }, slug: 'test', path: 'posts/test.md' },
        },
      },
    ];

    cmsConfig.current = { _baseURL: 'https://example.com' };
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'posts', _type: 'entry' }]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue(undefined);

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toEqual([]);
    expect(getField).toHaveBeenCalledOnce();

    // A field that is neither a media field nor a rich text field, the widget defaulting to String
    vi.mocked(getField).mockReturnValue({ name: 'unknown' });

    expect(await getEntriesByAssetURL('test.jpg', { entries: mockEntries })).toEqual([]);
  });

  test('returns empty array when no entries match', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: { image: 'other.jpg' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'posts',
      _type: 'entry',
    };

    cmsConfig.current = { _baseURL: 'https://example.com' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'other.jpg' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(0);
  });

  test('handles blob URLs correctly', async () => {
    cmsConfig.current = { _baseURL: 'https://example.com' };

    const result = await getEntriesByAssetURL('blob:test.jpg', { entries: [] });

    expect(result).toHaveLength(0);
  });

  test('handles baseURL replacement', async () => {
    cmsConfig.current = { _baseURL: 'https://example.com/' };

    const result = await getEntriesByAssetURL('https://example.com/test.jpg', { entries: [] });

    expect(result).toHaveLength(0);
  });

  test('skips entries with non-string content values', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {
              image: 'test.jpg',
              count: 42, // Non-string value
              enabled: true, // Non-string value
            },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'posts',
      _type: 'entry',
    };

    cmsConfig.current = { _baseURL: 'https://example.com' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'test.jpg' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('skips entries with empty string content values', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: {
              image: 'test.jpg',
              emptyField: '', // Empty string - should be skipped
              anotherEmpty: '', // Another empty string
            },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'posts',
      _type: 'entry',
    };

    cmsConfig.current = { _baseURL: 'https://example.com' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'test.jpg' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('handles file collections with collectionFiles', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: { image: 'test.jpg' },
            slug: 'test',
            path: 'config/main.yml',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'config',
      _type: 'file',
    };

    const mockCollectionFile = {
      name: 'main',
      file: 'config/main.yml',
    };

    cmsConfig.current = { _baseURL: 'https://example.com' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([mockCollectionFile]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'test.jpg' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('handles multiple locales with different content', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: { image: 'test.jpg', title: 'English title' },
            slug: 'test',
            path: 'posts/test.md',
          },
          ja: {
            content: { image: 'other.jpg', title: '日本語タイトル' },
            slug: 'test',
            path: 'posts/test.ja.md',
          },
        },
      },
    ];

    const mockCollection = {
      name: 'posts',
      _type: 'entry',
    };

    cmsConfig.current = { _baseURL: 'https://example.com' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });
    vi.mocked(getMediaFieldSource).mockReturnValue({ url: 'test.jpg' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('pre-filters fields that cannot contain the asset URL', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            content: { image: 'test.jpg', title: 'My post', body: 'Some long body text' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = { name: 'posts', _type: 'entry' };

    cmsConfig.current = { _baseURL: '' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    // getField should only be called for the 'image' field, not 'title' or 'body'
    expect(vi.mocked(getField)).toHaveBeenCalledTimes(1);
  });

  test('short-circuits after first match when not replacing', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            // Two fields both containing the URL – only the first one should be looked at
            content: { image1: 'test.jpg', image2: 'test.jpg' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = { name: 'posts', _type: 'entry' };

    cmsConfig.current = { _baseURL: '' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });

    const result = await getEntriesByAssetURL('test.jpg', { entries: mockEntries });

    expect(result).toHaveLength(1);
    // Short-circuits after the first matching field, so getField is only called once
    expect(vi.mocked(getField)).toHaveBeenCalledTimes(1);
  });

  test('does not short-circuit when replacing (processes all matching fields)', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const content = { image1: 'test.jpg', image2: 'test.jpg' };

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: { content, slug: 'test', path: 'posts/test.md' },
        },
      },
    ];

    const mockCollection = { name: 'posts', _type: 'entry' };

    cmsConfig.current = { _baseURL: '' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });

    await getEntriesByAssetURL('test.jpg', { entries: mockEntries, newURL: 'new.jpg' });

    // Both matching fields must be processed so both get replaced
    expect(vi.mocked(getField)).toHaveBeenCalledTimes(2);
    // What only depends on the collection and the entry is looked up once for both fields
    expect(vi.mocked(isCollectionIndexFile)).toHaveBeenCalledOnce();
    expect(vi.mocked(getCollectionFilesByEntry)).toHaveBeenCalledOnce();
    expect(content.image1).toBe('new.jpg');
    expect(content.image2).toBe('new.jpg');
  });

  test('skips non-string values that come first (line 206 branch 0)', async () => {
    // When a non-string value is the FIRST key in content, it triggers line 206’s continue
    // before the loop can break early. The numeric `count` key is processed first,
    // which forces `typeof 42 !== 'string'` = true → continue (branch 0).
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            // count (non-string) is inserted FIRST so it’s iterated before image
            content: { count: 42, image: 'target.jpg' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = { name: 'posts', _type: 'entry' };

    cmsConfig.current = { _baseURL: '' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'image', widget: 'image' });

    const result = await getEntriesByAssetURL('target.jpg', { entries: mockEntries });

    // count:42 → continue (line 206 branch 0); image:‘target.jpg’ → found
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('processes a non-matching field before a matching field', async () => {
    // A string field whose value contains the asset URL passes the pre-filter, but nothing matches
    // in a non-asset widget. The second field (image) matches.
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    const mockEntries = [
      {
        id: '1',
        slug: 'test',
        subPath: '',
        locales: {
          en: {
            // description contains the URL but is a string field (not image)
            content: { description: 'See target.jpg for more', image: 'target.jpg' },
            slug: 'test',
            path: 'posts/test.md',
          },
        },
      },
    ];

    const mockCollection = { name: 'posts', _type: 'entry' };

    cmsConfig.current = { _baseURL: '' };
    vi.mocked(getAssociatedCollections).mockReturnValue([mockCollection]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockImplementation(({ keyPath }) => {
      if (keyPath === 'description') return { name: 'description', widget: 'string' };
      if (keyPath === 'image') return { name: 'image', widget: 'image' };

      return undefined;
    });

    const result = await getEntriesByAssetURL('target.jpg', { entries: mockEntries });

    // description → no match (string widget); image → match
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});

describe('getAssetReferences()', () => {
  /**
   * Set the mocks up for a `posts` entry collection whose every field is an Image field.
   * @returns {Promise<{ getField: any, getCollectionFilesByEntry: any }>} Mocks.
   */
  const setup = async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    cmsConfig.current = { _baseURL: '' };
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'posts', _type: 'entry' }]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockImplementation(({ keyPath }) => ({ name: keyPath, widget: 'image' }));

    return { getField, getCollectionFilesByEntry };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('reports every field holding the asset, in every locale', async () => {
    await setup();

    const entry = {
      id: '1',
      slug: 'test',
      subPath: 'test',
      locales: {
        en: { content: { cover: 'a.jpg', 'gallery.0': 'b.jpg', 'gallery.1': 'a.jpg' } },
        fr: { content: { cover: 'a.jpg' } },
      },
    };

    const references = await getAssetReferences([{ url: 'a.jpg' }], { entries: [entry] });

    expect(references).toEqual([
      {
        entry,
        collection: { name: 'posts', _type: 'entry' },
        collectionFile: undefined,
        locale: 'en',
        keyPath: 'cover',
        fieldConfig: { name: 'cover', widget: 'image' },
      },
      expect.objectContaining({ locale: 'en', keyPath: 'gallery.1' }),
      expect.objectContaining({ locale: 'fr', keyPath: 'cover' }),
    ]);
  });

  test('reports nothing when no entry holds the asset', async () => {
    await setup();

    const entry = { id: '1', slug: 'test', subPath: 'test', locales: { en: { content: {} } } };

    expect(await getAssetReferences([{ url: 'a.jpg' }], { entries: [entry] })).toEqual([]);
  });

  test('reports the collection file the field belongs to', async () => {
    const { getCollectionFilesByEntry } = await setup();
    const collectionFile = { name: 'general' };

    vi.mocked(getCollectionFilesByEntry).mockReturnValue([collectionFile]);

    const entry = {
      id: '1',
      slug: 'general',
      subPath: 'general',
      locales: { en: { content: { logo: 'a.jpg' } } },
    };

    const references = await getAssetReferences([{ url: 'a.jpg' }], { entries: [entry] });

    expect(references).toEqual([expect.objectContaining({ collectionFile, keyPath: 'logo' })]);
  });

  test('searches the loaded entries by default', async () => {
    await setup();

    allEntries.current = [
      { id: '1', slug: 'test', subPath: 'test', locales: { en: { content: { cover: 'a.jpg' } } } },
    ];

    expect(await getAssetReferences([{ url: 'a.jpg' }])).toHaveLength(1);
    allEntries.current = undefined;
  });
});

describe('getComparableAssetURL()', () => {
  test('drops the site’s base URL, as a stored value does', () => {
    cmsConfig.current = { _baseURL: 'https://example.com' };
    expect(getComparableAssetURL('https://example.com/uploads/a.jpg')).toBe('/uploads/a.jpg');
    // A blob URL is left alone, even when it’s on the same origin
    expect(getComparableAssetURL('blob:https://example.com/abc')).toBe(
      'blob:https://example.com/abc',
    );
  });

  test('leaves the URL alone without a base URL', () => {
    cmsConfig.current = undefined;
    expect(getComparableAssetURL('/uploads/a.jpg')).toBe('/uploads/a.jpg');
  });
});

describe('getEntriesByAssets()', () => {
  /**
   * Set the mocks up for a `posts` entry collection whose fields are Image fields, except `body`,
   * which is a Markdown field, and `html`, which is a RichText field in the HTML format.
   * @returns {Promise<{ getField: any, getMediaFieldSource: any }>} Mocks.
   */
  const setup = async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');
    const { getMediaFieldSource } = await import('$lib/services/assets/media-field');

    cmsConfig.current = { _baseURL: 'https://example.com' };
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'posts', _type: 'entry' }]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockImplementation(({ keyPath }) =>
      keyPath === 'html'
        ? { name: keyPath, widget: 'richtext', format: 'html' }
        : { name: keyPath, widget: keyPath === 'body' ? 'markdown' : 'image' },
    );

    return { getField, getMediaFieldSource };
  };

  /**
   * Create an entry.
   * @param {string} id ID.
   * @param {Record<string, any>} content Content.
   * @returns {object} Entry.
   */
  const createEntry = (id, content) => ({
    id,
    slug: id,
    subPath: id,
    locales: { en: { slug: id, path: `posts/${id}/index.md`, content } },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('finds the entries holding each target in one pass', async () => {
    const { getField } = await setup();
    const a = createEntry('a', { cover: '/uploads/1.jpg', thumb: '/uploads/2.jpg' });
    const b = createEntry('b', { cover: '/uploads/2.jpg', title: 'Nothing here' });
    const c = createEntry('c', { body: 'Hi ![one](/uploads/1.jpg "One")' });

    const results = await getEntriesByAssets(
      [
        { url: 'https://example.com/uploads/1.jpg' },
        { url: '/uploads/2.jpg' },
        { url: '/uploads/3.jpg' },
      ],
      { entries: [a, b, c] },
    );

    expect(results).toEqual([[a, c], [a, b], []]);
    // Each value that can refer to a target is looked at once, however many targets there are
    expect(getField).toHaveBeenCalledTimes(4);
  });

  test('stops searching an entry once every target has been found in it', async () => {
    const { getField } = await setup();
    const a = createEntry('a', { cover: '/uploads/1.jpg', thumb: '/uploads/1.jpg' });

    expect(await getEntriesByAssets([{ url: '/uploads/1.jpg' }], { entries: [a] })).toEqual([[a]]);
    expect(getField).toHaveBeenCalledTimes(1);
  });

  test('reports an entry for every target sharing a URL', async () => {
    await setup();

    const a = createEntry('a', { cover: '/uploads/1.jpg' });
    const targets = [{ url: '/uploads/1.jpg' }, { url: '/uploads/1.jpg' }];

    expect(await getEntriesByAssets(targets, { entries: [a] })).toEqual([[a], [a]]);
  });

  test('matches an asset without a URL by the asset its references resolve to', async () => {
    const { getMediaFieldSource } = await setup();
    // The asset has never been loaded, so it has no blob URL to compare with
    const asset = { path: 'posts/a/photo.jpg', name: 'photo.jpg' };
    const a = createEntry('a', { cover: 'photo.jpg', body: '![p](photo.jpg) and ![o](other.jpg)' });
    const b = createEntry('b', { cover: 'photo.jpg' });

    vi.mocked(getMediaFieldSource).mockImplementation(({ entry, value }) =>
      entry.id === 'a' && value === 'photo.jpg' ? { asset: { ...asset } } : undefined,
    );

    expect(await getEntriesByAssets([{ asset }], { entries: [a, b] })).toEqual([[a]]);
    expect(getMediaFieldSource).toHaveBeenCalledWith({
      entry: a,
      collectionName: 'posts',
      fileName: undefined,
      typedKeyPath: 'cover',
      locale: 'en',
      value: 'photo.jpg',
      fieldConfig: { name: 'cover', widget: 'image' },
    });
  });

  test('resolves a reference against the field’s own media folder', async () => {
    const { getMediaFieldSource } = await setup();
    const { getTypedKeyPath } = await import('$lib/services/contents/entry/fields');
    const { getRichTextMediaSource } = await import('$lib/services/assets/media-field');

    const { getEditorComponentNames } =
      await import('$lib/services/contents/fields/rich-text/options');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    // An entry-relative collection whose fields have a `media_folder` of their own, like
    // `images1`: a bare file name only resolves to the asset against the field’s folder
    const asset = { path: 'posts/a/images1/photo.jpg', name: 'photo.jpg' };

    const content = {
      'gallery.0.src': 'photo.jpg',
      'gallery.0.type': 'image',
      cover: 'photo.jpg',
      body: '![p](photo.jpg)',
    };

    const a = createEntry('a', content);

    vi.mocked(isCollectionIndexFile).mockReturnValue(true);
    vi.mocked(getMediaFieldSource).mockImplementation(({ typedKeyPath, value }) =>
      ['gallery.*.src', 'body'].includes(typedKeyPath) && value === 'photo.jpg'
        ? { asset }
        : undefined,
    );

    const references = await getAssetReferences([{ asset }], { entries: [a] });

    expect(references.map(({ keyPath }) => keyPath)).toEqual(['gallery.0.src', 'body']);
    // The variable types along the key path are read from the content
    expect(getTypedKeyPath).toHaveBeenCalledWith({
      collectionName: 'posts',
      fileName: undefined,
      keyPath: 'gallery.0.src',
      valueMap: content,
      isIndexFile: true,
    });
    expect(getMediaFieldSource).toHaveBeenCalledWith(
      expect.objectContaining({
        typedKeyPath: 'gallery.*.src',
        fieldConfig: { name: 'gallery.0.src', widget: 'image' },
      }),
    );
    // A media URL in a body is also looked up in the folders of the field’s editor components
    expect(getEditorComponentNames).toHaveBeenCalledWith({ name: 'body', widget: 'markdown' });
    expect(getRichTextMediaSource).toHaveBeenCalledWith({
      entry: a,
      collectionName: 'posts',
      fileName: undefined,
      typedKeyPath: 'body',
      locale: 'en',
      value: 'photo.jpg',
      componentNames: ['image'],
    });
  });

  test('works out the typed key path of a field once, however many media it holds', async () => {
    const { getMediaFieldSource } = await setup();
    const { getTypedKeyPath } = await import('$lib/services/contents/entry/fields');
    const asset = { path: 'posts/a/photo.jpg', name: 'photo.jpg' };
    const a = createEntry('a', { body: '![p](photo.jpg) ![q](other.jpg) ![r](more.jpg)' });

    vi.mocked(getMediaFieldSource).mockReturnValue(undefined);

    expect(await getEntriesByAssets([{ asset }], { entries: [a] })).toEqual([[]]);
    expect(getMediaFieldSource).toHaveBeenCalledTimes(3);
    expect(getTypedKeyPath).toHaveBeenCalledTimes(1);
  });

  test('resolves a reference relative to the entry file of the locale holding it', async () => {
    const { getMediaFieldSource } = await setup();
    // With the `multiple_folders` i18n structure, each locale’s entry file has a folder of its own
    const asset = { path: 'posts/fr/a/photo.jpg', name: 'photo.jpg' };

    const a = {
      id: 'a',
      slug: 'a',
      subPath: 'a',
      locales: {
        en: { slug: 'a', path: 'posts/en/a/index.md', content: { cover: 'photo.jpg' } },
        fr: { slug: 'a', path: 'posts/fr/a/index.md', content: { cover: 'photo.jpg' } },
      },
    };

    vi.mocked(getMediaFieldSource).mockImplementation(({ locale }) =>
      locale === 'fr' ? { asset: { ...asset } } : undefined,
    );

    expect(await getAssetReferences([{ asset }], { entries: [a] })).toEqual([
      expect.objectContaining({ entry: a, locale: 'fr', keyPath: 'cover' }),
    ]);
  });

  test('replaces the references to each target with its own new URL', async () => {
    const { getMediaFieldSource } = await setup();
    const asset = { path: 'posts/a/photo.jpg', name: 'photo.jpg' };

    const content = {
      cover: 'photo.jpg',
      thumb: '/uploads/1.jpg',
      other: '/uploads/9.jpg',
      body: '[link](photo.jpg) ![p](photo.jpg) ![one](/uploads/1.jpg) ![o](other.jpg)',
    };

    const a = createEntry('a', content);

    vi.mocked(getMediaFieldSource).mockImplementation(({ value }) =>
      value === 'photo.jpg' ? { asset } : { url: value },
    );

    const results = await getEntriesByAssets(
      [
        { asset, newURL: 'images/photo.jpg' },
        { url: '/uploads/1.jpg', newURL: '/media/1.jpg' },
      ],
      { entries: [a] },
    );

    expect(results).toEqual([[a], [a]]);
    expect(content).toEqual({
      cover: 'images/photo.jpg',
      thumb: '/media/1.jpg',
      other: '/uploads/9.jpg',
      body: '[link](photo.jpg) ![p](images/photo.jpg) ![one](/media/1.jpg) ![o](other.jpg)',
    });
  });

  test('replaces a reference with the URL a function returns for it', async () => {
    const { getMediaFieldSource } = await setup();
    const asset = { path: 'posts/a/photo.jpg', name: 'photo.jpg' };
    const content = { cover: './photo.jpg', body: '![p](photo.jpg) ![q](sub/photo.jpg)' };
    const a = createEntry('a', content);

    vi.mocked(getMediaFieldSource).mockImplementation(({ value }) =>
      value.endsWith('photo.jpg') ? { asset } : undefined,
    );

    /**
     * Rename the photo, except in a subfolder.
     * @param {string} src Reference.
     * @returns {string | undefined} New reference.
     */
    const newURL = (src) => (src.startsWith('sub/') ? undefined : src.replace('photo', 'image'));

    await getEntriesByAssets([{ asset, newURL }], { entries: [a] });

    // A reference the function gives no URL for is left alone
    expect(content).toEqual({ cover: './image.jpg', body: '![p](image.jpg) ![q](sub/photo.jpg)' });
  });

  test('leaves the references to a target without a new URL alone', async () => {
    await setup();

    const content = {
      cover: '/uploads/1.jpg',
      body: '![one](/uploads/1.jpg) ![two](/uploads/2.jpg)',
    };

    const a = createEntry('a', content);

    await getEntriesByAssets(
      [{ url: '/uploads/1.jpg' }, { url: '/uploads/2.jpg', newURL: '/media/2.jpg' }],
      { entries: [a] },
    );

    expect(content).toEqual({
      cover: '/uploads/1.jpg',
      body: '![one](/uploads/1.jpg) ![two](/media/2.jpg)',
    });
  });

  test('finds and replaces the media URLs in HTML and the raw HTML in Markdown', async () => {
    const { getField } = await setup();

    const content = {
      body: '![a](/uploads/1.jpg)\n\n<video src="/uploads/2.mp4" poster="/uploads/1.jpg"></video>',
      html: [
        '<p><a href="/uploads/1.jpg">/uploads/1.jpg</a>',
        '<img src="/uploads/9.jpg" srcset="/uploads/1.jpg 2x"></p>',
        '<audio><source src="/uploads/2.mp4"></audio>',
      ].join(''),
      other: '<p><img src="/uploads/9.jpg"></p>',
      note: '![x](/uploads/9.jpg)',
    };

    const a = createEntry('a', content);

    const results = await getEntriesByAssets(
      [
        { url: '/uploads/1.jpg', newURL: '/media/1.jpg' },
        { url: '/uploads/2.mp4', newURL: '/media/2.mp4' },
      ],
      { entries: [a] },
    );

    expect(results).toEqual([[a], [a]]);
    expect(content).toEqual({
      body: '![a](/media/1.jpg)\n\n<video src="/media/2.mp4" poster="/media/1.jpg"></video>',
      html: [
        '<p><a href="/uploads/1.jpg">/uploads/1.jpg</a>',
        '<img src="/uploads/9.jpg" srcset="/media/1.jpg 2x"></p>',
        '<audio><source src="/media/2.mp4"></audio>',
      ].join(''),
      other: '<p><img src="/uploads/9.jpg"></p>',
      note: '![x](/uploads/9.jpg)',
    });
    // A value whose media URLs can’t refer to the targets is skipped before the field lookup
    expect(getField).toHaveBeenCalledTimes(2);
  });

  test('reads an HTML value as HTML when looking for references', async () => {
    const { getField } = await setup();
    // In Markdown, the tag would be missed, as the attribute value contains `<`
    const a = createEntry('a', { html: '<img alt="a<b" src="/uploads/1.jpg">' });
    const b = createEntry('b', { html: '<img alt="a<b" src="/uploads/2.jpg">' });

    expect(await getEntriesByAssets([{ url: '/uploads/1.jpg' }], { entries: [a, b] })).toEqual([
      [a],
    ]);
    // The field is only looked up for the value referring to the target
    expect(getField).toHaveBeenCalledTimes(1);
  });

  test('searches the loaded entries by default', async () => {
    await setup();

    allEntries.current = [createEntry('a', { cover: '/uploads/1.jpg' })];
    expect(await getEntriesByAssets([{ url: '/uploads/1.jpg' }])).toEqual([allEntries.current]);
    allEntries.current = undefined;
  });
});

describe('getAssetReferences() with several targets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('reports a field holding several of the targets once', async () => {
    const { getAssociatedCollections } = await import('$lib/services/contents/entry/collections');

    const { isCollectionIndexFile } =
      await import('$lib/services/contents/collection/entries/index-file');

    const { getCollectionFilesByEntry } = await import('$lib/services/contents/collection/files');
    const { getField } = await import('$lib/services/contents/entry/fields');

    cmsConfig.current = { _baseURL: '' };
    vi.mocked(getAssociatedCollections).mockReturnValue([{ name: 'posts', _type: 'entry' }]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(getCollectionFilesByEntry).mockReturnValue([]);
    vi.mocked(getField).mockReturnValue({ name: 'body', widget: 'markdown' });

    const entry = {
      id: '1',
      slug: 'test',
      subPath: 'test',
      locales: { en: { content: { body: '![a](a.jpg) ![b](b.jpg)', title: 'a.jpg' } } },
    };

    const references = await getAssetReferences([{ url: 'a.jpg' }, { url: 'b.jpg' }], {
      entries: [entry],
    });

    expect(references).toEqual([expect.objectContaining({ locale: 'en', keyPath: 'body' })]);
  });
});
