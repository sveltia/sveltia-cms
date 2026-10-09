import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { allAssets } from '$lib/services/assets/state';
import { backend } from '$lib/services/backends';
import { advanceRepositoryHead } from '$lib/services/backends/git/shared/file-cache';
import { repositoryHead } from '$lib/services/backends/git/shared/head';
import { allEntries } from '$lib/services/contents';
import { productionSHA } from '$lib/services/deployments';

import {
  _resetRootDirTree,
  checkForRemoteChanges,
  diffStores,
  MIN_CHECK_GAP,
  suspendChecksWhile,
} from './refresh';

const mockGetRootDir = vi.hoisted(() => vi.fn(() => ''));
const mockRepositoryHead = vi.hoisted(() => ({ current: '' }));

vi.mock('$lib/services/assets', () => ({ allAssets: { current: [] } }));
vi.mock('$lib/services/backends', () => ({ backend: { current: undefined } }));
vi.mock('$lib/services/backends/git/shared/head', () => ({ repositoryHead: mockRepositoryHead }));
vi.mock('$lib/services/backends/git/shared/file-cache', () => ({
  // Like the real one, record the new head
  advanceRepositoryHead: vi.fn(async (_repository, _from, to) => {
    mockRepositoryHead.current = to;
  }),
}));
vi.mock('$lib/services/contents', () => ({ allEntries: { current: [] } }));
vi.mock('$lib/services/deployments', () => ({ productionSHA: { current: '' } }));
vi.mock('$lib/services/backends/root-dir', () => ({ getRootDir: mockGetRootDir }));

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
    // The head just fetched is handed over, so the fetch doesn’t ask for it again
    expect(fetchFiles).toHaveBeenCalledWith({ lastCommit: { hash: 'head-2', message: '' } });
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
    // The fetch records the head it has loaded, like the real one
    fetchFiles.mockImplementation(async () => {
      repositoryHead.current = 'head-2';
    });

    await checkForRemoteChanges();
    expect(productionSHA.current).toBe('head-2');
  });

  test('tracks the head the fetch has loaded, when another commit has landed meanwhile', async () => {
    productionSHA.current = 'head-1';
    fetchLastCommit.mockResolvedValue({ hash: 'head-2', message: '' });
    // The fetch resolves the head again, and finds yet another commit
    fetchFiles.mockImplementation(async () => {
      repositoryHead.current = 'head-3';
    });

    await checkForRemoteChanges();
    expect(productionSHA.current).toBe('head-3');
  });

  describe('with a root directory', () => {
    const fetchDirSHA = vi.fn();

    beforeEach(() => {
      _resetRootDirTree();
      mockGetRootDir.mockReturnValue('apps/site');
      /** @type {any} */ (backend).current = {
        fetchLastCommit,
        fetchFiles,
        fetchDirSHA,
        repository: { databaseName: 'github:owner/repo:apps/site' },
      };
      productionSHA.current = 'head-1';
      fetchLastCommit.mockResolvedValue({ hash: 'head-2', message: '' });
    });

    afterEach(() => {
      mockGetRootDir.mockReturnValue('');
    });

    test('skips a commit that leaves the root directory as it is', async () => {
      fetchDirSHA.mockResolvedValue('tree-1');

      expect(await checkForRemoteChanges()).toBeUndefined();
      expect(fetchDirSHA).toHaveBeenCalledWith('head-1', 'apps/site');
      expect(fetchDirSHA).toHaveBeenCalledWith('head-2', 'apps/site');
      expect(fetchFiles).not.toHaveBeenCalled();
      // The new head is the one the data reflects now, but the site isn’t rebuilt for it
      expect(advanceRepositoryHead).toHaveBeenCalledWith(
        { databaseName: 'github:owner/repo:apps/site' },
        'head-1',
        'head-2',
      );
      expect(repositoryHead.current).toBe('head-2');
      expect(productionSHA.current).toBe('head-1');
    });

    test('only looks up the new head on the next check', async () => {
      fetchDirSHA.mockResolvedValue('tree-1');
      await checkForRemoteChanges();
      fetchDirSHA.mockClear();
      fetchLastCommit.mockResolvedValue({ hash: 'head-3', message: '' });

      await checkForRemoteChanges();
      expect(fetchDirSHA).toHaveBeenCalledTimes(1);
      expect(fetchDirSHA).toHaveBeenCalledWith('head-3', 'apps/site');
    });

    test('looks the head up again when the root directory has changed since', async () => {
      fetchDirSHA.mockResolvedValue('tree-1');
      await checkForRemoteChanges();
      fetchDirSHA.mockClear();
      mockGetRootDir.mockReturnValue('apps/other');
      fetchLastCommit.mockResolvedValue({ hash: 'head-3', message: '' });

      await checkForRemoteChanges();
      expect(fetchDirSHA).toHaveBeenCalledWith('head-2', 'apps/other');
    });

    test('fetches the files when the root directory has changed', async () => {
      fetchDirSHA.mockImplementation(async (commit) => `tree-of-${commit}`);

      await checkForRemoteChanges();
      expect(fetchFiles).toHaveBeenCalledTimes(1);
    });

    test('fetches the files when the root directory can’t be found', async () => {
      fetchDirSHA.mockResolvedValue(undefined);

      await checkForRemoteChanges();
      expect(fetchFiles).toHaveBeenCalledTimes(1);
    });

    test('fetches the files when the lookup fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      fetchDirSHA.mockRejectedValue(new Error('Network error'));

      await checkForRemoteChanges();
      expect(fetchFiles).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to look up the root directory.',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });

    test('fetches the files for a backend that can’t look the directory up', async () => {
      /** @type {any} */ (backend).current = { fetchLastCommit, fetchFiles };

      await checkForRemoteChanges();
      expect(fetchFiles).toHaveBeenCalledTimes(1);
    });
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
