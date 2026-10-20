import { _ } from '@sveltia/i18n';
import { generateRandomId, generateUUID, getHash } from '@sveltia/utils/crypto';
import { isObject } from '@sveltia/utils/object';
import { LocalStorage } from '@sveltia/utils/storage';

import {
  requestAccessToken,
  apiConfig as sharedApiConfig,
} from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';
import { USER_STORAGE_KEY } from '$lib/services/user/constants';
import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import {
 * ApiEndpointConfig,
 * AuthTokens,
 * InternalCmsConfig,
 * SignInOptions,
 * User,
 * } from '$lib/types/private';
 * @import { GitBackend } from '$lib/types/public';
 */

/**
 * Whether the app is running in the authentication popup window.
 */
export const inAuthPopup = createRawState(false);

/**
 * Function that cancels the pending authentication, so the user can get out of a sign-in whose
 * popup was closed without the app noticing, or `undefined` if no popup is pending.
 * @type {{ current: (() => void) | undefined }}
 */
export const cancelAuthorization = createRawState();

/**
 * Local storage key for the temporary secrets of the client-side Authorization Code Flow.
 */
const AUTH_SECRETS_STORAGE_KEY = 'sveltia-cms.auth';
/**
 * Session storage key under which the auth popup keeps the `state` of its flow, so it can still
 * recognize itself when it comes back without a window opener and window name. See
 * {@link isAuthPopup}.
 */
const AUTH_POPUP_STORAGE_KEY = 'sveltia-cms.auth-popup';
/**
 * Get the name of the `BroadcastChannel` that carries the result of a client-side flow from the
 * auth popup to the window that opened it, when the two have been severed. The name is tied to the
 * flow’s `state`, so another flow, or a window that doesn’t know the `state`, can’t take part.
 * @param {string} state Authorization state, which is the CSRF token of the flow.
 * @returns {string} Channel name.
 */
const getAuthChannelName = (state) => `sveltia-cms.auth.${state}`;

/**
 * Get the flow `state` stored in the auth popup’s session storage.
 * @returns {string | null} State, or `null` if it’s not stored or session storage is unavailable.
 */
const getAuthPopupState = () => {
  try {
    return window.sessionStorage.getItem(AUTH_POPUP_STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * Store the flow `state` in the auth popup’s session storage, or remove it.
 * @param {string} [state] State. Omit to remove it.
 */
const setAuthPopupState = (state) => {
  try {
    if (state) {
      window.sessionStorage.setItem(AUTH_POPUP_STORAGE_KEY, state);
    } else {
      window.sessionStorage.removeItem(AUTH_POPUP_STORAGE_KEY);
    }
  } catch {
    //
  }
};

/**
 * Remove the temporary secrets of the client-side flow, as the flow is over.
 */
const clearAuthSecrets = async () => {
  setAuthPopupState();
  await LocalStorage.delete(AUTH_SECRETS_STORAGE_KEY);
};

/**
 * Create the error thrown when the user closes the authentication popup, which callers tell apart
 * from a failure by its name.
 * @returns {Error} Error.
 */
const createAbortError = () =>
  Object.assign(new Error('Authentication aborted'), { name: 'AbortError' });

/**
 * Open a popup window for authentication.
 * @param {object} args Arguments.
 * @param {string} args.authURL Authentication site URL.
 * @returns {Window | null} Popup window object or `null` if the popup could not be opened.
 */
export const openPopup = ({ authURL }) => {
  const width = 600;
  const height = 800;
  const { availHeight, availWidth } = window.screen;
  const top = availHeight / 2 - height / 2;
  const left = availWidth / 2 - width / 2;

  return window.open(authURL, 'auth', `width=${width},height=${height},top=${top},left=${left}`);
};

/**
 * Authenticate with a Git service provider through Netlify Identity or other 3rd party OAuth client
 * specified with the configuration file.
 * @param {object} args Arguments.
 * @param {string} args.backendName Backend name, e.g. `github`.
 * @param {string} args.authURL Authentication site URL.
 * @param {Window | null} [args.popup] Optional pre-opened popup window. If not provided, a new
 * popup will be opened.
 * @param {string} [args.state] Authorization state of a client-side flow. If provided, the result
 * is also accepted over the flow’s `BroadcastChannel`, for when the popup comes back without a
 * window opener.
 * @returns {Promise<AuthTokens>} Auth access token and refresh token.
 * @throws {Error} When authentication failed or the popup window is closed before the auth process
 * is complete.
 * @see https://decapcms.org/docs/backends-overview/
 * @see https://sveltiacms.app/en/docs/backends
 */
export const authorize = async ({ backendName, authURL, popup, state }) => {
  const authPopup = popup ?? openPopup({ authURL });

  // Without a popup, there’s no window the result could come from
  if (!authPopup) {
    throw createAbortError();
  }

  return new Promise((resolve, reject) => {
    // Detaches the `message` listener below. Every exit path aborts it, including the one where the
    // user closes the popup: otherwise each cancelled sign-in would leave a listener — and the
    // popup and promise callbacks it captures — attached to the window for the rest of the session.
    const controller = new AbortController();
    const provider = backendName;
    /**
     * Channel the popup sends the result over when it comes back without a window opener: GitLab’s
     * sign-in page is served with `Cross-Origin-Opener-Policy: same-origin`, which severs the popup
     * from this window, so neither window can post a message to the other any more.
     */
    const channel = state ? new BroadcastChannel(getAuthChannelName(state)) : undefined;
    /**
     * Timer to check if the popup is closed.
     * @type {ReturnType<typeof setInterval> | undefined}
     */
    let timer;

    /**
     * Stop listening for the result.
     */
    const cleanUp = () => {
      controller.abort();
      clearInterval(timer);
      channel?.close();
      cancelAuthorization.current = undefined;
    };

    /**
     * Give up on the authentication, because the popup was closed or the user cancelled it.
     */
    const cancel = () => {
      cleanUp();
      authPopup.close();
      reject(createAbortError());
    };

    // The timer doesn’t work with GitLab: the same header makes `closed` `true` while the popup is
    // still open. The user can cancel the sign-in instead
    if (backendName === 'github' || backendName === 'gitea') {
      timer = setInterval(() => {
        if (authPopup.closed) {
          cancel();
        }
      }, 1000);
    }

    /**
     * Settle the promise with the result sent by the popup.
     * @param {string} data Message in the `authorization:{provider}:{status}:{result}` format.
     */
    const handleResult = (data) => {
      const { result: resultStr } =
        data.match(`^authorization:${provider}:(success|error):(?<result>.+)`)?.groups ?? {};

      /**
       * @type {{ token: string, refreshToken?: string } | { error: string, errorCode?: string }}
       */
      let result;

      try {
        result = resultStr ? JSON.parse(resultStr) : { error: 'No data' };

        if (!isObject(result)) {
          result = { error: 'Malformed data' };
        }
      } catch {
        result = { error: 'Malformed data' };
      }

      if ('token' in result) {
        resolve(result);
      } else {
        reject(
          new Error('Authentication failed', {
            cause: new Error(
              result.errorCode
                ? _(`sign_in_error.${result.errorCode}`, { default: result.error })
                : result.error,
            ),
          }),
        );
      }

      cleanUp();
      authPopup.close();
    };

    /**
     * Message event handler. Only messages from the popup itself are handled, so another window,
     * even on the same origin, can neither take part in the handshake nor inject a token.
     * @param {object} args Arguments.
     * @param {string} args.origin Origin URL.
     * @param {string} args.data Passed data.
     * @param {MessageEventSource | null} args.source Window that sent the message.
     */
    const handler = ({ origin, data, source }) => {
      if (source !== authPopup || origin !== new URL(authURL).origin || typeof data !== 'string') {
        return;
      }

      // First message
      if (data === `authorizing:${provider}`) {
        authPopup.postMessage(data, origin);

        return;
      }

      // Second message
      handleResult(data);
    };

    window.addEventListener('message', handler, { signal: controller.signal });

    if (channel) {
      /**
       * Channel message handler. There’s no handshake here: only a window that knows the `state`
       * can post to the channel.
       * @param {MessageEvent} event Event.
       */
      channel.onmessage = ({ data }) => {
        if (typeof data === 'string') {
          handleResult(data);
        }
      };
    }

    cancelAuthorization.current = cancel;
  });
};

/**
 * Initialize the server-side Authorization Code Flow.
 * @param {object} args Arguments.
 * @param {string} args.backendName Backend name, e.g. `github`.
 * @param {string | undefined} args.siteDomain Domain of the site hosting the CMS. Could be
 * `undefined` if the `site_domain` option is not specified in the backend configuration.
 * @param {string} args.authURL Authorization site URL.
 * @param {string} args.scope Authorization scope.
 * @returns {Promise<AuthTokens>} Auth access token and refresh token.
 */
export const initServerSideAuth = async ({ backendName, siteDomain, authURL, scope }) => {
  const { hostname } = window.location;

  // If the site domain is not specified, use the current hostname. If the hostname is `localhost`,
  // use `cms.netlify.com` as the default site domain.
  // @see https://decapcms.org/docs/backends-overview/
  siteDomain ??= hostname === 'localhost' ? 'cms.netlify.com' : hostname;

  try {
    // `siteDomain` may contain non-ASCII characters. When authenticating with Netlify, such
    // internationalized domain names (IDNs) must be written in Punycode. Use `URL` for conversion,
    // e.g `日本語.jp` -> `xn--wgv71a119e.jp`
    if (new URL(authURL).origin === 'https://api.netlify.com') {
      siteDomain = new URL(`https://${siteDomain}`).hostname;
    }
  } catch {
    //
  }

  const params = new URLSearchParams({
    provider: backendName,
    site_id: siteDomain,
    scope,
  });

  return authorize({
    backendName,
    authURL: `${authURL}?${params}`,
  });
};

/**
 * Create a code verifier and challenge for PKCE auth along with a CSRF token.
 * @returns {Promise<{ csrfToken: string, codeVerifier: string, codeChallenge: string}>} Secrets.
 * @see https://stackoverflow.com/questions/63309409/creating-a-code-verifier-and-challenge-for-pkce-auth-on-spotify-api-in-reactjs
 */
export const createAuthSecrets = async () => {
  const codeVerifier = `${generateRandomId()}${generateRandomId()}`;

  const codeChallenge = btoa(
    await getHash(codeVerifier, { algorithm: 'SHA-256', format: 'binary' }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return {
    csrfToken: generateUUID().replaceAll('-', ''),
    codeVerifier,
    codeChallenge,
  };
};

/**
 * Initialize the client-side Authorization Code Flow with PKCE.
 * @param {object} args Arguments.
 * @param {string} args.backendName Backend name, e.g. `gitlab`.
 * @param {string} args.clientId OAuth application ID.
 * @param {string} args.authURL Authorization site URL.
 * @param {string} args.scope Authorization scope.
 * @returns {Promise<AuthTokens>} Auth access token and refresh token.
 * @see https://docs.gitlab.com/ee/api/oauth2.html#authorization-code-with-proof-key-for-code-exchange-pkce
 */
export const initClientSideAuth = async ({ backendName, clientId, authURL, scope }) => {
  const { origin, pathname } = window.location;
  const redirectURL = `${origin}${pathname}`;
  // Open the popup immediately to prevent Safari from blocking it. Safari blocks popups that aren’t
  // opened synchronously from a user interaction.
  const popup = openPopup({ authURL: redirectURL });

  if (!popup) {
    throw createAbortError();
  }

  // Perform async operations after opening the popup
  const { csrfToken, codeVerifier, codeChallenge } = await createAuthSecrets();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectURL,
    response_type: 'code',
    state: csrfToken,
    scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  // Store the temporary secret and real auth URL
  await LocalStorage.set(AUTH_SECRETS_STORAGE_KEY, {
    csrfToken,
    codeVerifier,
    realAuthURL: `${authURL}?${params}`,
  });

  // Store the user info only with the backend name, so the automatic sign-in flow that triggers
  // `finishClientSideAuth` below will work
  await LocalStorage.set(USER_STORAGE_KEY, { backendName });

  // Check if the popup was closed while we were doing async operations
  if (popup.closed) {
    throw createAbortError();
  }

  try {
    return await authorize({ backendName, authURL: redirectURL, popup, state: csrfToken });
  } catch (ex) {
    // The popup may still be open if it was severed from this window, so make sure it can’t finish
    // the flow the user has given up on
    await LocalStorage.delete(AUTH_SECRETS_STORAGE_KEY);

    throw ex;
  }
};

/**
 * Communicate with the window opener as part of {@link finishClientSideAuth}. If the popup has no
 * opener because it was severed from it, the result is sent over the flow’s `BroadcastChannel`
 * instead, and the popup closes itself, as the opener can no longer close it.
 * @param {object} args Options.
 * @param {string} [args.provider] Backend name, e,g. `github`.
 * @param {string} [args.state] Authorization state of the flow, which names the channel. Tokens
 * must only be sent once the state has been verified.
 * @param {string} [args.token] OAuth access token.
 * @param {string} [args.refreshToken] OAuth refresh token.
 * @param {string} [args.error] Error message when an OAuth token is not available.
 * @param {string} [args.errorCode] Error code to be used to localize the error message in Sveltia
 * CMS.
 */
export const sendMessage = ({
  provider = 'unknown',
  state,
  token,
  refreshToken,
  error,
  errorCode,
}) => {
  const _state = error ? 'error' : 'success';
  const content = error ? { provider, error, errorCode } : { provider, token, refreshToken };

  if (!window.opener) {
    if (state) {
      const channel = new BroadcastChannel(getAuthChannelName(state));

      channel.postMessage(`authorization:${provider}:${_state}:${JSON.stringify(content)}`);
      channel.close();
      window.close();
    }

    return;
  }

  /**
   * Listener for messages from the window opener. The tokens are only sent back to the opener, and
   * only when it’s on the same origin as this popup, so no other window holding a reference to the
   * popup can obtain them by starting the handshake.
   * @param {MessageEvent} event Event.
   */
  const onMessage = ({ data, origin, source }) => {
    if (
      source === window.opener &&
      origin === window.location.origin &&
      data === `authorizing:${provider}`
    ) {
      window.opener?.postMessage(
        `authorization:${provider}:${_state}:${JSON.stringify(content)}`,
        origin,
      );
      // The handshake is complete; remove the listener so repeated auth flows don’t accumulate.
      window.removeEventListener('message', onMessage);
    }
  };

  window.addEventListener('message', onMessage);
  window.opener?.postMessage(`authorizing:${provider}`, window.location.origin);
};

/**
 * Complete the client-side Authorization Code Flow with PKCE by retrieving an access token and
 * passing it to the window opener. This code is to be called within the auth popup window and
 * basically does the same thing as the callback handler of Sveltia CMS Authenticator.
 * @param {object} args Arguments.
 * @param {string} args.backendName Backend name, e.g. `gitlab`.
 * @param {ApiEndpointConfig} args.apiConfig API endpoint configuration.
 * @param {string} args.code Authorization code.
 * @param {string} args.state Authorization state, which is a CSRF token previously set.
 * @returns {Promise<void>} None.
 * @see https://docs.gitlab.com/ee/api/oauth2.html#authorization-code-with-proof-key-for-code-exchange-pkce
 * @see https://github.com/sveltia/sveltia-cms-auth/blob/main/src/index.js
 */
export const finishClientSideAuth = async ({ backendName, apiConfig, code, state }) => {
  const { clientId, tokenURL, includeCredentials = false } = apiConfig;
  const { origin, pathname } = new URL(window.location.href);
  const { csrfToken, codeVerifier } = (await LocalStorage.get(AUTH_SECRETS_STORAGE_KEY)) ?? {};
  const provider = backendName;
  const redirectURL = `${origin}${pathname}`;

  // Remove the temporary secret
  await clearAuthSecrets();

  if (!csrfToken || !codeVerifier || state !== csrfToken) {
    return sendMessage({
      provider,
      state,
      error: _('sign_in_error.CSRF_DETECTED'),
      errorCode: 'CSRF_DETECTED',
    });
  }

  let token = '';
  let refreshToken = '';
  let error = '';

  const response = await requestAccessToken(
    tokenURL,
    {
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectURL,
      code_verifier: codeVerifier,
    },
    { includeCredentials },
  );

  if (!response) {
    return sendMessage({
      provider,
      state,
      error: _('sign_in_error.TOKEN_REQUEST_FAILED'),
      errorCode: 'TOKEN_REQUEST_FAILED',
    });
  }

  try {
    ({ access_token: token, refresh_token: refreshToken, error } = await response.json());
  } catch {
    return sendMessage({
      provider,
      state,
      error: _('sign_in_error.MALFORMED_RESPONSE'),
      errorCode: 'MALFORMED_RESPONSE',
    });
  }

  return sendMessage({ provider, state, token, refreshToken, error });
};

/**
 * Handle the client-side Authorization Code Flow with PKCE within the auth popup window. Redirect
 * to the authorization site or finish the flow after being redirected from the auth site.
 * @param {object} args Arguments.
 * @param {string} args.backendName Backend name, e.g. `gitlab`.
 * @param {ApiEndpointConfig} args.apiConfig API endpoint configuration.
 */
export const handleClientSideAuthPopup = async ({ backendName, apiConfig }) => {
  inAuthPopup.current = true;

  const { search } = window.location;

  const {
    code,
    state,
    error,
    error_description: errorDescription,
  } = Object.fromEntries(new URLSearchParams(search));

  if (code && state) {
    await finishClientSideAuth({ backendName, apiConfig, code, state });
  } else if (error) {
    // The user denied access, or the authorization failed, e.g. `?error=access_denied&state=…`.
    // Report it to the opener, which would otherwise wait forever, instead of showing the
    // authorization page again, and remove the temporary secret as the flow is over
    await clearAuthSecrets();

    sendMessage({
      provider: backendName,
      state,
      error: errorDescription || error,
      errorCode: 'AUTH_CODE_REQUEST_FAILED',
    });
  } else {
    const { csrfToken, realAuthURL } = (await LocalStorage.get(AUTH_SECRETS_STORAGE_KEY)) ?? {};

    if (realAuthURL) {
      // Remember the flow, as the popup may come back from the authorization site without a window
      // opener and window name
      setAuthPopupState(csrfToken);
      window.location.href = realAuthURL;
    }
  }
};

/**
 * Check whether the app is running in the authentication popup window opened by
 * {@link initClientSideAuth}.
 *
 * A page served with `Cross-Origin-Opener-Policy: same-origin`, like GitLab’s sign-in page, severs
 * the popup from its opener, and Chromium also clears the window name, so the popup comes back to
 * the redirect URL without either. It then recognizes itself by the flow `state` it stored in its
 * session storage before leaving for the authorization site: session storage belongs to the tab,
 * so another tab, even one opened with the callback URL, can’t be mistaken for the popup.
 * @returns {boolean} Result.
 */
const isAuthPopup = () => {
  try {
    if (window.opener) {
      return window.opener.origin === window.location.origin && window.name === 'auth';
    }
  } catch {
    // Reading the origin of a cross-origin opener, e.g. a page linking to the CMS that opened it in
    // a new tab, throws a `SecurityError`, which would otherwise make every sign-in fail
    return false;
  }

  const state = new URLSearchParams(window.location.search).get('state');

  return !!state && state === getAuthPopupState();
};

/**
 * Handle the authentication flow for a Git service provider. This function decides whether to
 * initiate a client-side or server-side authentication flow based on the configured backend name
 * and authentication type.
 * @param {object} args Arguments.
 * @param {boolean} args.auto Whether the sign-in process is automatic.
 * @param {ApiEndpointConfig} args.apiConfig API endpoint configuration.
 * @returns {Promise<AuthTokens | undefined>} Auth access token and refresh token, or `undefined` if
 * the sign-in process is automatic or the flow is being done in a popup window.
 */
export const handleAuthFlow = async ({ auto, apiConfig }) => {
  const { backend } = /** @type {InternalCmsConfig} */ (cmsConfig.current);

  const {
    name: backendName,
    site_domain: siteDomain,
    // @ts-ignore Gitea backend doesn’t have the property
    auth_type: authType,
  } = /** @type {GitBackend} */ (backend);

  const { clientId, authScope, authURL } = apiConfig;
  const authArgs = { backendName, authURL, scope: authScope };

  // Gitea/Forgejo backend only supports PKCE at this time
  if (backendName === 'gitea' || authType === 'pkce') {
    const inPopup = isAuthPopup();

    if (inPopup) {
      // We are in the auth popup window; let’s get the OAuth flow done
      await handleClientSideAuthPopup({ backendName, apiConfig });
    }

    if (inPopup || auto) {
      return undefined;
    }

    return initClientSideAuth({ ...authArgs, clientId });
  }

  if (auto) {
    return undefined;
  }

  return initServerSideAuth({ ...authArgs, siteDomain });
};

/**
 * Get OAuth tokens by handling the authentication flow if necessary.
 * @param {object} args Arguments.
 * @param {SignInOptions} args.options Options.
 * @param {ApiEndpointConfig} args.apiConfig API endpoint configuration.
 * @returns {Promise<AuthTokens | undefined>} Auth access token and refresh token, or `undefined` if
 * the sign-in process is automatic or the flow is being done in a popup window.
 */
export const getTokens = async ({ options: { token, refreshToken, auto = false }, apiConfig }) => {
  if (!token) {
    const result = await handleAuthFlow({ auto, apiConfig });

    if (!result) {
      return undefined;
    }

    ({ token, refreshToken } = result);
  }

  return { token, refreshToken };
};

/**
 * Sign in with a backend’s REST API: the tokens are obtained by running the authentication flow if
 * necessary, then the user profile is fetched with the backend-specific function.
 * @param {object} args Arguments.
 * @param {SignInOptions} args.options Options.
 * @param {(tokens: AuthTokens) => Promise<User>} args.getUserProfile Function to retrieve the
 * authenticated user’s profile information from the backend’s REST API.
 * @returns {Promise<User | void>} User info, or nothing when finishing PKCE auth flow in a popup or
 * the sign-in flow cannot be started.
 * @throws {Error} When there was an authentication error.
 */
export const signInToBackend = async ({ options, getUserProfile }) => {
  const { token, refreshToken } = (await getTokens({ options, apiConfig: sharedApiConfig })) ?? {};

  if (!token) {
    return undefined;
  }

  return getUserProfile({ token, refreshToken });
};

/**
 * Sign out from the backend. Nothing to do here.
 * @returns {Promise<void>}
 */
export const signOut = async () => undefined;
