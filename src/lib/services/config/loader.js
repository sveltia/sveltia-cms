import { isObject } from '@sveltia/utils/object';
import merge from 'deepmerge';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { parseTOML, parseYAML } from '$lib/services/contents/file/parse';

/**
 * @typedef {object} ConfigLink
 * @property {string} href File path or URL.
 * @property {string} [type] MIME type.
 */

/**
 * Supported MIME types for configuration files.
 */
const SUPPORTED_TYPES = [
  'text/yaml', // legacy
  'application/yaml', // default
  'application/toml',
  'application/json',
];

/**
 * Fetch a single configuration file.
 * @internal
 * @param {object} link Link attributes.
 * @param {string} link.href File path.
 * @param {string} [link.type] MIME type.
 * @param {object} [options] Options.
 * @param {boolean} [options.manualInit] Whether a manual config is provided. This can affect error
 * handling.
 * @returns {Promise<object>} Configuration.
 * @throws {Error} When fetching or parsing has failed.
 */
export const fetchFile = async (
  { href, type = 'application/yaml' },
  { manualInit = false } = {},
) => {
  /** @type {Response} */
  let response;

  if (!SUPPORTED_TYPES.includes(type)) {
    throw new Error(get(_)('config.error.parse_failed'), {
      cause: new Error(get(_)('config.error.parse_failed_unsupported_type')),
    });
  }

  try {
    response = await fetch(href);
  } catch (ex) {
    throw new Error(
      get(_)(
        manualInit ? 'config.error.fetch_failed_with_manual_init' : 'config.error.fetch_failed',
      ),
      { cause: ex },
    );
  }

  const { ok, status } = response;

  if (!ok) {
    throw new Error(get(_)('config.error.fetch_failed'), {
      cause: new Error(get(_)('config.error.fetch_failed_not_ok', { values: { status } })),
    });
  }

  /** @type {object} */
  let result;

  try {
    if (type === 'application/json') {
      result = await response.json();
    } else {
      const text = await response.text();

      if (type === 'application/toml') {
        result = parseTOML(text);
      } else {
        result = parseYAML(text, { merge: true, maxAliasCount: -1 });
      }
    }
  } catch (ex) {
    throw new Error(get(_)('config.error.parse_failed'), { cause: ex });
  }

  if (!isObject(result)) {
    throw new Error(get(_)('config.error.parse_failed'), {
      cause: new Error(get(_)('config.error.parse_failed_invalid_object')),
    });
  }

  return result;
};

/**
 * Get the path to the configuration file. Depending on the server or framework configuration, a
 * trailing slash may be removed from the CMS `/admin/` URL. In that case, we need to determine the
 * correct path to the configuration file.
 * @internal
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
 * @internal
 * @param {ConfigLink[]} links Links to verify.
 * @returns {boolean} True if all links are secure, false otherwise.
 */
export const verifyLinksAreSecure = (links) => {
  const { origin } = window.location;

  return links.every(({ href }) => {
    try {
      const { protocol, hostname } = new URL(href, origin);

      // Check if protocol is HTTPS or if it's a localhost address
      return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
    } catch {
      // If URL parsing fails, treat as insecure
      return false;
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
  const links = /** @type {HTMLLinkElement[]} */ ([
    ...document.querySelectorAll('link[rel="cms-config-url"]'),
  ]).map(({ href, type }) => /** @type {ConfigLink} */ ({ href, type }));

  if (!links.length) {
    links.push({ href: getConfigPath(window.location.pathname) });
  }

  if (!verifyLinksAreSecure(links)) {
    throw new Error(
      get(_)(links.length > 1 ? 'config.error.insecure_urls' : 'config.error.insecure_url'),
    );
  }

  const objects = await Promise.all(links.map((link) => fetchFile(link, { manualInit })));

  if (objects.length === 1) {
    return objects[0];
  }

  return merge.all(objects);
};
