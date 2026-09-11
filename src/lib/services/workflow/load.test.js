import { beforeEach, describe, expect, test, vi } from 'vitest';

import { backend } from '$lib/services/backends';
import {
  unpublishedEntries,
  unpublishedEntriesLoaded,
  unpublishedEntriesLoading,
  workflowEnabled,
} from '$lib/services/workflow';
import { mergeWorkflowAssets } from '$lib/services/workflow/assets';
import { convertPullRequests } from '$lib/services/workflow/entries';
import { loadUnpublishedEntries } from '$lib/services/workflow/load';

vi.mock('$lib/services/backends', () => ({ backend: { current: undefined } }));
vi.mock('$lib/services/workflow/assets');
vi.mock('$lib/services/workflow', () => ({
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
    unpublishedEntries.current = [];
    unpublishedEntriesLoading.current = false;
    unpublishedEntriesLoaded.current = false;
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
});
