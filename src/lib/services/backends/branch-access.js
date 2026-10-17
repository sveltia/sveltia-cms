import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { WorkflowPullRequest } from '$lib/types/private';
 */

/**
 * The configured branch, if the signed-in user can’t push to it, e.g. because it’s protected and
 * only Maintainers are allowed to push on GitLab. Everything that commits to the branch directly,
 * namely entries in a collection with the simple publish mode and assets, is then read-only, while
 * Editorial Workflow still works, as it commits to a branch of its own. It’s `undefined` when the
 * user can push to the branch, or when the backend doesn’t tell.
 * @type {{ current: string | undefined }}
 */
export const lockedBranch = createRawState();

/**
 * The configured branch, if the signed-in user can’t merge pull requests into it, e.g. because
 * it’s protected on Gitea and only some users are allowed to merge. Publishing an unpublished
 * entry merges its pull request, so the control isn’t offered then. It’s `undefined` when the user
 * can merge, or when the backend doesn’t tell for the branch as a whole: GitLab tells for each
 * merge request instead, with {@link WorkflowPullRequest.canMerge}.
 * @type {{ current: string | undefined }}
 */
export const mergeLockedBranch = createRawState();

/**
 * Check what the user can do on the configured branch, and record it in {@link lockedBranch} and
 * {@link mergeLockedBranch}. A failed request leaves the branch writable and mergeable, as the
 * backend still refuses a push or merge the user isn’t allowed to make.
 * @param {string | undefined} branch Configured branch.
 * @param {(branch: string) => Promise<{ canPush?: boolean, canMerge?: boolean }>} fetchAccess
 * Function to fetch the user’s access to the branch. A permission it doesn’t tell is assumed.
 */
export const recordBranchAccess = async (branch, fetchAccess) => {
  /** @type {{ canPush?: boolean, canMerge?: boolean }} */
  let access = {};

  if (branch) {
    try {
      access = await fetchAccess(branch);
    } catch {
      // Keep the branch writable, as said above
    }
  }

  lockedBranch.current = access.canPush === false ? branch : undefined;
  mergeLockedBranch.current = access.canMerge === false ? branch : undefined;
};
