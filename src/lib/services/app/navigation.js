import { sleep } from '@sveltia/utils/misc';
import { flushSync } from 'svelte';
import { derived, get, writable } from 'svelte/store';

import { showAssetOverlay } from '$lib/services/assets/view';
import { siteConfig } from '$lib/services/config';
import { showContentOverlay } from '$lib/services/contents/editor';
import { isSmallScreen } from '$lib/services/user/env';

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
 * @param {string} [href] URL. Omit this to use the current URL.
 * @returns {{ path: string, params: Record<string, string> }} Path and search params.
 */
export const parseLocation = (href = window.location.href) => {
  const { origin, hash } = new URL(href);
  const { pathname, searchParams } = new URL(`${origin}${hash.substring(1)}`);

  return {
    path: decodeURIComponent(pathname),
    params: Object.fromEntries(searchParams),
  };
};

/**
 * Start page transition, if possible, after updating the content.
 * @param {ViewTransitionType} transitionType View transition type.
 * @param {() => void} updateContent Function to trigger a content update.
 * @see https://developer.chrome.com/docs/web-platform/view-transitions/same-document
 */
const startViewTransition = (transitionType, updateContent) => {
  if (!get(isSmallScreen) || !document.startViewTransition) {
    updateContent();
    return;
  }

  document.startViewTransition({
    // @ts-ignore
    types: [transitionType],
    // eslint-disable-next-line jsdoc/require-jsdoc
    update: async () => {
      updateContent();
      await sleep(50);
      await new Promise((resolve) => {
        flushSync(() => {
          resolve(undefined);
        });
      });
    },
  });
};

/**
 * Update the content when the `hashchange` event is triggered. This function aims to support page
 * transition via the browser’s back/forward navigation.
 * @param {HashChangeEvent} event `hashchange` event.
 * @param {() => void} updateContent Function to trigger a content update.
 * @param {RegExp} routeRegex Regex to match a specific route.
 * @todo Develop a robust way to handle transition using the Navigation API.
 */
export const updateContentFromHashChange = (event, updateContent, routeRegex) => {
  const { isTrusted, oldURL, newURL } = event;

  // If `isTrusted` is `true`, it’s the browser’s back/forward navigation, so we need to start
  // transitioning. If `false`, the event is trigged by the `goto` method below and transition has
  // already started; in that case, just finish updating the content.
  if (!isTrusted) {
    updateContent();
    return;
  }

  const oldPath = parseLocation(oldURL).path;
  const newPath = parseLocation(newURL).path;
  // Compare paths to see if it’s a navigation within the same section, e.g. `/collections` to
  // `/collections/posts`.
  const inSameSection = routeRegex.test(oldPath) && routeRegex.test(newPath);
  // Count the number of path segments; navigating from `/collections` to `/collections/posts` and
  // `/collections/posts` to `/collections/posts/new` is forwards, while `/assets/-/all` to
  // `/assets` is backwards
  const oldPathSegmentCount = oldPath.split('/').length;
  const newPathSegmentCount = newPath.split('/').length;

  const transitionType =
    inSameSection && oldPathSegmentCount > newPathSegmentCount
      ? 'backwards'
      : inSameSection && oldPathSegmentCount < newPathSegmentCount
        ? 'forwards'
        : 'unknown';

  startViewTransition(transitionType, () => updateContent());
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
  const { origin, pathname, hash } = window.location;
  const oldURL = `${origin}${pathname}${hash}`;
  const newURL = `${origin}${pathname}#${path}`;
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
