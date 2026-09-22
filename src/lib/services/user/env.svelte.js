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

/**
 * Whether a click on a list item opens it right away, as there is no double-click to wait for: on
 * a small or medium screen, where the selection checkbox is hidden, and on a touch screen of any
 * size, e.g. a tablet in landscape, because Safari never fires `dblclick` for a double tap.
 * `pointerType` tells a tap from a mouse click where the browser dispatches `click` as a
 * `PointerEvent`; elsewhere, the lack of a fine pointer does. A click with no pointer at all — one
 * synthesized for the Enter key — opens the item as well, so it can be opened from the keyboard.
 * @param {MouseEvent} event `click` event.
 * @returns {boolean} Result.
 */
export const opensOnClick = (event) =>
  env.isSmallScreen ||
  env.isMediumScreen ||
  event.detail === 0 ||
  /** @type {PointerEvent} */ (event).pointerType === 'touch' ||
  !env.hasMouse;
