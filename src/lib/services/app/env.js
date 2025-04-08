import { writable } from 'svelte/store';

/**
 * Whether the app is displayed on a small screen (mobile).
 */
export const isSmallScreen = writable(false);

/**
 * Whether the app is displayed on a medium screen (tablet).
 */
export const isMediumScreen = writable(false);

/**
 * Whether the app is displayed on a large screen (desktop).
 */
export const isLargeScreen = writable(false);
