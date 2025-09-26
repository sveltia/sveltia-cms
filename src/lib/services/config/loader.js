import { isObject } from '@sveltia/utils/object';
import merge from 'deepmerge';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { parse } from 'yaml';

const SUPPORTED_TYPES = ['text/yaml', 'application/yaml', 'application/json'];

/**
 * Fetch a single configuration file.
 * @param {object} link Link attributes.
 * @param {string} link.href File path.
 * @param {string} [link.type] MIME type.
 * @returns {Promise<object>} Configuration.
 * @throws {Error} When fetching or parsing has failed.
 */
const fetchFile = async ({ href, type = 'application/yaml' }) => {
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
    throw new Error(get(_)('config.error.fetch_failed'), { cause: ex });
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
      result = response.json();
    } else {
      result = parse(await response.text(), { merge: true, maxAliasCount: -1 });
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
 * Fetch the YAML/JSON site configuration file(s) and return a parsed, merged object.
 * @returns {Promise<object>} Configuration.
 * @throws {Error} When fetching or parsing has failed.
 */
export const fetchSiteConfig = async () => {
  const links = /** @type {HTMLLinkElement[]} */ ([
    ...document.querySelectorAll('link[rel="cms-config-url"]'),
  ]).map(({ href, type }) => /** @type {{ href: string, type?: string }} */ ({ href, type }));

  if (!links.length) {
    links.push({ href: getConfigPath(window.location.pathname) });
  }

  const objects = await Promise.all(links.map((link) => fetchFile(link)));

  if (objects.length === 1) {
    return objects[0];
  }

  return merge.all(objects);
};
