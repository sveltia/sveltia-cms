// @ts-nocheck

import { IndexedDB, LocalStorage } from '@sveltia/utils/storage';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { clearFileCache, eraseAllData } from '$lib/services/app/cache';
import { backend } from '$lib/services/backends';

vi.mock('$lib/services/backends', () => ({
  backend: { current: null },
  gitBackendServices: { github: {}, gitlab: {}, gitea: {} },
}));

vi.mock('@sveltia/utils/storage', () => ({
  IndexedDB: vi.fn(),
  LocalStorage: { keys: vi.fn(), delete: vi.fn() },
}));

/** @type {import('vitest').Mock} */
let clear;
/** @type {import('vitest').Mock} */
let removeEntry;
/** @type {import('vitest').Mock} */
let databases;
/** @type {import('vitest').Mock} */
let deleteDatabase;
/** @type {string} */
let deleteRequestEvent;

beforeEach(() => {
  backend.current = null;
  clear = vi.fn(async () => undefined);
  // eslint-disable-next-line func-names, prefer-arrow-callback
  IndexedDB.mockImplementation(function () {
    return { clear };
  });
  removeEntry = vi.fn(async () => undefined);
  databases = vi.fn(async () => []);
  deleteRequestEvent = 'onsuccess';

  deleteDatabase = vi.fn(() => {
    const request = {};

    // Fire the event once the caller has attached the handlers
    queueMicrotask(() => request[deleteRequestEvent]?.());

    return request;
  });

  LocalStorage.keys.mockResolvedValue([]);
  LocalStorage.delete.mockResolvedValue(undefined);

  vi.stubGlobal('navigator', {
    storage: { getDirectory: vi.fn(async () => ({ removeEntry })) },
  });

  vi.stubGlobal('indexedDB', { databases, deleteDatabase });
});

describe('clearFileCache()', () => {
  test('clears the cache stores in the backend database', async () => {
    backend.current = { name: 'github', repository: { databaseName: 'github:owner/repo' } };

    await clearFileCache();

    expect(IndexedDB).toHaveBeenCalledTimes(2);
    expect(IndexedDB).toHaveBeenCalledWith('github:owner/repo', 'file-cache');
    expect(IndexedDB).toHaveBeenCalledWith('github:owner/repo', 'asset-thumbnails');
    expect(clear).toHaveBeenCalledTimes(2);
    expect(removeEntry).not.toHaveBeenCalled();
  });

  test('does nothing when the backend is not initialized', async () => {
    await clearFileCache();

    expect(IndexedDB).not.toHaveBeenCalled();
    expect(removeEntry).not.toHaveBeenCalled();
  });

  test('does nothing when the repository has no database name', async () => {
    backend.current = { name: 'github', repository: {} };

    await clearFileCache();

    expect(IndexedDB).not.toHaveBeenCalled();
  });

  test('deletes the OPFS directory with the test backend', async () => {
    backend.current = { name: 'test-repo' };

    await clearFileCache();

    expect(IndexedDB).not.toHaveBeenCalled();
    expect(removeEntry).toHaveBeenCalledWith('sveltia-cms-test', { recursive: true });
  });

  test('ignores an error while deleting the OPFS directory', async () => {
    backend.current = { name: 'test-repo' };
    removeEntry.mockRejectedValue(new Error('Not found'));

    await expect(clearFileCache()).resolves.toBeUndefined();
  });
});

describe('eraseAllData()', () => {
  test('deletes the database, local storage entries and OPFS directory', async () => {
    backend.current = { name: 'github', repository: { databaseName: 'github:owner/repo' } };

    LocalStorage.keys.mockResolvedValue([
      'sveltia-cms.prefs',
      'sveltia-cms.user',
      'decap-cms-user',
      'netlify-cms-user',
      'my-site.cart',
    ]);

    await eraseAllData();

    expect(deleteDatabase).toHaveBeenCalledExactlyOnceWith('github:owner/repo');
    expect(LocalStorage.delete).toHaveBeenCalledTimes(4);
    expect(LocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.prefs');
    expect(LocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.user');
    expect(LocalStorage.delete).toHaveBeenCalledWith('decap-cms-user');
    expect(LocalStorage.delete).toHaveBeenCalledWith('netlify-cms-user');
    // Any entry owned by the site hosting the CMS is left alone
    expect(LocalStorage.delete).not.toHaveBeenCalledWith('my-site.cart');
    expect(removeEntry).toHaveBeenCalledWith('sveltia-cms-test', { recursive: true });
  });

  test('deletes the databases left behind by other repositories', async () => {
    backend.current = { name: 'github', repository: { databaseName: 'github:owner/repo' } };

    databases.mockResolvedValue([
      { name: 'github:owner/repo' },
      { name: 'gitlab:owner/other' },
      { name: 'gitea:owner/another' },
      { name: 'my-site-db' },
      {},
    ]);

    await eraseAllData();

    expect(deleteDatabase).toHaveBeenCalledTimes(3);
    expect(deleteDatabase).toHaveBeenCalledWith('github:owner/repo');
    expect(deleteDatabase).toHaveBeenCalledWith('gitlab:owner/other');
    expect(deleteDatabase).toHaveBeenCalledWith('gitea:owner/another');
    expect(deleteDatabase).not.toHaveBeenCalledWith('my-site-db');
  });

  test('works without a database when the backend has none', async () => {
    backend.current = { name: 'test-repo' };

    await eraseAllData();

    expect(deleteDatabase).not.toHaveBeenCalled();
    expect(removeEntry).toHaveBeenCalledWith('sveltia-cms-test', { recursive: true });
  });

  test('falls back to the current database when enumeration is unavailable', async () => {
    backend.current = { name: 'github', repository: { databaseName: 'github:owner/repo' } };
    vi.stubGlobal('indexedDB', { deleteDatabase });

    await eraseAllData();

    expect(deleteDatabase).toHaveBeenCalledExactlyOnceWith('github:owner/repo');
  });

  test('falls back to the current database when enumeration fails', async () => {
    backend.current = { name: 'github', repository: { databaseName: 'github:owner/repo' } };
    databases.mockRejectedValue(new Error('Denied'));

    await eraseAllData();

    expect(deleteDatabase).toHaveBeenCalledExactlyOnceWith('github:owner/repo');
  });

  test.for(['onerror', 'onblocked'])('resolves on the %s event', async (event) => {
    backend.current = { name: 'github', repository: { databaseName: 'github:owner/repo' } };
    deleteRequestEvent = event;

    await expect(eraseAllData()).resolves.toBeUndefined();
  });

  test('ignores an error while reading the local storage', async () => {
    LocalStorage.keys.mockRejectedValue(new Error('Denied'));

    await expect(eraseAllData()).resolves.toBeUndefined();
    expect(LocalStorage.delete).not.toHaveBeenCalled();
  });
});
