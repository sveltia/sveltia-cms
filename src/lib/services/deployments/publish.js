import { derived } from 'svelte/store';

import { deployments, lastCommitPublishHint, productionSHA } from '$lib/services/deployments';

/**
 * @import { Readable } from 'svelte/store';
 */

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
  lastCommitPublishHint.set({ published, time: Date.now() });
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
 * @type {Readable<boolean>}
 */
export const isLastCommitPublished = derived(
  [lastCommitPublishHint, deployments, productionSHA],
  ([{ published, time }, deployMap, sha]) => {
    const status = sha ? deployMap[sha] : undefined;

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
  },
);
