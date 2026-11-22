import { _ } from '@sveltia/i18n';

import { getAdditionsURL } from '$lib/services/app/additions';
import { isSecureURL, sendRequest } from '$lib/services/utils/networking';

/**
 * Error codes of the Sveltia CMS Additions API that have a localized message. Other errors fall
 * back to a generic message.
 */
const LOCALIZED_ERROR_CODES = [
  'unauthenticated',
  'wrong_admin_secret',
  'admin_secret_missing',
  'admin_secret_too_short',
  'wrong_previous_secret',
  'not_an_admin',
  'invalid_username',
  'last_admin',
  'cannot_disable_self',
  'cannot_delete_self',
  'username_taken',
  'email_taken',
  'invalid_name',
  'invalid_email',
  'invalid_domains',
  'current_origin_removed',
  'forbidden',
  'invalid_credentials',
  'user_disabled',
  'too_many_attempts',
  'wrong_password',
  'same_password',
  'data_key_locked',
  'not_configured',
  'origin_not_allowed',
  'github_app_missing',
  'invalid_private_key',
  'private_key_mismatch',
  'github_error',
  'invalid_github_login',
  'github_user_not_found',
  'github_account_taken',
  'invalid_rules',
  'invalid_rule_role',
  'rule_org_not_installed',
  'not_invited',
  'method_disabled',
  'access_denied',
  'github_app_not_set_up',
  'not_set_up',
  'invalid_tenant_id',
  'invalid_tenant_name',
  'tenant_exists',
];

/**
 * Get the localized message for an error returned by the API.
 * @param {string | undefined} code Error code.
 * @returns {string} Message.
 */
export const getErrorMessage = (code) =>
  code && LOCALIZED_ERROR_CODES.includes(code)
    ? _(`additions.error.${code}`)
    : _('additions.error.unexpected');

/**
 * Send a request to the Sveltia CMS Additions API. An error carries the status and error code in
 * its `cause`, with a localized message the sign-in page shows. The request goes through
 * `sendRequest()`, which refuses to send the token over an insecure connection and sends a request
 * without side effects again after a transient error, while the API’s own error body is read here.
 * @param {string} path Path, e.g. `/v1/auth/session`.
 * @param {object} [options] Options.
 * @param {string} [options.method] HTTP method.
 * @param {Record<string, any>} [options.body] JSON body.
 * @param {string} [options.token] Session token.
 * @returns {Promise<any>} Parsed response.
 * @throws {Error} When the service can’t be reached or responds with an error.
 */
export const fetchAdditions = async (path, { method = 'GET', body, token } = {}) => {
  const url = `${getAdditionsURL()}${path}`;
  /** @type {Response} */
  let response;

  try {
    response = /** @type {Response} */ (
      await sendRequest(
        url,
        {
          method,
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          // Serialized by `sendRequest()`, which sets the content type
          ...(body ? { body: /** @type {any} */ (body) } : {}),
        },
        { responseType: 'raw' },
      )
    );
  } catch (/** @type {any} */ ex) {
    // `sendRequest()` refuses to send the token over plain HTTP, which is a configuration problem
    // rather than a network one
    const insecure = !!token && !isSecureURL(url);

    throw new Error('Sveltia CMS Additions could not be reached', {
      cause: {
        message: _(`additions.error.${insecure ? 'insecure_connection' : 'unreachable'}`),
        error: ex,
      },
    });
  }

  /** @type {any} */
  let data;

  try {
    data = await response.json();
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    const code = data?.error?.code;

    throw new Error(data?.error?.message ?? `Request failed with ${response.status}`, {
      cause: { status: response.status, code, message: getErrorMessage(code) },
    });
  }

  return data;
};

/**
 * Check that a URL the service has returned points to GitHub, before the CMS links to it or sends
 * a form there. The service only ever returns github.com pages, so anything else is refused.
 * @param {unknown} url URL.
 * @returns {url is string} Whether it’s a GitHub page.
 */
export const isGitHubURL = (url) =>
  typeof url === 'string' && URL.parse(url)?.origin === 'https://github.com';
