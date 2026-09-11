// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { deployments, deployPollTimedOut } from '$lib/services/deployments';
import { POLL_INTERVAL, POLL_MAX_DURATION } from '$lib/services/deployments/constants';
import { recheckDeployments, retainDeployPolling } from '$lib/services/deployments/poll';
import {
  cancelDeployResolution,
  deployTargets,
  markLookupPending,
  resolveDeployments,
} from '$lib/services/deployments/resolve';

/** Whether the mocked backend can report deployments. */
let canResolve = true;

vi.mock('$lib/services/user/prefs.svelte', () => ({ prefs: { devModeEnabled: false } }));
vi.mock('$lib/services/deployments/resolve', async () => {
  const { createRawState } = await import('$lib/services/utils/state.svelte');

  return {
    cancelDeployResolution: vi.fn(),
    markLookupPending: vi.fn(),
    /**
     * Report whether the backend can answer, which a test can turn off.
     * @returns {boolean} Result.
     */
    canResolveDeployments: () => canResolve,
    // A real reactive box, so the poller’s effect notices a new commit
    deployTargets: createRawState([]),
    resolveDeployments: vi.fn(),
  };
});

/**
 * Replace the tracked commits, as a save would, and let the poller notice it.
 * @param {any[]} next New targets.
 */
const setTargets = async (next) => {
  /** @type {any} */ (deployTargets).current = next;
  await vi.advanceTimersByTimeAsync(0);
};

/**
 * Holds taken by the current test, released in `afterEach`.
 * @type {(() => void)[]}
 */
let releases = [];

/**
 * Take a hold on the poll loop, remembering it so a failed assertion can’t leave it behind and
 * corrupt the tests that follow.
 * @returns {() => void} Release function.
 */
const retain = () => {
  const release = retainDeployPolling();

  releases.push(release);

  return release;
};

describe('Deployment polling', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T00:00:00Z'));
    vi.mocked(resolveDeployments).mockReset().mockResolvedValue(undefined);
    vi.mocked(cancelDeployResolution).mockReset();
    vi.mocked(markLookupPending).mockReset();
    canResolve = true;
    /** @type {any} */ (deployTargets).current = [{ sha: 'a', branch: 'main', kind: 'production' }];
    deployments.current = { a: { state: 'pending', checkedTime: 0 } };
    deployPollTimedOut.current = false;
    // Let the effects settle
    await vi.advanceTimersByTimeAsync(0);
  });

  afterEach(() => {
    releases.forEach((release) => release());
    releases = [];
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test('re-checks at a steady interval while a build is pending', async () => {
    const release = retain();

    expect(resolveDeployments).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL);
    expect(resolveDeployments).toHaveBeenCalledTimes(1);

    // The gap doesn’t widen, so a build finishing is noticed just as quickly later on
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL);
    expect(resolveDeployments).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL * 3);
    expect(resolveDeployments).toHaveBeenCalledTimes(5);

    release();
  });

  test('stops once every build has settled', async () => {
    const release = retain();

    deployments.current = { a: { state: 'ready', checkedTime: 0 } };
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL);

    expect(resolveDeployments).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL * 8);

    expect(resolveDeployments).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    release();
  });

  test('sends no request when nothing is pending to begin with', () => {
    deployments.current = { a: { state: 'error', checkedTime: 0 } };

    const release = retain();

    expect(vi.getTimerCount()).toBe(0);

    release();
  });

  test('gives an unreported commit a few checks before stopping', async () => {
    // A provider can take a moment to post its first status after a push, so an empty answer isn’t
    // taken as proof that there’s no build coming
    deployments.current = { a: { state: 'unknown', checkedTime: 0 } };

    const release = retain();

    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL * 8);

    expect(resolveDeployments).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);

    release();
  });

  test('picks up a new commit after a save, once the previous one settled', async () => {
    // The site was built long ago, so the editor opens with nothing to wait for
    deployments.current = { old: { state: 'ready', checkedTime: 0 } };
    await setTargets([{ sha: 'old', branch: 'main', kind: 'production' }]);

    const release = retain();

    expect(vi.getTimerCount()).toBe(0);

    // Saving moves the branch head to a commit nothing is known about yet
    deployments.current = {};
    await setTargets([{ sha: 'new', branch: 'main', kind: 'production' }]);

    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL);

    expect(resolveDeployments).toHaveBeenCalledWith({ pendingOnly: true });

    release();
  });

  test('leaves no second loop behind when a save lands mid-check', async () => {
    // Settle the request by hand, so the test controls when it comes back
    /** @type {any} */
    let finishRequest;

    vi.mocked(resolveDeployments).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRequest = resolve;
        }),
    );

    const release = retain();

    // The scheduled check fires and its request is now out
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL);
    expect(vi.getTimerCount()).toBe(0);

    // A save moves the tracked commit while that request is still in flight
    deployments.current = {};
    await setTargets([{ sha: 'b', branch: 'main', kind: 'production' }]);
    expect(vi.getTimerCount()).toBe(1);

    // The older request comes back; its chain has been retired and must not schedule its own check
    finishRequest();
    await vi.advanceTimersByTimeAsync(0);

    expect(vi.getTimerCount()).toBe(1);

    // With one loop running, releasing the hold really stops it
    release();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('ignores a target update that changes nothing', async () => {
    const release = retain();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL);
    expect(markLookupPending).toHaveBeenCalledTimes(1);

    // The same commits, so the run carries on rather than starting over
    await setTargets([{ sha: 'a', branch: 'main', kind: 'production' }]);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL);

    expect(markLookupPending).toHaveBeenCalledTimes(1);

    release();
  });

  test('stops watching for new commits once every holder has released', async () => {
    retain()();
    vi.mocked(markLookupPending).mockClear();

    // A new commit no longer restarts the loop
    await setTargets([{ sha: 'b', branch: 'main', kind: 'production' }]);

    expect(markLookupPending).not.toHaveBeenCalled();
  });

  test('says why it isn’t re-checking while dev mode is on', async () => {
    const { prefs } = await import('$lib/services/user/prefs.svelte');
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    prefs.devModeEnabled = true;
    deployments.current = { a: { state: 'ready', checkedTime: 0 } };

    retain()();

    expect(info).toHaveBeenCalledWith(
      'deployPreview: not re-checking',
      expect.objectContaining({ settled: true }),
    );

    prefs.devModeEnabled = false;
    info.mockRestore();
  });

  test('doesn’t announce a lookup the backend can’t make', () => {
    canResolve = false;

    retain()();

    // Marking a commit as being checked with nothing to check it against would leave the control
    // waiting forever
    expect(markLookupPending).not.toHaveBeenCalled();
  });

  test('gives up after the maximum duration and offers a manual re-check', async () => {
    const release = retain();

    await vi.advanceTimersByTimeAsync(POLL_MAX_DURATION + POLL_INTERVAL * 2);

    expect(deployPollTimedOut.current).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    release();
  });

  test('keeps going while another holder is still interested', async () => {
    const releaseA = retain();
    const releaseB = retain();

    releaseA();
    expect(vi.getTimerCount()).toBe(1);

    releaseB();
    expect(vi.getTimerCount()).toBe(0);
    expect(cancelDeployResolution).toHaveBeenCalled();
  });

  test('ignores a repeated release from the same holder', () => {
    const releaseA = retain();
    const releaseB = retain();

    releaseA();
    releaseA();

    // The second release was a no-op, so the other holder still keeps it alive
    expect(vi.getTimerCount()).toBe(1);

    releaseB();
  });

  test('restarts the backoff for a second run', async () => {
    retain()();

    const release = retain();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL);

    expect(resolveDeployments).toHaveBeenCalledTimes(1);

    release();
  });

  describe('recheckDeployments', () => {
    test('queries right away, ignoring the cached results', async () => {
      await recheckDeployments();

      expect(resolveDeployments).toHaveBeenCalledWith({ force: true });
    });

    test('clears the timed-out flag and resumes re-checking', async () => {
      const release = retain();

      await vi.advanceTimersByTimeAsync(POLL_MAX_DURATION + POLL_INTERVAL * 2);
      expect(deployPollTimedOut.current).toBe(true);

      await recheckDeployments();

      expect(deployPollTimedOut.current).toBe(false);
      // A pending build is still pending, so the automatic re-checks pick up again
      expect(vi.getTimerCount()).toBe(1);

      release();
    });

    test('schedules nothing when no view is watching', async () => {
      await recheckDeployments();

      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
