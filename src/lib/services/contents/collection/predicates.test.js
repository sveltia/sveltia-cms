// @ts-nocheck

import { describe, expect, test } from 'vitest';

import {
  getValidCollectionFiles,
  isArrayFileCollection,
  isEntryCollection,
  isFileCollection,
  isSingletonCollection,
  isValidCollection,
  isValidCollectionFile,
} from '$lib/services/contents/collection/predicates';

describe('isEntryCollection()', () => {
  test('returns true for collection with folder property', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isEntryCollection(collection)).toBe(true);
  });

  test('returns false for collection with files property', () => {
    const collection = {
      name: 'pages',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isEntryCollection(collection)).toBe(false);
  });

  test('returns false for collection with both folder and files', () => {
    const collection = {
      name: 'mixed',
      folder: 'content',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isEntryCollection(collection)).toBe(false);
  });

  test('returns true for collection with the file option', () => {
    const collection = {
      name: 'members',
      file: 'data/members.json',
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isEntryCollection(collection)).toBe(true);
  });

  test('returns false for collection without fields', () => {
    const collection = {
      name: 'invalid',
      folder: 'content/posts',
    };

    expect(isEntryCollection(collection)).toBe(false);
  });
});

describe('isFileCollection()', () => {
  test('returns true for collection with files property', () => {
    const collection = {
      name: 'pages',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isFileCollection(collection)).toBe(true);
  });

  test('returns false for collection with folder property', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isFileCollection(collection)).toBe(false);
  });

  test('returns false for collection without files', () => {
    const collection = {
      name: 'invalid',
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isFileCollection(collection)).toBe(false);
  });
});

describe('isArrayFileCollection()', () => {
  test('returns true for an entry collection storing the entries in one file', () => {
    expect(isArrayFileCollection({ _type: 'entry', _file: { arrayFile: true } })).toBe(true);
  });

  test('returns false for an entry collection storing the entries in a folder', () => {
    expect(isArrayFileCollection({ _type: 'entry', _file: {} })).toBe(false);
  });

  test('returns false for a file collection or no collection', () => {
    expect(isArrayFileCollection({ _type: 'file', _file: { arrayFile: true } })).toBe(false);
    expect(isArrayFileCollection(undefined)).toBe(false);
  });
});

describe('isSingletonCollection()', () => {
  test('returns true for _singletons collection with files', () => {
    const collection = {
      name: '_singletons',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isSingletonCollection(collection)).toBe(true);
  });

  test('returns false for non-singleton file collection', () => {
    const collection = {
      name: 'pages',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isSingletonCollection(collection)).toBe(false);
  });

  test('returns false for entry collection', () => {
    const collection = {
      name: '_singletons',
      folder: 'content',
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isSingletonCollection(collection)).toBe(false);
  });
});

describe('isValidCollection()', () => {
  test('returns true for valid entry collection', () => {
    const collection = {
      name: 'posts',
      folder: 'content/posts',
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isValidCollection(collection)).toBe(true);
  });

  test('returns true for valid file collection', () => {
    const collection = {
      name: 'pages',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isValidCollection(collection)).toBe(true);
  });

  test('returns false for divider', () => {
    const divider = {
      divider: true,
    };

    expect(isValidCollection(divider)).toBe(false);
  });

  test('returns false for hidden collection when visible=true', () => {
    const collection = {
      name: 'hidden',
      folder: 'content/hidden',
      hide: true,
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isValidCollection(collection, { visible: true })).toBe(false);
  });

  test('returns true for hidden collection when visible=false', () => {
    const collection = {
      name: 'hidden',
      folder: 'content/hidden',
      hide: true,
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isValidCollection(collection, { visible: false })).toBe(true);
  });

  test('filters by type=entry', () => {
    const entryCollection = {
      name: 'posts',
      folder: 'content/posts',
      fields: [{ name: 'title', widget: 'string' }],
    };

    const fileCollection = {
      name: 'pages',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isValidCollection(entryCollection, { type: 'entry' })).toBe(true);
    expect(isValidCollection(fileCollection, { type: 'entry' })).toBe(false);
  });

  test('filters by type=file', () => {
    const entryCollection = {
      name: 'posts',
      folder: 'content/posts',
      fields: [{ name: 'title', widget: 'string' }],
    };

    const fileCollection = {
      name: 'pages',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isValidCollection(entryCollection, { type: 'file' })).toBe(false);
    expect(isValidCollection(fileCollection, { type: 'file' })).toBe(true);
  });

  test('filters by type=singleton', () => {
    const singletonCollection = {
      name: '_singletons',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    const regularFileCollection = {
      name: 'pages',
      files: [{ name: 'about', file: 'about.md', fields: [] }],
    };

    expect(isValidCollection(singletonCollection, { type: 'singleton' })).toBe(true);
    expect(isValidCollection(regularFileCollection, { type: 'singleton' })).toBe(false);
  });
});

describe('isValidCollectionFile()', () => {
  test('returns true for valid collection file', () => {
    const validFile = {
      name: 'test-file',
      file: 'test.md',
      fields: [{ name: 'title', widget: 'string' }],
    };

    expect(isValidCollectionFile(validFile)).toBe(true);
  });

  test('returns false for divider', () => {
    const divider = {
      divider: true,
    };

    expect(isValidCollectionFile(divider)).toBe(false);
  });

  test('returns false for file without string file property', () => {
    const invalidFile = {
      name: 'test-file',
      file: 123, // Not a string
      fields: [{ name: 'title', widget: 'string' }],
    };

    // Cast to any to test the type validation
    expect(isValidCollectionFile(/** @type {any} */ (invalidFile))).toBe(false);
  });

  test('returns false for file without fields array', () => {
    const invalidFile = {
      name: 'test-file',
      file: 'test.md',
      fields: 'not-an-array',
    };

    // Cast to any to test the type validation
    expect(isValidCollectionFile(/** @type {any} */ (invalidFile))).toBe(false);
  });

  test('returns false for file without fields', () => {
    const invalidFile = {
      name: 'test-file',
      file: 'test.md',
    };

    // Cast to any to test the type validation
    expect(isValidCollectionFile(/** @type {any} */ (invalidFile))).toBe(false);
  });
});

describe('getValidCollectionFiles()', () => {
  test('filters out dividers and invalid files', () => {
    const files = [
      {
        name: 'valid-file-1',
        file: 'test1.md',
        fields: [{ name: 'title', widget: 'string' }],
      },
      {
        divider: true,
      },
      {
        name: 'valid-file-2',
        file: 'test2.md',
        fields: [{ name: 'content', widget: 'markdown' }],
      },
      {
        name: 'invalid-file',
        file: 123, // Invalid file property
        fields: [{ name: 'title', widget: 'string' }],
      },
    ];

    const validFiles = getValidCollectionFiles(/** @type {any} */ (files));

    expect(validFiles).toHaveLength(2);
    expect(validFiles[0].name).toBe('valid-file-1');
    expect(validFiles[1].name).toBe('valid-file-2');
  });

  test('returns empty array for no valid files', () => {
    const files = [
      { divider: true },
      {
        name: 'invalid-file',
        file: 123,
        fields: 'not-an-array',
      },
    ];

    const validFiles = getValidCollectionFiles(/** @type {any} */ (files));

    expect(validFiles).toHaveLength(0);
  });

  test('returns all files when all are valid', () => {
    const files = [
      {
        name: 'file-1',
        file: 'test1.md',
        fields: [{ name: 'title', widget: 'string' }],
      },
      {
        name: 'file-2',
        file: 'test2.md',
        fields: [{ name: 'content', widget: 'markdown' }],
      },
    ];

    const validFiles = getValidCollectionFiles(files);

    expect(validFiles).toHaveLength(2);
    expect(validFiles).toEqual(files);
  });
});
