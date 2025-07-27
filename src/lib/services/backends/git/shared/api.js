import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { user } from '$lib/services/user';
import { sendRequest } from '$lib/services/utils/networking';

/**
 * @import { ApiEndpointConfig, AuthTokens, FetchApiOptions } from '$lib/types/private';
 */

/**
 * Placeholder for API configuration information.
 * @type {ApiEndpointConfig}
 */
const API_CONFIG_INFO_PLACEHOLDER = {
  clientId: '',
  authURL: '',
  tokenURL: '',
  authScheme: 'token',
  origin: '',
  restBaseURL: '',
  graphqlBaseURL: '',
};

/**
 * Configuration for API endpoints.
 * @type {ApiEndpointConfig}
 */
export const apiConfig = { ...API_CONFIG_INFO_PLACEHOLDER };

/**
 * Variables to be used in GraphQL queries.
 * @type {Record<string, any>}
 */
export const graphqlVars = {};

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
 * Send a request to the REST or GraphQL API of a Git-based service with authentication. This
 * function is a wrapper around {@link sendRequest} that automatically adds the `Authorization`
 * header with the OAuth access token. It also handles the case where the access token needs to be
 * refreshed when the request fails with a 401 Unauthorized status.
 * @param {string} path API endpoint path.
 * @param {FetchApiOptions} [options] Fetch options.
 * @returns {Promise<object | string | Blob | Response>} Response data or `Response` itself,
 * depending on the `responseType` option.
 * @throws {Error} When there was an error in the API request, e.g. OAuth app access restrictions.
 * @see https://docs.github.com/en/rest
 * @see https://docs.gitlab.com/api/rest/
 * @see https://gitea.com/api/swagger
 * @see https://codeberg.org/api/swagger
 */
export const fetchAPI = async (
  path,
  {
    method = 'GET',
    headers = {},
    body = null,
    responseType = 'json',
    token = undefined,
    refreshToken = undefined,
  } = {},
) => {
  const { clientId, tokenURL, restBaseURL, graphqlBaseURL, authScheme = 'token' } = apiConfig;
  const _user = get(user);
  const isGraphQL = path === '/graphql';
  const baseURL = isGraphQL ? graphqlBaseURL : restBaseURL;

  token ??= _user?.token;
  refreshToken ??= _user?.refreshToken;
  headers.Authorization = `${authScheme} ${token}`;

  return sendRequest(
    `${baseURL}${path}`,
    { method, headers, body },
    {
      responseType,
      refreshAccessToken: refreshToken
        ? () => refreshAccessToken({ clientId, tokenURL, refreshToken })
        : undefined,
    },
  );
};

/**
 * Send a request to the GraphQL API of a Git-based service. This function is a wrapper around
 * {@link fetchAPI} and automatically applies the common variables defined in {@link graphqlVars} to
 * the query. Variables can also be passed as an argument to override the defaults.
 * @param {string} query Query string.
 * @param {Record<string, any>} [variables] Any variable to be applied.
 * @returns {Promise<Record<string, any>>} Response data.
 * @see https://docs.github.com/en/graphql
 * @see https://docs.gitlab.com/api/graphql/
 */
export const fetchGraphQL = async (query, variables = {}) => {
  // Normalize the query by removing line breaks and subsequent space characters. We must be careful
  // as file paths may contain spaces.
  query = query.replace(/\n\s*/g, ' ');

  // Apply common variables defined in `graphqlVars` to the query
  Object.entries(graphqlVars).forEach(([key, value]) => {
    if (query.includes(`$${key}`)) {
      variables[key] ??= value;
    }
  });

  // Extract `data` from the response
  const { data } = await /** @type {Promise<{ data: Record<string, any> }>} */ (
    fetchAPI('/graphql', { method: 'POST', body: { query, variables } })
  );

  return data;
};
