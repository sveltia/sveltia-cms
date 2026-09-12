import { backend } from '$lib/services/backends';
import { deployments, lastCommitPublishHint, productionSHA } from '$lib/services/deployments';
import { prefs } from '$lib/services/user/prefs.svelte';
import { isSecureURL } from '$lib/services/utils/networking';
import { createDerivedState } from '$lib/services/utils/state.svelte';

/**
 * Record what the last commit is expected to have done, worked out without asking the CI/CD
 * provider: `true` when it should have started a deployment, `false` when it shouldn’t have. It’s
 * called when the commit message carries a skip-CI marker, when a commit is made with a known
 * skip-CI option, and when the user triggers a deployment by hand.
 *
 * The time is recorded along with it so that {@link isLastCommitPublished} can tell a deployment
 * read before this point from one read after: the failed build the user has just asked to retry
 * describes an earlier state of the commit, and mustn’t go on saying the site is out of date.
 * @param {boolean} published Whether the last commit is expected to have started a deployment.
 */
export const setLastCommitPublishHint = (published) => {
  lastCommitPublishHint.current = { published, time: Date.now() };
};

/**
 * Whether the last commit on the production branch has been deployed. It decides whether the
 * Publish Changes button in the global toolbar offers to trigger a deployment.
 *
 * What the CI/CD provider reports for the commit is preferred, as long as it was read after the
 * expectation recorded by {@link setLastCommitPublishHint} was formed. A build that ran — whether
 * it’s still running or has finished — means the commit went out, and one that failed means it
 * didn’t, so the site is stale and worth deploying again.
 *
 * Everything else falls back to the expectation. Nothing reported is ambiguous: the provider may
 * have skipped the commit, or the repository may have no CI connected to the Git service at all,
 * and the two are indistinguishable from a single commit.
 */
export const isLastCommitPublished = createDerivedState(() => {
  const { published, time } = lastCommitPublishHint.current;
  const { current: sha } = productionSHA;
  const status = sha ? deployments.current[sha] : undefined;

  // A commit still being looked up reports no time, so it falls back here as well
  if (!status || status.checkedTime <= time) {
    return published;
  }

  if (status.state === 'ready' || status.state === 'pending') {
    return true;
  }

  if (status.state === 'error') {
    return false;
  }

  return published;
});

/**
 * Whether a deployment can be triggered by hand: there has to be a way to do it — a deploy hook
 * URL configured by the user, or a backend that can trigger a build itself — and the last commit
 * has to be out of date.
 */
export const canTriggerDeployment = createDerivedState(
  () =>
    (!!prefs.deployHookURL || typeof backend.current?.triggerDeployment === 'function') &&
    !isLastCommitPublished.current,
);

/**
 * Trigger a manual deployment on the CI/CD provider, by calling the deploy hook URL configured by
 * the user if there is one, or the backend’s own API otherwise. Once the request has been accepted,
 * the last commit is expected to have started a deployment.
 * @throws {Error} When the deploy hook URL is not secure, or the request has failed.
 */
export const triggerDeployment = async () => {
  const { deployHookURL, deployHookAuthHeader } = prefs;

  if (deployHookURL && !isSecureURL(deployHookURL)) {
    throw new Error('Deploy hook URL must use HTTPS or localhost');
  }

  const { ok, status } = deployHookURL
    ? await fetch(deployHookURL, {
        method: 'POST',
        mode: deployHookAuthHeader ? 'cors' : 'no-cors',
        headers: deployHookAuthHeader ? { Authorization: deployHookAuthHeader } : {},
      })
    : ((await backend.current?.triggerDeployment?.()) ?? {});

  // If the `mode` is `no-cors`, the regular response status will be `0`
  if (!ok && (deployHookAuthHeader || status !== 0)) {
    throw new Error(`Webhook returned ${status} error`);
  }

  // The provider hasn’t been asked about the new run yet, so record that one was requested.
  // Anything it reported about the commit before this point describes the state being replaced
  setLastCommitPublishHint(true);
};
