import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { user } from '$lib/services/user';
import { sendRequest } from '$lib/services/utils/networking';

/**
 * @import { ApiEndpointConfig, AuthTokens, FetchApiOptions } from '$lib/types/private';
 */

/**
 * Refresh the OAuth access token using the refresh token.
 * @param {object} args Arguments.
 * @param {string} args.clientId OAuth application ID.
 * @param {string} args.tokenURL OAuth token request URL.
 * @param {string} args.refreshToken OAuth refresh token.
 * @returns {Promise<AuthTokens>} New access token and refresh token.
 */
export const refreshAccessToken = async ({ clientId, tokenURL, refreshToken }) => {
  let response;
  let token = '';

  try {
    response = await fetch(tokenURL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: refreshToken,
      }),
    });
  } catch {
    //
  }

  if (!response?.ok) {
    throw new Error(get(_)('sign_in_error.TOKEN_REFRESH_FAILED'));
  }

  ({ access_token: token, refresh_token: refreshToken } = await response.json());

  // Update the user store with the new token and refresh token
  user.update((_user) => (_user ? { ..._user, token, refreshToken } : _user));

  return { token, refreshToken };
};

/**
 * Send a request to Git-based API with authentication. This function is a wrapper around
 * `sendRequest` that automatically adds the `Authorization` header with the OAuth access token. It
 * also handles the case where the access token needs to be refreshed when the request fails with a
 * 401 Unauthorized status.
 * @param {string} path API endpoint path.
 * @param {FetchApiOptions} options Fetch options.
 * @param {ApiEndpointConfig} apiConfig API configuration.
 * @returns {Promise<object | string | Blob | Response>} Response data or `Response` itself,
 * depending on the `responseType` option.
 * @throws {Error} When there was an error in the API request, e.g. OAuth app access restrictions.
 */
export const fetchAPIWithAuth = async (
  path,
  {
    method = 'GET',
    headers = {},
    body = null,
    responseType = 'json',
    token = undefined,
    refreshToken = undefined,
  },
  { clientId, tokenURL, restBaseURL, graphqlBaseURL, authScheme = 'token' },
) => {
  const _user = get(user);
  const isGraphQL = path === '/graphql';
  const baseURL = isGraphQL ? graphqlBaseURL : restBaseURL;

  token ??= _user?.token;
  refreshToken ??= _user?.refreshToken;
  headers.Authorization = `${authScheme} ${token}`;

  if (isGraphQL) {
    method = 'POST';
    // Remove line breaks and subsequent space characters; we must be careful as file paths may
    // contain spaces
    body.query = /** @type {string} */ (body.query).replace(/\n\s*/g, ' ');
  }

  const response = await sendRequest(
    `${baseURL}${path}`,
    { method, headers, body },
    {
      responseType,
      refreshAccessToken: refreshToken
        ? () => refreshAccessToken({ clientId, tokenURL, refreshToken })
        : undefined,
    },
  );

  if (isGraphQL) {
    return /** @type {{ data: object }} */ (response).data;
  }

  return response;
};
