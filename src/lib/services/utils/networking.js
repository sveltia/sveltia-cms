import { isObject } from '@sveltia/utils/object';

/**
 * A `fetch` wrapper to send an HTTP request to an API endpoint, parse the response as JSON or other
 * specified format, and handle errors gracefully.
 * @param {string} url - URL.
 * @param {RequestInit} [init] - Request options.
 * @param {object} [options] - Options.
 * @param {'json' | 'text' | 'blob' | 'raw'} [options.responseType] - Response parser type. The
 * default is `json`. Use `raw` to return a `Response` object as is.
 * @returns {Promise<object | string | Blob | Response>} Response data or `Response` itself,
 * depending on the `responseType` option.
 * @throws {Error} When there was an error in the request or response.
 */
export const sendRequest = async (url, init = {}, { responseType = 'json' } = {}) => {
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

  if (responseType === 'raw') {
    return response;
  }

  const { ok, status } = response;

  if (!ok) {
    /** @type {any} */
    let result;
    let message = '';

    try {
      result = await response.json();
    } catch {
      //
    }

    if (isObject(result)) {
      if (typeof result.error === 'string') {
        message = result.error;
      }

      if (typeof result.message === 'string') {
        // Typical REST
        message = result.message;
      }

      if (Array.isArray(result.errors)) {
        if (typeof result.errors[0] === 'string') {
          message = result.errors.join(', ');
        }

        if (isObject(result.errors[0]) && typeof result.errors[0].message === 'string') {
          // Typical GraphQL
          message = /** @type {any[]} */ (result.errors).map((e) => e.message).join(', ');
        }
      }
    }

    throw new Error('Server responded with an error', { cause: { status, message } });
  }

  try {
    if (responseType === 'blob') {
      return response.blob();
    }

    if (responseType === 'text') {
      return response.text();
    }

    return response.json();
  } catch (ex) {
    throw new Error('Failed to parse the response', { cause: ex });
  }
};
