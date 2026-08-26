import { writable } from 'svelte/store';

import { PING_TTL } from '$lib/services/deployments/constants';
import { sendRequest } from '$lib/services/utils/networking';

/**
 * @import { Writable } from 'svelte/store';
 * @import { PageLiveness } from '$lib/types/private';
 */

/**
 * Liveness of preview pages, keyed by the full URL.
 * @type {Writable<Record<string, PageLiveness>>}
 */
export const pageLiveness = writable({});

/**
 * How many pages to remember. A result is only useful for {@link PING_TTL}, so the cap is about
 * keeping a long editing session from accumulating an entry for every page ever opened, not about
 * holding a useful working set.
 */
const MAX_CACHED_PAGES = 100;
/**
 * Recent and in-flight checks, keyed by URL, so a re-render or a second view asking about the same
 * page doesn’t send another request.
 * @type {Map<string, { time: number, promise: Promise<PageLiveness> }>}
 */
const cache = new Map();

/**
 * Drop the pages least worth remembering once the cache outgrows its cap: the results that have
 * expired first, then the oldest of what’s left. The store is trimmed in step, so the two can’t
 * drift apart.
 */
const prune = () => {
  if (cache.size <= MAX_CACHED_PAGES) {
    return;
  }

  const cutoff = Date.now() - PING_TTL;

  const dropped = new Set(
    [...cache.entries()].filter(([, { time }]) => time < cutoff).map(([url]) => url),
  );

  // A Map iterates in insertion order, so this takes the longest-standing entries first
  [...cache.keys()].forEach((url) => {
    if (cache.size - dropped.size > MAX_CACHED_PAGES) {
      dropped.add(url);
    }
  });

  dropped.forEach((url) => cache.delete(url));

  pageLiveness.update((map) =>
    Object.fromEntries(Object.entries(map).filter(([url]) => !dropped.has(url))),
  );
};

/**
 * Check whether the given page is live.
 * @param {string} url URL to check.
 * @returns {Promise<PageLiveness>} Result.
 */
const request = async (url) => {
  /** @type {Response} */
  let response;

  try {
    response = /** @type {Response} */ (
      await sendRequest(url, { method: 'GET' }, { responseType: 'raw' })
    );
  } catch {
    return 'unknown';
  }

  if (response.ok) {
    return 'ready';
  }

  // A page that hasn’t been built yet is a 404. Any other status, including the 401 that a
  // password-protected preview returns, says nothing about the build, and the link still works for
  // a signed-in user, so don’t report it as missing
  return response.status === 404 ? 'pending' : 'unknown';
};

/**
 * Check whether the page at the given URL is live yet, and record the result in
 * {@link pageLiveness}.
 *
 * Only a same-origin URL is requested. A cross-origin response can’t be read without an
 * `Access-Control-Allow-Origin` header, which no major static host sets on HTML documents, and an
 * opaque `no-cors` response reports the same thing for a 200 and a 404 alike. Sending the request
 * anyway would cost a round trip and a console error to learn nothing, so it’s skipped. In practice
 * this covers the common setup where the CMS is served from the site it edits.
 * @param {string} url URL to check.
 * @returns {Promise<PageLiveness>} Result.
 */
export const pingURL = async (url) => {
  const cached = cache.get(url);

  if (cached && Date.now() - cached.time < PING_TTL) {
    return cached.promise;
  }

  let sameOrigin = false;

  try {
    sameOrigin = new URL(url).origin === window.location.origin;
  } catch {
    sameOrigin = false;
  }

  const promise = sameOrigin
    ? request(url)
    : Promise.resolve(/** @type {PageLiveness} */ ('unknown'));

  cache.set(url, { time: Date.now(), promise });
  prune();

  const result = await promise;

  // Skip an update that changes nothing, so a component checking the URL from an effect that reads
  // the store doesn’t loop
  pageLiveness.update((map) => (map[url] === result ? map : { ...map, [url]: result }));

  return result;
};

/**
 * Clear the cached liveness results. Called when the user signs out, so a different site’s pages
 * aren’t reported from the previous session.
 */
export const resetPageLiveness = () => {
  cache.clear();
  pageLiveness.set({});
};
