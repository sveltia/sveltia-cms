import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { DeployStatus, PublishHint } from '$lib/types/private';
 */

/**
 * Deployments reported by the CI/CD provider connected to the Git backend, keyed by commit SHA.
 * They’re kept here rather than on the pull request objects, because a pull request is rebuilt on
 * every status change while a deployment is refreshed on its own schedule.
 * @type {{ current: Record<string, DeployStatus> }}
 */
export const deployments = createRawState({});

/**
 * Head commit of the configured branch, which is what the production site is built from. It’s
 * refreshed after every commit, so the UI can tell whether the user’s own change is live yet.
 */
export const productionSHA = createRawState('');

/**
 * What the last commit is expected to have done, worked out without asking the CI/CD provider. See
 * {@link setLastCommitPublishHint}.
 * @type {{ current: PublishHint }}
 */
export const lastCommitPublishHint = createRawState({ published: true, time: 0 });

/**
 * Whether the automatic re-checks gave up on a pending build, in which case the UI offers a manual
 * re-check instead.
 */
export const deployPollTimedOut = createRawState(false);

/**
 * Drop the deployments recorded for the given commits. Called when a pull request is closed, so the
 * state doesn’t grow for the lifetime of the session.
 * @param {(string | undefined)[]} shas Commit SHAs to forget. A pull request opened in an older
 * session may have no head commit recorded, so a missing one is simply ignored.
 */
export const forgetDeployments = (shas) => {
  const targets = shas.filter((sha) => !!sha);

  if (!targets.length) {
    return;
  }

  deployments.current = Object.fromEntries(
    Object.entries(deployments.current).filter(([sha]) => !targets.includes(sha)),
  );
};

/**
 * Reset every deployment state. Called when the user signs out.
 */
export const resetDeployments = () => {
  deployments.current = {};
  productionSHA.current = '';
  deployPollTimedOut.current = false;
  lastCommitPublishHint.current = { published: true, time: 0 };
};
