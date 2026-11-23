// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { checkForRemoteChanges, MIN_CHECK_GAP } from '$lib/services/backends/refresh';
import {
  checkForWorkflowChanges,
  WORKFLOW_CHECK_INTERVAL,
  WORKFLOW_RETURN_GAP,
} from '$lib/services/workflow/load';

import { REMOTE_CHECK_INTERVAL, startRemoteChangePolling, stopRemoteChangePolling } from './poll';

vi.mock('$lib/services/backends/refresh', () => ({
  checkForRemoteChanges: vi.fn(),
  MIN_CHECK_GAP: 10 * 1000,
}));
vi.mock('$lib/services/workflow/load', () => ({
  checkForWorkflowChanges: vi.fn(),
  WORKFLOW_CHECK_INTERVAL: 5 * 60 * 1000,
  WORKFLOW_RETURN_GAP: 30 * 1000,
}));

/**
 * Pretend the tab is shown or hidden.
 * @param {DocumentVisibilityState} state Visibility state.
 */
const setVisibility = (state) => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
};

describe('remote change polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
    vi.mocked(checkForRemoteChanges).mockResolvedValue(undefined);
    vi.mocked(checkForWorkflowChanges).mockResolvedValue(false);
  });

  afterEach(() => {
    stopRemoteChangePolling();
    vi.useRealTimers();
  });

  test('checks the repository on schedule while the tab is shown', async () => {
    startRemoteChangePolling();

    // The data has just been loaded, so nothing is asked right away
    expect(checkForRemoteChanges).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(REMOTE_CHECK_INTERVAL);
    expect(checkForRemoteChanges).toHaveBeenCalledTimes(1);
    // A scheduled check is always made
    expect(checkForRemoteChanges).toHaveBeenCalledWith({ maxAge: 0 });

    await vi.advanceTimersByTimeAsync(REMOTE_CHECK_INTERVAL);
    expect(checkForRemoteChanges).toHaveBeenCalledTimes(2);
  });

  test('skips a scheduled check while the tab is hidden', async () => {
    startRemoteChangePolling();
    setVisibility('hidden');

    await vi.advanceTimersByTimeAsync(REMOTE_CHECK_INTERVAL);
    expect(checkForRemoteChanges).not.toHaveBeenCalled();
  });

  test('checks the repository as the user comes back to the tab', async () => {
    startRemoteChangePolling();
    await vi.advanceTimersByTimeAsync(MIN_CHECK_GAP);

    window.dispatchEvent(new Event('focus'));
    expect(checkForRemoteChanges).toHaveBeenCalledTimes(1);
    // Unless a check was made only moments ago, which is left to the check itself to tell
    expect(checkForRemoteChanges).toHaveBeenCalledWith({ maxAge: MIN_CHECK_GAP });

    // A hidden tab being shown again counts too
    await vi.advanceTimersByTimeAsync(MIN_CHECK_GAP);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(checkForRemoteChanges).toHaveBeenCalledTimes(2);

    // But not a tab being hidden
    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(MIN_CHECK_GAP);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(checkForRemoteChanges).toHaveBeenCalledTimes(2);
  });

  test('doesn’t check again right after the polling has started', () => {
    startRemoteChangePolling();
    window.dispatchEvent(new Event('focus'));
    expect(checkForRemoteChanges).not.toHaveBeenCalled();
  });

  test('reports a failed check rather than stopping', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('offline');

    vi.mocked(checkForRemoteChanges).mockRejectedValueOnce(error);
    startRemoteChangePolling();

    await vi.advanceTimersByTimeAsync(REMOTE_CHECK_INTERVAL);
    expect(consoleSpy).toHaveBeenCalledWith('Failed to check the repository for changes.', error);

    await vi.advanceTimersByTimeAsync(REMOTE_CHECK_INTERVAL);
    expect(checkForRemoteChanges).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });

  test('checks the unpublished entries after the repository', async () => {
    /** @type {string[]} */
    const calls = [];

    vi.mocked(checkForRemoteChanges).mockImplementation(async () => {
      calls.push('branch');

      return undefined;
    });
    vi.mocked(checkForWorkflowChanges).mockImplementation(async () => {
      calls.push('workflow');

      return false;
    });
    startRemoteChangePolling();

    await vi.advanceTimersByTimeAsync(REMOTE_CHECK_INTERVAL);
    // A merge on the Git service moves the branch, so the published version is fetched before the
    // unpublished entries are reloaded
    expect(calls).toEqual(['branch', 'workflow']);
    // The pull requests cost more to list, so they’re left alone for longer unless the branch moved
    expect(checkForWorkflowChanges).toHaveBeenCalledWith({ maxAge: WORKFLOW_CHECK_INTERVAL });
  });

  test('checks the unpublished entries sooner as the user comes back to the tab', async () => {
    startRemoteChangePolling();
    await vi.advanceTimersByTimeAsync(MIN_CHECK_GAP);

    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);
    expect(checkForWorkflowChanges).toHaveBeenCalledWith({ maxAge: WORKFLOW_RETURN_GAP });
  });

  test('checks the unpublished entries even when the repository check fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('offline');

    vi.mocked(checkForRemoteChanges).mockRejectedValueOnce(error);
    vi.mocked(checkForWorkflowChanges).mockRejectedValueOnce(error);
    startRemoteChangePolling();

    await vi.advanceTimersByTimeAsync(REMOTE_CHECK_INTERVAL);
    expect(checkForWorkflowChanges).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to check the unpublished entries for changes.',
      error,
    );
    consoleSpy.mockRestore();
  });

  test('starts once, and stops', async () => {
    startRemoteChangePolling();
    startRemoteChangePolling();

    await vi.advanceTimersByTimeAsync(REMOTE_CHECK_INTERVAL);
    expect(checkForRemoteChanges).toHaveBeenCalledTimes(1);

    stopRemoteChangePolling();
    // Stopping again is harmless
    stopRemoteChangePolling();

    await vi.advanceTimersByTimeAsync(REMOTE_CHECK_INTERVAL);
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(checkForRemoteChanges).toHaveBeenCalledTimes(1);
  });
});
