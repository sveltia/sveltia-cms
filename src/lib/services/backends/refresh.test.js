import { beforeEach, describe, expect, test, vi } from 'vitest';

import { allAssets } from '$lib/services/assets';
import { backend } from '$lib/services/backends';
import { repositoryHead } from '$lib/services/backends/git/shared/fetch';
import { allEntries } from '$lib/services/contents';
import { productionSHA } from '$lib/services/deployments';

import { checkForRemoteChanges, diffStores, MIN_CHECK_GAP, suspendChecksWhile } from './refresh';

vi.mock('$lib/services/assets', () => ({ allAssets: { current: [] } }));
vi.mock('$lib/services/backends', () => ({ backend: { current: undefined } }));
vi.mock('$lib/services/backends/git/shared/fetch', () => ({ repositoryHead: { current: '' } }));
vi.mock('$lib/services/contents', () => ({ allEntries: { current: [] } }));
vi.mock('$lib/services/deployments', () => ({ productionSHA: { current: '' } }));

/**
 * Make a minimal entry.
 * @param {string} id Entry ID.
 * @returns {any} Entry.
 */
const makeEntry = (id) => ({ id, locales: { _default: { path: `${id}.md` } } });
/**
 * Make a minimal asset.
 * @param {string} path Asset path.
 * @returns {any} Asset.
 */
const makeAsset = (path) => ({ path });

describe('diffStores', () => {
  test('tells added, modified and deleted entries and assets apart', () => {
    const kept = makeEntry('kept');
    const modifiedBefore = makeEntry('modified');
    const modifiedAfter = makeEntry('modified');
    const deleted = makeEntry('deleted');
    const added = makeEntry('added');
    const keptAsset = makeAsset('kept.png');
    const modifiedAssetBefore = makeAsset('modified.png');
    const modifiedAssetAfter = makeAsset('modified.png');
    const deletedAsset = makeAsset('deleted.png');
    const addedAsset = makeAsset('added.png');

    allEntries.current = [kept, modifiedAfter, added];
    allAssets.current = [keptAsset, modifiedAssetAfter, addedAsset];

    expect(
      diffStores({
        entriesBefore: [kept, modifiedBefore, deleted],
        assetsBefore: [keptAsset, modifiedAssetBefore, deletedAsset],
      }),
    ).toEqual({
      addedEntries: [added],
      modifiedEntries: [modifiedAfter],
      deletedEntries: [deleted],
      addedAssets: [addedAsset],
      modifiedAssets: [modifiedAssetAfter],
      deletedAssets: [deletedAsset],
    });
  });
});

describe('checkForRemoteChanges', () => {
  const fetchLastCommit = vi.fn();
  const fetchFiles = vi.fn();

  beforeEach(() => {
    /** @type {any} */ (backend).current = { fetchLastCommit, fetchFiles };
    repositoryHead.current = 'head-1';
    allEntries.current = [];
    allAssets.current = [];
    fetchLastCommit.mockResolvedValue({ hash: 'head-1', message: '' });
    fetchFiles.mockResolvedValue(undefined);
  });

  test('does nothing for a backend that has no commits to compare', async () => {
    /** @type {any} */ (backend).current = { fetchFiles };

    expect(await checkForRemoteChanges()).toBeUndefined();
    expect(fetchFiles).not.toHaveBeenCalled();
  });

  test('does nothing before the site data has been loaded', async () => {
    repositoryHead.current = '';

    expect(await checkForRemoteChanges()).toBeUndefined();
    expect(fetchLastCommit).not.toHaveBeenCalled();
  });

  test('only asks for the head when the branch hasn’t moved', async () => {
    expect(await checkForRemoteChanges()).toBeUndefined();
    expect(fetchLastCommit).toHaveBeenCalledTimes(1);
    expect(fetchFiles).not.toHaveBeenCalled();
  });

  test('skips a check made in passing right after another, whoever made it', async () => {
    vi.useFakeTimers({ now: 1_000_000 });

    // A save’s check
    await checkForRemoteChanges();
    expect(fetchLastCommit).toHaveBeenCalledTimes(1);

    vi.setSystemTime(1_000_000 + MIN_CHECK_GAP / 2);
    expect(await checkForRemoteChanges({ maxAge: MIN_CHECK_GAP })).toBeUndefined();
    expect(fetchLastCommit).toHaveBeenCalledTimes(1);

    // A save always checks
    await checkForRemoteChanges();
    expect(fetchLastCommit).toHaveBeenCalledTimes(2);

    vi.setSystemTime(1_000_000 + MIN_CHECK_GAP * 2);
    await checkForRemoteChanges({ maxAge: MIN_CHECK_GAP });
    expect(fetchLastCommit).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  test('joins a check in flight rather than skipping it', async () => {
    fetchLastCommit.mockResolvedValue({ hash: 'head-2', message: '' });

    const [a, b] = await Promise.all([
      checkForRemoteChanges(),
      checkForRemoteChanges({ maxAge: MIN_CHECK_GAP }),
    ]);

    expect(a).toBe(b);
    expect(fetchFiles).toHaveBeenCalledTimes(1);
  });

  test('fetches the files and reports what changed when the branch has moved', async () => {
    const kept = makeEntry('kept');
    const before = makeEntry('changed');
    const after = makeEntry('changed');

    allEntries.current = [kept, before];
    fetchLastCommit.mockResolvedValue({ hash: 'head-2', message: '' });
    fetchFiles.mockImplementation(async () => {
      allEntries.current = [kept, after];
    });

    expect(await checkForRemoteChanges()).toEqual({
      addedEntries: [],
      modifiedEntries: [after],
      deletedEntries: [],
      addedAssets: [],
      modifiedAssets: [],
      deletedAssets: [],
    });
  });

  test('reports nothing when the new commit changed nothing the CMS manages', async () => {
    const kept = makeEntry('kept');

    allEntries.current = [kept];
    fetchLastCommit.mockResolvedValue({ hash: 'head-2', message: '' });

    expect(await checkForRemoteChanges()).toBeUndefined();
    expect(fetchFiles).toHaveBeenCalledTimes(1);
  });

  test('tracks the new head as the one the site is built from', async () => {
    productionSHA.current = 'head-1';
    fetchLastCommit.mockResolvedValue({ hash: 'head-2', message: '' });

    await checkForRemoteChanges();
    expect(productionSHA.current).toBe('head-2');
  });

  test('shares one check between callers that overlap', async () => {
    fetchLastCommit.mockResolvedValue({ hash: 'head-2', message: '' });

    const [a, b] = await Promise.all([checkForRemoteChanges(), checkForRemoteChanges()]);

    expect(a).toBe(b);
    expect(fetchLastCommit).toHaveBeenCalledTimes(1);
    expect(fetchFiles).toHaveBeenCalledTimes(1);

    // A later call starts a new one
    await checkForRemoteChanges();
    expect(fetchLastCommit).toHaveBeenCalledTimes(2);
  });

  test('passes a failure on and lets the next call try again', async () => {
    fetchLastCommit.mockRejectedValueOnce(new Error('offline'));

    await expect(checkForRemoteChanges()).rejects.toThrow('offline');
    expect(await checkForRemoteChanges()).toBeUndefined();
    expect(fetchLastCommit).toHaveBeenCalledTimes(2);
  });
});

describe('suspendChecksWhile', () => {
  const fetchLastCommit = vi.fn();
  const fetchFiles = vi.fn();

  beforeEach(() => {
    /** @type {any} */ (backend).current = { fetchLastCommit, fetchFiles };
    repositoryHead.current = 'head-1';
    fetchLastCommit.mockResolvedValue({ hash: 'head-1', message: '' });
  });

  test('runs the commit and returns its result', async () => {
    expect(await suspendChecksWhile(async () => 42)).toBe(42);
  });

  test('skips a check made while the commit is being made, and allows one afterwards', async () => {
    /** @type {any} */
    let duringCommit;

    await suspendChecksWhile(async () => {
      duringCommit = await checkForRemoteChanges();
    });

    expect(duringCommit).toBeUndefined();
    expect(fetchLastCommit).not.toHaveBeenCalled();

    await checkForRemoteChanges();
    expect(fetchLastCommit).toHaveBeenCalledTimes(1);
  });

  test('allows checks again even when the commit fails', async () => {
    await expect(
      suspendChecksWhile(async () => {
        throw new Error('commit failed');
      }),
    ).rejects.toThrow('commit failed');

    await checkForRemoteChanges();
    expect(fetchLastCommit).toHaveBeenCalledTimes(1);
  });

  test('waits for a check in flight before committing', async () => {
    /** @type {string[]} */
    const order = [];
    const { promise, resolve } = Promise.withResolvers();

    /**
     * Let the head request come back.
     */
    const finishCheck = () => {
      order.push('check');
      resolve({ hash: 'head-1', message: '' });
    };

    fetchLastCommit.mockReturnValue(promise);

    const checkPromise = checkForRemoteChanges();

    const commitPromise = suspendChecksWhile(async () => {
      order.push('commit');
    });

    // The commit hasn’t started: it’s waiting for the check
    await Promise.resolve();
    expect(order).toEqual([]);

    finishCheck();
    await Promise.all([checkPromise, commitPromise]);
    expect(order).toEqual(['check', 'commit']);
  });

  test('commits even if the check in flight fails', async () => {
    fetchLastCommit.mockRejectedValueOnce(new Error('offline'));

    const checkPromise = checkForRemoteChanges().catch(() => 'failed');

    expect(await suspendChecksWhile(async () => 'committed')).toBe('committed');
    expect(await checkPromise).toBe('failed');
  });
});
