import { untrack } from 'svelte';

import { deployments, deployPollTimedOut } from '$lib/services/deployments';
import {
  POLL_INTERVAL,
  POLL_MAX_DURATION,
  UNKNOWN_GRACE_DURATION,
} from '$lib/services/deployments/constants';
import {
  cancelDeployResolution,
  canResolveDeployments,
  deployTargets,
  markLookupPending,
  resolveDeployments,
} from '$lib/services/deployments/resolve';
import { prefs } from '$lib/services/user/prefs.svelte';
import { createRootEffect } from '$lib/services/utils/state.svelte';

/**
 * @import { DeployStatus } from '$lib/types/private';
 */

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
 * Whether every tracked commit has reached a state that won’t change on its own. A commit with
 * nothing reported against it counts, because {@link keepWaiting} holds one back in the `checking`
 * state while the provider is still being given time to report — so an `unknown` that has landed in
 * the store is one the loop has already waited for, or one that was concluded before the run
 * began.
 * @returns {boolean} Result.
 */
const isSettled = () => {
  const map = deployments.current;

  return deployTargets.current.every(({ sha }) => {
    const state = map[sha]?.state;

    // Nothing recorded yet, or a build still running, is worth another look
    return state === 'ready' || state === 'error' || state === 'unknown';
  });
};

/**
 * Put the given commits back into the `checking` state, so the preview control keeps saying that a
 * preview is on its way rather than offering the live site, and the loop keeps looking at them.
 * @param {string[]} shas Commits to hold back.
 * @param {string} reason Why, for the dev mode report.
 */
const holdBack = (shas, reason) => {
  if (!shas.length) {
    return;
  }

  if (prefs.devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info(`deployPreview: ${reason}`, {
      shas,
      remaining: UNKNOWN_GRACE_DURATION - (Date.now() - startTime),
    });
  }

  const map = deployments.current;

  deployments.current = {
    ...map,
    ...Object.fromEntries(
      shas.map((sha) => [sha, /** @type {DeployStatus} */ ({ ...map[sha], state: 'checking' })]),
    ),
  };
};

/**
 * Keep waiting for the commits that were being checked and came back with nothing reported, as long
 * as the run is young enough that the provider may not have posted its first status yet. Once the
 * grace period is over, an empty answer is final. A commit that was already `unknown` when the run
 * began is left alone; it was concluded earlier, and nothing has happened to it since.
 * @param {Record<string, DeployStatus>} before Deploy state as of just before the lookup.
 * @see https://github.com/sveltia/sveltia-cms/issues/991
 */
const keepWaiting = (before) => {
  if (Date.now() - startTime >= UNKNOWN_GRACE_DURATION) {
    return;
  }

  const map = deployments.current;

  const shas = deployTargets.current
    .map(({ sha }) => sha)
    .filter((sha) => {
      if (map[sha]?.state !== 'unknown') {
        return false;
      }

      const prior = before[sha];

      // A commit with no record yet was marked as being checked by the lookup itself. One that a
      // lookup made outside the loop — the initial one at sign-in — concluded while this run was
      // going hasn’t been waited for either
      return (
        !prior ||
        prior.state === 'checking' ||
        (prior.state === 'unknown' && prior.checkedTime >= startTime)
      );
    });

  holdBack(shas, 'nothing reported yet, still waiting');
};

/**
 * Give a commit that was found to be unreported only moments ago the grace period as well, by
 * putting it back into the `checking` state before the run begins. Such a conclusion comes from the
 * lookup made at sign-in, which runs outside the loop: the CMS may have been reloaded right after a
 * save, before the provider posted anything, and that one lookup would otherwise be the last word
 * for the whole session. A conclusion older than the grace period stands — nothing reports on that
 * commit, and there’s nothing new to learn.
 */
const reopenRecentConclusions = () => {
  const map = deployments.current;
  const now = Date.now();

  const shas = deployTargets.current
    .map(({ sha }) => sha)
    .filter((sha) => {
      const status = map[sha];

      return status?.state === 'unknown' && now - status.checkedTime < UNKNOWN_GRACE_DURATION;
    });

  holdBack(shas, 'concluded only moments ago, waiting a little longer');
};

/**
 * Identify the current set of tracked commits, so a change to it can be noticed.
 * @returns {string} Key.
 */
const getTargetKey = () => deployTargets.current.map(({ sha }) => sha).join(',');

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
    deployPollTimedOut.current = true;
    stop();

    return;
  }

  const run = generation;

  timer = globalThis.setTimeout(async () => {
    timer = 0;
    attempts += 1;

    const before = deployments.current;

    // A finished build is skipped, so one entry still building doesn’t drag the whole board along
    await resolveDeployments({ pendingOnly: true });

    // This comes before the run is checked: a save while the request was out retires the run but
    // not the request, so its answer still lands, and a commit it found nothing on would otherwise
    // be concluded without its grace period
    keepWaiting(before);

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
  deployPollTimedOut.current = false;

  if (canResolveDeployments()) {
    // Say a lookup is coming before making it, so nothing shows a stale answer in the meantime
    markLookupPending();
    reopenRecentConclusions();
  }

  schedule();
};

/**
 * Start re-checking the deploy state, or join a run that’s already going. Re-checks stop once every
 * holder has released, so the entry editor and the Editorial Workflow board can share one loop.
 * @returns {() => void} Function to release this caller’s hold.
 */
const retain = () => {
  holders += 1;

  if (holders === 1) {
    lastKey = getTargetKey();

    // Saving moves the branch head, or gives a pull request a new head commit, and that’s exactly
    // when the state needs watching again — by which time the loop has usually stopped, because
    // everything it knew about had already settled
    unwatch = createRootEffect(() => {
      const key = getTargetKey();

      if (key !== lastKey) {
        lastKey = key;
        // Only track the targets, not the state the lookup reads and writes
        untrack(restart);
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
 * Start re-checking the deploy state, or join a run that’s already going. Re-checks stop once every
 * holder has released, so the entry editor and the Editorial Workflow board can share one loop.
 *
 * A component calls this from an effect, and nothing the loop reads is tracked by that effect: the
 * first check reads the deploy state to decide whether anything is still building, and a lookup
 * writes it, so a tracked read would re-run the effect on every answer — releasing the hold,
 * cancelling the lookup that was just made, and starting over without ever landing a result.
 * @returns {() => void} Function to release this caller’s hold.
 */
export const retainDeployPolling = () => untrack(retain);

/**
 * Query the backend right away, ignoring the cached results and the current backoff. This backs the
 * manual re-check offered when the automatic ones gave up.
 * @returns {Promise<void>}
 */
export const recheckDeployments = async () => {
  supersede();
  deployPollTimedOut.current = false;

  await resolveDeployments({ force: true });

  restart();
};
