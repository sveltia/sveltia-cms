/**
 * @import { Page, Request, Route } from '@playwright/test';
 */

/**
 * @typedef {object} StoredObject
 * @property {Buffer} body Content.
 * @property {string} contentType Content type.
 * @property {Date} lastModified Last modification date.
 */

/**
 * Escape a string for XML.
 * @param {string} value Value.
 * @returns {string} Escaped value.
 */
export const escapeXML = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Decode the path of an object from the URL, a segment at a time.
 * @param {string} path URL path, encoded.
 * @returns {string} Key.
 */
export const decodeKey = (path) =>
  path
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/');

/**
 * Answer a request to a cloud service, which lets the page read the response across origins, like
 * a bucket with a CORS rule for the CMS.
 * @param {Route} route Route.
 * @param {{ status?: number, contentType?: string, body?: string | Buffer, json?: any, headers?:
 * Record<string, string> }} response Response.
 * @returns {Promise<void>} Promise.
 */
export const fulfill = (route, { headers = {}, ...response }) =>
  route.fulfill({
    ...response,
    headers: {
      ...headers,
      'access-control-allow-origin': '*',
      'access-control-expose-headers': Object.keys(headers).join(', ') || '*',
    },
  });

/**
 * A bucket or container of a cloud object storage service, kept in memory: the objects keyed by
 * their full key, which includes the configured prefix.
 */
export class MockObjectStore {
  /**
   * Objects keyed by key.
   * @type {Map<string, StoredObject>}
   */
  objects = new Map();

  /**
   * Requests the mock refused or couldn’t answer, listed by the fixture user to fail the test.
   * @type {string[]}
   */
  refused = [];

  /**
   * Add objects, as someone else uploaded them.
   * @param {Record<string, Buffer | string>} objects Content keyed by key.
   */
  put(objects) {
    Object.entries(objects).forEach(([key, body]) => {
      this.objects.set(key, {
        body: Buffer.from(body),
        contentType: key.endsWith('/') ? 'application/x-directory' : 'image/png',
        lastModified: new Date(),
      });
    });
  }

  /**
   * List the objects under a prefix, sorted by key.
   * @param {string} prefix Prefix.
   * @returns {[string, StoredObject][]} Objects.
   */
  list(prefix) {
    return [...this.objects]
      .filter(([key]) => key.startsWith(prefix))
      .sort(([a], [b]) => a.localeCompare(b));
  }
}
