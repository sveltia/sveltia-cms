import { sleep } from '@sveltia/utils/misc';
import { flushSync } from 'svelte';

import { showAssetOverlay } from '$lib/services/assets/view';
import { cmsConfig } from '$lib/services/config';
import { showContentOverlay } from '$lib/services/contents/editor';
import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';
import { openNewTab } from '$lib/services/utils/window';

/**
 * @import { InternalCmsConfig } from '$lib/types/private';
 */

/**
 * View transition type: `forwards` and `backwards` move between pages, `previous` and `next` move
 * between the items listed on a page, e.g. the assets in the details overlay, and `unknown` is a
 * plain fade.
 * @typedef {'forwards' | 'backwards' | 'previous' | 'next' | 'unknown'} ViewTransitionType
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
 */
export const hasOverlay = createDerivedState(
  () => showContentOverlay.current || showAssetOverlay.current,
);

/**
 * Name of the currently selected page.
 */
export const selectedPageName = createRawState('');

/**
 * Page status to be announced by screen readers.
 */
export const announcedPageStatus = createRawState('');

/**
 * Name of the main area on the current page, e.g. the collection or asset folder being viewed,
 * shown in the document title. Empty when the page has no specific name, e.g. Settings.
 */
export const mainAreaTitle = createRawState('');

/**
 * Title of the overlay covering the page, e.g. the entry being edited, shown in the document title
 * in preference to {@link mainAreaTitle}. Empty while no overlay is open.
 */
export const overlayTitle = createRawState('');

/**
 * Percent-encode each segment of the given route path, keeping the slashes, so a file or folder
 * name containing a `%`, `#` or `?` sign makes it through the URL hash intact and is decoded back
 * to the same name by {@link parseLocation}. Build every route that contains an entry or asset
 * path with this before passing it to {@link goto} or {@link goBack}.
 * @param {string} path Route path without a query string, e.g. `/assets/images/50%off.jpg`.
 * @returns {string} Encoded path, e.g. `/assets/images/50%25off.jpg`.
 */
export const encodeRoutePath = (path) => path.split('/').map(encodeURIComponent).join('/');

/**
 * Decode the given route path. A malformed escape sequence, e.g. the `%` sign in a link to a
 * `50%off.jpg` file built before route paths were encoded, would make `decodeURIComponent()` throw,
 * so in that case only the valid escape sequences are decoded and anything else is left as is.
 * @param {string} path Encoded route path.
 * @returns {string} Decoded path.
 */
const decodeRoutePath = (path) => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path.replace(/(?:%[\da-f]{2})+/gi, (sequence) => {
      try {
        return decodeURIComponent(sequence);
      } catch {
        return sequence;
      }
    });
  }
};

/**
 * Parse the URL and return the decoded result.
 * @param {string} [href] URL. Omit this to use the current URL.
 * @returns {{ path: string, params: Record<string, string> }} Path and search params.
 */
export const parseLocation = (href = window.location.href) => {
  const { origin, hash } = new URL(href);
  const { pathname, searchParams } = new URL(`${origin}${hash.substring(1)}`);

  return {
    // Drop any trailing slash before decoding, so a hand-typed `#/collections/` resolves the same
    // way as `#/collections` rather than matching no route at all. The root path is left as is
    path: decodeRoutePath(pathname.replace(/(?!^)\/+$/, '')),
    params: Object.fromEntries(
      // Merge multiple values of the same key with a comma, e.g. `?a=1&a=2` becomes `{ a: '1,2' }`.
      // This is to support both `?tags=tag1,tag2` and `?tags=tag1&tags=tag2` formats for dynamic
      // default values.
      [...new Set(searchParams.keys())].map((key) => [key, searchParams.getAll(key).join(',')]),
    ),
  };
};

/**
 * Currently active view transition, if any. Used to prevent nested transitions from aborting the
 * active one, which would cause “Transition was skipped” errors in the browser console.
 * @type {ViewTransition | null}
 */
let activeTransition = null;

// Finish the running view transition as soon as a key is pressed. Until the animation is over, the
// transition overlay catches every hit test, and Sveltia UI only activates a button with its
// keyboard shortcut if a hit test finds the button, so a shortcut pressed right after the page
// changed would be ignored, e.g. Accel+S or Escape right after the entry editor opened, and the
// browser would handle Accel+S itself. The listener is added as the module is loaded, so it runs
// before the one Sveltia UI adds once a component with a shortcut is mounted
globalThis.addEventListener?.(
  'keydown',
  () => {
    activeTransition?.skipTransition();
  },
  { capture: true },
);

/**
 * Start page transition, if possible, after updating the content.
 * @param {ViewTransitionType} transitionType View transition type.
 * @param {() => void} updateContent Function to trigger a content update.
 * @see https://developer.chrome.com/docs/web-platform/view-transitions/same-document
 */
export const startViewTransition = (transitionType, updateContent) => {
  // Fall back to a direct update if the View Transitions API is unavailable, or if a transition is
  // already running (e.g. a redirect `goto()` inside `navigate()`), to avoid aborting it.
  if (!document.startViewTransition || activeTransition) {
    updateContent();
    return;
  }

  const options = {
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
  };

  // Firefox for Android currently doesn’t support the options parameter of `startViewTransition`
  // and will throw a `TypeError` if provided.
  // @see https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition
  try {
    const transition = document.startViewTransition(options);

    activeTransition = transition;

    // The browser skips a transition it can’t animate — most often because the document is hidden,
    // e.g. the user switched to another tab while a save was in flight — and says so by rejecting
    // `ready` with an `InvalidStateError`. The `update` callback still runs, so the content is up
    // to date and there’s nothing to recover from, but the rejection has to be observed or it
    // reaches the console as `Uncaught (in promise) InvalidStateError`
    transition.ready.catch(() => undefined);

    // `finished` only rejects when `update` itself failed, which is a real error worth reporting.
    // It also has to be observed here, because `finally()` re-throws whatever it received
    transition.finished
      .catch((/** @type {any} */ ex) => {
        // eslint-disable-next-line no-console
        console.error(ex);
      })
      .finally(() => {
        activeTransition = null;
      });
  } catch {
    // A browser that throws while the transition is being set up leaves nothing to wait for, so
    // don’t let a stale handle block every later transition
    activeTransition = null;
    updateContent();
  }
};

/**
 * Determine the transition type with the Navigation API, which knows where the URL we came from
 * sits in the session history relative to the current one. Unlike a comparison of the two paths,
 * this reflects the direction the user actually moved in, including navigation between two
 * different sections of the app or between two URLs with the same number of path segments.
 * @param {string} oldURL URL before the navigation.
 * @returns {ViewTransitionType | undefined} Transition type, or `undefined` if the API is
 * unavailable or the previous entry is no longer in the history, e.g. because it has been replaced.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API
 */
const getTransitionTypeFromHistory = (oldURL) => {
  const currentIndex = window.navigation?.currentEntry?.index ?? -1;

  if (currentIndex === -1) {
    return undefined;
  }

  // The same URL can appear more than once in the history, so pick the entry closest to the current
  // one, which is the one the user has most likely just left.
  const [oldIndex] = window.navigation
    .entries()
    .filter(({ url, index }) => url === oldURL && index !== currentIndex)
    .map(({ index }) => index)
    .sort((a, b) => Math.abs(a - currentIndex) - Math.abs(b - currentIndex));

  if (oldIndex === undefined) {
    return undefined;
  }

  return oldIndex < currentIndex ? 'forwards' : 'backwards';
};

/**
 * Determine the transition type by comparing the two paths. This is a fallback for browsers without
 * the Navigation API, and for navigation the API cannot place in the history.
 * @param {string} oldURL URL before the navigation.
 * @param {string} newURL URL after the navigation.
 * @param {RegExp} routeRegex Regex to match a specific route.
 * @returns {ViewTransitionType} Transition type.
 */
const getTransitionTypeFromPaths = (oldURL, newURL, routeRegex) => {
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

  if (!inSameSection || oldPathSegmentCount === newPathSegmentCount) {
    return 'unknown';
  }

  return oldPathSegmentCount < newPathSegmentCount ? 'forwards' : 'backwards';
};

/**
 * Update the content when the `hashchange` event is triggered. This function aims to support page
 * transition via the browser’s back/forward navigation.
 * @param {HashChangeEvent} event `hashchange` event.
 * @param {() => void} updateContent Function to trigger a content update.
 * @param {RegExp} routeRegex Regex to match a specific route.
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

  const transitionType =
    getTransitionTypeFromHistory(oldURL) ?? getTransitionTypeFromPaths(oldURL, newURL, routeRegex);

  startViewTransition(transitionType, () => updateContent());
};

/**
 * Navigate to a different URL or replace the current URL. This is similar to SvelteKit’s `goto`
 * method but assumes hash-based SPA routing.
 * @param {string} path URL path. It will appear in th URL hash but omit the leading `#` sign here.
 * Encode any entry or asset path in it with {@link encodeRoutePath}.
 * @param {GoToMethodOptions} [options] Options.
 */
export const goto = async (
  path,
  { state = {}, replaceState = false, notifyChange = true, transitionType = 'unknown' } = {},
) => {
  const { path: currentPath } = parseLocation();

  // If we’re already on this page AND not updating state, don’t navigate or trigger a transition.
  // The given path is encoded, while the current one is decoded
  if (currentPath === decodeRoutePath(path) && !Object.keys(state).length && !replaceState) {
    return;
  }

  const { origin, pathname, hash } = window.location;
  const oldURL = `${origin}${pathname}${hash}`;
  const newURL = `${origin}${pathname}#${path}`;
  // `from` is the URL of the previous history entry, which {@link goBack} relies on. Replacing the
  // current entry doesn’t change what the previous entry is, so carry the value over; the entry
  // being replaced is gone and must not become `from`, or a direct link followed by an in-place
  // URL update would send the user out of the app on Back
  const from = replaceState ? window.history.state?.from : oldURL;
  /** @type {[any, string, string]} */
  const args = [{ ...state, from }, '', newURL];

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
 * Route pattern for the shorthand link to an entry that Netlify/Decap CMS accepts, which is
 * documented alongside their Open Authoring feature as a way to hand contributors a direct link.
 * They redirect it to their own entry route, which is the same one Sveltia CMS uses, so a site
 * migrating over keeps any such link it has already published working.
 * @see https://decapcms.org/docs/open-authoring/
 */
const LEGACY_ENTRY_ROUTE_REGEX = /^\/edit\/(?<collectionName>[^/]+)\/(?<subPath>.+)$/;

/**
 * Redirect a Netlify/Decap CMS entry shorthand link, e.g. `#/edit/posts/hello`, to the equivalent
 * Sveltia CMS route, e.g. `#/collections/posts/entries/hello`. The current URL is replaced rather
 * than pushed, so the shorthand doesn’t sit in the history and send the user back to it.
 * @returns {boolean} `true` if the current URL was a shorthand link and a redirect has been
 * started, in which case the caller has nothing left to do for this navigation.
 */
export const redirectLegacyEntryLink = () => {
  const { path, params } = parseLocation();
  const { collectionName, subPath } = path.match(LEGACY_ENTRY_ROUTE_REGEX)?.groups ?? {};

  if (!collectionName || !subPath) {
    return false;
  }

  // Carry any query string over, so the editor locale and dynamic default values survive
  const query = new URLSearchParams(params).toString();

  goto(
    `${encodeRoutePath(`/collections/${collectionName}/entries/${subPath}`)}${query ? `?${query}` : ''}`,
    {
      replaceState: true,
    },
  );

  return true;
};

/**
 * Page names that make up the whole route. Unlike the content library and the other pages that
 * take a path of their own, anything following these in the URL is a dead link.
 */
const STANDALONE_PAGE_NAMES = ['workflow', 'config', 'menu'];
/**
 * Search modes set by the pages that search their own items.
 * @type {Record<string, 'contents' | 'assets'>}
 */
const PAGE_SEARCH_MODES = { collections: 'contents', assets: 'assets' };

/**
 * Result of {@link resolveRoute}: a URL to redirect to, a dead link, or the page to show along with
 * the search mode to set. `searchMode` is `undefined` when the current search mode is to be kept.
 * @typedef {{ redirect: string } | { notFound: true } | {
 * pageName: string, searchMode: 'contents' | 'assets' | null | undefined }} ResolvedRoute
 */

/**
 * Determine which page to show for the given URL path.
 * @param {string} path URL path, as returned by {@link parseLocation}.
 * @param {string[]} pageNames Names of the available pages.
 * @returns {ResolvedRoute} Result.
 */
export const resolveRoute = (path, pageNames) => {
  // The page name has to fill the whole first path segment, so `/collections-foo` doesn’t pass for
  // the content library and land on a page that can’t make sense of the rest of the path
  const { pageName } = path.match(`^\\/(?<pageName>${pageNames.join('|')})(?=\\/|$)`)?.groups ?? {};

  if (!pageName) {
    // The bare `#/` path is where the app starts, so open the content library. Any other unknown
    // path is a dead link. Show a Not Found page instead of redirecting, which would hide the fact
    // that the URL the user followed no longer goes anywhere
    return path === '/' ? { redirect: '#/collections' } : { notFound: true };
  }

  if (STANDALONE_PAGE_NAMES.includes(pageName) && path !== `/${pageName}`) {
    return { notFound: true };
  }

  // The content library and the asset library search their own items. The search page keeps the
  // current mode, and any other page has nothing to search
  return {
    pageName,
    searchMode: pageName === 'search' ? undefined : (PAGE_SEARCH_MODES[pageName] ?? null),
  };
};

/**
 * Go back to the previous page if possible, or navigate to the given fallback URL.
 * @param {string} path Fallback URL path. With the Navigation API, the previous page is only
 * returned to when it’s at this path, or when `returnTo` accepts its path.
 * @param {GoToMethodOptions & { returnTo?: (path: string) => boolean }} [options] Options to be
 * passed to {@link goto}, and `returnTo` to tell which other previous pages to return to, e.g. the
 * search results an entry was opened from.
 */
export const goBack = (path, { returnTo, ...options } = {}) => {
  const transitionType = 'backwards';

  // Use the Navigation API if available, which is more reliable than `window.history`
  if (window.navigation?.currentEntry) {
    const { index } = window.navigation.currentEntry;
    const { sameDocument, url } = window.navigation.entries()[index - 1] ?? {};
    const previousPath = url ? parseLocation(url).path : undefined;

    if (
      sameDocument &&
      previousPath !== undefined &&
      (previousPath === decodeRoutePath(path) || returnTo?.(previousPath))
    ) {
      startViewTransition(transitionType, () => {
        window.navigation.back();
      });
    } else {
      goto(path, { ...options, transitionType });
    }

    return;
  }

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
  const { display_url: displayURL, _siteURL: siteURL } = /** @type {InternalCmsConfig} */ (
    cmsConfig.current
  );

  openNewTab(displayURL || siteURL || '/');
};
