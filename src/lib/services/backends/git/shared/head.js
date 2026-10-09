import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * Head commit of the configured branch that the loaded site data reflects: the commit the files
 * were fetched at, or the user’s own latest commit. Comparing it with the branch’s current head
 * tells whether someone else has pushed since. Empty until the site data has been loaded, and for a
 * backend that doesn’t track commits.
 */
export const repositoryHead = createRawState('');
