import { beforeEach, describe, expect, test, vi } from 'vitest';

import { backend } from '$lib/services/backends';
import { allEntries } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import {
  applyArrayFileChanges,
  combineArrayFileChanges,
  createArrayFileEntries,
  getArrayFileCollection,
} from '$lib/services/contents/file/array';
import { arrayFileItems, createArrayItemEntry } from '$lib/services/contents/file/process';
import { getEntryFoldersByPath } from '$lib/services/contents/folders';
import { getRepositoryDatabase } from '$lib/services/utils/database';

/**
 * @import { Entry, FileChange, InternalEntryCollection } from '$lib/types/private';
 */

vi.mock('@sveltia/utils/crypto', () => ({
  generateUUID: vi.fn(() => 'new-uuid'),
}));

vi.mock('$lib/services/backends', () => ({
  backend: { current: undefined },
}));

vi.mock('$lib/services/backends/git/shared/errors', () => ({
  createLocalizedError: vi.fn(
    (/** @type {string} */ message, /** @type {string} */ key) =>
      new Error(message, { cause: new Error(key) }),
  ),
}));

vi.mock('$lib/services/contents', () => ({
  allEntries: { current: [] },
  allEntryFolders: { current: [] },
}));

vi.mock('$lib/services/contents/folders', () => ({
  getEntryFoldersByPath: vi.fn(() => []),
}));

vi.mock('$lib/services/contents/collection', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummaryFromContent: vi.fn(
    (/** @type {Record<string, any>} */ content, /** @type {any} */ { identifierField }) =>
      content[identifierField] ?? '',
  ),
}));

vi.mock('$lib/services/contents/file/format', () => ({
  formatEntryFile: vi.fn(async ({ content }) => JSON.stringify(content)),
}));

vi.mock('$lib/services/utils/database', () => ({
  getRepositoryDatabase: vi.fn(),
}));

const path = 'data/posts.json';

/**
 * Create an entry collection storing all the entries in one file.
 * @param {object} [options] Options.
 * @param {boolean} [options.i18nEnabled] Whether i18n is enabled with the `single_file` structure.
 * @param {boolean} [options.arrayFile] Whether the collection stores all the entries in one file.
 * @returns {InternalEntryCollection} Collection.
 */
const createCollection = ({ i18nEnabled = false, arrayFile = true } = {}) =>
  /** @type {any} */ ({
    name: 'posts',
    _type: 'entry',
    identifier_field: 'title',
    fields: [{ name: 'title' }],
    _file: { arrayFile, format: 'json', extension: 'json' },
    _i18n: {
      i18nEnabled,
      allLocales: i18nEnabled ? ['en', 'fr'] : ['_default'],
      defaultLocale: i18nEnabled ? 'en' : '_default',
      structureMap: { i18nSingleFile: i18nEnabled, i18nSingleFileDefaultRoot: false },
    },
  });

const collection = createCollection();
/**
 * Get the locales of the entry made from an item, as the user has seen it.
 * @param {any} item Item.
 * @param {number} index Position.
 * @returns {any} Locales.
 */
const localesOf = (item, index) => createArrayItemEntry({ collection, item, index, path })?.locales;

beforeEach(() => {
  arrayFileItems.clear();
  allEntries.current = [];
  // @ts-ignore
  backend.current = undefined;
  vi.mocked(getEntryFoldersByPath).mockReturnValue([]);
  vi.mocked(getCollection).mockReturnValue(undefined);
  vi.mocked(getRepositoryDatabase).mockReturnValue(undefined);
});

/**
 * Make the given path the file of the given collection.
 * @param {InternalEntryCollection} [_collection] Collection.
 */
const registerArrayFile = (_collection = collection) => {
  vi.mocked(getEntryFoldersByPath).mockImplementation((_path) =>
    _path === path
      ? [
          /** @type {any} */ ({ collectionName: 'others', fileName: 'other', filePathMap: {} }),
          /** @type {any} */ ({ collectionName: 'posts', filePathMap: { _default: path } }),
        ]
      : [],
  );
  vi.mocked(getCollection).mockReturnValue(_collection);
};

describe('Test getArrayFileCollection()', () => {
  test('returns the collection storing all the entries in the file', () => {
    registerArrayFile();
    expect(getArrayFileCollection(path)).toBe(collection);
    expect(getCollection).toHaveBeenCalledWith('posts');
  });

  test('returns undefined for another file', () => {
    registerArrayFile();
    expect(getArrayFileCollection('posts/hello.md')).toBeUndefined();
  });

  test('returns undefined for a folder without a file path map', () => {
    vi.mocked(getEntryFoldersByPath).mockReturnValue([
      /** @type {any} */ ({ collectionName: 'posts' }),
    ]);
    expect(getArrayFileCollection(path)).toBeUndefined();
    expect(getCollection).not.toHaveBeenCalled();
  });

  test('returns undefined for a collection that doesn’t store all the entries in one file', () => {
    registerArrayFile(createCollection({ arrayFile: false }));
    expect(getArrayFileCollection(path)).toBeUndefined();
  });
});

describe('Test applyArrayFileChanges()', () => {
  const items = [{ title: 'A' }, { title: 'B' }, { title: 'C' }];

  test('updates an item', () => {
    const slots = applyArrayFileChanges({
      collection,
      path,
      items,
      changes: [
        {
          action: 'update',
          path,
          data: JSON.stringify({ title: 'B2' }),
          arrayItem: { index: 1, locales: localesOf(items[1], 1) },
        },
      ],
    });

    expect(slots).toEqual([
      { item: { title: 'A' }, from: 0 },
      { item: { title: 'B2' }, from: 1 },
      { item: { title: 'C' }, from: 2 },
    ]);
  });

  test('appends a new item', () => {
    const slots = applyArrayFileChanges({
      collection,
      path,
      items,
      changes: [{ action: 'create', path, data: JSON.stringify({ title: 'D' }) }],
    });

    expect(slots.at(-1)).toEqual({ item: { title: 'D' } });
    expect(slots).toHaveLength(4);
  });

  test('deletes an item', () => {
    const slots = applyArrayFileChanges({
      collection,
      path,
      items,
      changes: [
        { action: 'delete', path, arrayItem: { index: 0, locales: localesOf(items[0], 0) } },
        // A delete change without an item is ignored
        { action: 'delete', path },
      ],
    });

    expect(slots).toEqual([
      { item: { title: 'B' }, from: 1 },
      { item: { title: 'C' }, from: 2 },
    ]);
  });

  test('reorders the items, leaving an unlisted item where it is', () => {
    const _items = [{ title: 'A' }, 'junk', { title: 'B' }, { title: 'C' }];

    const slots = applyArrayFileChanges({
      collection,
      path,
      items: _items,
      changes: [
        {
          action: 'update',
          path,
          arrayOrder: [
            { index: 3, locales: localesOf(_items[3], 3) },
            { index: 0, locales: localesOf(_items[0], 0) },
            { index: 2 },
          ],
        },
      ],
    });

    expect(slots).toEqual([
      { item: { title: 'C' }, from: 3 },
      { item: 'junk', from: 1 },
      { item: { title: 'A' }, from: 0 },
      { item: { title: 'B' }, from: 2 },
    ]);
  });

  test('updates an item that has been moved in the same batch', () => {
    const slots = applyArrayFileChanges({
      collection,
      path,
      items,
      changes: [
        { action: 'update', path, arrayOrder: [{ index: 1 }, { index: 0 }] },
        {
          action: 'update',
          path,
          data: JSON.stringify({ title: 'A2' }),
          arrayItem: { index: 0, locales: localesOf(items[0], 0) },
        },
      ],
    });

    expect(slots).toEqual([
      { item: { title: 'B' }, from: 1 },
      { item: { title: 'A2' }, from: 0 },
      { item: { title: 'C' }, from: 2 },
    ]);
  });

  test('skips the check when the locales are not given', () => {
    const slots = applyArrayFileChanges({
      collection,
      path,
      items,
      changes: [
        { action: 'update', path, data: JSON.stringify({ title: 'X' }), arrayItem: { index: 2 } },
      ],
    });

    expect(slots[2]).toEqual({ item: { title: 'X' }, from: 2 });
  });

  test('throws when the item has been changed', () => {
    expect(() =>
      applyArrayFileChanges({
        collection,
        path,
        items,
        changes: [
          {
            action: 'update',
            path,
            data: JSON.stringify({ title: 'X' }),
            arrayItem: { index: 1, locales: localesOf({ title: 'Old' }, 1) },
          },
        ],
      }),
    ).toThrow(
      expect.objectContaining({
        message: `The item at 1 in ${path} has been changed since it was loaded.`,
        cause: new Error('save_conflict.array_item_changed'),
      }),
    );
  });

  test('throws when the item is no longer an entry', () => {
    expect(() =>
      applyArrayFileChanges({
        collection,
        path,
        items: ['junk'],
        changes: [
          { action: 'delete', path, arrayItem: { index: 0, locales: localesOf(items[0], 0) } },
        ],
      }),
    ).toThrow('The item at 0');
  });

  test('throws when the index is out of range', () => {
    expect(() =>
      applyArrayFileChanges({
        collection,
        path,
        items,
        changes: [{ action: 'delete', path, arrayItem: { index: 3 } }],
      }),
    ).toThrow('The item at 3');

    expect(() =>
      applyArrayFileChanges({
        collection,
        path,
        items,
        changes: [{ action: 'update', path, arrayOrder: [{ index: 5 }, { index: 0 }] }],
      }),
    ).toThrow('The item at 5');
  });
});

describe('Test combineArrayFileChanges()', () => {
  /** @type {FileChange} */
  const otherChange = { action: 'create', path: 'posts/other.md', slug: 'other', data: 'text' };

  test('returns the changes as they are when no array file is changed', async () => {
    const changes = [otherChange];

    expect(await combineArrayFileChanges(changes)).toEqual({ changes, arrayFileUpdates: [] });
    expect(getRepositoryDatabase).not.toHaveBeenCalled();
  });

  test('throws when the file doesn’t contain a valid array', async () => {
    registerArrayFile();
    arrayFileItems.set(path, null);

    await expect(
      combineArrayFileChanges([
        { action: 'create', path, slug: '0', data: JSON.stringify({ title: 'A' }) },
      ]),
    ).rejects.toThrow(
      expect.objectContaining({
        message: `${path} can’t be updated, as it doesn’t contain a valid array.`,
        cause: new Error('save_conflict.array_file_invalid'),
      }),
    );
  });

  test('creates a missing file', async () => {
    registerArrayFile();

    const { changes, arrayFileUpdates } = await combineArrayFileChanges([
      { action: 'create', path, slug: '', data: JSON.stringify({ title: 'A' }) },
      otherChange,
      { action: 'create', path, slug: '', data: JSON.stringify({ title: 'B' }) },
    ]);

    expect(changes).toEqual([
      otherChange,
      {
        action: 'create',
        slug: 'A',
        path,
        previousSha: undefined,
        data: JSON.stringify([{ title: 'A' }, { title: 'B' }]),
      },
    ]);
    expect(arrayFileUpdates).toEqual([
      {
        collection,
        path,
        slots: [{ item: { title: 'A' } }, { item: { title: 'B' } }],
        change: changes[1],
      },
    ]);
  });

  test('updates an existing file with the SHA from the file cache', async () => {
    const get = vi.fn(async () => ({ sha: 'abc123' }));

    registerArrayFile();
    arrayFileItems.set(path, [{ title: 'A' }, { title: 'B' }]);
    // @ts-ignore
    backend.current = { repository: { databaseName: 'db' } };
    vi.mocked(getRepositoryDatabase).mockReturnValue(/** @type {any} */ ({ get }));

    const { changes } = await combineArrayFileChanges([
      { action: 'update', path, slug: '1', arrayOrder: [{ index: 1 }, { index: 0 }] },
    ]);

    expect(getRepositoryDatabase).toHaveBeenCalledWith({ databaseName: 'db' }, 'file-cache');
    expect(get).toHaveBeenCalledWith(path);
    expect(changes).toEqual([
      {
        action: 'update',
        slug: 'B',
        path,
        previousSha: 'abc123',
        data: JSON.stringify([{ title: 'B' }, { title: 'A' }]),
      },
    ]);
  });

  test('takes the label of a deleted item from the file', async () => {
    registerArrayFile();
    arrayFileItems.set(path, [{ title: 'A' }, { title: 'B' }]);

    const { changes } = await combineArrayFileChanges([
      { action: 'delete', path, slug: '1', arrayItem: { index: 1 } },
    ]);

    expect(changes[0].slug).toBe('B');
    expect(changes[0].data).toBe(JSON.stringify([{ title: 'A' }]));
  });

  test('falls back to the change slug when the item has no label', async () => {
    registerArrayFile();
    arrayFileItems.set(path, [{ title: '' }, 'junk']);

    expect(
      (
        await combineArrayFileChanges([
          { action: 'delete', path, slug: '0', arrayItem: { index: 0 } },
        ])
      ).changes[0].slug,
    ).toBe('0');

    expect(
      (
        await combineArrayFileChanges([
          { action: 'delete', path, slug: '1', arrayItem: { index: 1 } },
        ])
      ).changes[0].slug,
    ).toBe('1');
  });

  test('falls back to the change slug when the item has no default locale content', async () => {
    registerArrayFile(createCollection({ i18nEnabled: true }));

    const { changes } = await combineArrayFileChanges([
      { action: 'create', path, slug: 'new', data: JSON.stringify({ fr: { title: 'B' } }) },
    ]);

    expect(changes[0].slug).toBe('new');
  });
});

describe('Test createArrayFileEntries()', () => {
  /**
   * Create an entry stored in a file.
   * @param {string} id Entry ID.
   * @param {number | undefined} arrayIndex Position.
   * @param {string} [_path] File path.
   * @returns {Entry} Entry.
   */
  const createEntry = (id, arrayIndex, _path = path) =>
    /** @type {Entry} */ ({
      id,
      slug: String(arrayIndex),
      subPath: String(arrayIndex),
      arrayIndex,
      locales: { _default: { slug: '', path: _path, content: {} } },
    });

  test('creates the entries, carrying over the IDs', () => {
    const savingOld = createEntry('saving-0', 0);
    const savingNew = createEntry('saving-new', undefined);
    const savingElsewhere = createEntry('saving-elsewhere', undefined, 'other.json');

    allEntries.current = [
      createEntry('prev-0', 0),
      createEntry('prev-1', 1),
      createEntry('prev-other', 1, 'other.json'),
      createEntry('prev-folder', undefined),
      /** @type {Entry} */ ({ id: 'prev-no-locale', slug: '', subPath: '', locales: {} }),
    ];

    const meta = { commitDate: new Date(0) };

    const { entries, savedEntries } = createArrayFileEntries({
      arrayFileUpdates: [
        {
          collection,
          path,
          change: { action: 'update', path },
          slots: [
            { item: { title: 'B' }, from: 1 },
            { item: { title: 'A2' }, from: 0 },
            { item: 'junk', from: 2 },
            { item: { title: 'New' } },
            { item: { title: 'Unknown' }, from: 3 },
            { item: { title: 'New2' } },
          ],
        },
      ],
      savingEntries: [savingOld, savingNew, savingElsewhere],
      // @ts-ignore
      meta,
    });

    expect(
      entries.map(({ id, arrayIndex, locales }) => [id, arrayIndex, locales._default.content]),
    ).toEqual([
      ['prev-1', 0, { title: 'B' }],
      ['saving-0', 1, { title: 'A2' }],
      ['saving-new', 3, { title: 'New' }],
      ['new-uuid', 4, { title: 'Unknown' }],
      ['new-uuid', 5, { title: 'New2' }],
    ]);
    expect(entries[0].commitDate).toEqual(new Date(0));
    expect([...savedEntries]).toEqual([
      [savingOld, entries[1]],
      [savingNew, entries[2]],
    ]);
    expect(arrayFileItems.get(path)).toEqual([
      { title: 'B' },
      { title: 'A2' },
      'junk',
      { title: 'New' },
      { title: 'Unknown' },
      { title: 'New2' },
    ]);
  });

  test('returns nothing without updates', () => {
    expect(createArrayFileEntries({ arrayFileUpdates: [], savingEntries: [], meta: {} })).toEqual({
      entries: [],
      savedEntries: new Map(),
    });
  });
});
