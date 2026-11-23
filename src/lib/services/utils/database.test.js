import { IndexedDB } from '@sveltia/utils/storage';
import { describe, expect, test, vi } from 'vitest';

import {
  getRepositoryDatabase,
  readCacheEntries,
  updateCacheEntries,
} from '$lib/services/utils/database';

vi.mock('@sveltia/utils/storage', () => ({ IndexedDB: vi.fn() }));

describe('getRepositoryDatabase()', () => {
  test('opens the store in the repository’s database', () => {
    const db = getRepositoryDatabase({ databaseName: 'github:owner/repo' }, 'file-cache');

    expect(IndexedDB).toHaveBeenCalledWith('github:owner/repo', 'file-cache');
    expect(db).toBeInstanceOf(IndexedDB);
  });

  test('returns undefined without a database name', () => {
    expect(getRepositoryDatabase({ databaseName: '' }, 'file-cache')).toBeUndefined();
    expect(getRepositoryDatabase({}, 'file-cache')).toBeUndefined();
    expect(getRepositoryDatabase(undefined, 'file-cache')).toBeUndefined();
    expect(IndexedDB).not.toHaveBeenCalled();
  });
});

/**
 * Create a mock cache store.
 * @param {[string, any][]} [records] Records in the store.
 * @returns {{ entries: any, saveEntries: any, deleteEntries: any }} Mock store.
 */
const createMockStore = (records = []) => ({
  entries: vi.fn(async () => records),
  saveEntries: vi.fn(async () => {}),
  deleteEntries: vi.fn(async () => {}),
});

/**
 * Cast a mock store to the type the helpers take.
 * @param {ReturnType<typeof createMockStore>} store Mock store.
 * @returns {IndexedDB} Store.
 */
const asStore = (store) => /** @type {any} */ (store);

describe('readCacheEntries()', () => {
  test('reads the records into a map', async () => {
    const store = createMockStore([['a', 1]]);

    expect(await readCacheEntries(asStore(store))).toEqual(new Map([['a', 1]]));
  });

  test('returns an empty map without a store', async () => {
    expect(await readCacheEntries(undefined)).toEqual(new Map());
    expect(await readCacheEntries(null)).toEqual(new Map());
  });

  test('returns an empty map and logs the error if the store can’t be read', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createMockStore();
    const error = new Error('Cannot read');

    store.entries.mockRejectedValue(error);
    expect(await readCacheEntries(asStore(store))).toEqual(new Map());
    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });
});

describe('updateCacheEntries()', () => {
  test('saves the new records and deletes the stale ones', async () => {
    const store = createMockStore();

    await updateCacheEntries(asStore(store), new Map([['a', 1]]), ['b']);
    expect(store.saveEntries).toHaveBeenCalledWith([['a', 1]]);
    expect(store.deleteEntries).toHaveBeenCalledWith(['b']);
  });

  test('writes nothing if there is nothing to save or delete', async () => {
    const store = createMockStore();

    await updateCacheEntries(asStore(store), new Map(), []);
    expect(store.saveEntries).not.toHaveBeenCalled();
    expect(store.deleteEntries).not.toHaveBeenCalled();
  });

  test('does nothing without a store', async () => {
    await expect(
      updateCacheEntries(undefined, new Map([['a', 1]]), ['b']),
    ).resolves.toBeUndefined();
    await expect(updateCacheEntries(null, new Map([['a', 1]]), ['b'])).resolves.toBeUndefined();
  });

  test('logs the error if the store can’t be written', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createMockStore();
    const error = new Error('Cannot write');

    store.saveEntries.mockRejectedValue(error);
    await updateCacheEntries(asStore(store), new Map([['a', 1]]), ['b']);
    expect(store.deleteEntries).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });
});
