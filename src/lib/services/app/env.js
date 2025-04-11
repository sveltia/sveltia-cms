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

/**
 * Initialize the screen side detection. This should be called within `onMount()`.
 */
export const initScreenSizeDetection = () => {
  const mqlSmall = globalThis.matchMedia('(width < 768px)');
  const mqlMedium = globalThis.matchMedia('(768px <= width < 1024px)');
  const mqlLarge = globalThis.matchMedia('(1024px <= width)');

  isSmallScreen.set(mqlSmall.matches);
  isMediumScreen.set(mqlMedium.matches);
  isLargeScreen.set(mqlLarge.matches);

  mqlSmall.addEventListener('change', () => {
    isSmallScreen.set(mqlSmall.matches);
  });

  mqlMedium.addEventListener('change', () => {
    isMediumScreen.set(mqlMedium.matches);
  });

  mqlMedium.addEventListener('change', () => {
    isLargeScreen.set(mqlLarge.matches);
  });
};
