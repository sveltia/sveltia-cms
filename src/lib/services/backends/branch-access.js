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
