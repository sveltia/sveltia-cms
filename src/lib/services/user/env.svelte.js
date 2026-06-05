/**
 * Reactive environment detection state for the CMS.
 */
export const env = $state({
  /** Whether the app is running on localhost. */
  isLocalHost: false,
  /** Whether the local backend is supported. */
  isLocalBackendSupported: false,
  /** Whether the browser is Brave. */
  isBrave: false,
  /** Whether the operating system is macOS. */
  isMacOS: false,
  /** Whether the app is displayed on a small screen (mobile). */
  isSmallScreen: false,
  /** Whether the app is displayed on a medium screen (tablet). */
  isMediumScreen: false,
  /** Whether the app is displayed on a large screen (desktop). */
  isLargeScreen: false,
  /** Whether the user has a mouse. */
  hasMouse: true,
});

/**
 * Initialize the screen size detection. This should be called within `onMount()` due to the access
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
  env.isLocalHost = hostname === '127.0.0.1' || /^(.+\.)?localhost$/.test(hostname);
  env.isLocalBackendSupported = 'showDirectoryPicker' in globalThis;
  env.isBrave = userAgentData?.brands.some(({ brand }) => brand === 'Brave') ?? false;
  env.isMacOS = userAgentData?.platform === 'macOS' || platform.startsWith('Mac');

  const mqlSmall = matchMedia('(width < 768px)');
  const mqlMedium = matchMedia('(768px <= width < 1024px)');
  const mqlLarge = matchMedia('(1024px <= width)');
  const mqlPointer = matchMedia('(pointer: fine)');

  /* eslint-disable jsdoc/require-jsdoc */
  const isSmallScreenSetter = () => {
    env.isSmallScreen = mqlSmall.matches;
  };

  const isMediumScreenSetter = () => {
    env.isMediumScreen = mqlMedium.matches;
  };

  const isLargeScreenSetter = () => {
    env.isLargeScreen = mqlLarge.matches;
  };

  const hasMouseSetter = () => {
    env.hasMouse = mqlPointer.matches;
  };
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
