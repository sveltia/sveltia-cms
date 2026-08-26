import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { backend } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { deployments, productionSHA, resetDeployments } from '$lib/services/deployments';
import { POLL_INTERVAL } from '$lib/services/deployments/constants';
import { retainDeployPolling } from '$lib/services/deployments/poll';
import { unpublishedEntries } from '$lib/services/workflow';

/** @type {any} */
let backendService;

vi.mock('$lib/services/backends', () => ({ backend: { subscribe: vi.fn() } }));
vi.mock('$lib/services/config', () => ({ cmsConfig: { subscribe: vi.fn() } }));
vi.mock('$lib/services/workflow', () => ({
  unpublishedEntries: {
    /**
     * Report an empty list, so only the production commit is tracked.
     * @param {(value: any) => void} run Subscriber.
     * @returns {() => void} Function to stop listening.
     */
    subscribe: (run) => {
      run([]);

      return () => undefined;
    },
  },
}));
vi.mock('svelte/store', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  get: vi.fn(),
}));

const { get: readStore } = /** @type {any} */ (await vi.importActual('svelte/store'));

// The poll unit tests stand in for the target store, so this covers the seam between them: the
// poller reacting to the real derived store as a save moves the tracked commit
describe('Deployment polling against the real target store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T00:00:00Z'));
    resetDeployments();

    backendService = {
      repository: { branch: 'main' },
      fetchDeployments: vi.fn(async () => ({})),
    };

    vi.mocked(get).mockImplementation((store) => {
      if (store === backend) {
        return backendService;
      }

      if (store === unpublishedEntries) {
        return [];
      }

      if (store === cmsConfig) {
        return { show_preview_links: true };
      }

      return readStore(store);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('queries the backend after a save moves the branch head', async () => {
    // The editor is open before the save, with the site already built
    productionSHA.set('old');
    deployments.set({ old: { state: 'ready', checkedTime: Date.now() } });

    const release = retainDeployPolling();

    // Nothing to wait for yet
    expect(vi.getTimerCount()).toBe(0);

    // Saving an entry moves the branch head to the new commit
    productionSHA.set('new');

    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL);

    expect(backendService.fetchDeployments).toHaveBeenCalledWith([
      { sha: 'new', branch: 'main', kind: 'production' },
    ]);

    release();
  });

  test('queries the backend when the editor opens on an unresolved commit', async () => {
    productionSHA.set('abc');

    const release = retainDeployPolling();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL);

    expect(backendService.fetchDeployments).toHaveBeenCalled();

    release();
  });
});
