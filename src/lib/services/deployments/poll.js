import { get } from 'svelte/store';

import { deployments, deployPollTimedOut } from '$lib/services/deployments';
import { POLL_INTERVAL, POLL_MAX_DURATION } from '$lib/services/deployments/constants';
import {
  cancelDeployResolution,
  canResolveDeployments,
  deployTargets,
  markLookupPending,
  resolveDeployments,
} from '$lib/services/deployments/resolve';
import { prefs } from '$lib/services/user/prefs.svelte';

/**
 * How many checks to keep making while a commit has nothing reported against it. A provider can
 * take a moment to post its first status after a push, so the loop doesn’t conclude from the very
 * first empty answer that there’s no build to wait for.
 */
const UNKNOWN_GRACE_ATTEMPTS = 3;
/** Handle of the scheduled re-check, or `0` when nothing is scheduled. */
let timer = /** @type {any} */ (0);
/** Number of views currently interested in the deploy state. */
let holders = 0;
/** Time the current run started, as a Unix timestamp in milliseconds. */
let startTime = 0;
/** Number of checks made in the current run. */
let attempts = 0;
/** Stops the target watcher, which runs only while something is holding the loop. */
let unwatch = /** @type {(() => void) | undefined} */ (undefined);
/** The tracked commits as of the last check, used to notice that a save moved one. */
let lastKey = '';
/**
 * Incremented whenever the current run is superseded. A check whose request was still out when that
 * happened must not schedule the next one, or two loops would run at once and only the newer
 * timer’s handle would be known — leaving the older one running after every holder had released.
 */
let generation = 0;

/**
 * Whether every tracked commit has reached a state that won’t change on its own.
 * @returns {boolean} Result.
 */
const isSettled = () => {
  const map = get(deployments);

  return get(deployTargets).every(({ sha }) => {
    const state = map[sha]?.state;

    if (state === 'ready' || state === 'error') {
      return true;
    }

    if (state === 'unknown') {
      return attempts >= UNKNOWN_GRACE_ATTEMPTS;
    }

    // Nothing recorded yet, or a build still running
    return false;
  });
};

/**
 * Identify the current set of tracked commits, so a change to it can be noticed.
 * @returns {string} Key.
 */
const getTargetKey = () =>
  get(deployTargets)
    .map(({ sha }) => sha)
    .join(',');

/**
 * Drop the scheduled check and retire the current run, so a request still in flight can’t carry the
 * loop forward on its own.
 */
const supersede = () => {
  globalThis.clearTimeout(timer);
  timer = 0;
  generation += 1;
};

/**
 * Stop re-checking and forget the current run’s state.
 */
const stop = () => {
  supersede();
  cancelDeployResolution();
};

/**
 * Schedule the next re-check, unless there’s nothing left to wait for.
 */
const schedule = () => {
  if (!holders || !canResolveDeployments() || isSettled()) {
    if (prefs.devModeEnabled) {
      // eslint-disable-next-line no-console
      console.info('deployPreview: not re-checking', {
        watchers: holders,
        canResolve: canResolveDeployments(),
        settled: isSettled(),
        attempts,
      });
    }

    stop();

    return;
  }

  if (Date.now() - startTime > POLL_MAX_DURATION) {
    // A build this long is either stuck or reporting through a channel the CMS can’t read, so hand
    // it over to the manual re-check rather than requesting forever
    deployPollTimedOut.set(true);
    stop();

    return;
  }

  const run = generation;

  timer = globalThis.setTimeout(async () => {
    timer = 0;
    attempts += 1;
    // A finished build is skipped, so one entry still building doesn’t drag the whole board along
    await resolveDeployments({ pendingOnly: true });

    // A save or a release while the request was out has already retired this run
    if (run !== generation) {
      return;
    }

    // Reschedule only now, so a slow response can’t let two checks overlap
    schedule();
  }, POLL_INTERVAL);
};

/**
 * Begin a fresh run, discarding whatever the previous one was waiting for.
 */
const restart = () => {
  supersede();
  attempts = 0;
  startTime = Date.now();
  deployPollTimedOut.set(false);

  if (canResolveDeployments()) {
    // Say a lookup is coming before making it, so nothing shows a stale answer in the meantime
    markLookupPending();
  }

  schedule();
};

/**
 * Start re-checking the deploy state, or join a run that’s already going. Re-checks stop once every
 * holder has released, so the entry editor and the Editorial Workflow board can share one loop.
 * @returns {() => void} Function to release this caller’s hold.
 */
export const retainDeployPolling = () => {
  holders += 1;

  if (holders === 1) {
    lastKey = getTargetKey();

    // Saving moves the branch head, or gives a pull request a new head commit, and that’s exactly
    // when the state needs watching again — by which time the loop has usually stopped, because
    // everything it knew about had already settled
    unwatch = deployTargets.subscribe(() => {
      const key = getTargetKey();

      if (key !== lastKey) {
        lastKey = key;
        restart();
      }
    });

    restart();
  }

  let released = false;

  return () => {
    // A component can be destroyed more than once in a hot-reload cycle; only the first release
    // should count
    if (released) {
      return;
    }

    released = true;
    holders -= 1;

    if (!holders) {
      unwatch?.();
      unwatch = undefined;
      stop();
    }
  };
};

/**
 * Query the backend right away, ignoring the cached results and the current backoff. This backs the
 * manual re-check offered when the automatic ones gave up.
 * @returns {Promise<void>}
 */
export const recheckDeployments = async () => {
  supersede();
  deployPollTimedOut.set(false);

  await resolveDeployments({ force: true });

  restart();
};
