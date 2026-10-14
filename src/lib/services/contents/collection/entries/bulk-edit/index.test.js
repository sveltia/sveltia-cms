import { beforeEach, describe, expect, test, vi } from 'vitest';

import { checkForRemoteChanges } from '$lib/services/backends/refresh';
import { saveChanges } from '$lib/services/backends/save';
import { isConfigReadonly } from '$lib/services/config/readonly';
import { contentUpdatesToast } from '$lib/services/contents/collection/data';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { resolveCacheDB } from '$lib/services/contents/draft/save/file-changes';
import { validateAnyField } from '$lib/services/contents/draft/validate/fields';
import { DEFAULT_VALIDITY, finalizeValidity } from '$lib/services/contents/draft/validate/validity';
import { buildEntryUpdateChanges } from '$lib/services/contents/entry/changes';
import { isEntryReadonly } from '$lib/services/contents/entry/readonly';
import { assignAutoNowValues } from '$lib/services/contents/fields/date-time/auto-now';
import { getUnpublishedEntriesByCollection } from '$lib/services/workflow';

import {
  applyBulkEdits,
  buildBulkEditChanges,
  countBulkEdits,
  getBulkEditValue,
  getStoredValue,
  isBulkEditableEntry,
  saveBulkEdits,
  setBulkEditValue,
  validateBulkEdits,
} from '.';

vi.mock('$lib/services/backends/refresh', () => ({
  checkForRemoteChanges: vi.fn(),
}));

vi.mock('$lib/services/backends/save', () => ({
  saveChanges: vi.fn().mockResolvedValue({ commit: {}, savedEntries: [], savedAssets: [] }),
}));

vi.mock('$lib/services/config/readonly', () => ({
  isConfigReadonly: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/collection/data', () => ({
  contentUpdatesToast: { current: null },
  UPDATE_TOAST_DEFAULT_STATE: { count: 0, saved: false, deleted: false },
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  isCollectionIndexFile: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/draft/save/file-changes', () => ({
  resolveCacheDB: vi.fn(() => 'cache-db'),
}));

vi.mock('$lib/services/contents/draft/validate/fields', () => ({
  validateAnyField: vi.fn(),
}));

vi.mock('$lib/services/contents/draft/validate/messages', () => ({
  // List the flags that are set, so a test can tell which constraint failed
  getFieldValidationMessages: vi.fn(({ validity }) =>
    Object.entries(validity)
      .filter(([key, value]) => key !== 'valid' && value)
      .map(([key]) => key),
  ),
}));

vi.mock('$lib/services/contents/entry/changes', () => ({
  buildEntryUpdateChanges: vi.fn(async ({ entry }) => [
    { action: 'update', slug: entry.slug, path: entry.locales._default?.path ?? entry.slug },
  ]),
  createSyntheticDraft: vi.fn(({ collection }) => ({
    collection,
    collectionName: collection.name,
    fields: collection.fields,
    isIndexFile: false,
  })),
}));

vi.mock('$lib/services/contents/entry/readonly', () => ({
  isEntryReadonly: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/fields/date-time/auto-now', () => ({
  // Stand in for the real one, which looks the field up by the collection name: set the `updated`
  // field, which the tests configure with the `auto_now` option, wherever it’s present
  assignAutoNowValues: vi.fn((draft) => {
    Object.values(draft.currentValues).forEach((valueMap) => {
      if ('updated' in valueMap) {
        valueMap.updated = 'NOW';
      }
    });
  }),
}));

vi.mock('$lib/services/workflow', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getUnpublishedEntriesByCollection: vi.fn(() => []),
}));

/**
 * Build a minimal entry collection mock.
 * @param {object} [overrides] Optional overrides.
 * @returns {any} Collection.
 */
const makeCollection = (overrides = {}) => ({
  name: 'posts',
  _type: 'entry',
  bulk_edit: true,
  fields: [
    { name: 'title', widget: 'string' },
    { name: 'slug', widget: 'string', unique: true },
    { name: 'rank', widget: 'number', unique: true },
    { name: 'draft', widget: 'boolean' },
    { name: 'updated', widget: 'datetime', auto_now: true },
  ],
  _i18n: {
    i18nEnabled: false,
    allLocales: ['_default'],
    defaultLocale: '_default',
    structureMap: {},
  },
  ...overrides,
});

/**
 * Build a minimal entry mock.
 * @param {string} id Entry ID.
 * @param {Record<string, any>} content Default-locale content.
 * @param {object} [overrides] Optional overrides.
 * @returns {any} Entry.
 */
const makeEntry = (id, content, overrides = {}) => ({
  id,
  slug: id,
  subPath: id,
  locales: { _default: { slug: id, path: `content/posts/${id}.md`, content } },
  ...overrides,
});

/** A valid validity state. */
const VALID = finalizeValidity({ ...DEFAULT_VALIDITY });

describe('isBulkEditableEntry()', () => {
  beforeEach(() => {
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(isEntryReadonly).mockReturnValue(false);
  });

  test('accepts an entry with content in the default locale', () => {
    expect(isBulkEditableEntry(makeCollection(), makeEntry('a', { title: 'A' }))).toBe(true);
  });

  test('rejects an entry without content in the default locale', () => {
    const collection = makeCollection();

    expect(isBulkEditableEntry(collection, makeEntry('a', /** @type {any} */ (undefined)))).toBe(
      false,
    );
    expect(isBulkEditableEntry(collection, { ...makeEntry('a', {}), locales: {} })).toBe(false);
  });

  test('rejects the index file', () => {
    vi.mocked(isCollectionIndexFile).mockReturnValue(true);
    expect(isBulkEditableEntry(makeCollection(), makeEntry('_index', { title: 'A' }))).toBe(false);
  });

  test('rejects a read-only entry', () => {
    vi.mocked(isEntryReadonly).mockReturnValue(true);
    expect(isBulkEditableEntry(makeCollection(), makeEntry('a', { title: 'A' }))).toBe(false);
  });
});

describe('getStoredValue()', () => {
  test('returns the value in the default locale', () => {
    expect(getStoredValue(makeCollection(), makeEntry('a', { title: 'A' }), 'title')).toBe('A');
  });

  test('returns undefined without the default locale', () => {
    expect(
      getStoredValue(makeCollection(), { ...makeEntry('a', {}), locales: {} }, 'title'),
    ).toBeUndefined();
  });
});

describe('getBulkEditValue()', () => {
  const collection = makeCollection();
  const entry = makeEntry('a', { title: 'A', draft: true });

  test('returns the pending edit', () => {
    expect(
      getBulkEditValue({ collection, entry, keyPath: 'title', edits: { a: { title: 'B' } } }),
    ).toBe('B');
  });

  test('returns a pending edit that clears the value', () => {
    expect(
      getBulkEditValue({ collection, entry, keyPath: 'title', edits: { a: { title: undefined } } }),
    ).toBeUndefined();
  });

  test('returns the stored value without an edit', () => {
    expect(getBulkEditValue({ collection, entry, keyPath: 'title', edits: {} })).toBe('A');
    expect(
      getBulkEditValue({ collection, entry, keyPath: 'draft', edits: { a: { title: 'B' } } }),
    ).toBe(true);
  });
});

describe('setBulkEditValue()', () => {
  const collection = makeCollection();
  const entry = makeEntry('a', { title: 'A', draft: false });

  test('treats a Boolean field without a value as off', () => {
    const unset = makeEntry('b', { title: 'B' });

    expect(
      setBulkEditValue({ collection, entry: unset, keyPath: 'draft', value: false, edits: {} }),
    ).toEqual({});
    expect(
      setBulkEditValue({ collection, entry: unset, keyPath: 'draft', value: true, edits: {} }),
    ).toEqual({ b: { draft: true } });
  });

  test('records an edit without modifying the current edits', () => {
    const edits = { b: { title: 'X' } };
    const updated = setBulkEditValue({ collection, entry, keyPath: 'title', value: 'B', edits });

    expect(updated).toEqual({ a: { title: 'B' }, b: { title: 'X' } });
    expect(edits).toEqual({ b: { title: 'X' } });
  });

  test('replaces an earlier edit of the same field and keeps the other fields', () => {
    const edits = { a: { title: 'B', draft: true } };

    expect(setBulkEditValue({ collection, entry, keyPath: 'title', value: 'C', edits })).toEqual({
      a: { title: 'C', draft: true },
    });
  });

  test('drops an edit that brings the value back to the stored one', () => {
    expect(
      setBulkEditValue({
        collection,
        entry,
        keyPath: 'title',
        value: 'A',
        edits: { a: { title: 'B', draft: true } },
      }),
    ).toEqual({ a: { draft: true } });

    // The entry is left out once it has no edits
    expect(
      setBulkEditValue({
        collection,
        entry,
        keyPath: 'title',
        value: 'A',
        edits: { a: { title: 'B' }, b: { title: 'X' } },
      }),
    ).toEqual({ b: { title: 'X' } });
  });

  test('treats a missing value and an empty one as the same', () => {
    const empty = makeEntry('e', { title: '' });
    const missing = makeEntry('m', {});

    [undefined, null, ''].forEach((value) => {
      expect(
        setBulkEditValue({ collection, entry: empty, keyPath: 'title', value, edits: {} }),
      ).toEqual({});
      expect(
        setBulkEditValue({ collection, entry: missing, keyPath: 'title', value, edits: {} }),
      ).toEqual({});
    });
  });

  test('records clearing a value', () => {
    expect(setBulkEditValue({ collection, entry, keyPath: 'title', value: '', edits: {} })).toEqual(
      { a: { title: '' } },
    );
  });

  test('tells `0` apart from an empty value', () => {
    expect(
      setBulkEditValue({
        collection,
        entry: makeEntry('m', {}),
        keyPath: 'rank',
        value: 0,
        edits: {},
      }),
    ).toEqual({ m: { rank: 0 } });
    expect(
      setBulkEditValue({
        collection,
        entry: makeEntry('m', { rank: 0 }),
        keyPath: 'rank',
        value: '',
        edits: {},
      }),
    ).toEqual({ m: { rank: '' } });
  });
});

describe('countBulkEdits()', () => {
  test('counts the edited fields across the entries', () => {
    expect(countBulkEdits({})).toBe(0);
    expect(countBulkEdits({ a: { title: 'A', draft: true }, b: { title: 'B' } })).toBe(3);
  });
});

describe('applyBulkEdits()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('applies the edits to a copy of the entry and updates the `auto_now` fields', () => {
    const collection = makeCollection();
    const entry = makeEntry('a', { title: 'A', draft: false, updated: 'THEN' });
    const updated = applyBulkEdits({ collection, entry, entryEdits: { title: 'B', draft: true } });

    expect(updated).not.toBe(entry);
    expect(updated.locales._default).toEqual({
      slug: 'a',
      path: 'content/posts/a.md',
      content: { title: 'B', draft: true, updated: 'NOW' },
    });
    expect(entry.locales._default.content).toEqual({ title: 'A', draft: false, updated: 'THEN' });

    expect(assignAutoNowValues).toHaveBeenCalledExactlyOnceWith({
      isNew: false,
      collectionName: 'posts',
      isIndexFile: false,
      currentValues: { _default: { title: 'B', draft: true, updated: 'NOW' } },
    });
  });

  test('writes a duplicated field to every locale with content, and others to the default one', () => {
    const collection = makeCollection({
      fields: [
        { name: 'title', widget: 'string', i18n: true },
        { name: 'draft', widget: 'boolean', i18n: 'duplicate' },
        { name: 'rank', widget: 'number' },
      ],
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'fr', 'de'],
        defaultLocale: 'en',
        structureMap: {},
      },
    });

    const entry = makeEntry(
      'a',
      {},
      {
        locales: {
          en: { slug: 'a', path: 'content/posts/a.en.md', content: { title: 'A', draft: false } },
          fr: { slug: 'a', path: 'content/posts/a.fr.md', content: { title: 'Á', draft: false } },
          de: { slug: 'a', path: 'content/posts/a.de.md', content: undefined },
        },
      },
    );

    const updated = applyBulkEdits({
      collection,
      entry,
      entryEdits: { title: 'B', draft: true, rank: 2, unknown: 'x' },
    });

    expect(updated.locales.en.content).toEqual({ title: 'B', draft: true, rank: 2, unknown: 'x' });
    expect(updated.locales.fr.content).toEqual({ title: 'Á', draft: true });
    // A locale without content is kept as is
    expect(updated.locales.de).toEqual({
      slug: 'a',
      path: 'content/posts/a.de.md',
      content: undefined,
    });
    expect(updated.locales.de).not.toBe(entry.locales.de);
    expect(entry.locales.fr.content).toEqual({ title: 'Á', draft: false });
  });
});

describe('validateBulkEdits()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEntriesByCollection).mockReturnValue([]);
    vi.mocked(getUnpublishedEntriesByCollection).mockReturnValue([]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    // A required field is the only constraint checked here; the uniqueness check is left to the
    // module under test
    vi.mocked(validateAnyField).mockImplementation(({ keyPath, value }) =>
      keyPath === 'title' && !value
        ? finalizeValidity(/** @type {any} */ ({ ...DEFAULT_VALIDITY, valueMissing: true }))
        : VALID,
    );
  });

  test('returns no errors without edits', () => {
    const collection = makeCollection();
    const entries = [makeEntry('a', { title: 'A' })];

    expect(validateBulkEdits({ collection, entries, edits: {} })).toEqual({});
    expect(validateAnyField).not.toHaveBeenCalled();
  });

  test('validates only the edited fields against the edited content', () => {
    const collection = makeCollection();
    const entry = makeEntry('a', { title: 'A', draft: false });

    expect(
      validateBulkEdits({ collection, entries: [entry], edits: { a: { draft: true } } }),
    ).toEqual({});

    expect(validateAnyField).toHaveBeenCalledExactlyOnceWith({
      draft: expect.objectContaining({ collectionName: 'posts', originalEntry: entry }),
      locale: '_default',
      keyPath: 'draft',
      value: true,
      valueMap: { title: 'A', draft: true },
      validities: { _default: {} },
    });
  });

  test('reports the invalid fields', () => {
    const collection = makeCollection();

    vi.mocked(validateAnyField).mockImplementation(({ keyPath }) =>
      keyPath === 'draft'
        ? VALID
        : finalizeValidity(/** @type {any} */ ({ ...DEFAULT_VALIDITY, valueMissing: true })),
    );

    expect(
      validateBulkEdits({
        collection,
        entries: [makeEntry('a', { title: 'A' }), makeEntry('b', { title: 'B' })],
        edits: { a: { title: '', updated: '', draft: true }, b: { draft: true } },
      }),
    ).toEqual({ a: { title: ['valueMissing'], updated: ['valueMissing'] } });
  });

  test('skips a field the validator doesn’t check', () => {
    vi.mocked(validateAnyField).mockReturnValue(undefined);

    expect(
      validateBulkEdits({
        collection: makeCollection(),
        entries: [makeEntry('a', { title: 'A' })],
        edits: { a: { slug: 'x' } },
      }),
    ).toEqual({});
  });

  test('handles an entry without content in the default locale', () => {
    const entry = { ...makeEntry('a', {}), locales: {} };

    expect(
      validateBulkEdits({
        collection: makeCollection(),
        entries: [entry],
        edits: { a: { title: '' } },
      }),
    ).toEqual({ a: { title: ['valueMissing'] } });

    expect(validateAnyField).toHaveBeenCalledWith(
      expect.objectContaining({ valueMap: { title: '' } }),
    );
  });

  test('accepts two entries swapping their unique values', () => {
    const collection = makeCollection();
    const entries = [makeEntry('a', { slug: 'one' }), makeEntry('b', { slug: 'two' })];

    vi.mocked(getEntriesByCollection).mockReturnValue(entries);

    expect(
      validateBulkEdits({
        collection,
        entries,
        edits: { a: { slug: 'two' }, b: { slug: 'one' } },
      }),
    ).toEqual({});
  });

  test('reports two entries given the same unique value', () => {
    const collection = makeCollection();

    const entries = [
      makeEntry('a', { slug: 'one' }),
      makeEntry('b', { slug: 'two' }),
      makeEntry('c', { slug: 'three' }),
    ];

    vi.mocked(getEntriesByCollection).mockReturnValue(entries);

    expect(
      validateBulkEdits({
        collection,
        entries,
        edits: { a: { slug: 'same' }, b: { slug: ' same ' }, c: { slug: 'other' } },
      }),
    ).toEqual({ a: { slug: ['duplicateError'] }, b: { slug: ['duplicateError'] } });
  });

  test('reports a unique value taken by an entry that isn’t edited or shown', () => {
    const collection = makeCollection();
    const shown = [makeEntry('a', { rank: 1 })];

    vi.mocked(getEntriesByCollection).mockReturnValue([...shown, makeEntry('z', { rank: 2 })]);

    // Numbers are compared by their numeric value
    expect(validateBulkEdits({ collection, entries: shown, edits: { a: { rank: '02' } } })).toEqual(
      { a: { rank: ['duplicateError'] } },
    );
  });

  test('keeps the other constraint flags of a unique field', () => {
    const collection = makeCollection();
    const entries = [makeEntry('a', { slug: 'one' }), makeEntry('b', { slug: 'two' })];

    vi.mocked(getEntriesByCollection).mockReturnValue(entries);
    vi.mocked(validateAnyField).mockReturnValue(
      finalizeValidity(
        /** @type {any} */ ({ ...DEFAULT_VALIDITY, patternMismatch: true, duplicateError: true }),
      ),
    );

    // The validator’s own duplicate check is replaced with the batch-aware one
    expect(validateBulkEdits({ collection, entries, edits: { a: { slug: 'three' } } })).toEqual({
      a: { slug: ['patternMismatch'] },
    });
  });

  test('never reports an empty unique value', () => {
    const collection = makeCollection();
    const entries = [makeEntry('a', { slug: 'one' }), makeEntry('b', { slug: 'two' })];

    vi.mocked(getEntriesByCollection).mockReturnValue([...entries, makeEntry('c', {})]);

    expect(
      validateBulkEdits({ collection, entries, edits: { a: { slug: '' }, b: { slug: '  ' } } }),
    ).toEqual({});
  });

  test('counts an entry and its unpublished version once', () => {
    const collection = makeCollection();
    const entries = [makeEntry('a', { slug: 'one' }), makeEntry('b', { slug: 'two' })];

    vi.mocked(getEntriesByCollection).mockReturnValue(entries);
    // The unpublished version of `b` still has the old value, but it’s the same entry
    vi.mocked(getUnpublishedEntriesByCollection).mockReturnValue([
      makeEntry(
        'b-draft',
        { slug: 'two' },
        {
          locales: {
            _default: { slug: 'b', path: 'content/posts/b.md', content: { slug: 'two' } },
          },
        },
      ),
    ]);

    expect(
      validateBulkEdits({ collection, entries, edits: { a: { slug: 'two' }, b: { slug: 'one' } } }),
    ).toEqual({});

    // An unpublished entry that was never published is another entry
    vi.mocked(getUnpublishedEntriesByCollection).mockReturnValue([
      makeEntry('new', { slug: 'three' }),
    ]);

    expect(validateBulkEdits({ collection, entries, edits: { a: { slug: 'three' } } })).toEqual({
      a: { slug: ['duplicateError'] },
    });
  });

  test('counts an entry and its unpublished version renamed by a pull request once', () => {
    const collection = makeCollection();
    const entries = [makeEntry('a', { slug: 'one' }), makeEntry('b', { slug: 'two' })];

    vi.mocked(getEntriesByCollection).mockReturnValue(entries);
    // The pull request moves `b` to another path, which is still where the published version lives
    vi.mocked(getUnpublishedEntriesByCollection).mockReturnValue([
      makeEntry(
        'b-draft',
        { slug: 'two' },
        {
          locales: {
            _default: { slug: 'bee', path: 'content/posts/bee.md', content: { slug: 'two' } },
          },
          workflow: { previousPaths: ['content/posts/b.md'] },
        },
      ),
    ]);

    // Without the rename being matched, `two` would be counted twice
    expect(validateBulkEdits({ collection, entries, edits: { b: { slug: 'two' } } })).toEqual({});
    expect(validateBulkEdits({ collection, entries, edits: { a: { slug: 'two' } } })).toEqual({
      a: { slug: ['duplicateError'] },
    });
  });

  test('tells apart entries stored in the same file by their position', () => {
    const collection = makeCollection();

    /**
     * Build an entry stored in a file with the others.
     * @param {string} id Entry ID.
     * @param {number} arrayIndex Position in the file.
     * @param {string} slug Unique value.
     * @returns {any} Entry.
     */
    const makeArrayEntry = (id, arrayIndex, slug) =>
      makeEntry(
        id,
        { slug },
        {
          arrayIndex,
          locales: { _default: { slug: id, path: 'data/posts.json', content: { slug } } },
        },
      );

    const entries = [makeArrayEntry('a', 0, 'one'), makeArrayEntry('b', 1, 'two')];

    vi.mocked(getEntriesByCollection).mockReturnValue(entries);

    expect(validateBulkEdits({ collection, entries, edits: { a: { slug: 'two' } } })).toEqual({
      a: { slug: ['duplicateError'] },
    });
  });

  test('leaves out the index file and an entry without the default locale', () => {
    const collection = makeCollection();
    const entries = [makeEntry('a', { slug: 'one' })];
    const indexFile = makeEntry('_index', { slug: 'two' });

    vi.mocked(getEntriesByCollection).mockReturnValue([
      ...entries,
      indexFile,
      { ...makeEntry('x', {}), locales: {} },
    ]);
    vi.mocked(isCollectionIndexFile).mockImplementation(
      (_collection, entry) => entry === indexFile,
    );

    expect(validateBulkEdits({ collection, entries, edits: { a: { slug: 'two' } } })).toEqual({});
  });

  test('counts the values of a unique field once per field', () => {
    const collection = makeCollection();
    const entries = [makeEntry('a', { slug: 'one', rank: 1 }), makeEntry('b', { slug: 'two' })];

    vi.mocked(getEntriesByCollection).mockReturnValue(entries);

    expect(
      validateBulkEdits({
        collection,
        entries,
        edits: { a: { slug: 'x', rank: 2 }, b: { slug: 'y', rank: 2 } },
      }),
    ).toEqual({ a: { rank: ['duplicateError'] }, b: { rank: ['duplicateError'] } });

    // One pass over the collection for each of the two unique fields
    expect(getEntriesByCollection).toHaveBeenCalledTimes(2);
  });

  test('treats a unique field without a type as a String field', () => {
    const collection = makeCollection({ fields: [{ name: 'slug', unique: true }] });
    const entries = [makeEntry('a', { slug: 'one' }), makeEntry('b', { slug: 'two' })];

    vi.mocked(getEntriesByCollection).mockReturnValue(entries);

    expect(validateBulkEdits({ collection, entries, edits: { a: { slug: 'two' } } })).toEqual({
      a: { slug: ['duplicateError'] },
    });
  });
});

describe('buildBulkEditChanges()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('builds the changes of the edited entries only', async () => {
    const collection = makeCollection();
    const entries = [makeEntry('a', { title: 'A' }), makeEntry('b', { title: 'B' })];

    vi.mocked(getEntriesByCollection).mockReturnValue(entries);

    const { changes, savingEntries } = await buildBulkEditChanges({
      collection,
      entries,
      edits: { b: { title: 'C' } },
    });

    expect(savingEntries).toHaveLength(1);
    expect(savingEntries[0].id).toBe('b');
    expect(savingEntries[0].locales._default.content).toEqual({ title: 'C' });
    expect(changes).toEqual([{ action: 'update', slug: 'b', path: 'content/posts/b.md' }]);
    expect(resolveCacheDB).toHaveBeenCalledOnce();

    expect(buildEntryUpdateChanges).toHaveBeenCalledExactlyOnceWith({
      collection,
      entry: savingEntries[0],
      draft: expect.objectContaining({ collectionName: 'posts' }),
      cacheDB: 'cache-db',
    });
  });

  test('flattens the changes of an entry stored in several files', async () => {
    vi.mocked(buildEntryUpdateChanges).mockResolvedValueOnce(
      /** @type {any} */ ([{ path: 'a.en.md' }, { path: 'a.fr.md' }]),
    );

    const entries = [makeEntry('a', { title: 'A' })];

    vi.mocked(getEntriesByCollection).mockReturnValue(entries);

    const { changes } = await buildBulkEditChanges({
      collection: makeCollection(),
      entries,
      edits: { a: { title: 'B' } },
    });

    expect(changes).toEqual([{ path: 'a.en.md' }, { path: 'a.fr.md' }]);
  });

  test('applies the edits to the entries as they are in the store now', async () => {
    const collection = makeCollection();
    // Someone else has changed another field of `a` since the editor was opened, and deleted `b`
    const snapshot = [makeEntry('a', { title: 'A', rank: 1 }), makeEntry('b', { title: 'B' })];

    vi.mocked(getEntriesByCollection).mockReturnValue([makeEntry('a', { title: 'A', rank: 5 })]);

    const { savingEntries } = await buildBulkEditChanges({
      collection,
      entries: snapshot,
      edits: { a: { title: 'X' }, b: { title: 'Y' } },
    });

    expect(savingEntries).toHaveLength(1);
    expect(savingEntries[0].locales._default.content).toEqual({ title: 'X', rank: 5 });
  });
});

describe('saveBulkEdits()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isConfigReadonly).mockReturnValue(false);
    contentUpdatesToast.current = /** @type {any} */ (null);
  });

  test('saves the edited entries in one commit and shows a toast', async () => {
    const collection = makeCollection();

    const entries = [
      makeEntry('a', { title: 'A' }),
      makeEntry('b', { title: 'B' }),
      makeEntry('c', { title: 'C' }),
    ];

    vi.mocked(getEntriesByCollection).mockReturnValue(entries);

    const count = await saveBulkEdits({
      collection,
      entries,
      edits: { a: { title: 'X' }, c: { title: 'Y' } },
    });

    expect(count).toBe(2);
    expect(isConfigReadonly).toHaveBeenCalledWith({ collection });
    expect(checkForRemoteChanges).toHaveBeenCalledOnce();
    expect(vi.mocked(checkForRemoteChanges).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(buildEntryUpdateChanges).mock.invocationCallOrder[0],
    );

    expect(saveChanges).toHaveBeenCalledExactlyOnceWith({
      changes: [
        { action: 'update', slug: 'a', path: 'content/posts/a.md' },
        { action: 'update', slug: 'c', path: 'content/posts/c.md' },
      ],
      savingEntries: [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'c' })],
      options: { commitType: 'update', collection },
    });

    expect(contentUpdatesToast.current).toEqual({
      count: 2,
      saved: true,
      deleted: false,
    });
  });

  test('saves nothing in a read-only collection', async () => {
    vi.mocked(isConfigReadonly).mockReturnValue(true);

    const count = await saveBulkEdits({
      collection: makeCollection(),
      entries: [makeEntry('a', { title: 'A' })],
      edits: { a: { title: 'X' } },
    });

    expect(count).toBe(0);
    expect(buildEntryUpdateChanges).not.toHaveBeenCalled();
    expect(saveChanges).not.toHaveBeenCalled();
    expect(contentUpdatesToast.current).toBeNull();
  });

  test('saves anyway if the repository can’t be checked for changes', async () => {
    const error = new Error('offline');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const entries = [makeEntry('a', { title: 'A' })];

    vi.mocked(checkForRemoteChanges).mockRejectedValueOnce(error);
    vi.mocked(getEntriesByCollection).mockReturnValue(entries);

    try {
      const count = await saveBulkEdits({
        collection: makeCollection(),
        entries,
        edits: { a: { title: 'X' } },
      });

      expect(count).toBe(1);
      expect(saveChanges).toHaveBeenCalledOnce();
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to check the repository for changes.',
        error,
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  test('saves nothing without changes', async () => {
    const count = await saveBulkEdits({
      collection: makeCollection(),
      entries: [makeEntry('a', { title: 'A' })],
      edits: {},
    });

    expect(count).toBe(0);
    expect(saveChanges).not.toHaveBeenCalled();
    expect(contentUpdatesToast.current).toBeNull();
  });
});
