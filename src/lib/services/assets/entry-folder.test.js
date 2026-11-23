import { describe, expect, test, vi } from 'vitest';

import {
  getEntryAssetFolderPath,
  getExistingEntryAssetFolderPath,
  getOwnedEntryFolderPath,
} from '$lib/services/assets/entry-folder';
import { getCollection } from '$lib/services/contents/collection';

vi.mock('$lib/services/contents/collection', () => ({ getCollection: vi.fn() }));

describe('Test getOwnedEntryFolderPath()', () => {
  /**
   * Create an entry collection.
   * @param {Record<string, any>} [props] Properties to override.
   * @returns {any} Collection.
   */
  const createCollection = (props = {}) => ({
    name: 'blog',
    folder: 'content/blog',
    fields: [],
    _type: 'entry',
    _file: { basePath: 'content/blog', subPath: undefined },
    ...props,
  });

  test('returns the folder holding an entry file with a fixed name', () => {
    const collection = createCollection({
      _file: { basePath: 'content/blog', subPath: '{{slug}}/index' },
    });

    expect(getOwnedEntryFolderPath(collection, 'content/blog/hello-world/index.md')).toBe(
      'content/blog/hello-world',
    );
  });

  test('returns the folder named after an entry file whose name is the slug', () => {
    const collection = createCollection({
      _file: { basePath: 'content/blog', subPath: '{{year}}/{{month}}/{{slug}}' },
    });

    expect(getOwnedEntryFolderPath(collection, 'content/blog/2025/06/hello-world.md')).toBe(
      'content/blog/2025/06/hello-world',
    );
  });

  test('returns the folder holding the index file of a collection with nested entries', () => {
    const collection = createCollection({
      nested: { depth: 100 },
      meta: { path: { index_file: '_index' } },
    });

    expect(getOwnedEntryFolderPath(collection, 'content/pages/about/_index.md')).toBe(
      'content/pages/about',
    );
    expect(getOwnedEntryFolderPath(collection, 'content/pages/about/_index.fr.md')).toBe(
      'content/pages/about',
    );
    expect(getOwnedEntryFolderPath(collection, 'content/pages/about/notes.md')).toBeUndefined();
  });

  test('returns nothing for an entry sharing the collection folder', () => {
    expect(
      getOwnedEntryFolderPath(createCollection(), 'content/blog/hello-world.md'),
    ).toBeUndefined();
    expect(
      getOwnedEntryFolderPath(
        createCollection({ _file: { basePath: 'content/blog', subPath: '{{slug}}' } }),
        'content/blog/hello-world.md',
      ),
    ).toBeUndefined();
  });

  test('returns nothing for a file collection', () => {
    expect(
      getOwnedEntryFolderPath(/** @type {any} */ ({ _type: 'file' }), 'data/settings.json'),
    ).toBeUndefined();
  });
});

describe('Test getEntryAssetFolderPath()', () => {
  const ownFolderCollection = /** @type {any} */ ({
    name: 'blog',
    _type: 'entry',
    _file: { basePath: 'content/blog', subPath: '{{slug}}/index' },
  });

  const sharedFolderCollection = /** @type {any} */ ({
    name: 'blog',
    _type: 'entry',
    _file: { basePath: 'content/blog', subPath: undefined },
  });

  test('returns the folder the entry occupies', () => {
    expect(
      getEntryAssetFolderPath({
        collection: ownFolderCollection,
        entryFilePath: 'content/blog/hello/index.md',
        internalPath: 'content/blog',
      }),
    ).toBe('content/blog/hello');
  });

  test('returns the folder the entry file is stored in', () => {
    expect(
      getEntryAssetFolderPath({
        collection: sharedFolderCollection,
        entryFilePath: 'content/blog/en/hello.md',
        internalPath: 'content/blog',
      }),
    ).toBe('content/blog/en');
  });

  test('falls back to the internal path for a file at the repository root', () => {
    expect(
      getEntryAssetFolderPath({
        collection: sharedFolderCollection,
        entryFilePath: 'hello.md',
        internalPath: 'content/blog',
      }),
    ).toBe('content/blog');
  });

  test('returns the internal path for a file collection', () => {
    expect(
      getEntryAssetFolderPath({
        collection: /** @type {any} */ ({ name: 'data', _type: 'file' }),
        entryFilePath: 'data/settings.json',
        internalPath: 'static/uploads',
      }),
    ).toBe('static/uploads');
  });
});

describe('Test getExistingEntryAssetFolderPath()', () => {
  const entry = /** @type {any} */ ({
    locales: {
      en: { path: 'content/blog/en/2025/06/hello.md' },
      fr: { path: 'content/blog/fr/2025/06/hello.md' },
    },
  });

  test('returns the folder named after an entry in subfolders', () => {
    vi.mocked(getCollection).mockReturnValue(
      /** @type {any} */ ({
        name: 'blog',
        _type: 'entry',
        _file: { basePath: 'content/blog', subPath: '{{year}}/{{month}}/{{slug}}' },
      }),
    );

    expect(getExistingEntryAssetFolderPath({ entry, collectionName: 'blog' })).toBe(
      'content/blog/en/2025/06/hello',
    );
    expect(getExistingEntryAssetFolderPath({ entry, locale: 'fr', collectionName: 'blog' })).toBe(
      'content/blog/fr/2025/06/hello',
    );
    expect(getCollection).toHaveBeenCalledWith('blog');
  });

  test('returns the folder of the entry file for an entry sharing the collection folder', () => {
    vi.mocked(getCollection).mockReturnValue(
      /** @type {any} */ ({ name: 'blog', _type: 'entry', _file: { basePath: 'content/blog' } }),
    );

    expect(getExistingEntryAssetFolderPath({ entry, collectionName: 'blog' })).toBe(
      'content/blog/en/2025/06',
    );
  });

  test('returns the folder of the entry file without a collection', () => {
    vi.mocked(getCollection).mockReturnValue(undefined);

    expect(getExistingEntryAssetFolderPath({ entry, collectionName: 'missing' })).toBe(
      'content/blog/en/2025/06',
    );
    expect(getExistingEntryAssetFolderPath({ entry })).toBe('content/blog/en/2025/06');
    expect(getCollection).toHaveBeenCalledOnce();
  });

  test('returns the folder of a file collection’s file', () => {
    vi.mocked(getCollection).mockReturnValue(/** @type {any} */ ({ name: 'data', _type: 'file' }));

    expect(
      getExistingEntryAssetFolderPath({
        entry: /** @type {any} */ ({ locales: { _default: { path: 'data/settings.json' } } }),
        collectionName: 'data',
      }),
    ).toBe('data');
  });
});
