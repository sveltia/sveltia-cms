import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { backend } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { deployments, productionSHA, resetDeployments } from '$lib/services/deployments';
import {
  cancelDeployResolution,
  deployTargets,
  getDeployTargets,
  initDeployments,
  markLookupPending,
  refreshProductionSHA,
  resolveDeployments,
} from '$lib/services/deployments/resolve';
import { unpublishedEntries } from '$lib/services/workflow';

vi.mock('$lib/services/backends', () => ({ backend: { subscribe: vi.fn() } }));
vi.mock('$lib/services/config', () => ({ cmsConfig: { subscribe: vi.fn() } }));
vi.mock('$lib/services/user/prefs.svelte', () => ({ prefs: { devModeEnabled: false } }));

/** @type {any[]} */
let entries = [];

vi.mock('$lib/services/workflow', () => ({
  unpublishedEntries: {
    /**
     * Report the current entries. A real subscription is needed, because `deployTargets` derives
     * from this store.
     * @param {(value: any) => void} run Subscriber.
     * @returns {() => void} Function to stop listening.
     */
    subscribe: (run) => {
      run(entries);

      return () => undefined;
    },
  },
}));
vi.mock('svelte/store', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  get: vi.fn(),
}));

/** The real store reader, used for every store the mock doesn’t stand in for. */
const { get: readStore } = /** @type {any} */ (await vi.importActual('svelte/store'));
/** @type {any} */
let backendService;
/** @type {any} */
let config;

/**
 * Create an unpublished entry with the given pull request properties.
 * @param {object} [pullRequest] Pull request properties.
 * @returns {any} Entry.
 */
const createEntry = (pullRequest = {}) => ({
  workflow: { pullRequest: { number: 1, branch: 'cms/posts/hello', ...pullRequest } },
});

describe('Deployment resolution', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T00:00:00Z'));
    resetDeployments();
    entries = [];
    config = { show_preview_links: true };

    backendService = {
      repository: { branch: 'main' },
      fetchBranchHeadSHA: vi.fn(),
      fetchDeployments: vi.fn(async () => ({})),
    };

    vi.mocked(get).mockImplementation((store) => {
      if (store === backend) {
        return backendService;
      }

      if (store === unpublishedEntries) {
        return entries;
      }

      if (store === cmsConfig) {
        return config;
      }

      return readStore(store);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getDeployTargets', () => {
    test('returns nothing without a production commit or a pull request', () => {
      expect(getDeployTargets()).toEqual([]);
    });

    test('includes the production commit', () => {
      productionSHA.set('prod');

      expect(getDeployTargets()).toEqual([{ sha: 'prod', branch: 'main', kind: 'production' }]);
    });

    test('includes each pull request head commit', () => {
      productionSHA.set('prod');
      entries = [
        createEntry({ headSHA: 'a', branch: 'cms/posts/a' }),
        createEntry({ headSHA: 'b', branch: 'cms/posts/b' }),
      ];

      expect(getDeployTargets()).toEqual([
        { sha: 'prod', branch: 'main', kind: 'production' },
        { sha: 'a', branch: 'cms/posts/a', kind: 'preview' },
        { sha: 'b', branch: 'cms/posts/b', kind: 'preview' },
      ]);
    });

    test('skips a duplicate and a pull request with no head commit', () => {
      entries = [createEntry({ headSHA: 'a' }), createEntry({ headSHA: 'a' }), createEntry()];

      expect(getDeployTargets()).toEqual([
        { sha: 'a', branch: 'cms/posts/hello', kind: 'preview' },
      ]);
    });

    test('falls back to an empty branch without repository info', () => {
      backendService = {};
      productionSHA.set('prod');

      expect(getDeployTargets()).toEqual([{ sha: 'prod', branch: '', kind: 'production' }]);
    });
  });

  describe('deployTargets', () => {
    test('recomputes when the branch head moves', () => {
      /** @type {any[]} */
      let seen = [];

      const unsubscribe = deployTargets.subscribe((value) => {
        seen = value;
      });

      expect(seen).toEqual([]);

      // A save moves the head, and whatever is watching the deploy state has to notice
      productionSHA.set('prod');

      expect(seen).toEqual([{ sha: 'prod', branch: 'main', kind: 'production' }]);

      unsubscribe();
    });
  });

  describe('markLookupPending', () => {
    test('marks a commit nothing is known about, so no stale answer is shown meanwhile', () => {
      productionSHA.set('prod');

      markLookupPending();

      expect(get(deployments).prod).toEqual({ state: 'checking', checkedTime: 0 });
    });

    test('leaves a commit that already has a result alone', () => {
      productionSHA.set('prod');
      deployments.set({ prod: { state: 'ready', checkedTime: 5 } });

      const before = get(deployments);

      markLookupPending();

      // The same object, so subscribers aren’t woken for nothing
      expect(get(deployments)).toBe(before);
    });
  });

  describe('resolveDeployments', () => {
    test('does nothing when the backend has no support', async () => {
      backendService = { repository: { branch: 'main' } };
      productionSHA.set('prod');

      await resolveDeployments();

      expect(get(deployments)).toEqual({});
    });

    test('does nothing without a target', async () => {
      await resolveDeployments();

      expect(backendService.fetchDeployments).not.toHaveBeenCalled();
    });

    test('does nothing when preview links are turned off', async () => {
      config = { show_preview_links: false };
      productionSHA.set('prod');

      await resolveDeployments();

      expect(backendService.fetchDeployments).not.toHaveBeenCalled();
    });

    test('treats a missing config as preview links being on', async () => {
      config = undefined;
      productionSHA.set('prod');

      await resolveDeployments();

      expect(backendService.fetchDeployments).toHaveBeenCalled();
    });

    test('skips a finished build when only pending ones are wanted', async () => {
      // One entry still building shouldn’t drag every settled commit on the board along with it
      productionSHA.set('prod');
      entries = [createEntry({ headSHA: 'a' }), createEntry({ headSHA: 'b' })];

      deployments.set({
        prod: { state: 'ready', checkedTime: 0 },
        a: { state: 'error', checkedTime: 0 },
        b: { state: 'pending', checkedTime: 0 },
      });

      await resolveDeployments({ pendingOnly: true });

      expect(backendService.fetchDeployments).toHaveBeenCalledWith([
        { sha: 'b', branch: 'cms/posts/hello', kind: 'preview' },
      ]);
    });

    test('re-reads a running build however recently it was seen', async () => {
      // The freshness window is for reopening a view, not for the loop — deferring to it would
      // throttle the checks to one per window and make the interval meaningless
      productionSHA.set('prod');
      deployments.set({ prod: { state: 'pending', checkedTime: Date.now() } });

      await resolveDeployments({ pendingOnly: true });

      expect(backendService.fetchDeployments).toHaveBeenCalledWith([
        { sha: 'prod', branch: 'main', kind: 'production' },
      ]);
    });

    test('still defers to the freshness window outside the loop', async () => {
      productionSHA.set('prod');
      deployments.set({ prod: { state: 'pending', checkedTime: Date.now() } });

      await resolveDeployments();

      expect(backendService.fetchDeployments).not.toHaveBeenCalled();
    });

    test('looks at a finished build again when forced', async () => {
      productionSHA.set('prod');
      deployments.set({ prod: { state: 'ready', checkedTime: Date.now() } });

      await resolveDeployments({ force: true, pendingOnly: true });

      expect(backendService.fetchDeployments).toHaveBeenCalled();
    });

    test('records the results returned by the backend', async () => {
      productionSHA.set('prod');
      backendService.fetchDeployments.mockResolvedValue({
        prod: { state: 'ready', url: 'https://example.com', checkedTime: 1 },
      });

      await resolveDeployments();

      expect(backendService.fetchDeployments).toHaveBeenCalledWith([
        { sha: 'prod', branch: 'main', kind: 'production' },
      ]);

      expect(get(deployments).prod).toEqual({
        state: 'ready',
        url: 'https://example.com',
        checkedTime: 1,
      });
    });

    test('marks a commit with no result yet as being checked', async () => {
      productionSHA.set('prod');

      // Settle the pending request by hand, so the test controls when the response lands
      /** @type {any} */
      let release;

      backendService.fetchDeployments.mockReturnValue(
        new Promise((resolve) => {
          release = resolve;
        }),
      );

      const promise = resolveDeployments();

      expect(get(deployments).prod).toEqual({ state: 'checking', checkedTime: 0 });

      release({});
      await promise;
    });

    test('leaves a known result alone while re-checking it', async () => {
      productionSHA.set('prod');
      deployments.set({ prod: { state: 'pending', checkedTime: 0 } });

      // Settle the pending request by hand, so the test controls when the response lands
      /** @type {any} */
      let release;

      backendService.fetchDeployments.mockReturnValue(
        new Promise((resolve) => {
          release = resolve;
        }),
      );

      const promise = resolveDeployments();

      expect(get(deployments).prod.state).toBe('pending');

      release({});
      await promise;
    });

    test('skips a commit whose result is still fresh', async () => {
      productionSHA.set('prod');
      deployments.set({ prod: { state: 'ready', checkedTime: Date.now() } });

      await resolveDeployments();

      expect(backendService.fetchDeployments).not.toHaveBeenCalled();
    });

    test('re-queries a stale result', async () => {
      productionSHA.set('prod');
      deployments.set({ prod: { state: 'ready', checkedTime: Date.now() - 60_000 } });

      await resolveDeployments();

      expect(backendService.fetchDeployments).toHaveBeenCalled();
    });

    test('re-queries a fresh result when forced', async () => {
      productionSHA.set('prod');
      deployments.set({ prod: { state: 'ready', checkedTime: Date.now() } });

      await resolveDeployments({ force: true });

      expect(backendService.fetchDeployments).toHaveBeenCalled();
    });

    test('re-queries a commit still marked as being checked', async () => {
      productionSHA.set('prod');
      deployments.set({ prod: { state: 'checking', checkedTime: Date.now() } });

      await resolveDeployments();

      expect(backendService.fetchDeployments).toHaveBeenCalled();
    });

    test('records an unknown state when the backend fails', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      productionSHA.set('prod');
      backendService.fetchDeployments.mockRejectedValue(new Error('Rate limited'));

      await resolveDeployments();

      expect(get(deployments).prod).toEqual({ state: 'unknown', checkedTime: expect.any(Number) });
      expect(error).toHaveBeenCalled();
      error.mockRestore();
    });

    test('discards a response that a later lookup has superseded', async () => {
      productionSHA.set('prod');

      // Settle the first request by hand, so it can be made to return last
      /** @type {any} */
      let finishFirst;

      backendService.fetchDeployments
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishFirst = resolve;
            }),
        )
        .mockResolvedValueOnce({ prod: { state: 'ready', checkedTime: 2 } });

      const scheduled = resolveDeployments();
      const manual = resolveDeployments({ force: true });

      await manual;
      finishFirst({ prod: { state: 'error', checkedTime: 1 } });
      await scheduled;

      // The manual re-check started later, so the older answer doesn’t land on top of it
      expect(get(deployments).prod.state).toBe('ready');
    });

    test('discards a response that lands after the resolution was cancelled', async () => {
      productionSHA.set('prod');

      // Settle the pending request by hand, so the test controls when the response lands
      /** @type {any} */
      let release;

      backendService.fetchDeployments.mockReturnValue(
        new Promise((resolve) => {
          release = resolve;
        }),
      );

      const promise = resolveDeployments();

      cancelDeployResolution();
      release({ prod: { state: 'ready', url: 'https://example.com', checkedTime: 1 } });
      await promise;

      // Still the placeholder, not the late result
      expect(get(deployments).prod).toEqual({ state: 'checking', checkedTime: 0 });
    });
  });

  describe('dev mode reporting', () => {
    test('narrates each step, so a missing preview can be traced', async () => {
      const { prefs } = await import('$lib/services/user/prefs.svelte');
      const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

      prefs.devModeEnabled = true;
      productionSHA.set('prod');

      // A fresh timestamp, so the second lookup below is a cache hit rather than a re-query
      const resolved = { prod: { state: 'ready', checkedTime: Date.now() } };

      backendService.fetchDeployments.mockResolvedValue(resolved);

      await resolveDeployments();

      expect(info).toHaveBeenCalledWith('deployPreview: looking up', [
        { sha: 'prod', branch: 'main', kind: 'production' },
      ]);

      expect(info).toHaveBeenCalledWith('deployPreview: resolved', resolved);

      // Nothing left to ask about once it’s settled
      await resolveDeployments();

      expect(info).toHaveBeenCalledWith(
        'deployPreview: nothing to look up',
        expect.objectContaining({ tracked: expect.any(Array) }),
      );

      prefs.devModeEnabled = false;
      info.mockRestore();
    });

    test('says so when the backend can’t report deployments', async () => {
      const { prefs } = await import('$lib/services/user/prefs.svelte');
      const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

      prefs.devModeEnabled = true;
      backendService = { repository: { branch: 'main' } };
      productionSHA.set('prod');

      await resolveDeployments();

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('not looking anything up'),
        expect.anything(),
      );

      prefs.devModeEnabled = false;
      info.mockRestore();
    });
  });

  describe('refreshProductionSHA', () => {
    test('records the head commit', async () => {
      backendService.fetchBranchHeadSHA.mockResolvedValue('abc');

      await refreshProductionSHA();

      expect(get(productionSHA)).toBe('abc');
    });

    test('records an empty value when the commit is unavailable', async () => {
      backendService.fetchBranchHeadSHA.mockResolvedValue(undefined);
      productionSHA.set('old');

      await refreshProductionSHA();

      expect(get(productionSHA)).toBe('');
    });

    test('does nothing when the backend has no support', async () => {
      backendService = { repository: { branch: 'main' } };
      productionSHA.set('old');

      await refreshProductionSHA();

      expect(get(productionSHA)).toBe('old');
    });

    test('keeps the previous value when the request fails', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      backendService.fetchBranchHeadSHA.mockRejectedValue(new Error('Not found'));
      productionSHA.set('old');

      await refreshProductionSHA();

      expect(get(productionSHA)).toBe('old');
      expect(error).toHaveBeenCalled();
      error.mockRestore();
    });
  });

  describe('initDeployments', () => {
    test('keeps an unexpected failure from escaping as an unhandled rejection', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      // Nothing awaits this call, so anything thrown here would otherwise go unreported
      vi.mocked(get).mockImplementation(() => {
        throw new Error('Store unavailable');
      });

      await expect(initDeployments()).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledWith(
        'Failed to look up the deployment info.',
        expect.any(Error),
      );

      error.mockRestore();
    });

    test('resolves the production commit and then its deployment', async () => {
      backendService.fetchBranchHeadSHA.mockResolvedValue('abc');
      backendService.fetchDeployments.mockResolvedValue({
        abc: { state: 'ready', checkedTime: 1 },
      });

      await initDeployments();

      expect(get(productionSHA)).toBe('abc');
      expect(get(deployments).abc).toEqual({ state: 'ready', checkedTime: 1 });
    });
  });
});
