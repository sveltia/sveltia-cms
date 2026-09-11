// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { backend } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { deployments, productionSHA, resetDeployments } from '$lib/services/deployments';
import { POLL_INTERVAL } from '$lib/services/deployments/constants';
import { retainDeployPolling } from '$lib/services/deployments/poll';

/** @type {any} */
let backendService;

vi.mock('$lib/services/backends', () => ({ backend: { current: undefined } }));
vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));
vi.mock('$lib/services/user/prefs.svelte', () => ({ prefs: { devModeEnabled: false } }));
// Report an empty list, so only the production commit is tracked
vi.mock('$lib/services/workflow', () => ({ unpublishedEntries: { current: [] } }));

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

    /** @type {any} */ (backend).current = backendService;
    cmsConfig.current = /** @type {any} */ ({ show_preview_links: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('queries the backend after a save moves the branch head', async () => {
    // The editor is open before the save, with the site already built
    productionSHA.current = 'old';
    deployments.current = { old: { state: 'ready', checkedTime: Date.now() } };

    const release = retainDeployPolling();

    // Nothing to wait for yet
    expect(vi.getTimerCount()).toBe(0);

    // Saving an entry moves the branch head to the new commit
    productionSHA.current = 'new';
    // Let the poller’s effect notice it
    await vi.advanceTimersByTimeAsync(0);

    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL);

    expect(backendService.fetchDeployments).toHaveBeenCalledWith([
      { sha: 'new', branch: 'main', kind: 'production' },
    ]);

    release();
  });

  test('queries the backend when the editor opens on an unresolved commit', async () => {
    productionSHA.current = 'abc';

    const release = retainDeployPolling();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL);

    expect(backendService.fetchDeployments).toHaveBeenCalled();

    release();
  });
});
