import { writable } from 'svelte/store';

/**
 * @import { Writable } from 'svelte/store';
 */

/**
 * @type {Writable<'contents' | 'assets' | null>}
 */
export const searchMode = writable(null);

/**
 * @type {Writable<string>}
 */
export const searchTerms = writable('');
