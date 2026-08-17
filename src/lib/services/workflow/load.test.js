import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { backend } from '$lib/services/backends';
import {
  unpublishedEntries,
  unpublishedEntriesLoading,
  workflowEnabled,
} from '$lib/services/workflow';
import { mergeWorkflowAssets } from '$lib/services/workflow/assets';
import { convertPullRequests } from '$lib/services/workflow/entries';
import { loadUnpublishedEntries } from '$lib/services/workflow/load';

vi.mock('svelte/store', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  get: vi.fn(),
}));
vi.mock('$lib/services/backends', () => ({ backend: { subscribe: vi.fn() } }));
vi.mock('$lib/services/workflow/assets');
vi.mock('$lib/services/workflow', () => ({
  unpublishedEntries: { set: vi.fn() },
  unpublishedEntriesLoading: { set: vi.fn() },
  unpublishedEntriesLoaded: { set: vi.fn() },
  workflowEnabled: { subscribe: vi.fn() },
}));
vi.mock('$lib/services/workflow/entries');

describe('workflow/load', () => {
  const fetchPullRequests = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(get).mockImplementation((store) => {
      if (store === workflowEnabled) {
        return true;
      }

      if (store === backend) {
        return { workflow: { fetchPullRequests } };
      }

      return undefined;
    });
  });

  test('does nothing when the feature is disabled', async () => {
    vi.mocked(get).mockImplementation((store) => (store === backend ? {} : false));
    await loadUnpublishedEntries();

    expect(unpublishedEntries.set).not.toHaveBeenCalled();
    expect(unpublishedEntriesLoading.set).not.toHaveBeenCalled();
  });

  test('does nothing when the backend doesn’t implement the feature', async () => {
    vi.mocked(get).mockImplementation((store) => (store === backend ? {} : true));
    await loadUnpublishedEntries();

    expect(unpublishedEntries.set).not.toHaveBeenCalled();
  });

  test('stores the converted entries', async () => {
    const pullRequests = [{ branch: 'cms/posts/hello' }];
    const entries = [{ id: 'x' }];

    fetchPullRequests.mockResolvedValue(pullRequests);
    vi.mocked(convertPullRequests).mockResolvedValue(/** @type {any} */ ({ entries, assets: [] }));

    await loadUnpublishedEntries();

    expect(convertPullRequests).toHaveBeenCalledWith(pullRequests);
    expect(unpublishedEntries.set).toHaveBeenCalledWith(entries);
    expect(unpublishedEntriesLoading.set).toHaveBeenNthCalledWith(1, true);
    expect(unpublishedEntriesLoading.set).toHaveBeenNthCalledWith(2, false);
    expect(mergeWorkflowAssets).toHaveBeenCalledWith([]);
  });

  test('merges the draft assets into the asset store', async () => {
    const assets = [{ path: 'static/img.png', sha: 'new' }];

    fetchPullRequests.mockResolvedValue([]);
    vi.mocked(convertPullRequests).mockResolvedValue(/** @type {any} */ ({ entries: [], assets }));

    await loadUnpublishedEntries();

    expect(mergeWorkflowAssets).toHaveBeenCalledWith(assets);
  });

  test('swallows an error and resets the loading state', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    fetchPullRequests.mockRejectedValue(new Error('API error'));

    await expect(loadUnpublishedEntries()).resolves.toBeUndefined();

    expect(unpublishedEntries.set).not.toHaveBeenCalled();
    expect(unpublishedEntriesLoading.set).toHaveBeenNthCalledWith(2, false);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
