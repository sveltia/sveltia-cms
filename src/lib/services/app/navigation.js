import { sleep } from '@sveltia/utils/misc';
import { flushSync } from 'svelte';
import { derived, get, writable } from 'svelte/store';
import { isSmallScreen } from '$lib/services/app/env';
import { showAssetOverlay } from '$lib/services/assets';
import { siteConfig } from '$lib/services/config';
import { showContentOverlay } from '$lib/services/contents/draft/editor';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import { InternalSiteConfig } from '$lib/types/private';
 */

/**
 * @typedef {'forwards' | 'backwards' | 'unknown'} ViewTransitionType
 */

/**
 * @typedef {object} GoToMethodOptions
 * @property {object} [state] History state to be included.
 * @property {boolean} [replaceState] Whether to replace the history state.
 * @property {boolean} [notifyChange] Whether to dispatch a `hashchange` event.
 * @property {ViewTransitionType} [transitionType] View transition type.
 */

/**
 * Whether the app has an overlay. Some elements have to be `inert` while an overlay is displayed.
 * We cannot use the `<Modal>` component for these overlays because it will make everything inert,
 * including the toast notifications and announced page title.
 * @type {Readable<boolean>}
 */
export const hasOverlay = derived(
  [showContentOverlay, showAssetOverlay],
  ([_showContentOverlay, _showAssetOverlay]) => _showContentOverlay || _showAssetOverlay,
);
/**
 * @type {Writable<string>}
 */
export const selectedPageName = writable('');
/**
 * Page status to be announced by screen readers.
 * @type {Writable<string>}
 */
export const announcedPageStatus = writable('');

/**
 * Parse the URL and return the decoded result.
 * @param {Location} [loc] URL. Omit this to use the current URL.
 * @returns {{ path: string, params: Record<string, string> }} Path and search params.
 */
export const parseLocation = (loc = window.location) => {
  const { pathname, searchParams } = new URL(`${loc.origin}${loc.hash.substring(1)}`);

  return {
    path: decodeURIComponent(pathname),
    params: Object.fromEntries(searchParams),
  };
};

/**
 * Start page transition, if possible, and execute a callback function once it’s complete.
 * @param {ViewTransitionType} transitionType View transition type.
 * @param {() => void} callback Callback function.
 * @see https://developer.chrome.com/docs/web-platform/view-transitions/same-document
 */
const startViewTransition = (transitionType, callback) => {
  if (!get(isSmallScreen) || !document.startViewTransition) {
    callback();
    return;
  }

  document.startViewTransition({
    // @ts-ignore
    types: [transitionType],
    // eslint-disable-next-line jsdoc/require-jsdoc
    update: async () => {
      callback();
      await sleep(100);
      await new Promise((resolve) => {
        flushSync(() => {
          resolve(undefined);
        });
      });
    },
  });
};

/**
 * Navigate to a different URL or replace the current URL. This is similar to SvelteKit’s `goto`
 * method but assumes hash-based SPA routing.
 * @param {string} path URL path. It will appear in th URL hash but omit the leading `#` sign here.
 * @param {GoToMethodOptions} [options] Options.
 */
export const goto = async (
  path,
  { state = {}, replaceState = false, notifyChange = true, transitionType = 'unknown' } = {},
) => {
  const oldURL = window.location.hash;
  const newURL = `#${path}`;
  /** @type {[any, string, string]} */
  const args = [{ ...state, from: oldURL }, '', newURL];

  if (replaceState) {
    window.history.replaceState(...args);
  } else {
    window.history.pushState(...args);
  }

  if (notifyChange) {
    startViewTransition(transitionType, () => {
      window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL }));
    });
  }
};

/**
 * Go back to the previous page if possible, or navigate to the given fallback URL.
 * @param {string} path Fallback URL path.
 * @param {GoToMethodOptions} [options] Options to be passed to {@link goto}.
 */
export const goBack = (path, options = {}) => {
  const transitionType = 'backwards';

  if (window.history.state?.from) {
    startViewTransition(transitionType, () => {
      window.history.back();
    });
  } else {
    goto(path, { ...options, transitionType });
  }
};

/**
 * Open the production site in a new browser tab.
 */
export const openProductionSite = () => {
  const { display_url: displayURL, _siteURL: siteURL } = /** @type {InternalSiteConfig} */ (
    get(siteConfig)
  );

  window.open(displayURL || siteURL || '/', '_blank');
};
