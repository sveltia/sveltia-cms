import { describe, expect, test } from 'vitest';

import {
  canDuplicateEntry,
  getRemovalMenuItems,
  getSaveFailure,
} from '$lib/services/contents/editor/toolbar';

describe('canDuplicateEntry', () => {
  /** @type {any} */
  const collection = { _type: 'entry', name: 'posts' };

  const args = {
    collection,
    collectionFile: undefined,
    isIndexFile: false,
    readonly: false,
    creationDisabled: false,
  };

  test('allows duplicating an entry', () => {
    expect(canDuplicateEntry(args)).toBe(true);
    expect(canDuplicateEntry({ ...args, collection: undefined })).toBe(true);
    expect(canDuplicateEntry({ ...args, collection: { ...collection, duplicate: true } })).toBe(
      true,
    );
  });

  test('disallows duplicating an entry that can’t be', () => {
    expect(canDuplicateEntry({ ...args, readonly: true })).toBe(false);
    expect(canDuplicateEntry({ ...args, collectionFile: /** @type {any} */ ({ name: 'a' }) })).toBe(
      false,
    );
    expect(canDuplicateEntry({ ...args, isIndexFile: true })).toBe(false);
    expect(canDuplicateEntry({ ...args, creationDisabled: true })).toBe(false);
    expect(canDuplicateEntry({ ...args, collection: { ...collection, duplicate: false } })).toBe(
      false,
    );
  });

  test('ignores the `duplicate` option of a file collection', () => {
    expect(
      canDuplicateEntry({
        ...args,
        collection: /** @type {any} */ ({ _type: 'file', name: 'pages', duplicate: false }),
      }),
    ).toBe(true);
  });
});

describe('getRemovalMenuItems', () => {
  const args = {
    publishedVersionExists: false,
    canDeleteEntry: true,
    isCollectionFile: false,
    readonly: false,
    locked: false,
  };

  test('offers deleting an entry that has no pull request, or has never been published', () => {
    expect(getRemovalMenuItems(args)).toEqual({ discard: true, delete: false });
  });

  test('offers discarding the changes to, and deleting, a published entry under review', () => {
    expect(getRemovalMenuItems({ ...args, publishedVersionExists: true })).toEqual({
      discard: true,
      delete: true,
    });
  });

  test('only offers discarding the changes when the entry can’t be deleted', () => {
    const published = { ...args, publishedVersionExists: true };

    expect(getRemovalMenuItems({ ...published, canDeleteEntry: false })).toEqual({
      discard: true,
      delete: false,
    });
    expect(getRemovalMenuItems({ ...published, isCollectionFile: true })).toEqual({
      discard: true,
      delete: false,
    });
    expect(getRemovalMenuItems({ ...published, locked: true })).toEqual({
      discard: true,
      delete: false,
    });
  });

  test('offers nothing for an entry that can’t be deleted or discarded', () => {
    expect(getRemovalMenuItems({ ...args, canDeleteEntry: false })).toEqual({
      discard: false,
      delete: false,
    });
    expect(getRemovalMenuItems({ ...args, isCollectionFile: true })).toEqual({
      discard: false,
      delete: false,
    });
    expect(
      getRemovalMenuItems({ ...args, publishedVersionExists: true, readonly: true, locked: true }),
    ).toEqual({ discard: false, delete: false });
  });
});

describe('getSaveFailure', () => {
  test('points out invalid fields', () => {
    expect(getSaveFailure(new Error('validation_failed'))).toEqual({ type: 'validation' });
  });

  test('passes on a conflicting change', () => {
    const conflict = { type: 'modified', canOverwrite: true };

    expect(getSaveFailure(new Error('save_conflict', { cause: conflict }))).toEqual({
      type: 'conflict',
      conflict,
    });
  });

  test('reports the backend’s message', () => {
    expect(getSaveFailure(new Error('saving_failed', { cause: new Error('Not Found') }))).toEqual({
      type: 'error',
      message: 'Not Found',
      unexpected: false,
    });
  });

  test('reports an error without a message, not the `saving_failed` key', () => {
    expect(getSaveFailure(new Error('saving_failed'))).toEqual({
      type: 'error',
      message: '',
      unexpected: false,
    });
    // The cause of a server error without a JSON body, e.g. a gateway’s HTML error page
    expect(getSaveFailure(new Error('saving_failed', { cause: { status: 500 } }))).toEqual({
      type: 'error',
      message: '',
      unexpected: false,
    });
  });

  test('reports an unexpected error without a message', () => {
    expect(getSaveFailure(new Error('Boom'))).toEqual({
      type: 'error',
      message: '',
      unexpected: true,
    });
  });
});
