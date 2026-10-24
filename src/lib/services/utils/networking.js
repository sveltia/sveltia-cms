import { sleep } from '@sveltia/utils/misc';
import { isObject } from '@sveltia/utils/object';

/**
 * @import { AuthTokens } from '$lib/types/private';
 */

/**
 * Regular expression to match `localhost` and its subdomains like `mysite.localhost`.
 */
const LOCALHOST_REGEX = /^(.+\.)?localhost$/;

/**
 * Check if a hostname refers to the local computer, which browsers treat as a secure context over
 * HTTP: `localhost` and its subdomains like `mysite.localhost`, and the IPv4 and IPv6 loopback
 * addresses, the latter written in brackets as `URL` and `location` give it.
 * @param {string} hostname Hostname, e.g. `location.hostname`.
 * @returns {boolean} Whether the hostname is local.
 * @see https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
 */
export const isLocalHostname = (hostname) =>
  ['127.0.0.1', '[::1]'].includes(hostname) || LOCALHOST_REGEX.test(hostname);

/**
 * Check if a URL can be requested without exposing credentials over an insecure transport.
 * @param {string} url URL to check.
 * @param {string} [baseURL] Base URL for relative URLs.
 * @returns {boolean} Whether the URL uses HTTPS or local HTTP.
 */
export const isSecureURL = (
  url,
  baseURL = globalThis.window?.location?.origin ??
    globalThis.location?.origin ??
    'https://localhost',
) => {
  try {
    const { hostname, protocol } = new URL(url, baseURL);

    return protocol === 'https:' || isLocalHostname(hostname);
  } catch {
    return false;
  }
};

/**
 * A `fetch` wrapper to send an HTTP request to an API endpoint, parse the response as JSON or other
 * specified format, and handle errors gracefully.
 * @param {string} url URL.
 * @param {RequestInit} [init] Request options.
 * @param {object} [options] Options.
 * @param {'json' | 'text' | 'blob' | 'raw'} [options.responseType] Response parser type. The
 * default is `json`. Use `raw` to return a `Response` object as is.
 * @param {() => Promise<AuthTokens>} [options.refreshAccessToken] A function to refresh the OAuth
 * access token when the request fails with a 401 Unauthorized status. If this function is provided,
 * the request will be retried with the new token.
 * @param {number} [options.retries] Number of remaining retries for transient server errors (5xx).
 * Defaults to `1`. Used internally for recursive retries.
 * @returns {Promise<object | string | Blob | Response>} Response data or `Response` itself,
 * depending on the `responseType` option.
 * @throws {Error} When there was an error in the request or response.
 */
export const sendRequest = async (
  url,
  init = {},
  { responseType = 'json', refreshAccessToken = undefined, retries = 1 } = {},
) => {
  /** @type {Response} */
  let response;
  const headers = new Headers(init.headers);

  init.cache = 'no-cache';
  init.headers = headers;

  if (headers.has('Authorization') && !isSecureURL(url)) {
    throw new Error('Refusing to send credentials over an insecure connection');
  }

  if (responseType === 'json') {
    headers.set('Accept', 'application/json');
  }

  // Serialize a plain object body for any method that accepts one, e.g. `POST`, `PUT` and `PATCH`
  if (isObject(init.body)) {
    headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(init.body);
  }

  try {
    response = await fetch(url, init);
  } catch (ex) {
    throw new Error('Failed to send the request', { cause: ex });
  }

  const { ok, status } = response;

  /**
   * Refresh the OAuth access token and send the request again with the new token.
   * @returns {Promise<object | string | Blob | Response>} Response data or `Response` itself.
   */
  const retryWithNewToken = async () => {
    const [scheme] = headers.get('Authorization')?.split(' ') ?? ['token'];
    const { token } = await /** @type {() => Promise<AuthTokens>} */ (refreshAccessToken)();

    headers.set('Authorization', `${scheme} ${token}`);

    // Retry the request with the new token. Omit `refreshAccessToken` to avoid infinite loops.
    return sendRequest(url, init, { responseType });
  };

  /**
   * Send the request again after a short delay.
   * @returns {Promise<object | string | Blob | Response>} Response data or `Response` itself.
   */
  const retryAfterDelay = async () => {
    await sleep(1000);

    return sendRequest(url, init, { responseType, refreshAccessToken, retries: retries - 1 });
  };

  // A raw response is returned as is for the caller to check the status, but a transient 502 error
  // is still retried and an expired token refreshed, the same as for the other response types
  if (responseType === 'raw') {
    if (status === 502 && retries > 0) {
      return retryAfterDelay();
    }

    return status === 401 && refreshAccessToken ? retryWithNewToken() : response;
  }

  /** @type {any} */
  let result;

  if (ok) {
    try {
      if (responseType === 'blob') {
        return await response.blob();
      }

      if (responseType === 'text') {
        return await response.text();
      }

      result = await response.json();
    } catch (ex) {
      throw new Error('Failed to parse the response', { cause: ex });
    }
  } else {
    try {
      result = await response.json();
    } catch {
      // An error response doesn’t always come with a JSON body, e.g. a gateway’s HTML error page,
      // but its status still decides whether to retry, refresh the token or report the error
      result = undefined;
    }
  }

  // Return the parsed result for a successful response, but a GraphQL error is typically returned
  // with 200 OK so we need to check the content for the `errors` key
  if (ok && !(url.endsWith('/graphql') && isObject(result) && result.errors)) {
    return result;
  }

  // Retry the request if the server responded with 502 Bad Gateway, which is a transient error that
  // may succeed on retry. This is especially relevant for the GitHub GraphQL API, which is known to
  // occasionally return 502 errors.
  // @see https://github.com/sveltia/sveltia-cms/issues/695
  if (status === 502 && retries > 0) {
    return retryAfterDelay();
  }

  if (status === 401 && refreshAccessToken) {
    return retryWithNewToken();
  }

  if (!isObject(result)) {
    throw new Error('Server responded with an error', { cause: { status } });
  }

  let message = '';

  if (typeof result.error === 'string') {
    message = result.error;
  }

  // Typical REST
  if (typeof result.message === 'string') {
    message = result.message;
  }

  if (Array.isArray(result.errors)) {
    if (typeof result.errors[0] === 'string') {
      message = result.errors.join(', ');
    }

    // Typical GraphQL
    if (isObject(result.errors[0]) && typeof result.errors[0].message === 'string') {
      message = /** @type {any[]} */ (result.errors).map((e) => e.message).join(', ');
    }
  }

  throw new Error('Server responded with an error', { cause: { status, message } });
};
