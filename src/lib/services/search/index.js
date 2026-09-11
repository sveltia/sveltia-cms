import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * What is being searched, or `null` while the search page is not shown.
 * @type {{ current: 'contents' | 'assets' | null }}
 */
export const searchMode = createRawState(null);

/**
 * Current search terms.
 */
export const searchTerms = createRawState('');
