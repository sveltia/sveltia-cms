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
 * Whether the user has a mouse.
 */
export const hasMouse = writable(true);

/**
 * Initialize the screen side detection. This should be called within `onMount()`.
 */
export const initUserEnvDetection = () => {
  const mqlSmall = globalThis.matchMedia('(width < 768px)');
  const mqlMedium = globalThis.matchMedia('(768px <= width < 1024px)');
  const mqlLarge = globalThis.matchMedia('(1024px <= width)');
  const mqlPointer = globalThis.matchMedia('(pointer: fine)');
  /* eslint-disable jsdoc/require-jsdoc */
  const isSmallScreenSetter = () => isSmallScreen.set(mqlSmall.matches);
  const isMediumScreenSetter = () => isMediumScreen.set(mqlMedium.matches);
  const isLargeScreenSetter = () => isLargeScreen.set(mqlLarge.matches);
  const hasMouseSetter = () => hasMouse.set(mqlPointer.matches);
  /* eslint-enable jsdoc/require-jsdoc */

  isSmallScreenSetter();
  isMediumScreenSetter();
  isLargeScreenSetter();
  hasMouseSetter();

  mqlSmall.addEventListener('change', isSmallScreenSetter);
  mqlMedium.addEventListener('change', isMediumScreenSetter);
  mqlLarge.addEventListener('change', isLargeScreenSetter);
  mqlPointer.addEventListener('change', hasMouseSetter);
};
