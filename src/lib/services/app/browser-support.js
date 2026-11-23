import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @typedef {object} BrowserFeature
 * @property {string} name Name of the feature, logged when it’s missing.
 * @property {() => boolean} test Function that tells whether the browser supports the feature.
 */

/**
 * The most recently added JavaScript built-ins the app relies on. A browser lacking any of them is
 * too old to run the app: it would fail while loading the configuration, or later in ways the user
 * can’t make sense of, e.g. a rich text field that never updates the entry. Syntax the browser
 * doesn’t support can’t be detected here, as the bundle wouldn’t even load.
 * @type {BrowserFeature[]}
 */
const REQUIRED_FEATURES = [
  {
    name: 'Uint8Array Base64/hex conversion',
    /**
     * Supported by Chrome/Edge 140, Firefox 133 and Safari 18.2.
     * @returns {boolean} Result.
     */
    test: () =>
      typeof Uint8Array.fromBase64 === 'function' &&
      typeof Uint8Array.prototype.toHex === 'function',
  },
  {
    name: 'Iterator helpers',
    /**
     * Supported by Chrome/Edge 122, Firefox 131 and Safari 18.4.
     * @returns {boolean} Result.
     */
    test: () =>
      typeof globalThis.Iterator === 'function' &&
      typeof globalThis.Iterator.prototype.map === 'function',
  },
];

/**
 * Get the names of the features the app requires that the browser doesn’t support.
 * @returns {string[]} Feature names. Empty if the browser is supported.
 */
export const getMissingBrowserFeatures = () =>
  REQUIRED_FEATURES.filter(({ test }) => !test()).map(({ name }) => name);

/**
 * Names of the features the app requires that the browser doesn’t support. If there are any, the
 * app doesn’t load the configuration, and asks the user to update the browser instead.
 * @type {{ current: string[] }}
 */
export const missingBrowserFeatures = createRawState(getMissingBrowserFeatures());
