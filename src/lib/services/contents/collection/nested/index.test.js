// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { isEntryCollection } from '$lib/services/contents/collection';
import {
  filterNestedEntries,
  getEntryDirPath,
  getMetaPathConfig,
  getNestedConfig,
  getNestedIndexFileName,
  getSharedEntryFileName,
  isDescendantPath,
  isNestedCollection,
  nestedFilterPath,
  usesCustomEntryPath,
} from '$lib/services/contents/collection/nested';

vi.mock('$lib/services/contents/collection', () => ({
  isEntryCollection: vi.fn(),
}));

/**
 * Create an entry with only the properties the nested collection helpers read.
 * @param {string} subPath Entry’s sub path.
 * @returns {any} Entry.
 */
const entry = (subPath) => ({ subPath });

beforeEach(() => {
  vi.mocked(isEntryCollection).mockImplementation(
    (collection) => typeof collection?.folder === 'string' && !Array.isArray(collection?.files),
  );
  nestedFilterPath.set('');
});

describe('getNestedConfig()', () => {
  test('returns undefined for a file collection', () => {
    expect(getNestedConfig({ name: 'pages', files: [], nested: { depth: 3 } })).toBeUndefined();
  });

  test('returns undefined when the `nested` option is missing', () => {
    expect(getNestedConfig({ name: 'pages', folder: 'content/pages' })).toBeUndefined();
  });

  test('returns undefined when the `nested` option is not an object', () => {
    expect(
      getNestedConfig({ name: 'pages', folder: 'content/pages', nested: true }),
    ).toBeUndefined();
  });

  test('applies the defaults', () => {
    expect(getNestedConfig({ name: 'pages', folder: 'content/pages', nested: {} })).toEqual({
      depth: Infinity,
      summary: undefined,
      subfolders: true,
    });
  });

  test('normalizes the configured options', () => {
    expect(
      getNestedConfig({
        name: 'pages',
        folder: 'content/pages',
        nested: { depth: 3.8, summary: '{{title}}', subfolders: false },
      }),
    ).toEqual({ depth: 3, summary: '{{title}}', subfolders: false });
  });

  test('ignores an invalid depth and a blank summary', () => {
    expect(
      getNestedConfig({
        name: 'pages',
        folder: 'content/pages',
        nested: { depth: 0, summary: '  ' },
      }),
    ).toEqual({ depth: Infinity, summary: undefined, subfolders: true });
  });
});

describe('isNestedCollection()', () => {
  test('returns true only for a nested entry collection', () => {
    expect(isNestedCollection({ name: 'pages', folder: 'content/pages', nested: {} })).toBe(true);
    expect(isNestedCollection({ name: 'pages', folder: 'content/pages' })).toBe(false);
  });
});

describe('getMetaPathConfig()', () => {
  test('returns undefined for a file collection', () => {
    expect(
      getMetaPathConfig({ name: 'pages', files: [], nested: {}, meta: { path: {} } }),
    ).toBeUndefined();
  });

  test('returns undefined when the `meta.path` option is missing', () => {
    expect(
      getMetaPathConfig({ name: 'pages', folder: 'content/pages', nested: {} }),
    ).toBeUndefined();
    expect(
      getMetaPathConfig({ name: 'pages', folder: 'content/pages', nested: {}, meta: {} }),
    ).toBeUndefined();
  });

  test('returns undefined when the `meta.path` option is not an object', () => {
    expect(
      getMetaPathConfig({
        name: 'pages',
        folder: 'content/pages',
        nested: {},
        meta: { path: 'string' },
      }),
    ).toBeUndefined();
  });

  test('returns undefined without the `nested` option, which has no hierarchy to place entries in', () => {
    expect(
      getMetaPathConfig({
        name: 'pages',
        folder: 'content/pages',
        meta: { path: { widget: 'string', index_file: '_index' } },
      }),
    ).toBeUndefined();
  });

  test('normalizes the configured options, ignoring the widget and label', () => {
    expect(
      getMetaPathConfig({
        name: 'pages',
        folder: 'content/pages',
        nested: {},
        meta: { path: { widget: 'parent', label: 'Parent', index_file: '/_index/' } },
      }),
    ).toEqual({ indexFileName: '_index' });
  });

  test('drops a file extension from the index file name', () => {
    // `index_file: index.md` would otherwise save every entry as `index.md.md`
    // @see https://github.com/decaporg/decap-cms/issues/7606
    expect(
      getMetaPathConfig({
        name: 'pages',
        folder: 'content/pages',
        nested: {},
        meta: { path: { index_file: 'index.md' } },
      })?.indexFileName,
    ).toBe('index');

    expect(
      getMetaPathConfig({
        name: 'pages',
        folder: 'content/pages',
        nested: {},
        meta: { path: { index_file: 'index.yaml' } },
      })?.indexFileName,
    ).toBe('index');
  });

  test('keeps a dot that is not a file extension', () => {
    expect(
      getMetaPathConfig({
        name: 'pages',
        folder: 'content/pages',
        nested: {},
        meta: { path: { index_file: '_index.en' } },
      })?.indexFileName,
    ).toBe('_index.en');
  });

  test('ignores a blank index file name', () => {
    expect(
      getMetaPathConfig({
        name: 'pages',
        folder: 'content/pages',
        nested: {},
        meta: { path: { index_file: ' ' } },
      }),
    ).toEqual({ indexFileName: undefined });
  });
});

describe('getNestedIndexFileName()', () => {
  test('returns the shared file name of a nested collection', () => {
    expect(
      getNestedIndexFileName({
        name: 'pages',
        folder: 'content/pages',
        nested: {},
        meta: { path: { index_file: '_index' } },
      }),
    ).toBe('_index');
  });

  test('returns undefined when the collection is not nested', () => {
    expect(
      getNestedIndexFileName({
        name: 'pages',
        folder: 'content/pages',
        meta: { path: { index_file: '_index' } },
      }),
    ).toBeUndefined();
  });
});

describe('getSharedEntryFileName()', () => {
  test('returns the file name every entry is saved as in the subfolders mode', () => {
    expect(
      getSharedEntryFileName({
        name: 'pages',
        folder: 'content/pages',
        nested: {},
        meta: { path: { index_file: '_index' } },
      }),
    ).toBe('_index');
  });

  test('returns undefined without the subfolders mode, where entries keep their own names', () => {
    // @see https://github.com/decaporg/decap-cms/issues/7606
    expect(
      getSharedEntryFileName({
        name: 'pages',
        folder: 'content/pages',
        nested: { subfolders: false },
        meta: { path: { index_file: 'index' } },
      }),
    ).toBeUndefined();
  });

  test('returns undefined for a collection with the path editor but no nesting', () => {
    expect(
      getSharedEntryFileName({
        name: 'pages',
        folder: 'content/pages',
        meta: { path: { index_file: 'index' } },
      }),
    ).toBeUndefined();
  });
});

describe('usesCustomEntryPath()', () => {
  /** @type {any} */
  const collection = {
    name: 'pages',
    folder: 'content/pages',
    nested: {},
    meta: { path: { widget: 'string', index_file: '_index' } },
  };

  test('returns false when the path editor is disabled', () => {
    expect(usesCustomEntryPath({ collection, currentPath: undefined })).toBe(false);
  });

  test('returns true for a chosen folder', () => {
    expect(usesCustomEntryPath({ collection, isNew: false, currentPath: 'docs' })).toBe(true);
  });

  test('returns true when a folder that was set has been cleared', () => {
    expect(
      usesCustomEntryPath({ collection, isNew: false, originalPath: 'docs', currentPath: '' }),
    ).toBe(true);
  });

  test('returns false for an existing entry that has always been in the collection folder', () => {
    expect(
      usesCustomEntryPath({ collection, isNew: false, originalPath: '', currentPath: '' }),
    ).toBe(false);
    // An entry drafted before the folder was known has no original folder to compare against
    expect(usesCustomEntryPath({ collection, isNew: false, currentPath: '' })).toBe(false);
  });

  test('returns true for a new entry that gets a folder of its own', () => {
    // The chosen folder is where the entry is created, so even the collection folder is a choice
    expect(
      usesCustomEntryPath({ collection, isNew: true, originalPath: '', currentPath: '' }),
    ).toBe(true);
  });

  test('returns false for a new entry in a collection without a shared file name', () => {
    /** @type {any} */
    const flatCollection = {
      ...collection,
      nested: { subfolders: false },
    };

    expect(
      usesCustomEntryPath({
        collection: flatCollection,
        isNew: true,
        originalPath: '',
        currentPath: '',
      }),
    ).toBe(false);
  });
});

describe('getEntryDirPath()', () => {
  test('returns the folder of an entry', () => {
    expect(getEntryDirPath('about/_index')).toBe('about');
    expect(getEntryDirPath('a/b/c/_index')).toBe('a/b/c');
  });

  test('returns an empty string for an entry in the collection folder', () => {
    expect(getEntryDirPath('_index')).toBe('');
  });
});

describe('isDescendantPath()', () => {
  test('matches everything at the root', () => {
    expect(isDescendantPath('', 'a/b')).toBe(true);
  });

  test('matches a descendant only', () => {
    expect(isDescendantPath('a', 'a/b')).toBe(true);
    expect(isDescendantPath('a', 'ab/c')).toBe(false);
    expect(isDescendantPath('a', 'a')).toBe(false);
  });
});

describe('filterNestedEntries()', () => {
  const entries = [
    entry('_index'),
    entry('about/_index'),
    entry('docs/_index'),
    entry('docs/intro/_index'),
    entry('docs/guides/_index'),
    entry('docs/guides/deep/_index'),
  ];

  test('returns the entries as is for a regular collection', () => {
    const collection = { name: 'pages', folder: 'content/pages' };

    expect(filterNestedEntries({ collection, entries, dirPath: 'docs' })).toBe(entries);
  });

  describe('with subfolders', () => {
    const collection = { name: 'pages', folder: 'content/pages', nested: {} };

    test('lists the collection’s own index file and the top-level entries at the root', () => {
      expect(
        filterNestedEntries({ collection, entries, dirPath: '' }).map(({ subPath }) => subPath),
      ).toEqual(['_index', 'about/_index', 'docs/_index']);
    });

    test('lists the immediate children of a folder', () => {
      expect(
        filterNestedEntries({ collection, entries, dirPath: 'docs' }).map(({ subPath }) => subPath),
      ).toEqual(['docs/intro/_index', 'docs/guides/_index']);
    });

    test('accepts a path with slashes around it', () => {
      expect(
        filterNestedEntries({ collection, entries, dirPath: '/docs/' }).map(
          ({ subPath }) => subPath,
        ),
      ).toEqual(['docs/intro/_index', 'docs/guides/_index']);
    });
  });

  describe('without subfolders', () => {
    const collection = {
      name: 'pages',
      folder: 'content/pages',
      nested: { subfolders: false },
    };

    const flatEntries = [entry('about'), entry('docs/intro'), entry('docs/guides/deep')];

    test('lists the files directly in the root folder', () => {
      expect(
        filterNestedEntries({ collection, entries: flatEntries, dirPath: '' }).map(
          ({ subPath }) => subPath,
        ),
      ).toEqual(['about']);
    });

    test('lists the files directly in a folder', () => {
      expect(
        filterNestedEntries({ collection, entries: flatEntries, dirPath: 'docs' }).map(
          ({ subPath }) => subPath,
        ),
      ).toEqual(['docs/intro']);
    });
  });
});
