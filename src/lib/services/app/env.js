import { writable } from 'svelte/store';

/**
 * Whether the app is displayed on a small screen (mobile).
 */
export const isSmallScreen = writable(false);
