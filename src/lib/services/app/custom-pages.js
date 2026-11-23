import { customPageRegistry } from '$lib/services/api/registries';
import { goto } from '$lib/services/app/navigation';
import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';
import { openNewTab } from '$lib/services/utils/window';

/**
 * @import { CustomPage } from '$lib/types/private';
 */

/**
 * Route pattern for a custom page, e.g. `/pages/analytics`.
 */
const CUSTOM_PAGE_ROUTE_REGEX = /^\/pages\/(?<id>[^/]+)$/;

/**
 * ID of the custom page the URL points to, set by the main router. Empty on any other page.
 */
export const selectedCustomPageId = createRawState('');

/**
 * Custom page the URL points to, or `undefined` if the URL points to another page, or to a custom
 * page that hasn’t been registered (yet).
 */
export const selectedCustomPage = createDerivedState(() =>
  selectedCustomPageId.current ? customPageRegistry.get(selectedCustomPageId.current) : undefined,
);

/**
 * All the registered custom pages, in the order of registration.
 */
export const customPages = createDerivedState(() => [...customPageRegistry.values()]);

/**
 * Get the ID of the custom page the given URL path points to.
 * @param {string} path URL path, as returned by `parseLocation()`.
 * @returns {string} Page ID, or an empty string if the path is not a custom page route.
 */
export const getCustomPageId = (path) => path.match(CUSTOM_PAGE_ROUTE_REGEX)?.groups?.id ?? '';

/**
 * Get the URL path of the given custom page. The ID only consists of characters that need no
 * encoding, as `CMS.registerCustomPage()` makes sure of it.
 * @param {CustomPage} page Custom page.
 * @returns {string} URL path.
 */
export const getCustomPagePath = ({ id }) => `/pages/${id}`;

/**
 * Open the given custom page: navigate to it, or open its web page in a new browser tab if it’s a
 * link.
 * @param {CustomPage} page Custom page.
 */
export const openCustomPage = (page) => {
  if (page.newTab) {
    openNewTab(page.url);
  } else {
    goto(getCustomPagePath(page));
  }
};
