import { writable } from 'svelte/store';

/**
 * Whether the app is running on localhost.
 */
export const isLocalHost = writable(false);

/**
 * Whether the local backend is supported.
 */
export const isLocalBackendSupported = writable(false);

/**
 * Whether the browser is Brave.
 */
export const isBrave = writable(false);

/**
 * Whether the operating system is macOS.
 */
export const isMacOS = writable(false);

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
 * Initialize the screen side detection. This should be called within `onMount()` due to the access
 * to the DOM APIs.
 */
export const initUserEnvDetection = () => {
  const {
    location: { hostname },
    navigator: { userAgentData, platform },
    matchMedia,
  } = globalThis;

  // Local editing needs a secure context, either `http://localhost` or `http://*.localhost`
  // https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
  isLocalHost.set(hostname === '127.0.0.1' || /^(.+\.)?localhost$/.test(hostname));
  isLocalBackendSupported.set('showDirectoryPicker' in globalThis);
  isBrave.set(userAgentData?.brands.some(({ brand }) => brand === 'Brave') ?? false);
  isMacOS.set(userAgentData?.platform === 'macOS' || platform.startsWith('Mac'));

  const mqlSmall = matchMedia('(width < 768px)');
  const mqlMedium = matchMedia('(768px <= width < 1024px)');
  const mqlLarge = matchMedia('(1024px <= width)');
  const mqlPointer = matchMedia('(pointer: fine)');
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
