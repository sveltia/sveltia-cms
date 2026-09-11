import { _ } from '@sveltia/i18n';
import { isObject } from '@sveltia/utils/object';
import merge from 'deepmerge';

import {
  DEV_CONFIG_PATH,
  DEV_SITE_URL,
  SCHEMA_URL,
  SUPPORTED_TYPES,
} from '$lib/services/config/constants';
import { parseTOML, parseYAML } from '$lib/services/contents/file/parse';
import { env } from '$lib/services/user/env.svelte';
import { isSecureURL } from '$lib/services/utils/networking';
import { makeLink } from '$lib/services/utils/string';

/**
 * @typedef {object} ConfigLink
 * @property {string} href File path or URL.
 * @property {string} [type] MIME type.
 */

const LOAD_CONFIG_DOC_URL =
  'https://sveltiacms.app/en/docs/api/initialization#providing-a-full-configuration';

const SCHEMA_TIP_URL = 'https://sveltiacms.app/en/docs/config-basics#validation-and-autocomplete';
/**
 * Responses of config files requested ahead of time with {@link prefetchCmsConfig}, keyed by the
 * absolute file URL. Each is consumed once by {@link fetchFile}.
 * @type {Map<string, Promise<Response>>}
 */
const prefetchedResponses = new Map();

/**
 * Request the config file at the given URL. A timestamp is appended to the URL to prevent caching
 * issues.
 * @param {URL} url File URL.
 * @returns {Promise<Response>} Response.
 */
const requestFile = (url) => {
  const requestURL = new URL(url);

  requestURL.searchParams.set('_', Date.now().toString());

  return fetch(requestURL);
};

/**
 * Fetch a single configuration file.
 * @param {object} link Link attributes.
 * @param {string} link.href File path.
 * @param {string} [link.type] MIME type.
 * @param {object} [options] Options.
 * @param {boolean} [options.manualInit] Whether a manual config is provided. This can affect error
 * handling.
 * @param {boolean} [options.showSchemaTip] Whether to show schema help in the browser console.
 * @returns {Promise<object>} Configuration.
 * @throws {Error} When fetching or parsing has failed.
 */
export const fetchFile = async (
  { href, type = 'application/yaml' },
  { manualInit = false, showSchemaTip } = {},
) => {
  /** @type {Response} */
  let response;

  if (!SUPPORTED_TYPES.includes(type)) {
    throw new Error(_('config.error.parse_failed'), {
      cause: new Error(_('config.error.parse_failed_unsupported_type')),
    });
  }

  const fetchErrorKey = manualInit
    ? 'config.error.fetch_failed_with_manual_init'
    : 'config.error.fetch_failed';

  const errorMessage = makeLink(_(fetchErrorKey), LOAD_CONFIG_DOC_URL);

  try {
    const url = new URL(href, window.location.href);
    const prefetched = prefetchedResponses.get(url.href);

    // A response requested ahead of time is used once, so a later reload of the config is fresh
    prefetchedResponses.delete(url.href);
    response = await (prefetched ?? requestFile(url));
  } catch (ex) {
    throw new Error(errorMessage, { cause: ex });
  }

  const { ok, status } = response;

  if (!ok) {
    throw new Error(errorMessage, {
      cause: new Error(_('config.error.fetch_failed_not_ok', { values: { status } })),
    });
  }

  let schemaMissing = false;
  /** @type {object} */
  let result;

  try {
    if (type === 'application/json') {
      result = await response.json();

      if (isObject(result) && result.$schema !== SCHEMA_URL) {
        schemaMissing = true;
      }
    } else {
      const text = await response.text();

      if (type === 'application/toml') {
        result = parseTOML(text);

        if (!text.includes(`#:schema ${SCHEMA_URL}`)) {
          schemaMissing = true;
        }
      } else {
        result = parseYAML(text, { merge: true, maxAliasCount: -1 });

        if (!text.includes(`# yaml-language-server: $schema=${SCHEMA_URL}`)) {
          schemaMissing = true;
        }
      }
    }
  } catch (ex) {
    throw new Error(_('config.error.parse_failed'), { cause: ex });
  }

  if (!isObject(result)) {
    throw new Error(_('config.error.parse_failed'), {
      cause: new Error(_('config.error.parse_failed_invalid_object')),
    });
  }

  if (showSchemaTip && schemaMissing) {
    // eslint-disable-next-line no-console
    console.info(_('config.schema_tip', { values: { link: SCHEMA_TIP_URL } }));
  }

  return result;
};

/**
 * Get the path to the configuration file. Depending on the server or framework configuration, a
 * trailing slash may be removed from the CMS `/admin/` URL. In that case, we need to determine the
 * correct path to the configuration file.
 * @param {string} path Current `location.pathname` starting with a slash, like `/admin/`, `/admin`,
 * or `/admin/index.html`.
 * @returns {string} Path to the configuration file.
 */
export const getConfigPath = (path) => {
  // If the path ends with a slash, like `/admin/`, we can safely assume it is a directory and
  // append `config.yml`.
  if (path.endsWith('/')) {
    return `${path}config.yml`;
  }

  const parts = path.split('/');
  const lastPart = parts.pop();

  // If the last part of the path contains a dot, like `/admin/index.html`, we assume it is a file
  // and append `config.yml` to the directory part of the path. For example, `/admin/index.html`
  // becomes `/admin/config.yml`.
  if (lastPart?.includes('.')) {
    return `${parts.join('/')}/config.yml`;
  }

  // If the last part does not contain a dot, we assume it is a directory and append `config.yml`.
  // For example, `/admin` becomes `/admin/config.yml`.
  return `${path}/config.yml`;
};

/**
 * Verify that all provided links are in a secure context. A secure context is defined as either an
 * HTTPS URL or a localhost address.
 * @param {ConfigLink[]} links Links to verify.
 * @returns {boolean} True if all links are secure, false otherwise.
 */
export const verifyLinksAreSecure = (links) => {
  const { origin } = window.location;

  return links.every(({ href }) => isSecureURL(href, origin));
};

/**
 * Get the links to the config files: the `<link rel="cms-config-url">` elements on the page, or
 * the default file next to the admin page if there is none. During development, the config file
 * is loaded from the local live site instead.
 * @returns {ConfigLink[]} Links.
 */
export const getConfigLinks = () => {
  const links = /** @type {HTMLLinkElement[]} */ ([
    ...document.querySelectorAll('link[rel="cms-config-url"]'),
  ]).map(({ href, type }) => /** @type {ConfigLink} */ ({ href, type }));

  if (!links.length) {
    links.push(
      DEV_SITE_URL
        ? { href: `${DEV_SITE_URL}${DEV_CONFIG_PATH}` }
        : { href: getConfigPath(window.location.pathname) },
    );
  }

  return links;
};

/**
 * Start requesting the config files, so the response is on its way while the app is being mounted
 * rather than requested afterwards. This is called as soon as the CMS is initialized. The links
 * are resolved again when the config is actually loaded, and a response is only reused if it was
 * requested for the same URL, so a `<link>` that appears later is still honoured. Any failure is
 * reported then as well.
 */
export const prefetchCmsConfig = () => {
  const links = getConfigLinks();

  if (!verifyLinksAreSecure(links)) {
    return;
  }

  links.forEach(({ href }) => {
    try {
      const url = new URL(href, window.location.href);

      if (!prefetchedResponses.has(url.href)) {
        const promise = requestFile(url);

        // Reported by `fetchFile()` when the response is consumed
        promise.catch(() => {});
        prefetchedResponses.set(url.href, promise);
      }
    } catch {
      // An invalid URL is reported by `fetchFile()` as well
    }
  });
};

/**
 * Fetch the YAML/JSON CMS configuration file(s) and return a parsed, merged object.
 * @param {object} [options] Options.
 * @param {boolean} [options.manualInit] Whether a manual config is provided. This can affect error
 * handling.
 * @returns {Promise<object>} Configuration.
 * @throws {Error} When fetching or parsing has failed.
 */
export const fetchCmsConfig = async ({ manualInit = false } = {}) => {
  const links = getConfigLinks();

  if (!verifyLinksAreSecure(links)) {
    throw new Error(_('config.error.insecure_urls', { values: { count: links.length } }));
  }

  const showSchemaTip = env.isLocalHost && !manualInit && links.length === 1;
  /** @type {Record<string, any>[]} */
  let objects;

  try {
    objects = await Promise.all(
      links.map((link) => fetchFile(link, { manualInit, showSchemaTip })),
    );
  } finally {
    // Drop a response requested ahead of time for a file that wasn’t named after all
    prefetchedResponses.clear();
  }

  if (objects.length === 1) {
    return objects[0];
  }

  return merge.all(objects);
};
