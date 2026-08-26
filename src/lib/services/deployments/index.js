import { writable } from 'svelte/store';

/**
 * @import { Writable } from 'svelte/store';
 * @import { DeployStatus } from '$lib/types/private';
 */

/**
 * Deployments reported by the CI/CD provider connected to the Git backend, keyed by commit SHA.
 * They’re kept here rather than on the pull request objects, because a pull request is rebuilt on
 * every status change while a deployment is refreshed on its own schedule.
 * @type {Writable<Record<string, DeployStatus>>}
 */
export const deployments = writable({});

/**
 * Head commit of the configured branch, which is what the production site is built from. It’s
 * refreshed after every commit, so the UI can tell whether the user’s own change is live yet.
 * @type {Writable<string>}
 */
export const productionSHA = writable('');

/**
 * Whether the automatic re-checks gave up on a pending build, in which case the UI offers a manual
 * re-check instead.
 * @type {Writable<boolean>}
 */
export const deployPollTimedOut = writable(false);

/**
 * Drop the deployments recorded for the given commits. Called when a pull request is closed, so the
 * store doesn’t grow for the lifetime of the session.
 * @param {(string | undefined)[]} shas Commit SHAs to forget. A pull request opened in an older
 * session may have no head commit recorded, so a missing one is simply ignored.
 */
export const forgetDeployments = (shas) => {
  const targets = shas.filter((sha) => !!sha);

  if (!targets.length) {
    return;
  }

  deployments.update((map) =>
    Object.fromEntries(Object.entries(map).filter(([sha]) => !targets.includes(sha))),
  );
};

/**
 * Reset every deployment store. Called when the user signs out.
 */
export const resetDeployments = () => {
  deployments.set({});
  productionSHA.set('');
  deployPollTimedOut.set(false);
};
