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
 * Check if a request can be sent again after a transient error without side effects: a `GET` or
 * `HEAD` request, or a GraphQL query, which is sent with `POST` but only reads data. Any other
 * request, including a GraphQL mutation, may have taken effect behind a gateway that still answered
 * with an error, so sending it again could create a duplicate commit or deployment, or report a
 * false conflict.
 * @param {RequestInit} init Request options, with the body serialized or not.
 * @returns {boolean} Whether the request is safe to retry.
 */
const isRetryableRequest = ({ method = 'GET', body }) => {
  if (['GET', 'HEAD'].includes(method.toUpperCase())) {
    return true;
  }

  /** @type {any} */
  let data = body;

  if (typeof body === 'string') {
    try {
      data = JSON.parse(body);
    } catch {
      return false;
    }
  }

  // `fetchGraphQL` sends the query as a JSON `query` property, with line breaks removed. An
  // operation without a keyword, e.g. `{ viewer { login } }`, is a query
  return (
    isObject(data) &&
    typeof data.query === 'string' &&
    !/^\s*(?:#[^\n]*\n\s*)*mutation\b/.test(data.query)
  );
};

/**
 * Statuses of a transient server error, other than 502 Bad Gateway, that a request without side
 * effects is retried once for: 429 Too Many Requests, 503 Service Unavailable and 504 Gateway
 * Timeout, which a rate limit or a self-hosted instance under load answers with. A write that opts
 * in with `retryable` is only retried on 502: a gateway can time out with 504 after a large commit
 * has landed, and the repeat would be refused as a conflict.
 * @see https://github.com/sveltia/sveltia-cms/issues/1143
 */
const TRANSIENT_STATUSES = [429, 503, 504];
/**
 * Wait before a retry when the server doesn’t say how long to wait, in milliseconds.
 */
const DEFAULT_RETRY_DELAY = 1000;

/**
 * Longest wait before a retry, in milliseconds. A request the server asks to send again later than
 * that isn’t retried, as the wait would look like a hang.
 */
export const MAX_RETRY_DELAY = 10 * 1000;

/**
 * Get how long to wait before sending a request again after a transient error, from the
 * `Retry-After` header of the response, which gives either a number of seconds or an HTTP date. A
 * request isn’t to be sent again sooner than the server asks: GitHub may ban an integration that
 * keeps sending requests while it’s rate limited. A rate limit that doesn’t say how long to wait
 * typically lasts a minute or more, until the limit resets, so it isn’t retried either.
 * @param {number} status Response status.
 * @param {Headers} [headers] Response headers.
 * @returns {number | undefined} Delay in milliseconds, between `0` and {@link MAX_RETRY_DELAY}, or
 * `undefined` if the request is not to be retried now.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After
 * @see https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#exceeding-the-rate-limit
 */
export const getRetryDelay = (status, headers) => {
  const value = headers?.get('Retry-After')?.trim();

  if (value) {
    const delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now();

    if (!Number.isNaN(delay)) {
      return delay > MAX_RETRY_DELAY ? undefined : Math.max(delay, 0);
    }
  }

  return status === 429 ? undefined : DEFAULT_RETRY_DELAY;
};

/**
 * Send a request with `fetch()`, taking the same arguments, and make sure the response status is
 * OK.
 * @param {Parameters<typeof fetch>} args Resource and request options.
 * @returns {Promise<Response>} Response.
 * @throws {Error} When the request fails, or the response status is not OK.
 */
export const fetchOK = async (...args) => {
  const response = await fetch(...args);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response;
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
 * @param {number} [options.retries] Number of remaining retries for transient server errors.
 * Defaults to `1`. Used internally for recursive retries.
 * @param {boolean} [options.retryable] Whether the request can be sent again after a transient
 * error. The default is `true` for a request without side effects, as determined by
 * {@link isRetryableRequest}. A request that writes data can opt in when the server refuses a
 * repeat of a request that has already taken effect, like a commit guarded by the expected head.
 * @returns {Promise<object | string | Blob | Response>} Response data or `Response` itself,
 * depending on the `responseType` option.
 * @throws {Error} When there was an error in the request or response.
 */
export const sendRequest = async (
  url,
  init = {},
  {
    responseType = 'json',
    refreshAccessToken = undefined,
    retries = 1,
    retryable = isRetryableRequest(init),
  } = {},
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
    return sendRequest(url, init, { responseType, retryable });
  };

  // A transient error that may succeed on retry: 502 Bad Gateway, which the GitHub GraphQL API is
  // known to occasionally answer with, and, for a request without side effects only, a rate limit
  // or a self-hosted instance under load
  // @see https://github.com/sveltia/sveltia-cms/issues/695
  const retryDelay =
    retries > 0 &&
    retryable &&
    (status === 502 || (TRANSIENT_STATUSES.includes(status) && isRetryableRequest(init)))
      ? getRetryDelay(status, response.headers)
      : undefined;

  const shouldRetry = retryDelay !== undefined;

  /**
   * Send the request again after the delay the server asks for, or a short one.
   * @returns {Promise<object | string | Blob | Response>} Response data or `Response` itself.
   */
  const retryAfterDelay = async () => {
    await sleep(/** @type {number} */ (retryDelay));

    return sendRequest(url, init, {
      responseType,
      refreshAccessToken,
      retries: retries - 1,
      retryable,
    });
  };

  // A raw response is returned as is for the caller to check the status, but a transient error is
  // still retried and an expired token refreshed, the same as for the other response types
  if (responseType === 'raw') {
    if (shouldRetry) {
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

  if (shouldRetry) {
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

/**
 * Throw an error with the response body appended to the given message if the request failed.
 * @param {Response} response Response.
 * @param {string} message Error message, such as `Failed to list objects`.
 * @param {object} [options] Options.
 * @param {boolean} [options.allowNotFound] Whether to accept a `404 Not Found` response.
 * @returns {Promise<void>}
 * @throws {Error} When the response status is not OK.
 */
export const assertResponseOK = async (response, message, { allowNotFound = false } = {}) => {
  if (!response.ok && !(allowNotFound && response.status === 404)) {
    const errorText = await response.text();

    throw new Error(`${message}: ${errorText}`);
  }
};
