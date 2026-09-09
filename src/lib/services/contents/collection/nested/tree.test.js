// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { isEntryCollection } from '$lib/services/contents/collection';
import {
  addFolderToTree,
  findNestedTreeNode,
  getNestedTree,
  getParentFolderTree,
} from '$lib/services/contents/collection/nested/tree';
import { getEntrySummary } from '$lib/services/contents/entry/summary';

vi.mock('$lib/services/contents/collection', () => ({
  isEntryCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummary: vi.fn(),
}));

/**
 * Create an entry with only the properties the tree builder reads.
 * @param {string} subPath Entry’s sub path.
 * @param {string} [title] Title used as the entry summary.
 * @returns {any} Entry.
 */
const entry = (subPath, title) => ({ subPath, title });

beforeEach(() => {
  vi.mocked(isEntryCollection).mockImplementation(
    (collection) => typeof collection?.folder === 'string' && !Array.isArray(collection?.files),
  );
  vi.mocked(getEntrySummary).mockImplementation((_collection, { title }) => title ?? '');
});

describe('getNestedTree()', () => {
  test('returns an empty array for a regular collection', () => {
    const collection = { name: 'pages', folder: 'content/pages' };

    expect(getNestedTree({ collection, entries: [entry('about/_index')] })).toEqual([]);
  });

  describe('with subfolders', () => {
    const collection = { name: 'pages', folder: 'content/pages', nested: {} };

    test('leaves out a folder that holds nothing but its own entry', () => {
      const entries = [entry('_index', 'Home'), entry('about/_index', 'About')];

      expect(getNestedTree({ collection, entries })).toEqual([]);
    });

    test('lists the folders that have a subfolder of their own', () => {
      const entries = [
        entry('_index', 'Home'),
        entry('docs/_index', 'Documentation'),
        entry('docs/intro/_index', 'Introduction'),
      ];

      expect(getNestedTree({ collection, entries })).toEqual([
        { path: 'docs', label: 'Documentation', children: [] },
      ]);
    });

    test('keeps an ancestor that has no entry of its own', () => {
      const entries = [entry('a/b/c/_index', 'Deep')];

      expect(getNestedTree({ collection, entries })).toEqual([
        { path: 'a', label: 'a', children: [{ path: 'a/b', label: 'b', children: [] }] },
      ]);
    });

    test('sorts the folders by label', () => {
      const entries = [
        entry('zebra/_index', 'Alpha'),
        entry('zebra/child/_index', 'Zebra child'),
        entry('alpha/_index', 'Zebra'),
        entry('alpha/child/_index', 'Alpha child'),
      ];

      expect(getNestedTree({ collection, entries }).map(({ path }) => path)).toEqual([
        'zebra',
        'alpha',
      ]);
    });

    test('falls back to the folder name when the entry has no summary', () => {
      const entries = [entry('docs/_index', ''), entry('docs/intro/_index', 'Introduction')];

      expect(getNestedTree({ collection, entries })).toEqual([
        { path: 'docs', label: 'docs', children: [] },
      ]);
    });

    test('passes the `nested.summary` template to the summary formatter', () => {
      const collectionWithSummary = {
        name: 'pages',
        folder: 'content/pages',
        nested: { summary: '{{fields.name}}' },
      };

      const entries = [entry('docs/_index', 'Documentation'), entry('docs/intro/_index', 'Intro')];

      getNestedTree({ collection: collectionWithSummary, entries });

      expect(getEntrySummary).toHaveBeenCalledWith(collectionWithSummary, expect.anything(), {
        useTemplate: true,
        template: '{{fields.name}}',
      });
    });

    test('labels a folder with its configured index file, ignoring the other entries', () => {
      const collectionWithIndexFile = {
        name: 'pages',
        folder: 'content/pages',
        nested: {},
        meta: { path: { index_file: '_index' } },
      };

      const entries = [
        entry('docs/extra', 'Extra'),
        entry('docs/_index', 'Documentation'),
        entry('docs/intro/_index', 'Introduction'),
      ];

      expect(getNestedTree({ collection: collectionWithIndexFile, entries })).toEqual([
        { path: 'docs', label: 'Documentation', children: [] },
      ]);
    });

    test('keeps the index file label when another entry follows it', () => {
      const collectionWithIndexFile = {
        name: 'pages',
        folder: 'content/pages',
        nested: {},
        meta: { path: { index_file: '_index' } },
      };

      const entries = [
        entry('docs/_index', 'Documentation'),
        entry('docs/extra', 'Extra'),
        entry('docs/intro/_index', 'Introduction'),
      ];

      expect(getNestedTree({ collection: collectionWithIndexFile, entries })).toEqual([
        { path: 'docs', label: 'Documentation', children: [] },
      ]);
    });

    test('labels a folder with its index file rather than the first entry it holds', () => {
      // @see https://github.com/decaporg/decap-cms/issues/7651
      const entries = [
        entry('docs/appendix', 'Appendix'),
        entry('docs/index', 'Documentation'),
        entry('docs/intro/index', 'Introduction'),
      ];

      expect(getNestedTree({ collection, entries })).toEqual([
        { path: 'docs', label: 'Documentation', children: [] },
      ]);
    });

    test('falls back to the first entry when no folder holds an index file', () => {
      const entries = [entry('docs/appendix', 'Appendix'), entry('docs/intro/other', 'Other')];

      expect(getNestedTree({ collection, entries })).toEqual([
        { path: 'docs', label: 'Appendix', children: [] },
      ]);
    });

    test('falls back to the folder name when the configured index file is missing', () => {
      const collectionWithIndexFile = {
        name: 'pages',
        folder: 'content/pages',
        nested: {},
        meta: { path: { index_file: '_index' } },
      };

      const entries = [entry('docs/extra', 'Extra'), entry('docs/intro/_index', 'Introduction')];

      expect(getNestedTree({ collection: collectionWithIndexFile, entries })).toEqual([
        { path: 'docs', label: 'docs', children: [] },
      ]);
    });
  });

  describe('without subfolders', () => {
    const collection = {
      name: 'pages',
      folder: 'content/pages',
      nested: { subfolders: false },
    };

    test('lists every folder that holds a file, labelled with the folder name', () => {
      const entries = [entry('about', 'About'), entry('docs/intro', 'Introduction')];

      expect(getNestedTree({ collection, entries })).toEqual([
        { path: 'docs', label: 'docs', children: [] },
      ]);
    });

    test('registers a folder once even when it holds several files', () => {
      const entries = [entry('docs/intro', 'Introduction'), entry('docs/setup', 'Setup')];

      expect(getNestedTree({ collection, entries })).toEqual([
        { path: 'docs', label: 'docs', children: [] },
      ]);
    });

    test('nests the folders', () => {
      const entries = [entry('docs/guides/deep', 'Deep')];

      expect(getNestedTree({ collection, entries })).toEqual([
        {
          path: 'docs',
          label: 'docs',
          children: [{ path: 'docs/guides', label: 'guides', children: [] }],
        },
      ]);
    });
  });
});

describe('getParentFolderTree()', () => {
  const collection = { name: 'pages', folder: 'content/pages', nested: {} };

  test('returns an empty array for a regular collection', () => {
    expect(
      getParentFolderTree({
        collection: { name: 'pages', folder: 'content/pages' },
        entries: [entry('about/_index')],
      }),
    ).toEqual([]);
  });

  test('keeps a folder that holds nothing but its own entry, unlike the sidebar tree', () => {
    const entries = [entry('_index', 'Home'), entry('about/_index', 'About')];

    expect(getNestedTree({ collection, entries })).toEqual([]);
    expect(getParentFolderTree({ collection, entries })).toEqual([
      { path: 'about', label: 'About', children: [] },
    ]);
  });

  test('leaves out the given folder along with everything below it', () => {
    const entries = [
      entry('docs/_index', 'Documentation'),
      entry('docs/intro/_index', 'Introduction'),
      entry('guides/_index', 'Guides'),
    ];

    expect(
      getParentFolderTree({ collection, entries, excludePath: 'docs' }).map(({ path }) => path),
    ).toEqual(['guides']);
  });

  test('keeps the other folders when nothing is excluded', () => {
    const entries = [entry('docs/_index', 'Documentation'), entry('guides/_index', 'Guides')];

    expect(getParentFolderTree({ collection, entries }).map(({ path }) => path)).toEqual([
      'docs',
      'guides',
    ]);
  });
});

describe('findNestedTreeNode()', () => {
  /** @type {any} */
  const nodes = [
    {
      path: 'docs',
      label: 'Documentation',
      children: [{ path: 'docs/intro', label: 'Introduction', children: [] }],
    },
    { path: 'guides', label: 'Guides', children: [] },
  ];

  test('finds a node at the top level', () => {
    expect(findNestedTreeNode(nodes, 'guides')?.label).toBe('Guides');
  });

  test('finds a node further down', () => {
    expect(findNestedTreeNode(nodes, 'docs/intro')?.label).toBe('Introduction');
  });

  test('returns undefined for a folder that isn’t in the tree', () => {
    expect(findNestedTreeNode(nodes, 'missing')).toBeUndefined();
  });
});

describe('addFolderToTree()', () => {
  /**
   * Create a tree node.
   * @param {string} path Folder path.
   * @param {NestedTreeNode[]} [children] Child folders.
   * @returns {NestedTreeNode} Node.
   */
  const node = (path, children = []) => ({
    path,
    label: path.slice(path.lastIndexOf('/') + 1),
    children,
  });

  test('adds a folder at the top level, sorted by label', () => {
    expect(addFolderToTree({ nodes: [node('products')], path: 'guides' })).toEqual([
      node('guides'),
      node('products'),
    ]);
  });

  test('adds a folder below an existing one', () => {
    expect(addFolderToTree({ nodes: [node('products')], path: 'products/hardware' })).toEqual([
      node('products', [node('products/hardware')]),
    ]);
  });

  test('creates the missing folders above the new one', () => {
    expect(addFolderToTree({ nodes: [], path: 'a/b/c' })).toEqual([
      node('a', [node('a/b', [node('a/b/c')])]),
    ]);
  });

  test('keeps the existing folders below an ancestor of the new folder', () => {
    const nodes = [node('products', [node('products/hardware')])];

    expect(addFolderToTree({ nodes, path: 'products/software' })).toEqual([
      node('products', [node('products/hardware'), node('products/software')]),
    ]);
  });

  test('leaves the folders beside an ancestor of the new folder alone', () => {
    const nodes = [node('guides'), node('products', [node('products/hardware')])];

    expect(addFolderToTree({ nodes, path: 'products/software' })).toEqual([
      node('guides'),
      node('products', [node('products/hardware'), node('products/software')]),
    ]);
  });

  test('leaves a folder that’s already there alone', () => {
    const nodes = [node('products', [node('products/hardware')])];

    expect(addFolderToTree({ nodes, path: 'products' })).toEqual(nodes);
  });

  test('leaves the tree alone for the collection folder itself', () => {
    const nodes = [node('products')];

    expect(addFolderToTree({ nodes, path: '' })).toBe(nodes);
    expect(addFolderToTree({ nodes, path: '/' })).toBe(nodes);
  });
});
