import { isObject } from '@sveltia/utils/object';

/**
 * @import { AuthTokens } from '$lib/types/private';
 */

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
 * @returns {Promise<object | string | Blob | Response>} Response data or `Response` itself,
 * depending on the `responseType` option.
 * @throws {Error} When there was an error in the request or response.
 */
export const sendRequest = async (
  url,
  init = {},
  { responseType = 'json', refreshAccessToken = undefined } = {},
) => {
  /** @type {Response} */
  let response;

  init.cache = 'no-cache';
  init.headers = new Headers(init.headers);

  if (responseType === 'json') {
    init.headers.set('Accept', 'application/json');
  }

  if (init.method === 'POST' && isObject(init.body)) {
    init.headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(init.body);
  }

  try {
    response = await fetch(url, init);
  } catch (ex) {
    throw new Error('Failed to send the request', { cause: ex });
  }

  const { ok, status } = response;

  if (ok && responseType === 'raw') {
    return response;
  }

  /** @type {any} */
  let result;

  try {
    if (ok && responseType === 'blob') {
      return response.blob();
    }

    if (ok && responseType === 'text') {
      return response.text();
    }

    result = await response.json();
  } catch (ex) {
    throw new Error('Failed to parse the response', { cause: ex });
  }

  // Return the parsed result for a successful response, but a GraphQL error is typically returned
  // with 200 OK so we need to check the content for the `errors` key
  if (ok && !(url.endsWith('/graphql') && isObject(result) && result.errors)) {
    return result;
  }

  if (status === 401 && refreshAccessToken) {
    const [scheme] = init.headers.get('Authorization')?.split(' ') ?? ['token'];
    const { token } = await refreshAccessToken();

    init.headers.set('Authorization', `${scheme} ${token}`);

    // Retry the request with the new token. Omit `refreshAccessToken` to avoid infinite loops.
    return sendRequest(url, init, { responseType });
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
