import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * The configured branch, if the signed-in user can’t push to it, e.g. because it’s protected and
 * only Maintainers are allowed to push on GitLab. Everything that commits to the branch directly,
 * namely entries in a collection with the simple publish mode and assets, is then read-only, while
 * Editorial Workflow still works, as it commits to a branch of its own. It’s `undefined` when the
 * user can push to the branch, or when the backend doesn’t tell.
 * @type {{ current: string | undefined }}
 */
export const lockedBranch = createRawState();
