import { writable } from 'svelte/store';

/**
 * @import { Writable } from 'svelte/store';
 */

/**
 * @type {Writable<'entries' | 'assets' | null>}
 */
export const searchMode = writable(null);

/**
 * @type {Writable<string>}
 */
export const searchTerms = writable('');
