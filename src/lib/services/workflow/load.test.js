import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { backend } from '$lib/services/backends';
import { dataGeneration, repositoryHead } from '$lib/services/backends/git/shared/head';
import { checkForRemoteChanges } from '$lib/services/backends/refresh';
import { cmsConfig } from '$lib/services/config';
import {
  publishingBranches,
  unpublishedEntries,
  unpublishedEntriesLoaded,
  unpublishedEntriesLoading,
  workflowEnabled,
} from '$lib/services/workflow';
import { mergeWorkflowAssets, removeWorkflowAssets } from '$lib/services/workflow/assets';
import { convertPullRequests } from '$lib/services/workflow/entries';
import {
  _resetWorkflowLoadState,
  checkForWorkflowChanges,
  loadUnpublishedEntries,
  reloadUnpublishedEntries,
  startLoadingPullRequests,
  WORKFLOW_CHECK_INTERVAL,
} from '$lib/services/workflow/load';
import { openAuthoringInitialized } from '$lib/services/workflow/open-authoring';

vi.mock('$lib/services/backends', () => ({ backend: { current: undefined } }));
vi.mock('$lib/services/backends/git/shared/head', () => {
  const generationBox = { current: 0 };

  return {
    /**
     * Like the real one, compare the generation at creation with the current one.
     * @returns {() => boolean} Check.
     */
    createStaleCheck: () => {
      const generation = generationBox.current;

      return () => generation !== generationBox.current;
    },
    dataGeneration: generationBox,
    repositoryHead: { current: '' },
  };
});
vi.mock('$lib/services/backends/refresh', () => ({ checkForRemoteChanges: vi.fn() }));
vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));
vi.mock('$lib/services/workflow/open-authoring', () => ({
  openAuthoringInitialized: { current: false },
}));
vi.mock('$lib/services/workflow/assets');
vi.mock('$lib/services/workflow', () => ({
  publishingBranches: { current: [] },
  unpublishedEntries: { current: [] },
  unpublishedEntriesLoading: { current: false },
  unpublishedEntriesLoaded: { current: false },
  workflowEnabled: { current: undefined },
}));
vi.mock('$lib/services/workflow/entries');

describe('workflow/load', () => {
  const fetchPullRequests = vi.fn();
  /** The loading state as of each pull request fetch. */
  const loadingStates = /** @type {boolean[]} */ ([]);

  beforeEach(() => {
    vi.clearAllMocks();
    loadingStates.length = 0;
    fetchPullRequests.mockImplementation(async () => {
      loadingStates.push(unpublishedEntriesLoading.current);

      return [];
    });

    /** @type {any} */ (workflowEnabled).current = true;
    /** @type {any} */ (backend).current = { workflow: { fetchPullRequests } };
    /** @type {any} */ (cmsConfig).current = { backend: { name: 'github' } };
    /** @type {any} */ (openAuthoringInitialized).current = false;
    unpublishedEntries.current = [];
    unpublishedEntriesLoading.current = false;
    unpublishedEntriesLoaded.current = false;
    publishingBranches.current = [];
    repositoryHead.current = 'head-1';
    dataGeneration.current = 0;
    _resetWorkflowLoadState();
  });

  test('does nothing when the feature is disabled', async () => {
    /** @type {any} */ (workflowEnabled).current = false;
    await loadUnpublishedEntries();

    expect(fetchPullRequests).not.toHaveBeenCalled();
    expect(unpublishedEntriesLoading.current).toBe(false);
    expect(unpublishedEntriesLoaded.current).toBe(false);
  });

  test('does nothing when the backend doesn’t implement the feature', async () => {
    /** @type {any} */ (backend).current = {};
    await loadUnpublishedEntries();

    expect(fetchPullRequests).not.toHaveBeenCalled();
    expect(unpublishedEntriesLoaded.current).toBe(false);
  });

  test('stores the converted entries', async () => {
    const pullRequests = [{ branch: 'cms/posts/hello' }];
    const entries = [{ id: 'x' }];

    fetchPullRequests.mockImplementation(async () => {
      loadingStates.push(unpublishedEntriesLoading.current);

      return pullRequests;
    });
    vi.mocked(convertPullRequests).mockResolvedValue(/** @type {any} */ ({ entries, assets: [] }));

    await loadUnpublishedEntries();

    expect(convertPullRequests).toHaveBeenCalledWith(pullRequests);
    expect(unpublishedEntries.current).toEqual(entries);
    // The loading state is on while fetching, and off once done
    expect(loadingStates).toEqual([true]);
    expect(unpublishedEntriesLoading.current).toBe(false);
    expect(unpublishedEntriesLoaded.current).toBe(true);
    expect(mergeWorkflowAssets).toHaveBeenCalledWith([]);
  });

  test('merges the draft assets into the asset state', async () => {
    const assets = [{ path: 'static/img.png', sha: 'new' }];

    vi.mocked(convertPullRequests).mockResolvedValue(/** @type {any} */ ({ entries: [], assets }));

    await loadUnpublishedEntries();

    expect(mergeWorkflowAssets).toHaveBeenCalledWith(assets);
  });

  test('swallows an error and resets the loading state', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    fetchPullRequests.mockRejectedValue(new Error('API error'));

    await expect(loadUnpublishedEntries()).resolves.toBeUndefined();

    expect(unpublishedEntries.current).toEqual([]);
    expect(unpublishedEntriesLoading.current).toBe(false);
    // Marked as loaded even on failure, so a deep link isn’t stuck on the loading state forever
    expect(unpublishedEntriesLoaded.current).toBe(true);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  describe('when the site data is discarded meanwhile', () => {
    beforeEach(() => {
      vi.mocked(convertPullRequests).mockImplementation(async () => {
        // Signed out while the pull requests were being converted
        dataGeneration.current += 1;

        return /** @type {any} */ ({ entries: [{ id: 'x' }], assets: [{ path: 'a.png' }] });
      });
    });

    test('doesn’t write the previous session’s entries back', async () => {
      await loadUnpublishedEntries();

      expect(unpublishedEntries.current).toEqual([]);
      expect(mergeWorkflowAssets).not.toHaveBeenCalled();
      expect(unpublishedEntriesLoaded.current).toBe(false);
      // The load isn’t recorded either, so the next session’s check doesn’t take it as fresh
      unpublishedEntriesLoaded.current = true;
      await checkForWorkflowChanges();
      expect(fetchPullRequests).toHaveBeenCalledTimes(2);
    });

    test('records a load that isn’t discarded', async () => {
      vi.mocked(convertPullRequests).mockResolvedValue(
        /** @type {any} */ ({ entries: [{ id: 'x' }], assets: [] }),
      );

      await loadUnpublishedEntries();
      await checkForWorkflowChanges();
      expect(fetchPullRequests).toHaveBeenCalledOnce();
    });

    test('doesn’t mark the entries as loaded after a failure either', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      fetchPullRequests.mockImplementation(async () => {
        await Promise.resolve();
        dataGeneration.current += 1;
        throw new Error('API error');
      });

      await loadUnpublishedEntries();

      expect(unpublishedEntriesLoaded.current).toBe(false);
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });

  describe('startLoadingPullRequests()', () => {
    test('returns nothing when the feature is disabled', () => {
      /** @type {any} */ (workflowEnabled).current = false;

      expect(startLoadingPullRequests()).toBeUndefined();
      expect(fetchPullRequests).not.toHaveBeenCalled();
      expect(unpublishedEntriesLoading.current).toBe(false);
    });

    test('waits for the Open Authoring set-up, whichever way it turns out', async () => {
      /** @type {any} */ (cmsConfig).current = {
        backend: { name: 'github', open_authoring: true },
      };

      // Whether the pull requests live in the user’s fork or in the configured repository is only
      // found out while the files are fetched; listing them before that would look in the wrong
      // place
      expect(startLoadingPullRequests()).toBeUndefined();
      expect(fetchPullRequests).not.toHaveBeenCalled();
      expect(unpublishedEntriesLoading.current).toBe(false);

      // Completed — for a maintainer without a fork just as for a contributor with one
      /** @type {any} */ (openAuthoringInitialized).current = true;

      await expect(startLoadingPullRequests()).resolves.toEqual([]);
      expect(fetchPullRequests).toHaveBeenCalledOnce();
    });

    test('loads the entries after the files with Open Authoring, if not started before', async () => {
      /** @type {any} */ (cmsConfig).current = {
        backend: { name: 'github', open_authoring: true },
      };
      vi.mocked(convertPullRequests).mockResolvedValue({ entries: [], assets: [] });

      // What the sign-in flow does: nothing could be started early…
      const early = startLoadingPullRequests();

      expect(early).toBeUndefined();

      // …so once the files are fetched and the set-up has completed, the loader requests them
      /** @type {any} */ (openAuthoringInitialized).current = true;
      await loadUnpublishedEntries(early);

      expect(fetchPullRequests).toHaveBeenCalledOnce();
      expect(unpublishedEntriesLoaded.current).toBe(true);
    });

    test('starts the request even without a configuration, e.g. in a unit test', async () => {
      /** @type {any} */ (cmsConfig).current = undefined;

      await expect(startLoadingPullRequests()).resolves.toEqual([]);
    });

    test('starts the request and marks the entries as loading', async () => {
      const promise = startLoadingPullRequests();

      expect(fetchPullRequests).toHaveBeenCalledOnce();
      expect(unpublishedEntriesLoading.current).toBe(true);
      await expect(promise).resolves.toEqual([]);
    });

    test('hands a request started earlier over to the loader', async () => {
      vi.mocked(convertPullRequests).mockResolvedValue({
        entries: /** @type {any} */ ([{ id: 'x' }]),
        assets: [],
      });

      const promise = startLoadingPullRequests();

      await loadUnpublishedEntries(promise);

      // Not requested a second time
      expect(fetchPullRequests).toHaveBeenCalledOnce();
      expect(unpublishedEntries.current).toEqual([{ id: 'x' }]);
      expect(unpublishedEntriesLoading.current).toBe(false);
      expect(unpublishedEntriesLoaded.current).toBe(true);
    });

    test('leaves a failure for the loader to report rather than rejecting on its own', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const unhandled = vi.fn();

      process.on('unhandledRejection', unhandled);
      fetchPullRequests.mockRejectedValue(new Error('API error'));

      const promise = startLoadingPullRequests();

      // Give a stray rejection a chance to surface before the loader picks the promise up
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      await loadUnpublishedEntries(promise);
      process.off('unhandledRejection', unhandled);

      expect(unhandled).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalled();
      expect(unpublishedEntriesLoading.current).toBe(false);

      consoleError.mockRestore();
    });
  });

  describe('reloadUnpublishedEntries()', () => {
    /**
     * Build an unpublished entry.
     * @param {string} slug Entry slug, which names the branch.
     * @param {object} [options] Options.
     * @param {string} [options.id] Entry ID.
     * @param {string} [options.title] Entry title.
     * @param {string} [options.headSHA] Head of the pull request.
     * @returns {any} Entry.
     */
    const createEntry = (slug, { id = `${slug}-id`, title = slug, headSHA = 'a' } = {}) => ({
      id,
      slug,
      locales: { _default: { content: { title } } },
      workflow: { pullRequest: { branch: `cms/posts/${slug}`, headSHA }, status: 'draft' },
    });

    /**
     * Have the next listing return the given entries and assets.
     * @param {any[]} entries Entries, which stand for their pull requests too.
     * @param {any[]} [assets] Assets.
     */
    const mockListing = (entries, assets = []) => {
      fetchPullRequests.mockResolvedValue(entries.map(({ workflow }) => workflow.pullRequest));
      vi.mocked(convertPullRequests).mockResolvedValue({ entries, assets });
    };

    const fetchBranchHead = vi.fn();

    beforeEach(() => {
      unpublishedEntriesLoaded.current = true;
      vi.mocked(checkForRemoteChanges).mockResolvedValue(undefined);
      fetchBranchHead.mockResolvedValue(undefined);
      /** @type {any} */ (backend).current = { workflow: { fetchPullRequests, fetchBranchHead } };
    });

    test('does nothing until the entries have been loaded once', async () => {
      unpublishedEntriesLoaded.current = false;

      await expect(reloadUnpublishedEntries()).resolves.toBe(false);
      expect(fetchPullRequests).not.toHaveBeenCalled();
    });

    test('does nothing when the feature is not in use, or not ready', async () => {
      /** @type {any} */ (workflowEnabled).current = false;
      await expect(reloadUnpublishedEntries()).resolves.toBe(false);

      /** @type {any} */ (workflowEnabled).current = true;
      /** @type {any} */ (backend).current = {};
      await expect(reloadUnpublishedEntries()).resolves.toBe(false);

      /** @type {any} */ (backend).current = { workflow: { fetchPullRequests } };
      /** @type {any} */ (cmsConfig).current = {
        backend: { name: 'github', open_authoring: true },
      };
      await expect(reloadUnpublishedEntries()).resolves.toBe(false);

      expect(fetchPullRequests).not.toHaveBeenCalled();
    });

    test('merges the pull requests into the store', async () => {
      const unchanged = createEntry('unchanged');
      const changed = createEntry('changed');
      const closed = createEntry('closed');
      const store = [unchanged, changed, closed];

      unpublishedEntries.current = store;
      mockListing([
        createEntry('opened', { id: 'opened-new-id' }),
        createEntry('unchanged', { id: 'unchanged-new-id' }),
        createEntry('changed', { id: 'changed-new-id', title: 'Changed', headSHA: 'b' }),
      ]);

      await expect(reloadUnpublishedEntries()).resolves.toBe(true);

      const [first, second, third] = unpublishedEntries.current;

      // An unchanged entry stays the same object, a changed one keeps its ID, a closed one goes,
      // and a new one comes last
      expect(first).toBe(unchanged);
      expect(second).toMatchObject({
        id: 'changed-id',
        locales: { _default: { content: { title: 'Changed' } } },
      });
      expect(third).toMatchObject({ id: 'opened-new-id' });
      expect(unpublishedEntries.current).toHaveLength(3);
    });

    test('leaves the store as it is when nothing has changed', async () => {
      const store = [createEntry('hello')];

      unpublishedEntries.current = store;
      mockListing([createEntry('hello', { id: 'another-id' })]);

      await expect(reloadUnpublishedEntries()).resolves.toBe(false);
      expect(unpublishedEntries.current).toBe(store);
      expect(removeWorkflowAssets).not.toHaveBeenCalled();
      expect(mergeWorkflowAssets).not.toHaveBeenCalled();
      // Nothing has gone, so the branch isn’t checked either
      expect(checkForRemoteChanges).not.toHaveBeenCalled();
    });

    test('replaces the assets of the branches that have changed or gone', async () => {
      unpublishedEntries.current = [
        createEntry('kept'),
        createEntry('changed'),
        createEntry('closed'),
      ];

      const changedAsset = { path: 'a.png', workflow: { branch: 'cms/posts/changed' } };
      const keptAsset = { path: 'b.png', workflow: { branch: 'cms/posts/kept' } };

      mockListing(
        [createEntry('kept'), createEntry('changed', { headSHA: 'b' })],
        [changedAsset, keptAsset],
      );

      await reloadUnpublishedEntries();

      expect(
        vi
          .mocked(removeWorkflowAssets)
          .mock.calls.map(([branch]) => branch)
          .sort(),
      ).toEqual(['cms/posts/changed', 'cms/posts/closed']);
      expect(mergeWorkflowAssets).toHaveBeenCalledWith([changedAsset]);
    });

    test('fetches the published version before dropping a pull request that has gone', async () => {
      /** @type {string[]} */
      const calls = [];

      unpublishedEntries.current = [createEntry('merged')];
      mockListing([]);
      vi.mocked(checkForRemoteChanges).mockImplementation(async () => {
        calls.push('branch');

        return undefined;
      });
      vi.mocked(convertPullRequests).mockImplementation(async () => {
        calls.push('convert');

        return { entries: [], assets: [] };
      });

      await expect(reloadUnpublishedEntries()).resolves.toBe(true);
      // The entry is matched against the published one, so that has to be in first
      expect(calls).toEqual(['branch', 'convert']);
      // There’s no branch left to compare with the head in the store
      expect(fetchBranchHead).not.toHaveBeenCalled();
      expect(unpublishedEntries.current).toEqual([]);
    });

    test('drops a pull request that has gone even if the branch can’t be checked', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const error = new Error('offline');

      unpublishedEntries.current = [createEntry('closed')];
      mockListing([]);
      vi.mocked(checkForRemoteChanges).mockRejectedValue(error);

      await expect(reloadUnpublishedEntries()).resolves.toBe(true);
      expect(unpublishedEntries.current).toEqual([]);
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to check the repository for changes.',
        error,
      );

      consoleError.mockRestore();
    });

    test('keeps an entry saved in this tab over an older snapshot of its pull request', async () => {
      const saved = createEntry('saved', { title: 'Saved here', headSHA: 'b' });
      const store = [saved];

      unpublishedEntries.current = store;
      // The Git service still reports the pull request as of the commit before the save, while the
      // branch already points at the one the save made
      mockListing([createEntry('saved', { headSHA: 'a' })]);
      fetchBranchHead.mockResolvedValue('b');

      await expect(reloadUnpublishedEntries()).resolves.toBe(false);
      expect(fetchBranchHead).toHaveBeenCalledExactlyOnceWith('cms/posts/saved');
      expect(unpublishedEntries.current).toBe(store);
      expect(removeWorkflowAssets).not.toHaveBeenCalled();
    });

    test('keeps an entry over a snapshot that names no head', async () => {
      const store = [createEntry('saved', { title: 'Saved here', headSHA: 'b' })];
      const listed = createEntry('saved');

      delete listed.workflow.pullRequest.headSHA;
      unpublishedEntries.current = store;
      mockListing([listed]);
      fetchBranchHead.mockResolvedValue('b');

      await expect(reloadUnpublishedEntries()).resolves.toBe(false);
      expect(unpublishedEntries.current).toBe(store);
    });

    test('keeps an entry over a snapshot that yields none', async () => {
      const store = [createEntry('saved', { headSHA: 'b' })];

      unpublishedEntries.current = store;
      // The pull request is listed, but none of its files are yet
      fetchPullRequests.mockResolvedValue([{ branch: 'cms/posts/saved', headSHA: 'a' }]);
      vi.mocked(convertPullRequests).mockResolvedValue({ entries: [], assets: [] });
      fetchBranchHead.mockResolvedValue('b');

      await expect(reloadUnpublishedEntries()).resolves.toBe(false);
      expect(unpublishedEntries.current).toBe(store);
      // The pull request is still open, so there’s no merge to look for either
      expect(checkForRemoteChanges).not.toHaveBeenCalled();
    });

    test('takes a commit pushed to the branch outside the CMS', async () => {
      unpublishedEntries.current = [createEntry('pushed', { headSHA: 'b' })];
      mockListing([createEntry('pushed', { title: 'Pushed', headSHA: 'c' })]);
      fetchBranchHead.mockResolvedValue('c');

      await expect(reloadUnpublishedEntries()).resolves.toBe(true);
      expect(unpublishedEntries.current).toMatchObject([
        {
          id: 'pushed-id',
          locales: { _default: { content: { title: 'Pushed' } } },
          workflow: { pullRequest: { headSHA: 'c' } },
        },
      ]);
    });

    test('takes the listing when the branch can’t be checked', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const error = new Error('offline');

      unpublishedEntries.current = [createEntry('hello', { headSHA: 'b' })];
      mockListing([createEntry('hello', { title: 'Listed', headSHA: 'a' })]);
      fetchBranchHead.mockRejectedValue(error);

      await expect(reloadUnpublishedEntries()).resolves.toBe(true);
      expect(unpublishedEntries.current).toMatchObject([
        { workflow: { pullRequest: { headSHA: 'a' } } },
      ]);
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to check the workflow branch for changes.',
        error,
      );

      consoleError.mockRestore();
    });

    test('only checks a branch whose head differs from the one in the store', async () => {
      const relabelled = createEntry('relabelled');
      const unknown = createEntry('unknown');

      relabelled.workflow.status = 'pending_review';
      delete unknown.workflow.pullRequest.headSHA;
      unpublishedEntries.current = [createEntry('relabelled'), unknown];
      // A relabel made on the Git service leaves the head as it is, and an entry with no head on
      // record has nothing to compare
      mockListing([relabelled, createEntry('unknown', { headSHA: 'c' })]);

      await expect(reloadUnpublishedEntries()).resolves.toBe(true);
      expect(fetchBranchHead).not.toHaveBeenCalled();
      expect(unpublishedEntries.current).toMatchObject([
        { workflow: { status: 'pending_review' } },
        { workflow: { pullRequest: { headSHA: 'c' } } },
      ]);
    });

    test('keeps the changes made in this tab while the request was on its way', async () => {
      const saved = createEntry('saved', { title: 'Saved here', headSHA: 'b' });
      const created = createEntry('created');

      unpublishedEntries.current = [createEntry('saved'), createEntry('discarded')];
      fetchPullRequests.mockImplementation(async () => {
        // A save, a new draft and a discard land while the pull requests are being listed
        unpublishedEntries.current = [saved, created];

        return [];
      });
      vi.mocked(convertPullRequests).mockResolvedValue({
        entries: [createEntry('saved'), createEntry('discarded')],
        assets: [],
      });

      await expect(reloadUnpublishedEntries()).resolves.toBe(false);
      expect(unpublishedEntries.current).toEqual([saved, created]);
    });

    test('leaves an entry being published to the publish', async () => {
      const publishing = createEntry('publishing');

      unpublishedEntries.current = [publishing];
      publishingBranches.current = ['cms/posts/publishing'];
      mockListing([]);

      await expect(reloadUnpublishedEntries()).resolves.toBe(false);
      expect(unpublishedEntries.current).toEqual([publishing]);
    });

    test('drops the results once the site data has been discarded', async () => {
      const store = [createEntry('hello')];

      unpublishedEntries.current = store;

      // Signed out while the pull requests are being listed…
      fetchPullRequests.mockImplementationOnce(async () => {
        dataGeneration.current += 1;

        return [];
      });
      await expect(reloadUnpublishedEntries()).resolves.toBe(false);

      // …while the branch is being checked…
      mockListing([]);
      vi.mocked(checkForRemoteChanges).mockImplementationOnce(async () => {
        dataGeneration.current += 1;

        return undefined;
      });
      await expect(reloadUnpublishedEntries()).resolves.toBe(false);

      // …while the entries are being parsed…
      vi.mocked(convertPullRequests).mockImplementationOnce(async () => {
        dataGeneration.current += 1;

        return { entries: [], assets: [] };
      });
      await expect(reloadUnpublishedEntries()).resolves.toBe(false);

      // …or while their branches are being checked
      mockListing([createEntry('hello', { headSHA: 'b' })]);
      fetchBranchHead.mockImplementationOnce(async () => {
        dataGeneration.current += 1;

        return 'b';
      });
      await expect(reloadUnpublishedEntries()).resolves.toBe(false);

      expect(unpublishedEntries.current).toBe(store);
      expect(convertPullRequests).toHaveBeenCalledTimes(2);
    });

    test('shares a reload in flight, unless a fresh one is asked for', async () => {
      const { promise, resolve } = Promise.withResolvers();

      mockListing([]);
      fetchPullRequests.mockReturnValueOnce(promise);

      const first = reloadUnpublishedEntries();
      const second = reloadUnpublishedEntries();
      const fresh = reloadUnpublishedEntries({ fresh: true });

      expect(fetchPullRequests).toHaveBeenCalledOnce();
      resolve([]);
      await Promise.all([first, second, fresh]);
      // The fresh one waited for the first, then listed the pull requests again
      expect(fetchPullRequests).toHaveBeenCalledTimes(2);
    });

    test('reports a failure to the caller', async () => {
      const error = new Error('API error');

      fetchPullRequests.mockRejectedValueOnce(error);
      await expect(reloadUnpublishedEntries()).rejects.toBe(error);

      // The next reload starts afresh, and a fresh one doesn’t mind the failure of the one before
      mockListing([]);
      await expect(reloadUnpublishedEntries()).resolves.toBe(false);

      const { promise, reject } = Promise.withResolvers();

      fetchPullRequests.mockReturnValueOnce(promise);

      const failing = reloadUnpublishedEntries();
      const fresh = reloadUnpublishedEntries({ fresh: true });

      reject(error);
      await expect(failing).rejects.toBe(error);
      await expect(fresh).resolves.toBe(false);
    });
  });

  describe('checkForWorkflowChanges()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      unpublishedEntriesLoaded.current = true;
      fetchPullRequests.mockResolvedValue([]);
      vi.mocked(convertPullRequests).mockResolvedValue({ entries: [], assets: [] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('reloads the entries once they’re older than the given time', async () => {
      await loadUnpublishedEntries();
      expect(fetchPullRequests).toHaveBeenCalledOnce();

      await checkForWorkflowChanges();
      expect(fetchPullRequests).toHaveBeenCalledOnce();

      vi.advanceTimersByTime(WORKFLOW_CHECK_INTERVAL);
      await checkForWorkflowChanges();
      expect(fetchPullRequests).toHaveBeenCalledTimes(2);

      // The reload counts as a load
      await checkForWorkflowChanges();
      expect(fetchPullRequests).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(1000);
      await checkForWorkflowChanges({ maxAge: 1000 });
      expect(fetchPullRequests).toHaveBeenCalledTimes(3);
    });

    test('reloads the entries straight away once the branch has moved', async () => {
      await loadUnpublishedEntries();

      // What a pull request merged on the Git service does
      repositoryHead.current = 'head-2';
      await checkForWorkflowChanges();
      expect(fetchPullRequests).toHaveBeenCalledTimes(2);

      await checkForWorkflowChanges();
      expect(fetchPullRequests).toHaveBeenCalledTimes(2);
    });

    test('joins a reload in flight', async () => {
      await loadUnpublishedEntries();

      const { promise, resolve } = Promise.withResolvers();

      fetchPullRequests.mockReturnValueOnce(promise);

      const reload = reloadUnpublishedEntries();
      const check = checkForWorkflowChanges();

      resolve([]);
      await Promise.all([reload, check]);
      expect(fetchPullRequests).toHaveBeenCalledTimes(2);
    });

    test('tries again on the next check after a failed load', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      fetchPullRequests.mockRejectedValueOnce(new Error('API error'));
      await loadUnpublishedEntries();

      await checkForWorkflowChanges();
      expect(fetchPullRequests).toHaveBeenCalledTimes(2);

      consoleError.mockRestore();
    });
  });
});
