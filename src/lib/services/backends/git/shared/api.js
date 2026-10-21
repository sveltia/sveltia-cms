import { _ } from '@sveltia/i18n';
import { LocalStorage } from '@sveltia/utils/storage';

import { user } from '$lib/services/user/account.svelte';
import { USER_STORAGE_KEY } from '$lib/services/user/constants';
import { isSecureURL, sendRequest } from '$lib/services/utils/networking';
import { isNonEmptyString } from '$lib/services/utils/string';

/**
 * @import { ApiEndpointConfig, AuthTokens, FetchApiOptions, User } from '$lib/types/private';
 */

/**
 * Placeholder for API configuration information.
 * @type {ApiEndpointConfig}
 */
const API_CONFIG_INFO_PLACEHOLDER = {
  clientId: '',
  authScope: '',
  authURL: '',
  tokenURL: '',
  authScheme: 'token',
  restBaseURL: '',
  graphqlBaseURL: '',
  includeCredentials: false,
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
 * Send a request to an OAuth token endpoint.
 * @param {string} tokenURL OAuth token request URL.
 * @param {Record<string, string>} body Request parameters, including the `grant_type`.
 * @param {object} [options] Options.
 * @param {boolean} [options.includeCredentials] Whether to send cookies with the request.
 * @returns {Promise<Response | undefined>} Response, or `undefined` if the URL isn’t secure or the
 * request couldn’t be sent at all.
 */
export const requestAccessToken = async (tokenURL, body, { includeCredentials = false } = {}) => {
  if (!isSecureURL(tokenURL)) {
    return undefined;
  }

  try {
    return await fetch(tokenURL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      ...(includeCredentials && { credentials: 'include' }),
    });
  } catch {
    return undefined;
  }
};

/**
 * Token refreshes in progress, keyed by the refresh token they use.
 * @type {Map<string, Promise<AuthTokens>>}
 */
const pendingRefreshes = new Map();

/**
 * Send a request to refresh the OAuth access token.
 * @param {object} args Arguments.
 * @param {string} args.clientId OAuth application ID.
 * @param {string} args.tokenURL OAuth token request URL.
 * @param {string} args.refreshToken OAuth refresh token.
 * @returns {Promise<AuthTokens>} New access token and refresh token.
 */
const requestTokenRefresh = async ({ clientId, tokenURL, refreshToken }) => {
  const response = await requestAccessToken(
    tokenURL,
    { grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken },
    { includeCredentials: apiConfig.includeCredentials },
  );

  if (!response?.ok) {
    throw new Error(_('sign_in_error.TOKEN_REFRESH_FAILED'));
  }

  /** @type {Record<string, any> | undefined} */
  let result;

  try {
    result = await response.json();
  } catch {
    //
  }

  // Some services, e.g. GitHub, report a failed refresh with `200 OK` and an `error` property, so
  // the session mustn’t be overwritten unless a new access token came back
  if (!isNonEmptyString(result?.access_token)) {
    throw new Error(_('sign_in_error.TOKEN_REFRESH_FAILED'));
  }

  const token = /** @type {string} */ (result?.access_token);

  // A service that doesn’t rotate refresh tokens doesn’t return a new one
  if (isNonEmptyString(result?.refresh_token)) {
    refreshToken = result?.refresh_token;
  }

  // Update the user store with the new token and refresh token
  if (user.account) {
    user.account = { ...user.account, token, refreshToken };

    // Store them right away, before the lock is released, rather than waiting for the store to be
    // saved, so another tab whose token has expired as well takes them instead of refreshing with
    // the old refresh token, which a service like GitLab revokes once it’s used
    try {
      await LocalStorage.set(USER_STORAGE_KEY, user.account);
    } catch {
      //
    }
  }

  return { token, refreshToken };
};

/**
 * Refresh the OAuth access token using the refresh token. Requests failing at the same time share a
 * single refresh, as a refresh token may only be used once, e.g. with a GitHub App or Gitea, and
 * each of them refreshing on its own would make all but the first fail.
 * @param {object} args Arguments.
 * @param {string} args.clientId OAuth application ID.
 * @param {string} args.tokenURL OAuth token request URL.
 * @param {string} args.refreshToken OAuth refresh token.
 * @returns {Promise<AuthTokens>} New access token and refresh token.
 */
export const refreshAccessToken = ({ clientId, tokenURL, refreshToken }) => {
  let promise = pendingRefreshes.get(refreshToken);

  if (!promise) {
    promise = requestTokenRefresh({ clientId, tokenURL, refreshToken }).finally(() => {
      pendingRefreshes.delete(refreshToken);
    });
    pendingRefreshes.set(refreshToken, promise);
  }

  return promise;
};

/**
 * Name of the Web Lock held while refreshing the OAuth access token, shared by all the tabs.
 */
const TOKEN_REFRESH_LOCK_NAME = 'sveltia-cms.token-refresh';

/**
 * Run a function while holding the token refresh lock, so only one tab at a time refreshes the
 * token, as a refresh token may only be used once. Without the Web Locks API, the function simply
 * runs.
 * @template T
 * @param {() => Promise<T>} func Function to run.
 * @returns {Promise<T>} Result of the function.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API
 */
const withTokenRefreshLock = (func) => {
  const locks = globalThis.navigator?.locks;

  return locks ? locks.request(TOKEN_REFRESH_LOCK_NAME, func) : func();
};

/**
 * Get the tokens of a stored user if it’s the same account as the current user.
 * @param {any} storedUser User stored by any tab.
 * @returns {AuthTokens | undefined} Tokens, or `undefined` if the stored user is another account,
 * has no refresh token while the current user has one, or no one is signed in.
 */
const getStoredTokens = (storedUser) => {
  const { account } = user;

  const refreshToken = isNonEmptyString(storedUser?.refreshToken)
    ? storedUser.refreshToken
    : undefined;

  if (
    !account ||
    !isNonEmptyString(storedUser?.token) ||
    storedUser.backendName !== account.backendName ||
    storedUser.id !== account.id ||
    // Don’t lose the refresh token
    (!!account.refreshToken && !refreshToken)
  ) {
    return undefined;
  }

  return { token: storedUser.token, refreshToken };
};

/**
 * Read the tokens of the current user from the storage, where another tab may have saved the ones
 * it has refreshed.
 * @returns {Promise<AuthTokens | undefined>} Tokens, or `undefined` if the stored user is another
 * account, or the storage can’t be read.
 */
const readStoredTokens = async () => {
  try {
    return getStoredTokens(await LocalStorage.get(USER_STORAGE_KEY));
  } catch {
    return undefined;
  }
};

/**
 * Check whether the given tokens have replaced the ones a request was sent with: another request,
 * or another tab, has refreshed them meanwhile, which replaces both.
 * @param {Partial<AuthTokens> | undefined} tokens Current tokens, if any.
 * @param {object} sent Tokens the request was sent with.
 * @param {string | undefined} sent.token OAuth access token.
 * @param {string | undefined} sent.refreshToken OAuth refresh token.
 * @returns {tokens is AuthTokens} Result.
 */
export const isRefreshedElsewhere = (tokens, { token, refreshToken }) =>
  !!tokens?.token && tokens.token !== token && tokens.refreshToken !== refreshToken;

/**
 * Take the tokens another tab has refreshed as soon as it stores them, so this tab doesn’t keep
 * using the old ones, which may have been revoked, or later write them back over the new ones.
 * @param {StorageEvent} event `storage` event.
 */
const onUserStorageChange = ({ key, newValue }) => {
  if (key !== USER_STORAGE_KEY || !newValue) {
    return;
  }

  /** @type {any} */
  let storedUser;

  try {
    storedUser = JSON.parse(newValue);
  } catch {
    return;
  }

  const tokens = getStoredTokens(storedUser);
  // The account is there if the tokens are
  const { account } = /** @type {{ account: User }} */ (user);

  if (tokens && (tokens.token !== account.token || tokens.refreshToken !== account.refreshToken)) {
    user.account = { ...account, ...tokens };
  }
};

globalThis.addEventListener?.('storage', onUserStorageChange);

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
    isGraphQL = false,
    responseType = 'json',
    token = undefined,
    refreshToken = undefined,
  } = {},
) => {
  const {
    clientId,
    tokenURL,
    restBaseURL,
    graphqlBaseURL,
    authScheme = 'token',
    includeCredentials,
  } = apiConfig;

  const _user = user.account;
  const baseURL = isGraphQL ? graphqlBaseURL : restBaseURL;

  token ??= _user?.token;
  refreshToken ??= _user?.refreshToken;
  headers.Authorization = `${authScheme} ${token}`;

  // Whether the request is sent with the current user’s tokens, rather than with ones being signed
  // in with, while the user store may still hold a previous session of another account
  const isUserToken = !!_user && token === _user.token && refreshToken === _user.refreshToken;

  return sendRequest(
    `${baseURL}${path}`,
    {
      method,
      headers,
      body,
      ...(includeCredentials && { credentials: 'include' }),
    },
    {
      responseType,
      refreshAccessToken: refreshToken
        ? () =>
            withTokenRefreshLock(async () => {
              if (isUserToken) {
                const { account } = user;

                // Another request has refreshed the token since this one was sent, which used up
                // the refresh token if it’s single-use, so take the new token instead of refreshing
                // again
                if (account && isRefreshedElsewhere(account, { token, refreshToken })) {
                  return { token: account.token, refreshToken: account.refreshToken };
                }

                // The same goes for another tab, which stores the tokens it has refreshed
                const stored = await readStoredTokens();

                if (stored && isRefreshedElsewhere(stored, { token, refreshToken })) {
                  user.account = { .../** @type {User} */ (user.account), ...stored };

                  return stored;
                }
              }

              return refreshAccessToken({ clientId, tokenURL, refreshToken });
            })
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
    fetchAPI('', { method: 'POST', body: { query, variables }, isGraphQL: true })
  );

  return data;
};
