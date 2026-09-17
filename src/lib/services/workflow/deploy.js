import { deployments, deployPollTimedOut, productionSHA } from '$lib/services/deployments';
import { canResolveDeployments } from '$lib/services/deployments/resolve';
import {
  createDerivedState,
  createRawState,
  createRootEffect,
} from '$lib/services/utils/state.svelte';

/**
 * @import { DeployingEntry, UnpublishedEntry } from '$lib/types/private';
 */

/**
 * Entries whose pull request has been merged during this session, in merge order, as recorded by
 * {@link trackDeployingEntry} — whatever the site has done since.
 * @type {{ current: DeployingEntry[] }}
 */
const mergedEntries = createRawState([]);

/**
 * Whether the site has caught up with the given commit on the configured branch. A finished build
 * counts, and so does a commit nothing reports on once the re-checks have given the provider time:
 * there’s nothing more to wait for either way. A failed build doesn’t count, because the change
 * isn’t on the site, and the board is where that shows until a later commit — the next save or
 * merge — is built.
 * @param {string} sha Commit SHA.
 * @returns {boolean} Result.
 */
const isBuildDone = (sha) => {
  const state = sha ? deployments.current[sha]?.state : undefined;

  return state === 'ready' || state === 'unknown';
};

/**
 * Whether the site has caught up with the head of the configured branch, which is the commit every
 * merge made so far has landed on.
 */
export const productionBuildDone = createDerivedState(() => isBuildDone(productionSHA.current));

/**
 * Entries whose change is on its way to the site: their pull request has been merged, but the site
 * hasn’t been rebuilt and deployed from the merge yet, so a published entry isn’t live and a
 * deleted one is still up. They stay on the Editorial Workflow board with the build state until
 * the site has caught up, because a merged deletion has left the entry list, and the board is the
 * only place left to say so.
 *
 * Every merge lands on the same branch, so a build of any later commit carries the earlier changes
 * as well: an entry is on its way until the build of its own commit, of one recorded after it, or
 * of the current branch head is done. The re-check loop only follows the current head, so the
 * build of a commit that was superseded while still running is never seen to finish, and the
 * later ones are what conclude it.
 * @type {{ readonly current: DeployingEntry[] }}
 * @see https://github.com/sveltia/sveltia-cms/issues/992
 */
export const deployingEntries = createDerivedState(() => {
  if (productionBuildDone.current) {
    return [];
  }

  const entries = mergedEntries.current;
  const lastDone = entries.findLastIndex(({ sha }) => isBuildDone(sha));

  return lastDone === -1 ? entries : entries.slice(lastDone + 1);
});

/**
 * Record that the given entry’s pull request has been merged, so the board can show it until the
 * site has caught up. Nothing is recorded when the backend can’t report deployments, because the
 * wait would never be seen to end. The head of the configured branch has to be refreshed first, or
 * the entry would be judged against the build of the commit before the merge.
 * @param {UnpublishedEntry} entry Entry as it was published, with the workflow properties.
 */
export const trackDeployingEntry = (entry) => {
  const sha = productionSHA.current;

  if (!canResolveDeployments() || !sha) {
    return;
  }

  const { workflow } = entry;
  const { branch } = workflow.pullRequest;

  mergedEntries.current = [
    // Only the entries still on their way are kept, so the list doesn’t grow for the lifetime of
    // the session. One published again replaces its earlier record
    ...deployingEntries.current.filter((e) => e.entry.workflow.pullRequest.branch !== branch),
    {
      entry: {
        ...entry,
        workflow: {
          ...workflow,
          // The merge time is what the card shows
          pullRequest: { ...workflow.pullRequest, updatedDate: new Date() },
        },
      },
      sha,
    },
  ];
};

/**
 * Forget the merged entries. Called when the user signs out.
 */
export const resetDeployingEntries = () => {
  mergedEntries.current = [];
};

// Once the re-checks have given up on a build, nothing more will be learned about it on its own,
// so the entries waiting for it are let go rather than left saying the site is on its way. This
// has to stick: the flag is cleared again as soon as the re-checks restart, which any save or
// merge does by moving a tracked commit, and a list that merely hid its entries while the flag was
// set would bring them all back then
createRootEffect(() => {
  if (deployPollTimedOut.current) {
    resetDeployingEntries();
  }
});
