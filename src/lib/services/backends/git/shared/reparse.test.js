// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFile } from '$lib/services/contents/collection/files';

import { canMergeFiles, mergeEntries, planEntryReparse } from './reparse';

vi.mock('$lib/services/contents/collection', () => ({ getCollection: vi.fn() }));
vi.mock('$lib/services/contents/collection/files', () => ({ getCollectionFile: vi.fn() }));

/**
 * Create a collection with the given i18n structure.
 * @param {string} [structure] Name of the structure flag to set.
 * @returns {object} Collection.
 */
const createCollection = (structure) => ({
  _i18n: { structureMap: structure ? { [structure]: true } : {} },
});

/**
 * Create an entry file.
 * @param {string} path File path.
 * @param {string} [collectionName] Collection name.
 * @returns {object} File.
 */
const createFile = (path, collectionName = 'posts') => ({
  path,
  sha: `${path}-sha`,
  type: 'entry',
  folder: { collectionName },
});

/**
 * Create an entry made of the given files.
 * @param {string} id Entry ID.
 * @param {Record<string, string>} locales File path for each locale.
 * @returns {object} Entry.
 */
const createEntry = (id, locales) => ({
  id,
  locales: Object.fromEntries(
    Object.entries(locales).map(([locale, path]) => [locale, { path, content: {} }]),
  ),
});

describe('git/shared/reparse', () => {
  beforeEach(() => {
    vi.mocked(getCollection).mockImplementation((name) =>
      name === 'i18n' ? createCollection('i18nMultiFile') : createCollection(),
    );
  });

  describe('canMergeFiles', () => {
    test.each(['i18nMultiFile', 'i18nMultiFolder', 'i18nMultiRootFolder'])(
      'returns true for the %s structure',
      (structure) => {
        vi.mocked(getCollection).mockReturnValue(createCollection(structure));

        expect(canMergeFiles({ collectionName: 'posts' })).toBe(true);
      },
    );

    test.each(['i18nSingleFile', 'i18nSingleFileDefaultRoot', undefined])(
      'returns false for the %s structure',
      (structure) => {
        vi.mocked(getCollection).mockReturnValue(createCollection(structure));

        expect(canMergeFiles({ collectionName: 'posts' })).toBe(false);
      },
    );

    test('returns false for an unknown collection', () => {
      vi.mocked(getCollection).mockReturnValue(undefined);

      expect(canMergeFiles({ collectionName: 'missing', fileName: 'about' })).toBe(false);
      expect(getCollectionFile).not.toHaveBeenCalled();
    });

    test('returns false for a collection without i18n options', () => {
      vi.mocked(getCollection).mockReturnValue({});

      expect(canMergeFiles({ collectionName: 'posts' })).toBe(false);
    });

    test('uses the i18n structure of a collection file', () => {
      const collection = createCollection();

      vi.mocked(getCollection).mockReturnValue(collection);
      vi.mocked(getCollectionFile).mockReturnValue(createCollection('i18nMultiFile'));

      expect(canMergeFiles({ collectionName: 'pages', fileName: 'about' })).toBe(true);
      expect(getCollectionFile).toHaveBeenCalledWith(collection, 'about');
    });

    test('falls back to the collection when the collection file is missing', () => {
      vi.mocked(getCollection).mockReturnValue(createCollection('i18nMultiFolder'));
      vi.mocked(getCollectionFile).mockReturnValue(undefined);

      expect(canMergeFiles({ collectionName: 'pages', fileName: 'about' })).toBe(true);
    });
  });

  describe('planEntryReparse', () => {
    /**
     * Get the paths of the files to parse.
     * @param {object} plan Plan.
     * @param {object[]} plan.dirtyFiles Files to parse.
     * @returns {string[]} Paths.
     */
    const getDirtyPaths = ({ dirtyFiles }) => dirtyFiles.map(({ path }) => path);

    test('keeps the entries whose single file hasn’t changed', () => {
      const entryA = createEntry('a', { _default: 'posts/a.md' });
      const entryB = createEntry('b', { _default: 'posts/b.md' });

      const plan = planEntryReparse({
        entryFiles: [createFile('posts/a.md'), createFile('posts/b.md'), createFile('posts/c.md')],
        previous: [entryA, entryB],
        changedPaths: new Set(['posts/b.md', 'posts/c.md']),
      });

      expect([...plan.reusedEntries]).toEqual([['posts/a.md', entryA]]);
      expect(getDirtyPaths(plan)).toEqual(['posts/b.md', 'posts/c.md']);
    });

    test('keeps a single-file i18n entry listing its file under every locale', () => {
      const entry = createEntry('a', { en: 'posts/a.md', fr: 'posts/a.md' });

      const plan = planEntryReparse({
        entryFiles: [createFile('posts/a.md')],
        previous: [entry],
        changedPaths: new Set(),
      });

      expect(plan.reusedEntries.get('posts/a.md')).toBe(entry);
      expect(plan.dirtyFiles).toEqual([]);
    });

    test('parses a file that made no entry, such as one that failed to parse', () => {
      const plan = planEntryReparse({
        entryFiles: [createFile('posts/broken.md')],
        previous: [createEntry('a', { _default: 'posts/a.md' })],
        changedPaths: new Set(),
      });

      expect(getDirtyPaths(plan)).toEqual(['posts/broken.md']);
    });

    test('parses a file claimed by more than one previous entry', () => {
      const plan = planEntryReparse({
        entryFiles: [createFile('posts/a.md')],
        previous: [
          createEntry('a', { _default: 'posts/a.md' }),
          createEntry('a2', { _default: 'posts/a.md' }),
        ],
        changedPaths: new Set(),
      });

      expect(getDirtyPaths(plan)).toEqual(['posts/a.md']);
    });

    test('parses a file whose previous entry is made of other files as well', () => {
      const plan = planEntryReparse({
        entryFiles: [createFile('posts/a.md'), createFile('posts/a.fr.md')],
        previous: [createEntry('a', { en: 'posts/a.md', fr: 'posts/a.fr.md' })],
        changedPaths: new Set(),
      });

      expect(getDirtyPaths(plan)).toEqual(['posts/a.md', 'posts/a.fr.md']);
    });

    test('keeps a multi-file i18n collection whose files are all unchanged', () => {
      const entryA = createEntry('a', { en: 'i18n/en/a.md', fr: 'i18n/fr/a.md' });
      const entryB = createEntry('b', { en: 'i18n/en/b.md' });

      const plan = planEntryReparse({
        entryFiles: [
          createFile('i18n/en/a.md', 'i18n'),
          createFile('i18n/fr/a.md', 'i18n'),
          createFile('i18n/en/b.md', 'i18n'),
          createFile('posts/c.md'),
        ],
        previous: [entryA, entryB],
        changedPaths: new Set(['posts/c.md']),
      });

      expect([...plan.reusedEntries]).toEqual([
        ['i18n/en/a.md', entryA],
        ['i18n/fr/a.md', entryA],
        ['i18n/en/b.md', entryB],
      ]);
      expect(getDirtyPaths(plan)).toEqual(['posts/c.md']);
      // The structure is only looked up once per collection
      expect(getCollection).toHaveBeenCalledTimes(2);
    });

    test('parses a whole multi-file i18n collection when one of its files has changed', () => {
      const plan = planEntryReparse({
        entryFiles: [
          createFile('i18n/en/a.md', 'i18n'),
          createFile('i18n/fr/a.md', 'i18n'),
          createFile('i18n/en/b.md', 'i18n'),
          createFile('posts/c.md'),
        ],
        previous: [
          createEntry('a', { en: 'i18n/en/a.md', fr: 'i18n/fr/a.md' }),
          createEntry('b', { en: 'i18n/en/b.md' }),
          createEntry('c', { _default: 'posts/c.md' }),
        ],
        changedPaths: new Set(['i18n/fr/a.md']),
      });

      expect(getDirtyPaths(plan)).toEqual(['i18n/en/a.md', 'i18n/fr/a.md', 'i18n/en/b.md']);
      expect([...plan.reusedEntries.keys()]).toEqual(['posts/c.md']);
    });

    test('parses a whole multi-file i18n collection when a file has been added', () => {
      // `i18n/fr/b.md` could belong to entry `b`
      const plan = planEntryReparse({
        entryFiles: [createFile('i18n/en/b.md', 'i18n'), createFile('i18n/fr/b.md', 'i18n')],
        previous: [createEntry('b', { en: 'i18n/en/b.md' })],
        changedPaths: new Set(['i18n/fr/b.md']),
      });

      expect(getDirtyPaths(plan)).toEqual(['i18n/en/b.md', 'i18n/fr/b.md']);
      expect(plan.reusedEntries.size).toBe(0);
    });

    test('parses a whole multi-file i18n collection when a file has been removed', () => {
      const plan = planEntryReparse({
        entryFiles: [createFile('i18n/en/a.md', 'i18n')],
        previous: [createEntry('a', { en: 'i18n/en/a.md', fr: 'i18n/fr/a.md' })],
        changedPaths: new Set(),
      });

      expect(getDirtyPaths(plan)).toEqual(['i18n/en/a.md']);
    });
  });

  describe('mergeEntries', () => {
    test('lists the entries in the order of their first file, once each', () => {
      const entryA = createEntry('a', { en: 'i18n/en/a.md', fr: 'i18n/fr/a.md' });
      const entryB = createEntry('b', { _default: 'posts/b.md' });
      const entryC = createEntry('c', { _default: 'posts/c.md' });

      const entries = mergeEntries({
        entryFiles: [
          createFile('posts/b.md'),
          createFile('i18n/en/a.md', 'i18n'),
          createFile('posts/broken.md'),
          createFile('i18n/fr/a.md', 'i18n'),
          createFile('posts/c.md'),
        ],
        reusedEntries: new Map([
          ['i18n/en/a.md', entryA],
          ['i18n/fr/a.md', entryA],
          ['posts/c.md', entryC],
        ]),
        parsedEntries: [entryB],
      });

      expect(entries).toEqual([entryB, entryA, entryC]);
      expect(entries[1]).toBe(entryA);
    });
  });
});
