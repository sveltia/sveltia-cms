import { derived, get } from 'svelte/store';

import { backend } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { deployments, productionSHA } from '$lib/services/deployments';
import { DEPLOY_TTL } from '$lib/services/deployments/constants';
import { prefs } from '$lib/services/user/prefs.svelte';
import { unpublishedEntries } from '$lib/services/workflow';

/**
 * @import { Readable } from 'svelte/store';
 * @import { BackendService, DeployStatus, DeployTarget } from '$lib/types/private';
 */

/**
 * Report what the lookup is doing while dev mode is on. The requests it makes are ordinary API
 * calls, indistinguishable from the rest in the network panel, so a preview that never appears is
 * otherwise hard to trace.
 * @param {string} message What happened.
 * @param {any | (() => any)} [detail] Supporting detail, or a function returning it when working
 * that out costs more than reading a variable. Nothing is evaluated while dev mode is off.
 */
const report = (message, detail) => {
  if (!prefs.devModeEnabled) {
    return;
  }

  // eslint-disable-next-line no-console
  console.info(
    `deployPreview: ${message}`,
    (typeof detail === 'function' ? detail() : detail) ?? '',
  );
};

/**
 * Incremented whenever an in-flight resolution should be discarded, which happens when polling
 * stops. The shared request helper takes no abort signal, so the response is dropped on arrival
 * instead of the request being cancelled.
 */
let currentToken = 0;
/**
 * Incremented as each resolution starts. Two can be in flight at once — a scheduled check and the
 * manual re-check, say — and the one that started later is the more authoritative, so an older
 * response is dropped rather than allowed to land on top of it.
 */
let runCount = 0;

/**
 * Discard whatever resolution is in flight, so its result doesn’t land in the store after the view
 * that asked for it is gone.
 */
export const cancelDeployResolution = () => {
  currentToken += 1;
};

/**
 * Collect the commits worth looking up: the head of the configured branch, which the production
 * site is built from, and the head of every open Editorial Workflow pull request.
 * @returns {DeployTarget[]} Targets, without duplicates.
 */
export const getDeployTargets = () => {
  const branch = get(backend)?.repository?.branch ?? '';
  /** @type {DeployTarget[]} */
  const targets = [];
  const seen = new Set();
  const prodSHA = get(productionSHA);

  if (prodSHA) {
    targets.push({ sha: prodSHA, branch, kind: 'production' });
    seen.add(prodSHA);
  }

  get(unpublishedEntries).forEach(({ workflow: { pullRequest } }) => {
    const { headSHA, branch: prBranch } = pullRequest;

    if (headSHA && !seen.has(headSHA)) {
      targets.push({ sha: headSHA, branch: prBranch, kind: 'preview' });
      seen.add(headSHA);
    }
  });

  return targets;
};

/**
 * The commits worth looking up, recomputed whenever the branch head moves or the open pull requests
 * change — which is what a save does. Anything watching the deploy state uses this rather than
 * calling {@link getDeployTargets} once, so a commit made during the session is picked up.
 * @type {Readable<DeployTarget[]>}
 */
export const deployTargets = derived([productionSHA, unpublishedEntries], () => getDeployTargets());

/**
 * Whether it’s worth asking the backend about deployments at all. There’s nothing to look up when
 * the service can’t report one, and nothing to show when preview links are turned off.
 * @returns {boolean} Result.
 */
export const canResolveDeployments = () => {
  const { show_preview_links: showLinks = true } = get(cmsConfig) ?? {};

  return showLinks && !!get(backend)?.fetchDeployments;
};

/**
 * Whether the recorded deployment is recent enough to reuse.
 * @param {DeployStatus} [status] Recorded deployment.
 * @returns {boolean} Result.
 */
const isFresh = (status) =>
  !!status && status.state !== 'checking' && Date.now() - status.checkedTime < DEPLOY_TTL;

/**
 * Record that a lookup is about to happen for any commit nothing is known about yet. This runs
 * synchronously, so the control reports the wait from the moment a save moves the tracked commit
 * rather than showing a live site link until the first result lands.
 */
export const markLookupPending = () => {
  const targets = getDeployTargets();

  deployments.update((map) => {
    /** @type {Record<string, DeployStatus>} */
    const additions = Object.fromEntries(
      targets
        .filter(({ sha }) => !map[sha])
        .map(({ sha }) => [
          sha,
          /** @type {DeployStatus} */ ({ state: 'checking', checkedTime: 0 }),
        ]),
    );

    // Leave the store alone when there’s nothing to add, so subscribers aren’t woken for nothing
    return Object.keys(additions).length ? { ...map, ...additions } : map;
  });
};

/**
 * Ask the backend for the deployment status of every tracked commit and record the results. A
 * failure is reported as an unknown state rather than thrown, because a missing deploy preview
 * shouldn’t stop the user from editing.
 * @param {object} [options] Options.
 * @param {boolean} [options.force] Whether to re-query a commit whose deployment is still fresh.
 * @param {boolean} [options.pendingOnly] Whether to look only at commits whose build hasn’t
 * finished. Used by the re-check loop, which would otherwise keep asking about every commit on the
 * board just because one of them is still building, and which ignores the freshness window because
 * re-reading is the point.
 * @returns {Promise<void>}
 */
export const resolveDeployments = async ({ force = false, pendingOnly = false } = {}) => {
  if (!canResolveDeployments()) {
    report(
      'not looking anything up: the backend can’t report deployments, or preview links are off',
    );

    return;
  }

  // Guaranteed by the check above
  const fetchDeployments = /** @type {NonNullable<BackendService['fetchDeployments']>} */ (
    get(backend)?.fetchDeployments
  );

  const cached = get(deployments);

  const targets = getDeployTargets().filter(({ sha }) => {
    if (force) {
      return true;
    }

    const state = cached[sha]?.state;

    if (pendingOnly) {
      // A finished build won’t change on its own; only a forced re-check looks at one again.
      // Everything else is re-read however recently it was seen — noticing a change is the whole
      // reason the loop is running, so treating a recent answer as good enough would throttle the
      // checks to the freshness window and leave the interval doing nothing
      return state !== 'ready' && state !== 'error';
    }

    return !isFresh(cached[sha]);
  });

  if (!targets.length) {
    report('nothing to look up', () => ({ tracked: getDeployTargets(), known: cached }));

    return;
  }

  report('looking up', targets);

  const token = currentToken;

  runCount += 1;

  const run = runCount;

  // Only a commit with no result yet shows as being checked; re-checking a known one in the
  // background shouldn’t flip the UI back to a loading state on every poll
  deployments.update((map) => ({
    ...map,
    ...Object.fromEntries(
      targets
        .filter(({ sha }) => !map[sha])
        .map(({ sha }) => [sha, { state: 'checking', checkedTime: 0 }]),
    ),
  }));

  /** @type {Record<string, DeployStatus>} */
  let results;

  try {
    results = await fetchDeployments(targets);
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch the deployment info.', ex);

    results = Object.fromEntries(
      targets.map(({ sha }) => [sha, { state: 'unknown', checkedTime: Date.now() }]),
    );
  }

  if (token !== currentToken) {
    report('discarding a result that arrived after the lookup was cancelled', results);

    return;
  }

  if (run !== runCount) {
    report('discarding a result that a later lookup has superseded', results);

    return;
  }

  report('resolved', results);
  deployments.update((map) => ({ ...map, ...results }));
};

/**
 * Resolve the head commit of the configured branch, which the production site is built from.
 * @returns {Promise<void>}
 */
export const refreshProductionSHA = async () => {
  const fetchBranchHeadSHA = get(backend)?.fetchBranchHeadSHA;

  if (!fetchBranchHeadSHA) {
    return;
  }

  try {
    const sha = (await fetchBranchHeadSHA()) ?? '';

    report('tracking the branch head', sha);
    productionSHA.set(sha);
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch the branch head commit.', ex);
  }
};

/**
 * Look the production deployment target up and resolve whatever is known so far. Called once the
 * user is signed in and the content has been loaded.
 *
 * The caller doesn’t await this, so nothing may escape: an unexpected failure would otherwise
 * surface as an unhandled rejection rather than something anyone can act on. The deploy state is a
 * convenience, and losing it shouldn’t be louder than that.
 * @returns {Promise<void>}
 */
export const initDeployments = async () => {
  try {
    await refreshProductionSHA();
    await resolveDeployments();
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error('Failed to look up the deployment info.', ex);
  }
};
