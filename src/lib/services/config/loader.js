import { isObject } from '@sveltia/utils/object';
import merge from 'deepmerge';
import { _ } from 'svelte-i18n';
import { get } from 'svelte/store';
import YAML from 'yaml';

const supportedTypes = ['text/yaml', 'application/yaml', 'application/json'];

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

  if (!supportedTypes.includes(type)) {
    throw new Error(get(_)('config.error.parse_failed'), {
      cause: new Error(get(_)('config.error.parse_failed_unsupported_type')),
    });
  }

  try {
    response = await fetch(href);
  } catch (/** @type {any} */ ex) {
    throw new Error(get(_)('config.error.fetch_failed'), { cause: ex });
  }

  const { ok, status } = response;

  if (!ok) {
    throw new Error(get(_)('config.error.fetch_failed'), {
      cause: new Error(get(_)('config.error.fetch_failed_not_ok', { values: { status } })),
    });
  }

  /** @type {any} */
  let result;

  try {
    if (type === 'application/json') {
      result = response.json();
    } else {
      result = YAML.parse(await response.text(), { merge: true });
    }
  } catch (/** @type {any} */ ex) {
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
 * Fetch the YAML/JSON site configuration file(s) and return a parsed, merged object.
 * @returns {Promise<object>} Configuration.
 * @throws {Error} When fetching or parsing has failed.
 */
export const fetchSiteConfig = async () => {
  /** @type {{ href: string, type?: string }[]} */
  const links = /** @type {HTMLLinkElement[]} */ ([
    ...document.querySelectorAll('link[rel="cms-config-url"]'),
  ]).map(({ href, type }) => ({ href, type }));

  if (!links.length) {
    links.push({
      // Depending on the server or framework configuration, the trailing slash may be removed from
      // the CMS `/admin/` URL. In that case, fetch the config file from a root-relative URL instead
      // of a regular relative URL to avoid 404 Not Found.
      href: window.location.pathname === '/admin' ? '/admin/config.yml' : './config.yml',
    });
  }

  const objects = await Promise.all(links.map((link) => fetchFile(link)));

  if (objects.length === 1) {
    return objects[0];
  }

  return merge.all(objects);
};
