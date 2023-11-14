import { get, writable } from 'svelte/store';
import { siteConfig } from '$lib/services/config';

/**
 * @type {import('svelte/store').Writable<string>}
 */
export const selectedPageName = writable('');

/**
 * Page title to be announced by screen readers.
 * @type {import('svelte/store').Writable<string>}
 */
export const announcedPageTitle = writable('');

/**
 * Parse the URL and return the decoded result.
 * @param {Location} [loc] URL. Omit this to use the current URL.
 * @returns {{ path: string, params: { [key: string]: string } }} Path and search params.
 */
export const parseLocation = (loc = window.location) => {
  const { pathname, searchParams } = new URL(`${loc.origin}${loc.hash.substring(1)}`);

  return {
    path: decodeURIComponent(pathname),
    params: Object.fromEntries([...searchParams.entries()]),
  };
};

/**
 * Navigate to a different URL. This is similar to SvelteKit’s `goto` method but assumes hash-based
 * SPA routing.
 * @param {string} path URL path. It will appear in th URL hash but omit the leading `#` sign here.
 * @param {object} [options] Options.
 * @param {object} [options.state] History state to be included.
 * @param {boolean} [options.replaceState] Whether to replace the history state.
 * @param {boolean} [options.notifyChange] Whether to dispatch a `hashchange` event.
 */
export const goto = (path, { state = {}, replaceState = false, notifyChange = true } = {}) => {
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
    window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL }));
  }
};

/**
 * Go back to the previous page if possible, or navigate to the given fallback URL.
 * @param {string} path Fallback URL path.
 * @param {object} [options] Options to be passed to {@link goto}.
 */
export const goBack = (path, options = {}) => {
  if (window.history.state?.from) {
    window.history.back();
  } else {
    goto(path, options);
  }
};

/**
 * Open the production site in a new browser tab.
 */
export const openProductionSite = () => {
  const { display_url: displayURL, site_url: siteURL } = get(siteConfig);

  window.open(displayURL || siteURL || '/', '_blank');
};
