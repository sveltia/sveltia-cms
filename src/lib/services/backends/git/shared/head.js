import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * Head commit of the configured branch that the loaded site data reflects: the commit the files
 * were fetched at, or the user’s own latest commit. Comparing it with the branch’s current head
 * tells whether someone else has pushed since. Empty until the site data has been loaded, and for a
 * backend that doesn’t track commits.
 */
export const repositoryHead = createRawState('');

/**
 * Generation of the loaded site data, incremented when it’s discarded, e.g. on sign-out. A fetch
 * still on its way at that point, like a check for remote changes, belongs to the previous session:
 * it compares the generation it started in with the current one and drops its results instead of
 * putting them back into the stores, where the next user would find them.
 */
export const dataGeneration = { current: 0 };

/**
 * Create a check telling whether the site data has been discarded since the call, e.g. by signing
 * out. A fetch started in one session uses it to drop its results once that session is over.
 * @returns {() => boolean} Function returning `true` if the {@link dataGeneration} has changed
 * since the check was created.
 */
export const createStaleCheck = () => {
  const generation = dataGeneration.current;

  return () => generation !== dataGeneration.current;
};
